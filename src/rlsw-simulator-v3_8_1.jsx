import boardImg from "./board.png";
import boardOutlineImg from "./board_outline.png";
import battleMeterImg from "./Battle_Meter.png";
import battlePickImg from "./battle_pick.png";
import crowdPinkImg from "./crowd_pink.png";   // fan-fare — attacker (left) cheering section
import crowdBlueImg from "./crowd_blue.png";   // fan-fare — defender (right) cheering section
// (hydraImg removed — Ronin rework)
import { SPIRIT_DEFS, SPIRIT_OPTIONS } from "./data/spirits.js";
import { CORNERS, CORNER_LABELS, CORNERS_ORDER } from "./data/corners.js";
import { HEX_SIZE, SCALE, SVG_W, SVG_H } from "./board/constants.js";
import { HEX_BY_NUM, HEX_BY_QR, ALL_HEXES } from "./board/hexMap.js";
import { pointyCorners, axialDist, axialNeighbors, getFlatTopNeighborSlots, angleTo, angleDiff, neighborInDirection, grandstandSeat, grandstandArc, grandstandRowSpan } from "./board/hexGeometry.js";
import { Tutorial } from "./tutorial/content.jsx";
import { useRiffState } from "./hooks/useRiffState.js";
import { useFanEconomy } from "./hooks/useFanEconomy.js";
import { useBgmState } from "./hooks/useBgmState.js";
import { useBoardState } from "./hooks/useBoardState.js";
import { useTransientFx } from "./hooks/useTransientFx.js";
// Phase 5c: noteStates moved into the engine — useNoteSystem retired (the client
// now reads engineState.noteStates via a setNoteStates compat shim).
import { GameOverOverlay } from "./ui/GameOverOverlay.jsx";
import { GameStyles } from "./ui/GameStyles.jsx";
import { RiffBanner } from "./ui/RiffBanner.jsx";
import { CadenceToast } from "./ui/CadenceToast.jsx";
import { BattleMeterOverlay } from "./ui/BattleMeterOverlay.jsx";
import { UpgradeModal } from "./ui/UpgradeModal.jsx";
import { SignatureAbilities } from "./ui/SignatureAbilities.jsx";
import { TestingGrounds } from "./ui/TestingGrounds.jsx";
import { EventModal } from "./ui/EventModal.jsx";
import { TRIVIA_QUESTIONS, TRIVIA_REWARD, TRIVIA_BOT_ODDS } from "./data/trivia.js";
import { Riffbook } from "./ui/Riffbook.jsx";
import { BoardFX } from "./ui/BoardFX.jsx";
import { VoiceRollDie } from "./ui/VoiceRollDie.jsx";
import { NeonStrikeFX } from "./ui/NeonStrikeFX.jsx";
import { ScoreTrackOverlay } from "./ui/ScoreTrackOverlay.jsx";
import { StatKnob } from "./ui/StatKnob.jsx";
import { ToneFader } from "./ui/ToneFader.jsx";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import React from "react";
import { BGM_TRACKS, nextBgmTrack } from "./audio/bgm.js";
import { micAvailable, startMicListening } from "./audio/micPitch.js";
import riffOffSong from "./Riff_off_song.mp3";
import battleSong  from "./battle_song.mp3";
import moshpitSong from "./Master_of_Moshpits_song.mp3";   // 🤘 Master of Moshpits cinematic
import { sonicRig, rigPoolLabel } from "./engine/systems/sonicRig.js";
import AmpDecks from "./board/ampDecks.jsx";
import { hexRingFromCenter, crowdMultiplier, advanceDB, SPOTLIGHT_POOL } from "./board/boardHelpers.js";
import { getRiffAudio, riffDegreeFreq, playRiffWrong, pickGlitchRiffNote, playRiffMiss, playBeamClash, playBeamSurge, playBeamBreak, playFanPop } from "./audio/riffSfx.js";
import { TONE_KNOB_DEFAULTS, SPIRIT_TONES, TONE_VOICE_ORDER, TONE_VOICES, getAmpBuses, playAmpNote, makeDistortionCurve } from "./audio/ampVoice.js";
import { RIFF_CONTOUR_LABELS, RIFF_ANSWER_LABELS, riffDegreesToNotes } from "./riff/riffGeneration.js";
import { RIFF_FALL_DIFFICULTY, RIFF_FALL_DEFAULT, buildRiffTimeline, riffOkWindow, gradeRiffOffset,
         loadRiffSpeed, scalePresetForSpeed, scaleTimelineForSpeed } from "./riff/fallingNotes.js";
import { voiceRiff, nearestPositionForKey } from "./riff/guitarMap.js";
import { Lobby } from "./ui/Lobby.jsx";
import TitleMenu from "./ui/TitleMenu.jsx";
import RiffMenu from "./ui/RiffMenu.jsx";
import { buildTestingGroundsConfig } from "./data/matchSetup.js";
import { RiffPractice } from "./ui/RiffPractice.jsx";
import { FretboardRecon } from "./ui/FretboardRecon.jsx";
import { DiscordCoach } from "./ui/DiscordCoach.jsx";
import { LegendLessons } from "./ui/LegendLessons.jsx";
import OpeningMovie from "./ui/OpeningMovie.jsx";
import HintScreen from "./ui/HintScreen.jsx";
import { BeginnerTipOverlay } from "./ui/BeginnerTipOverlay.jsx";
import { isMirrorFacing, MIRROR_SPRITES, mobileColorStyle, GameErrorBoundary } from "./ui/GameErrorBoundary.jsx";
import { useStageEffects } from "./hooks/useStageEffects.js";
import { useRockGod } from "./hooks/useRockGod.js";
import { ROCK_GODS, ROCK_GOD_RUNAWAY_LEAD, ROCK_GOD_TIMER_SECONDS, ROCK_GOD_VENGEANCE_DMG, ROCK_GOD_KILL_BLOW_FP, pickRockGod, godTauntLine } from "./data/rockGods.js"; // HP scaling moved into the engine (Phase 6c)
import { freeNeighborHex } from "./board/rockGodFx.js"; // AoE/slide/shove geometry moved into the engine (Phase 6c)
import { RockGodBoardLayer, RockGodHUD, GodVictoryOverlay } from "./ui/RockGodLayer.jsx";
import { STAGE_FX_META, SMOKE_ROUNDS, LASER_ROUNDS, LASER_DAMAGE, PYRO_WAVES, PYRO_DAMAGE, PYRO_BURN_TURNS, ANIMATRONIC_TURNS, ANIMATRONIC_DAMAGE } from "./data/stageEffects.js"; // tuning the engine consumes directly (counts/radii/waves) moved with the 6b flip
import { hexInSmoke, hexInBeams } from "./board/stageFx.js"; // pattern/spawn rolls moved into the engine (Phase 6b)
import { StageFXBoardLayer, StageFXBanner } from "./ui/StageFXLayer.jsx";
import { makeInitialState } from "./engine/state.js";
import { applyAction } from "./engine/reduce.js";
import { turnStarted, turnEnded, turnSkipped, moveBudgetSet, moveStep as engineMoveStep, beatsSpent, spiritWarped, spiritFaced, spiritEliminated, spiritsSynced, spiritPatched, riffOffStarted, riffResultsSubmitted, riffResolved, riffRound2Started, riffClosed, attackRolled, damageApplied, knockdownResolved, winnerDeclared, noteStatesSynced, fameChanged, fansChanged, noteSheetPatched, fansTicked, debuffsTicked, burnTicked, stageFxDrawn, stageFxActivated, stageFxTurnTicked, stageFxRoundTicked, godSummoned as godSummonedAction, godDamaged as godDamagedAction, godActed as godActedAction, godDefeated as godDefeatedAction, godTriumphed as godTriumphedAction, godTimerExpired as godTimerExpiredAction, spotlightHealed, spotlightMoved, tokensScattered, flamingDecayed, eventRespawnTicked, eventHexSpawned, chargeZonesTicked, eventHexTriggered, thrashTokensSpawned, tokenPickedUp, chargeZoneUsed, flamingHexesSet, randomBatchDrawn, headlinerChanged, tokensDrifted } from "./engine/actions.js";
import { riffStats } from "./engine/systems/riffOff.js";
import {
  marginToDamage, fameFromMargin, knockbackSpaces, underdogBonus as engineUnderdogBonus,
  smashOutcome, decideWinner, thrashDamage, thrashKnockback, thrashFame,
  sonicDamage, sonicKnockback, sonicFame,
  chordFrayAmount, isRearHit, REAR_ARC, REAR_FRAY_BONUS,
} from "./engine/systems/combat.js";
import {
  usedHas, usedList, usedAdd, performanceScore, makeInitialNoteState,
} from "./engine/systems/economy.js";
import { skillEligibility, THEORY_DISCORD_GRANTS } from "./engine/systems/skills.js";
import { STYLE_DEFS, styleOf, styleDef } from "./data/styles.js";
import {
  BOT_PERSONALITIES, BOT_PERSONA_KEYS, BOT_SKILL_PRIORITY_BASE, BOT_SPIRIT_SKILLS,
  SPIRIT_ONLY_ROUTE, BOT_RIFF_PROFILE,
  botAssignPersona, botPickTarget as _botPickTarget, botHexScore as _botHexScore,
  botSkillEligible as _botSkillEligible, botPickSkillTarget as _botPickSkillTarget,
  botRiffResults as _botRiffResults,
  botPlanNoteStep as _botPlanNoteStep, botSpiritChord,
  botPlanRevoice as _botPlanRevoice,
  botPlanStackCommit as _botPlanStackCommit,
  botPlanMove as _botPlanMove, botRivalsWithin as _botRivalsWithin,
  botIsBehind, REAR_INTEREST_DIST,
} from "./engine/policies/bot.js";


// ─── 🎸 CURSED SHAMISEN ART ───────────────────────────────────────────────────
// The Shamisen has its own board token rather than borrowing an emoji.
//
// TO SWAP IN REAL ART: drop the file at src/standees/Cursed_Shamisen.png, add
//   import cursedShamisenArt from "./standees/Cursed_Shamisen.png";
// at the top of this file, and set SHAMISEN_ART to it. That's the only change —
// the renderer falls through to the vector placeholder below whenever this is
// null, so the board is never empty while the art is being drawn.
const SHAMISEN_ART = null;

// Vector placeholder: a three-stringed shamisen standing on its head, seen
// head-on. `tint` recolours it with the instrument's mood (calm blue while it
// waits, hot red once it starts hunting). Drawn around a 0,0 origin at unit
// scale so the caller can size it off the hex.
function shamisenPlaceholder(tint, glow) {
  return (
    <g style={{ pointerEvents: "none", filter: `drop-shadow(0 0 5px ${glow})` }}>
      {/* neck (sao) — long, thin, runs up out of the body */}
      <rect x={-0.045} y={-1.05} width={0.09} height={1.15} rx={0.03}
        fill="#2a1a12" stroke={tint} strokeWidth={0.028}/>
      {/* tuning head, canted back */}
      <path d="M -0.075 -1.05 L 0.075 -1.05 L 0.11 -1.30 L -0.04 -1.30 Z"
        fill="#2a1a12" stroke={tint} strokeWidth={0.028}/>
      {/* three tuning pegs */}
      <circle cx={-0.10} cy={-1.13} r={0.032} fill="#e8dcc0"/>
      <circle cx={ 0.12} cy={-1.19} r={0.032} fill="#e8dcc0"/>
      <circle cx={-0.09} cy={-1.25} r={0.032} fill="#e8dcc0"/>
      {/* body (dou) — square skin-head drum */}
      <rect x={-0.34} y={-0.16} width={0.68} height={0.62} rx={0.07}
        fill="#3a2418" stroke={tint} strokeWidth={0.04}/>
      {/* stretched skin face */}
      <rect x={-0.27} y={-0.09} width={0.54} height={0.48} rx={0.05}
        fill="#efe4cc" opacity={0.92}/>
      {/* three strings running the full length */}
      {[-0.035, 0, 0.035].map((dx, i) => (
        <line key={i} x1={dx * 0.7} y1={-1.28} x2={dx} y2={0.40}
          stroke="#f6f1e2" strokeWidth={0.012} opacity={0.85}/>
      ))}
      {/* bridge (koma) */}
      <rect x={-0.10} y={0.20} width={0.20} height={0.035} fill="#c9a227"/>
      {/* the curse: a crack across the skin, weeping light */}
      <path d="M -0.20 -0.05 L -0.06 0.12 L -0.14 0.20 L 0.04 0.36"
        fill="none" stroke={tint} strokeWidth={0.035} strokeLinecap="round"
        opacity={0.95}/>
    </g>
  );
}


// 🎟️ A fan = a geometric "pawn": a detached round head above a downward-pointing
// triangle body. All fans share the same shape; `filled` marks a diehard (solid) vs
// a casual (hollow outline). Centred vertically on (x, y), owner colour from spirit.
//
// BEHAVIOUR CYCLING — every fan has ALL behaviours baked in and cycles through them
// via CSS. Fans are mostly settled (rest ~74% of the time); actions appear briefly
// and at pseudo-random intervals. Each fan gets a unique cycle DURATION (38–60 s)
// and phase offset derived from a seeded hash, so the crowd drifts out of sync and
// never looks patterned. Pass `forcePose` to pin a fan to one behaviour (walk-off,
// pop-in, flying); pass null to let it self-animate.
//
// NO Math.random() — all timing is hash-derived so the crowd is stable across renders.
function fanPawnShape(x, y, r, color, filled, sw = 1.2, op = 1, seed = 0, _unused = false, forcePose = null) {
  r = r * 1.15;
  const headR  = r * 0.40;
  const headCy = y - r * 0.88;
  const detail = headR > 2.0;
  const ink    = filled ? '#0a0e18' : color;

  // ── BODY — downward-pointing triangle (wide top, point at bottom) ──
  const topY = y - r * 0.28, botY = y + r * 0.72, halfW = r * 0.60;
  const bodyD = `M ${x - halfW} ${topY} L ${x + halfW} ${topY} L ${x} ${botY} Z`;

  // ── SEEDED HASH — stable pseudo-random [0,1) per (seed, offset) pair ──
  const s = typeof seed === 'number' ? ((seed % 997) + 997) % 997 : 0;
  const h = (n) => { const v = Math.sin(s * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };

  // ── TIMING — each fan gets its own durations so the crowd drifts apart ──
  const cycleDur  = (38 + h(0) * 22).toFixed(2);               // 38–60 s full behaviour cycle
  const cycDelay  = (h(1) * parseFloat(cycleDur)).toFixed(2);   // random phase within cycle
  const bobDur    = (3.5 + h(2) * 2.0).toFixed(2);             // 3.5–5.5 s head bob
  const bobDelay  = (h(3) * 3).toFixed(2);
  const blinkDur  = (4.0 + h(4) * 3.0).toFixed(2);             // 4–7 s blink period
  const blinkDel  = (h(5) * 4).toFixed(2);
  const lookDur   = (12 + h(6) * 10).toFixed(2);               // 12–22 s look-around
  const lookDel   = (h(7) * 8).toFixed(2);
  const tiltDur   = (20 + h(8) * 18).toFixed(2);               // 20–38 s head tilt
  const tiltDel   = (h(9) * 12).toFixed(2);
  const lookRange = (headR * 0.14).toFixed(2);
  const hbob      = (headR * 0.18).toFixed(2);                  // gentler bob
  const tiltDeg   = (6 + Math.floor(h(10) * 8)).toFixed(0);

  // ── EYE geometry — simple filled circles (no outline/pupil) ──
  const eyeY   = headCy - headR * 0.05;
  const eyeDX  = headR * 0.36;
  const eyeR   = headR * 0.18;

  // ── HAND geometry — positions relative to the wide-top body ──
  const handR    = headR * 0.42;
  const hFill    = filled ? color : 'none';
  const restY    = topY + (botY - topY) * 0.25;      // ¼ down the body (shoulder level)
  const restDX   = halfW * 0.78;                      // at the body edges
  const waveY    = headCy - headR * 0.65;
  const waveDX   = halfW * 1.0;
  const sway     = headR * 0.5;
  const fistY    = headCy - headR * 1.05;
  const fistX    = x + halfW * 0.35;
  const lighterY = headCy - headR * 0.85;
  const lighterX = x - halfW * 0.28;
  const phoneY   = headCy - headR * 1.1;
  const phoneX   = x - halfW * 0.3;
  const hornW    = Math.max(sw * 0.9, r * 0.14);

  const animate = !forcePose && detail;

  // ── helper: a single hand circle ──
  const handCircle = (cx, cy, key) => (
    <circle key={key} cx={cx} cy={cy} r={handR}
      fill={hFill} stroke={color} strokeWidth={sw} opacity={op}/>
  );

  // ── FORCED-POSE HANDS (pop-in / walk-off / flying fans) ──
  let forcedHands = null;
  if (forcePose && detail) {
    if (forcePose === 'wave') {
      forcedHands = (
        <g>
          <g style={{animation:'fan-wave 1.4s ease-in-out infinite',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            {handCircle(x - waveDX, waveY, 'wl')}
          </g>
          <g style={{animation:'fan-wave 1.4s ease-in-out infinite', animationDelay:'-0.7s',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            {handCircle(x + waveDX, waveY, 'wr')}
          </g>
        </g>
      );
    } else if (forcePose === 'fist') {
      forcedHands = (
        <g>
          {handCircle(x - restDX, restY, 'rl')}
          <g style={{animation:'fan-fist 1.0s ease-in-out infinite', ['--pump']:`${-(headR * 1.4)}px`}}>
            {handCircle(fistX, fistY, 'fh')}
          </g>
        </g>
      );
    } else {
      forcedHands = <g>{handCircle(x - restDX, restY, 'rl')}{handCircle(x + restDX, restY, 'rr')}</g>;
    }
  }

  // ── SELF-ANIMATING HANDS — five behaviour groups, CSS cycles opacity ──
  // Rest is visible ~74% of the time; each action gets ~5–6%. Per-fan cycle
  // durations (38–60 s) drift apart so actions appear random across the crowd.
  let cyclingHands = null;
  if (animate) {
    // Negative delay = animation starts already in progress at the offset
    // position, so there's never a gap where all groups default to opacity 1.
    const actStyle = (idx) => ({
      animation: `fan-act-${idx} ${cycleDur}s linear infinite`,
      animationDelay: `-${cycDelay}s`
    });

    cyclingHands = (
      <g>
        {/* Act 0: rest — both hands at sides */}
        <g style={actStyle(0)}>
          {handCircle(x - restDX, restY, 'r0l')}
          {handCircle(x + restDX, restY, 'r0r')}
        </g>
        {/* Act 1: wave — both hands up, swaying in opposite phase */}
        <g style={actStyle(1)}>
          <g style={{animation:'fan-wave 1.4s ease-in-out infinite',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            {handCircle(x - waveDX, waveY, 'w1l')}
          </g>
          <g style={{animation:'fan-wave 1.4s ease-in-out infinite', animationDelay:'-0.7s',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            {handCircle(x + waveDX, waveY, 'w1r')}
          </g>
        </g>
        {/* Act 2: fist pump — one hand pumping, the other rests */}
        <g style={actStyle(2)}>
          {handCircle(x - restDX, restY, 'f2l')}
          <g style={{animation:'fan-fist 1.0s ease-in-out infinite', ['--pump']:`${-(headR * 1.4)}px`}}>
            {handCircle(fistX, fistY, 'f2r')}
            {detail && <g stroke={color} strokeWidth={hornW} strokeLinecap="round" opacity={op}>
              <line x1={fistX - handR * 0.55} y1={fistY - handR * 0.3} x2={fistX - handR * 0.85} y2={fistY - handR * 1.5}/>
              <line x1={fistX + handR * 0.55} y1={fistY - handR * 0.3} x2={fistX + handR * 0.85} y2={fistY - handR * 1.5}/>
            </g>}
          </g>
        </g>
        {/* Act 3: lighter — one hand holds a flickering flame */}
        <g style={actStyle(3)}>
          {handCircle(x + restDX, restY, 'l3r')}
          {handCircle(lighterX, lighterY, 'l3h')}
          <g style={{animation:'fan-flame 0.6s ease-in-out infinite',
            transformBox:'fill-box', transformOrigin:'center bottom',
            filter:'drop-shadow(0 0 2px #ff7a00)'}}>
            <ellipse cx={lighterX} cy={lighterY - handR * 1.5} rx={handR * 0.5} ry={handR * 0.95} fill="#ff9a2e"/>
            <ellipse cx={lighterX} cy={lighterY - handR * 1.3} rx={handR * 0.26} ry={handR * 0.5} fill="#ffe28a"/>
          </g>
        </g>
        {/* Act 4: phone — a glowing rectangle held high, swaying slowly */}
        <g style={actStyle(4)}>
          {handCircle(x + restDX, restY, 'p4r')}
          <g style={{animation:'fan-phone-sway 3.0s ease-in-out infinite'}}>
            <rect x={phoneX - handR * 0.42} y={phoneY - handR * 0.9}
              width={handR * 0.84} height={handR * 1.3} rx={handR * 0.2}
              fill="#cfe0ff" opacity={op} style={{filter:'drop-shadow(0 0 2px #cfe0ff)'}}/>
          </g>
        </g>
      </g>
    );
  }

  // ── EYES — simple filled circles that blink and look around ──
  let eyes = null;
  if (detail) {
    eyes = (
      <g style={{
        animation: `fan-blink ${blinkDur}s ease-in-out infinite`,
        animationDelay: `-${blinkDel}s`,
        transformBox: 'fill-box', transformOrigin: 'center'
      }}>
        <g style={{animation: `fan-look ${lookDur}s ease-in-out infinite`,
          animationDelay: `-${lookDel}s`, ['--look']: `${lookRange}px`}}>
          <circle cx={x - eyeDX} cy={eyeY} r={eyeR} fill={ink} opacity={op}/>
          <circle cx={x + eyeDX} cy={eyeY} r={eyeR} fill={ink} opacity={op}/>
        </g>
      </g>
    );
  }

  return (
    <>
      {/* Body — downward-pointing triangle */}
      <path d={bodyD} fill={filled ? color : 'none'} stroke={color} strokeWidth={sw}
        strokeLinejoin="round" opacity={op}/>
      {/* Head — circle, with slow internal bob + tilt */}
      <g style={detail ? {
        animation: `fan-head-bob ${bobDur}s ease-in-out infinite, fan-tilt ${tiltDur}s ease-in-out infinite`,
        animationDelay: `-${bobDelay}s, -${tiltDel}s`,
        ['--hbob']: `${-hbob}px`, ['--hbob2']: `${-hbob * 0.35}px`,
        ['--tilt']: `${h(11) > 0.5 ? '' : '-'}${tiltDeg}deg`,
        transformBox: 'fill-box', transformOrigin: 'center bottom'
      } : undefined}>
        <circle cx={x} cy={headCy} r={headR} fill={filled ? color : '#0a0e18'}
          stroke={color} strokeWidth={sw} opacity={op}/>
        {eyes}
      </g>
      {/* Hands */}
      {animate ? cyclingHands : forcedHands}
    </>
  );
}


import { ENHARMONIC_RESPELL, canonicalRoot, getSpelledPool, pitchIndex, semitonesUpSpelled, buildScale, getIntervalNotes, getFourthFifth, playableScale, NOTE_POOL } from "./music/notes.js";

import { DB_UPGRADE_THRESHOLD, STOCK_REFILL_RATE, CAMERA_ZOOM_MS, LIMELIGHT_HEX, LIMELIGHT_TO_WIN, LIMELIGHT_FAME, fpPerLife, FAME_PER_TURN_CAP, UNDERDOG_MIN_DEFICIT, TOKEN_MAX, FAN_DIEHARD_WEIGHT, FAN_CASUAL_WEIGHT, FAN_MULT_CAP, FAN_DIEHARD_CAP, FAN_CASUAL_CAP, FAN_DIEHARD_START, FAN_CASUAL_START, EXCITE_PER_CASUAL, LOYALTY_PER_DIEHARD, FAN_GAIN_BY_RING, FAN_DECAY, FAN_BORED_AFTER, FAN_PROMOTE_EVERY, FAN_RECOVERY_LAG, FAN_FLEE_MIN, FAN_FLEE_MAX, FAN_DEFECT_TO_VICTOR, EVENT_HEX_COUNT, EVENT_RESPAWN_TURNS, FLAMING_DISC_COUNT, FLAMING_DISC_ROUNDS, CHARGE_ZONE_COUNT, CHARGE_ZONE_BOOST_TURNS, CHARGE_ZONE_COOLDOWN, CHARGE_FLOOR_BONUS, THRASH_DIE, THRASH_CEIL_DIE, SONIC_LIMELIGHT_FP, SONIC_BASE_DIE, SONIC_DEF_DIE, SONIC_DEF_DIE_OUT_OF_RIG, ATK_BONUS_CAP, THRASH_DAMAGE_CAP, STACK_COMMIT_BUDGET, STACK_CAP_BASE, STACK_CAP_MAX, stackCapFor } from "./data/gameConstants.js";
// ── SPOTLIGHT SYSTEM ─────────────────────────────────────────────────────────
// A roaming searchlight that heals +1 Vibe to any spirit ending their turn on it.
// Moves to a new hex every full round (once all spirits have taken a turn).
// SPOTLIGHT_POOL is imported from board/boardHelpers.js (EVENT_HEX_POOL moved to engine)
// (shared with the engine's makeInitialState for seeded placement).

import { EVENT_DECK, EVENT_BY_ID } from "./data/events.js";

// ── BACK TO THE PAST — two-stage PLAY CHALLENGE (its own mini riff engine) ────
// Stages are scale-degree sequences (degree 0 = A3, A-natural-minor) so they
// reuse the Note-Track letter/pitch system. All naturals → no Shift needed.
const BTTP_STAGES = {
  angel: {
    name: 'SLOW-DANCE ANGEL', icon: '💫', accent: '#7fb0ff', view: 'piano',
    blurb: 'Read the lit keys and play each chord — no labels, no second guesses.',
    // Doo-wop changes: Am – F – C – G – Am (all natural triads → white keys)
    chords: [['a','c','e'], ['f','a','c'], ['c','e','g'], ['g','b','d'], ['a','c','e']],
    window: 3000, gap: 320, reward: 'hc', pbLit: 560, pbGap: 170,
  },
  goode: {
    name: 'DUCKWALK DYNAMO', icon: '🦆', accent: '#ff9a3c', view: 'piano',
    blurb: 'Same piano, faster changes — find the power chords by feel.',
    // Berry-style power chords (root + fifth): A5 A5 C5 A5 D5 E5 A5
    chords: [['a','e'], ['a','e'], ['c','g'], ['a','e'], ['d','a'], ['e','b'], ['a','e']],
    window: 2200, gap: 220, reward: 'fans', pbLit: 320, pbGap: 110,
  },
};
const BTTP_PASS_RATIO = 0.6; // share of chords nailed CLEANLY to "nail" a stage
const BTTP_NAT_DEG = { a:0, b:1, c:2, d:3, e:4, f:5, g:6 }; // keystroke → scale degree
function bttpLetterFreq(letter) { return riffDegreeFreq(BTTP_NAT_DEG[letter] ?? 0, false); }
function bttpStageData(key) {
  const st = BTTP_STAGES[key];
  const rhythm = st.chords.map((_, i) => ({ window: st.window, gap: i === 0 ? 0 : st.gap }));
  return { ...st, key, rhythm };
}

// ── 🧪 Signature-skill test registry — Ronin & Monster (the two built so far) ──
// Each entry unlocks the named skill (+ any prereqs) for its spirit; `fire`
// marks the ones with a self-contained trigger we can run on the spot.
const SIGNATURE_TESTS = {
  cosmic_ronin: { name: 'Shredding Ronin', color: '#4488ff', skills: [
    { id:'psycho_bushido',   label:'🌀 Psycho Bushido',   pre:[] },
    { id:'shadow_illusion',  label:'👤 Shadow Illusion',  pre:[] },
    { id:'cursed_shamisen',  label:'🎸 Cursed Shamisen',  pre:[] },
    { id:'wa_no_koe',        label:'🎵 Wa no Koe',        pre:[] },
  ]},
  Metalness_Monster: { name: 'Metalness Monster', color: '#ffcc00', skills: [
    { id:'number_of_the_beast', label:'6️⃣ Number of the Beast', pre:[] },
    { id:'master_moshpits',     label:'🤘 Master of Moshpits',  pre:[] },
    { id:'slime',               label:'🧪 Slime',               pre:[] },
    { id:'azrael',              label:'💀 Azrael',               pre:[] },
  ]},
  intergalactic_0: { name: 'Intergalactic 0', color: '#aa55ff', skills: [
    { id:'blaster_of_ra', label:'🌀 Blaster of Ra', pre:[] },
    { id:'displace',      label:'🌌 Displace',       pre:[] },
    { id:'sunbeam',       label:'☀️ Sunbeam',         pre:['amp_1','amp_2','amp_3'] },
  ]},
};

import { RIFF_LIBRARY, RIFF_GENRE, RIFF_GENRE_META, PC_PLAY_NAMES, detectRiff } from "./music/riffLibrary.js";

// ─── CADENCE OBJECTIVES ──────────────────────────────────────────────────────
// Multi-turn music-theory goals: the LAST note of your confirmed track each
// turn is your "final". String the right finals together across consecutive
// turns — in any key — and you resolve a cadence for Fame. Degrees are
// semitone offsets from the root you establish on the run's first final.
import { CADENCE_OBJECTIVES, cadenceHints, detectCadence, detectChromaticRun, detectDiatonicRun, driveBoostFromRun, detectSkipClimb, detectRepeatPattern, sustainBoostFromPattern, scoreTrackDB, randomNote } from "./music/cadence.js";
import { chordContext, contextClaim, classifyTrack, countUnpardoned, countPardonedByStack, modeFromStack, harmonicLock, discordPenaltyFor } from "./music/context.js";
import { evaluateChord } from "./music/chords.js";

// ── CADENCE HINTS ────────────────────────────────────────────────────────────
// Given the finals trail, work out which ending note(s) would advance (or
// resolve) each off-cooldown cadence. For each cadence, find the LONGEST tail
// of the trail that matches the start of its degree pattern (the first final
// of the run sets the root), then report the next required pitch class.


// Check whether the tail of a finals trail completes any cadence (skipping
// objectives on cooldown). Longest pattern wins.

// ⚠️ CQC swing-upgrade tiers + %-proc chance tables were CUT with the Stance
// system rework (see STANCE_SYSTEM_DESIGN.md §8) — no musical connection.

// Vintage dance-craze names flashed on a plain swing (no upgrade effect landed).
// Picked once per battle (stored on battleState) so it stays stable across renders.
const SWING_DANCE_NAMES = [
  'TWIST','MASHED POTATO','THE JERK','WATUSI','THE HUSTLE','FUNKY CHICKEN',
  'THE PONY','THE SWIM','THE FRUG','SHIMMY','CHARLESTON','JITTERBUG',
  'THE MONKEY','HAND JIVE','THE STROLL','THE MADISON','THE SHAG','BOOGIE',
];
function pickDanceName() {
  return SWING_DANCE_NAMES[Math.floor(Math.random() * SWING_DANCE_NAMES.length)];
}


// ── DISCORD UPGRADE PATH ─────────────────────────────────────────────────────
// Three tiers unlocked via the DB upgrade system. Once a tier is unlocked,
// those interval notes:
//   • Are colored (no longer gray)
//   • Do NOT count against Harmonic structure (discordCount not incremented)
//   • CAN contribute to DB points
// Before unlock: grayed out, same rules as any other discord note.
//
// ⚠️ B1: these IDs are now PURELY scale-expansion flags. The combat effects they
// used to carry (m7 → Mojo Drain, tritone → Burn, maj3 → cleanse/shield,
// chromatic run → Stagger) are gone. B5 finished the job: the tritone →
// feedbackBoost link is gone too, so NONE of these IDs reaches combat any more.
// The tritone survives as a colour, an unlock, and +1 Performance Score — all of
// which do what they say. B3 repurposes the same IDs as the tiers of the
// chord-context ladder.
// ── STACK COLOURS — ONE SOURCE, EVERYWHERE ───────────────────────────────────
// Drive is red and Sustain is blue in the stat readouts (⚔️/🛡️), in the chord
// commit preview, in the note stock's context highlight, and in the commit-time
// payout router. Same two hexes in all four places, defined once here, because the
// whole point of recolouring the highlight was to make "which stack does this note
// feed" answerable at a glance — and that collapses the moment two screens use two
// reds. Import these rather than pasting a literal.
const DRIVE_C   = "#ff6644";
const SUSTAIN_C = "#44aaff";
// Dimmed backings for the same pair, for hex interiors and chip fills.
const DRIVE_BG   = "#2a0f0a";
const SUSTAIN_BG = "#08202e";

// ── THE UNLOCKED-DISCORD LOOK ────────────────────────────────────────────────
// The tritone, the ♭7 and the major 3rd each used to own a colour (red, blue,
// green) from the era when each carried its own combat effect. B1 and B5 deleted
// every one of those effects; what survives is identical for all three — the
// unlock makes the note clean, and ending a track on it adds +1 to a Performance
// Score bucket that caps at 3. Three colours for one behaviour is three things to
// learn and nothing to learn them for, and two of them were squatting on red and
// blue, which the stacks now need.
//
// So they share one treatment: the locked-discord grey, LIFTED. That reads as what
// actually happened — the note didn't become a new kind of thing, it came out of
// the dark. Their identity is still on the hex, in the letter.
// (4th purple and 5th pink are NOT demoted: those still pay real Db ending bonuses,
//  +2 and +3, so their colour is still pointing at something.)
const UNLOCKED_DISCORD = { border: "#a08fc0", text: "#b8a8d8", bg: "#201a2e", shadow: "0 0 4px #a08fc066" };

const DISCORD_UPGRADE_TIERS = [
  {
    id: 'discord_1',
    label: 'Blues Lick',
    icon: '🎷',
    desc: "Flat 7th (minor 7th) no longer discord in Major scales — the blues note joins your clean palette.",
    notesByMode: { major: ['minorSeventh'], minor: [] },
  },
  {
    id: 'discord_2',
    label: 'Borrowed Chord',
    icon: '✨',
    desc: "Major 3rd no longer discord in Minor scales — borrow the brighter third whenever the line wants it.",
    notesByMode: { major: [], minor: ['majorThird'] },
  },
  {
    id: 'discord_3',
    label: "Devil's Interval",
    icon: '🔥',
    desc: "Tritone never breaks harmony in either mode — the devil's interval joins your clean palette in Major and Minor alike.",
    notesByMode: { major: ['tritone'], minor: ['tritone'] },
  },
  {
    id: 'discord_4',
    label: 'Chromatic Climb',
    icon: '⚡',
    desc: "A chromatic run of 3+ notes no longer causes discord. Out-of-scale notes stay grey but the run is clean.",
    notesByMode: { major: [], minor: [] },
  },
];
// ── SKILL TREE ────────────────────────────────────────────────────────────────
// Four routes. Skills within a gated chain require the previous skill first.
// PA sub-chain (mic/pedal/mixer/powerchords) requires amp_1 first.
// Groupies, Stage Effects, and the "hero_pose" CQC terminal are standalone.
const SKILL_TREE = {
  routes: [
    // ── THE LADDER — Music Theory (universal spine: the consonance→dissonance arc) ──
    // Everyone starts on the Major Pentatonic. Climbing the ladder unlocks a wider,
    // riskier, higher-Fame palette. This route ABSORBS the old Discord path — the
    // colour notes (Blues 7th, Devil's Interval, Chromatic, Borrowed Chord) arrive
    // as you learn the theory that justifies them (see applySkillEffects).
    // B1 stripped their combat riders; B3 gives the same tiers a real mechanic —
    // each one widens how far your chord's permission reaches into the melody.
    {
      id: 'theory',
      label: 'Music Theory',
      icon: '🎼',
      color: '#66ccff',
      // B9: was "Start on the Major Pentatonic", which contradicted the free
      // theory_major grant. (For most of this branch's life the blurb was accurate
      // by accident, because the grant was broken — see the initial-skill effect.)
      desc: 'The spine of the game. You start with the full Major scale. Each rung does two things: it widens what your CHORD can make legal, and it gives you room to build a bigger chord — and the bigger the chord, the more it pays to land your line on it.',
      skills: [
        // B9: every desc now states all three things a tier can give — the SCALE
        // expansion (what the key allows), the CONTEXT TIER (what your stacks
        // pardon, B3's ladder) and the SLOT unlock (B0b). Before B9 they mentioned
        // only the first, which left the branch's actual mechanic undocumented in
        // the one place a player goes to read about it.
        { id:'theory_major',     label:'The Full Scale',       icon:'🎼', dbCost:6,  gated:true, prereq:null,
          desc:'Adds the 4th & 7th, completing the Major (Ionian) scale — those two notes stop costing Discord.' },
        { id:'theory_minor',     label:'Minor Tonality',       icon:'🌑', dbCost:8,  gated:true, prereq:'theory_major',
          desc:'Unlocks the Minor scale — stack a minor third and the song follows you into a darker key, Discord-free. And it opens the ladder: CHORD TONE PARDON — any note sitting in your Drive or Sustain stack is never Discord, whatever the key says. Colour notes your chord legalizes pay Drive or Sustain.' },
        { id:'theory_dom7',      label:'Blues / Dominant 7th', icon:'🎷', dbCost:10, gated:true, prereq:'theory_minor',
          desc:'The ♭7 joins your clean palette. PLAY THE CHANGES — the pardon widens from the notes you placed to your stack\'s whole implied chord, completed to its seventh: a C-E-G stack makes B clean though you never stacked it. +1 STACK SLOT (4) — the lesson that teaches you the blues note also lets you build the dominant 7th.' },
        { id:'theory_modes',     label:'Modal Colour',         icon:'🌀', dbCost:12, gated:true, prereq:'theory_dom7',
          desc:"Lydian ♯4 & Mixolydian ♭7 become clean, and the tritone never breaks harmony. EXTENSIONS — the pardon reaches your chord's available tensions by quality: ♯4 over major, natural 6 over minor, ♭9 and 9 over dominant. +1 STACK SLOT (5) — room for 9th chords, and a 9th is worth +2 to land on." },
        // ⚠️ REWRITTEN. This used to headline the chromatic-run Db payout, which
        // fired on 1% of commits — 16 Db for something the player would never see.
        // The capstone now sells the sixth slot, which is the lever that actually
        // moves the ladder: bigger chord, bigger target for Harmonic Lock.
        { id:'theory_chromatic', label:'Chromatic Mastery',    icon:'⚡', dbCost:16, gated:true, prereq:'theory_modes',
          desc:'CAPSTONE — +1 STACK SLOT (6). The biggest chords in the game are yours alone, and a bigger chord is a bigger thing to land your line on. APPROACH NOTES too: any note is clean if the next one lands on a chord tone, so you can walk in from anywhere. Also brings the Major 3rd (Borrowed Chord) online in Minor.' },
      ],
    },
    // ── THE RIG — your amp deck lives at your corner and grows (AMP_DECK_DESIGN.md §4) ──
    {
      id: 'electric',
      label: 'Electric',
      icon: '⚡',
      color: '#ffcc44',
      desc: 'Your rig. It lives at your corner and it only gets bigger.',
      subChains: [
        { id:'rig_amps', label:'🔊 Amps', skills: [
          { id:'amp_1', label:'Amp I',  icon:'🔊', dbCost:6,  gated:true, prereq:null,
            desc:'Your starting Main Amp — 2d6, keep highest, board-wide. Every Spirit begins wired in.' },
          { id:'amp_2', label:'Amp II', icon:'🔊', dbCost:10, gated:true, prereq:'amp_1',
            desc:'+1d6 (roll 3, keep highest). A second cabinet hits the stack.' },
          { id:'amp_3', label:'Amp III',icon:'🔊', dbCost:16, gated:true, prereq:'amp_2',
            desc:'+1d6 (roll 4, keep highest). Three stacks — the wall of sound is complete.' },
          { id:'overcharge', label:'Overcharge', icon:'🎸', dbCost:12, gated:true, prereq:'amp_2',
            desc:'Charge Zones no longer just spark your dice — tapping one now lets you choose: the usual charge (random die floor/ceiling boost), OR one curated Chord Stack note plus a bonus revoice to spend on it.' },
        ]},
        { id:'rig_power', label:'🎛️ Power', skills: [
          { id:'power_1', label:'Power I',  icon:'🎛️', dbCost:8,  gated:true, prereq:'amp_1',
            desc:'A real head on the stack — one of your dice becomes a d8.' },
          { id:'power_2', label:'Power II', icon:'🎛️', dbCost:12, gated:true, prereq:['power_1','amp_2'],
            desc:'A second die becomes a d8.' },
          { id:'power_3', label:'Power III',icon:'🎛️', dbCost:16, gated:true, prereq:['power_2','amp_3'],
            desc:'Three d8s in the pool — maximum wattage.' },
        ]},
        { id:'rig_range', label:'📡 Range', skills: [
          { id:'range_1', label:'Range I',  icon:'📡', dbCost:6,  gated:true, prereq:null,
            desc:'Full rig reaches 4 hexes from home.' },
          { id:'range_2', label:'Range II', icon:'📡', dbCost:10, gated:true, prereq:'range_1',
            desc:'Full rig reaches 7 hexes — the Limelight is inside your field.' },
          { id:'range_3', label:'Range III',icon:'📡', dbCost:14, gated:true, prereq:'range_2',
            desc:'Fully wired. The whole venue is your stage.' },
        ]},
      ],
    },
    // ── SIGNATURE ARSENALS — one compact route per Spirit (hidden from the others) ──
    {
      id: 'shredding_ronin',
      label: 'Shredding Ronin',
      icon: '🗡️',
      color: '#4488ff',
      desc: 'The way of the blade meets the way of the riff. An exclusive arsenal only the Ronin can wield.',
      spiritOnly: 'cosmic_ronin',
      skills: [
        { id:'psycho_bushido',  label:'Psycho Bushido',  icon:'🌀', dbCost:6,  gated:false,
          desc:'Iaijutsu dash — charge in a straight line from your facing. Remaining AP converts to bonus Drive on top of your Drive stack. 2-round cooldown.' },
        { id:'shadow_illusion', label:'Shadow Illusion', icon:'👤', dbCost:6,  gated:false,
          desc:'Split into a second, identical Ronin, born stacked on your own hex (costs 1 Drive token) — nobody sees which one appeared. Rivals cannot tell the double from the real you: it blocks, it faces, and it walks the board on its own steps, refreshed each turn to match your movement range at no cost to your Action Points. Lasts 3 turns. Pops if it is struck, if you attack, or if you are attacked. Whoever swings at it burns their AP and Action Token for nothing.' },
        { id:'cursed_shamisen', label:'Cursed Shamisen', icon:'🎸', dbCost:8,  gated:false,
          desc:'Set a cursed Shamisen down on your hex (2 Db per use). It plays a haunting melody every turn, costing 1 Sustain (then Vibe) to every Spirit inside its rings. Turn 1: 2 rings. Turn 2: 3 rings. Turn 3: it stops growing and starts HUNTING — stalking 1 hex a turn toward the nearest Spirit, and it no longer spares you. Calmed by walking onto its hex, which also hands the walker a bonus note.' },
        { id:'wa_no_koe',       label:'Wa no Koe (和の声)', icon:'🎵', dbCost:12, gated:false,
          desc:'Voice of Harmony — when half your melody or more sits inside your Drive or Sustain stack, the alignment pays +1 Drive or Sustain for 3 rounds. The Ronin already starts holding CHORD TONE PARDON, so those same notes are never Discord for him either: this is the amplifier on top of an instinct he was born with.' },
      ],
    },
    {
      id: 'metalness',
      label: 'Metalness Monster',
      icon: '🤘',
      color: '#ffcc00',
      desc: 'Dripping poison, summoning mosh pits, invoking the Beast. An exclusive arsenal only the Monster can wield.',
      spiritOnly: 'Metalness_Monster',
      skills: [
        { id:'number_of_the_beast', label:'Number of the Beast', icon:'6️⃣', dbCost:6, gated:false,
          desc:'BERSERK — 1 Db to call, and only at 2 Vibe or less. +6 Drive with no cap, immune to knockback, and every attack costs 1 Vibe. Ends when you put a rival down, when you go down, or when you heal out of danger. The Beast only answers the dying.' },
        { id:'master_moshpits', label:'Master of Moshpits', icon:'🤘', dbCost:8,  gated:false,
          desc:'Pulls 3 fans out of the stands and onto the board for a pit. +2 Drive that STANDS — it survives battles and lasts until you call the next pit. Once per turn.' },
        { id:'slime',           label:'Slime',              icon:'🧪', dbCost:10, gated:false,
          desc:'On Swing/Smash hit, spend 1 Db to slime the rival — their next turn\'s note regeneration is halved.' },
        { id:'azrael',          label:'Azrael',             icon:'💀', dbCost:12, gated:false,
          desc:'Each rival you knock down feeds Fame equal to your knockdown streak (1st→1, 2nd→2…). Resets when YOU go down.' },
      ],
    },
    {
      id: 'intergalactic',
      label: 'Intergalactic 0',
      icon: '🌀',
      color: '#aa55ff',
      desc: 'Cosmic groove and weaponized sound. An exclusive arsenal only Intergalactic 0 can wield.',
      spiritOnly: 'intergalactic_0',
      skills: [
        { id:'blaster_of_ra', label:'Blaster of Ra', icon:'🌀', dbCost:10, gated:false,
          desc:'REPLACES the Smash. A ranged, PIERCING bass-drop: hurl your unused stock down the forward beam, hammering EVERY rival in line — undefendable, scattering their stock and knocking them back. Leaves you Exposed.' },
        { id:'displace', label:'Displace', icon:'🌌', dbCost:8,  gated:false,
          desc:"He can't run — he warps. Teleport to an open hex beside your amp rig (costs 3 AP, 2-turn cooldown). The slow zoner's get-out-of-jail. Needs at least one amp to warp to." },
        { id:'sunbeam', label:'Sunbeam', icon:'☀️', dbCost:14, gated:true, prereq:'amp_3',
          desc:'CAPSTONE — requires Amp III. Your Sonic beam reaches +2 hexes AND scorches the hexes it crosses into burning ground (2 rounds) — area denial down the whole line.' },
      ],
    },
  ],
};
// Flat lookup: skillId → skill def (including which route/chain it belongs to)
const SKILL_BY_ID = (() => {
  const map = {};
  for (const route of SKILL_TREE.routes) {
    if (route.skills) {
      for (const sk of route.skills) map[sk.id] = { ...sk, routeId: route.id };
    }
    if (route.subChains) {
      for (const chain of route.subChains) {
        for (const sk of chain.skills) map[sk.id] = { ...sk, routeId: route.id, chainId: chain.id };
      }
    }
  }
  return map;
})();

// Returns the note that is N semitones above root (chromatic, sharp-pool default)

// ── CHROMATIC RUN DETECTION ──────────────────────────────────────────────────
// Returns the length of the longest chromatic run (consecutive semitones) in the track

// ─── RIFF-OFF ────────────────────────────────────────────────────────────────
// When two Spirits clash with a Sonic Attack while facing each other (each
// standing in the other's beam) AND BOTH ARE INSIDE THEIR OWN RIG'S RADIUS,
// the battle becomes a RIFF-OFF: a call-and-response rhythm duel.
// The range requirement is mutual on purpose — a duel needs two live rigs. If
// the rival is beam-to-beam but stranded outside their amp range, there is no
// answering riff: the Sonic lands as an ordinary attack and the stranded rival
// defends on a bare d4 instead of the usual d6 (SONIC_DEF_DIE_OUT_OF_RIG). The attacker lays down a riff; the
// defender answers with a musically transformed version of it (inversion,
// modulation, twisted notes, or a phrase resolution). The riff FALLS down a
// note highway toward the strike line at the instrument (Guitar Hero style —
// engine timing in riff/fallingNotes.js, rendering in ui/RiffHighway.jsx).
// Press the note's letter key as its gem crosses the line; CAPITAL letters are
// SHARPS (hold Shift). Grades measure |press − hit-time|, early or late alike.
const RIFF_LEN          = 6;
const RIFF_GAP_NORMAL   = 470;   // ms breath before a steady note (groove spacing)
// ── RIFF-OFF SCORING — timing GRADE decides the duel, not raw hit-count ──
// Every note is graded (perfect/good/ok/miss) on how tight to the strike line
// it was played. The duel is won on the grade-weighted SCORE of the two
// performances: nailing the groove tight beats lazily catching the same notes
// inside the window. A hit is not just a hit — how cleanly you played it is
// the whole point. (Grade thresholds live in RIFF_FALL_DIFFICULTY presets.)
// Riff scoring weights/margins + riffStats now live in the engine —
// src/engine/systems/riffOff.js (Phase 4). riffStats is imported above.
export default function RLSWSimulator() {
  const [gameState, setGameState] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [practiceMode, setPracticeMode] = useState(null); // null | { mode: 'riff'|'fretboard'|'discord', diff? }
  const [introDone, setIntroDone] = useState(false);
  // 🏝️ TITLE MENU — the Zelda-style front door. Everything hangs off it:
  //   null    → the title menu itself
  //   'normal'→ the match lobby (player count, Spirit select, settings)
  //   'riff'  → the Riff Mode submenu (practice modes live in there)
  // Rock God Challenge is on the menu but locked until it's built out; Testing
  // Grounds and How to Play launch straight from the menu without a branch.
  const [menuRoute, setMenuRoute] = useState(null);
  // 💡 HINT SCREEN — an intentional ~5s beat between Lobby and Game so a
  // random gameplay hint can be read. Reset on return-to-lobby so every match
  // start gets a fresh hint.
  const [hintDone, setHintDone] = useState(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // 🎬 Opening movie — plays on every launch, any input skips (attract style).
  if (!introDone) {
    return <div style={isMobile ? mobileColorStyle : {}}><OpeningMovie onDone={() => setIntroDone(true)} /></div>;
  }
  if (showTutorial) {
    return <div style={isMobile ? mobileColorStyle : {}}><Tutorial onBack={() => setShowTutorial(false)} /></div>;
  }
  if (practiceMode) {
    const pm = practiceMode;
    // Backing out of a trainer returns to the Riff Mode menu it was launched
    // from, not all the way to the title screen — you almost always want another go.
    const back = () => setPracticeMode(null);
    if (pm.mode === 'fretboard') return <div style={isMobile ? mobileColorStyle : {}}><FretboardRecon onBack={back} /></div>;
    if (pm.mode === 'discord')   return <div style={isMobile ? mobileColorStyle : {}}><DiscordCoach onBack={back} /></div>;
    if (pm.mode === 'legend')    return <div style={isMobile ? mobileColorStyle : {}}><LegendLessons onBack={back} /></div>;
    return <div style={isMobile ? mobileColorStyle : {}}><RiffPractice initialDiff={pm.diff || pm} onBack={back} /></div>;
  }
  // 🏝️ Title menu — shown whenever no match is running and no route is chosen.
  if (!gameState && menuRoute === null) {
    return <div style={isMobile ? mobileColorStyle : {}}><TitleMenu
      onNormal={() => setMenuRoute('normal')}
      onRiff={() => setMenuRoute('riff')}
      onTestingGrounds={() => setGameState(buildTestingGroundsConfig())}
      onHowToPlay={() => setShowTutorial(true)}
    /></div>;
  }
  if (!gameState && menuRoute === 'riff') {
    return <div style={isMobile ? mobileColorStyle : {}}><RiffMenu
      onPractice={p => setPracticeMode(p)}
      onBack={() => setMenuRoute(null)}
    /></div>;
  }
  if (!gameState) {
    return <div style={isMobile ? mobileColorStyle : {}}><Lobby
      onStart={gs => setGameState(gs)}
      onTutorial={() => setShowTutorial(true)}
      onPractice={p => setPracticeMode(p)}
      onBackToMenu={() => setMenuRoute(null)}
    /></div>;
  }
  // 💡 Match is starting — hold on the hint screen for ~5s before the board mounts.
  if (!hintDone) {
    return <div style={isMobile ? mobileColorStyle : {}}><HintScreen onDone={() => setHintDone(true)} /></div>;
  }
  // Netcode: leaving the Game must CLOSE the socket (keeping the saved session),
  // or the old connection keeps holding the seat and the Lobby's auto-rejoin
  // falls through to spectator-of-a-dead-game. `resetRoom` also flips the room
  // back to phase:lobby server-side so everyone can start a fresh match.
  // Error-boundary resets DON'T reset the room — rejoining a live game via
  // CATCH_UP is the correct recovery there.
  const returnToLobby = ({ resetRoom = true } = {}) => {
    const net = gameState.net;
    if (net?.client) {
      if (resetRoom && !net.spectator) net.client.send({ t: "RETURN_TO_LOBBY" });
      net.client.close(); // keeps rlsw.net.session — Lobby auto-rejoin reclaims the seat
    }
    setGameState(null);
    setHintDone(false); // 💡 next match start shows a fresh hint
  };
  return (
    <GameErrorBoundary onReset={() => returnToLobby({ resetRoom: false })}>
      <div style={isMobile ? mobileColorStyle : {}}><Game key={JSON.stringify(gameState.spirits.map(s=>s.num))} gameState={gameState} onReturnToLobby={returnToLobby} /></div>
    </GameErrorBoundary>
  );
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
function Game({ gameState, onReturnToLobby }) {
  const { mode, teams } = gameState;
  const startingLives = gameState.startingLives ?? 3;
  const playerCount = gameState.spirits.length;
  const fameToWin = startingLives * fpPerLife(playerCount);

  // 🎇 Stage FX fires once per life, evenly spaced across the FP target.
  const stageFxThresholds = (() => {
    const count = startingLives;
    const interval = fameToWin / (count + 1);
    return Array.from({ length: count }, (_, i) => Math.round(interval * (i + 1)));
  })();

  // ── ENGINE STATE (see src/MULTIPLAYER_HANDOFF.md) ─────────────────────────
  // The authoritative, serializable game state. The engine owns the turn queue,
  // beats/AP, movement/facing rules, limelight-start flags, the turn counter,
  // the seeded note sheets, AND (Phase 5c) the spirits array — see the SPIRITS
  // shim just below.
  // N0 (netcode): thread the lobby/server seed through. Offline `gameState.seed`
  // is undefined → makeInitialState keeps its time-derived default (byte-
  // unchanged). Online, GAME_STARTED.seed rides into gameState and lands here.
  // N6: when gameState.catchUp is present (spectator join or reconnect), replay
  // the full action log at init — no presentation, just engine state. The
  // selftest proves this produces byte-identical state.
  const [engineState, setEngineState] = useState(() => {
    let state = makeInitialState(gameState, gameState.seed);
    if (gameState.catchUp) {
      for (const entry of gameState.catchUp.log) {
        state = applyAction(state, entry.action);
      }
      console.log(`[RLSW NET] catch-up replay: ${gameState.catchUp.log.length} actions, cursor=${state.rng.cursor}`);
    }
    return state;
  });
  const engineRef = useRef(engineState); // live mirror so dispatch works inside timeout chains
  // ⛔ FP banked per spirit inside the CURRENT turn window — grantFame clamps
  // against FAME_PER_TURN_CAP; startNewTurnNotes resets the whole map. A ref
  // (not state): it's bookkeeping for timeout-chained grants, never rendered.
  const fameThisTurnRef = useRef({});
  // N3: net context — stash the client reference for N4 action relay
  const netRef = useRef(gameState.net ?? null);
  // Dispatch through the engine reducer. Synchronous: returns the next state
  // so callers can read results (turn.lastMove / turn.lastReport) immediately.
  // Phase 8a — ACTION LOG: every dispatch is recorded with the rng cursor it
  // applied at. seed + config + this log IS the multiplayer replay contract
  // (the engine selftest proves byte-identical reproduction). Ref — the log
  // never triggers a render; export it from the Testing Grounds panel.
  const actionLogRef = useRef(gameState.catchUp ? [...gameState.catchUp.log] : []);
  function dispatch(engineAction) {
    const cursorBefore = engineRef.current.rng.cursor;
    actionLogRef.current.push({ action: engineAction, cursorBefore });
    const next = applyAction(engineRef.current, engineAction);
    engineRef.current = next;
    setEngineState(next);
    // N4: relay to server when online (N6: spectators never send actions)
    if (netRef.current && !netRef.current.spectator) {
      netRef.current.client.sendAction(engineAction, cursorBefore);
    }
    return next;
  }

  // N3: log seed + cursor on mount so both tabs can confirm identical engine boot
  useEffect(() => {
    console.log(`[RLSW NET] engine booted — seed: ${engineState.rng.seed}, cursor: ${engineState.rng.cursor}, spirits: ${engineState.spirits.map(s=>s.id).join(",")}`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── N8: HARDENING — desync recovery + connection status ────────────────────
  // netSync: null = in sync · 'resyncing' = a cursor mismatch or seq gap froze
  // input and a CATCH_UP was requested; cleared when the rebuilt state lands.
  const [netSync, setNetSync] = useState(null);
  const netSyncRef = useRef(null); // live mirror — frame handlers run outside render
  // Monotonic server sequence — every ACTION frame (echoes included: our own
  // actions advance the room seq too) must arrive at lastSeq+1, or we missed
  // frames and must resync. Catch-up log entries carry their seq.
  const lastSeqRef = useRef(
    gameState.catchUp?.log?.length
      ? (gameState.catchUp.log[gameState.catchUp.log.length - 1].seq ?? null)
      : null
  );
  const [selfConn, setSelfConn] = useState("ok");                       // ok | reconnecting
  const [netSeatsLive, setNetSeatsLive] = useState(gameState.net?.seats ?? null); // ROOM_STATE presence

  function startResync(reason) {
    if (netSyncRef.current) return; // already frozen — one CATCH_UP is enough
    console.error(`[RLSW NET] ${reason} — freezing input, requesting CATCH_UP`);
    netSyncRef.current = "resyncing";
    setNetSync("resyncing");
    netRef.current?.client.requestCatchUp();
  }

  // N4: input gating — only the acting player can trigger user actions
  const isMyTurn = !netRef.current || engineState.acting === netRef.current.mySpiritId;
  // N7: the host also controls bot seats — bot step machine + gated functions
  // need to know when this client should drive a bot's turn.
  const amIBotController = (() => {
    const net = netRef.current;
    if (!net) return false; // offline: bots run via isBot(acting) already
    if (!net.isHost) return false; // only the host runs bots
    const actId = engineState.acting;
    return !!net.seats?.find(s => s.isBot && s.spiritId === actId);
  })();
  // canAct: true when this client should process actions (human turn OR host-run
  // bot). N8: a resyncing client is frozen — its local state can't be trusted.
  const canAct = (isMyTurn || amIBotController) && !netSync;

  // N4: listen for remote ACTION frames — apply to engine, skip orchestration
  useEffect(() => {
    const net = netRef.current;
    if (!net) return;
    return net.client.on("ACTION", frame => {
      // N8: seq-gap tripwire — runs on EVERY frame, echoes included
      if (frame.seq != null) {
        const expected = lastSeqRef.current != null ? lastSeqRef.current + 1 : frame.seq;
        const gap = frame.seq !== expected;
        lastSeqRef.current = frame.seq;
        if (gap) return startResync(`SEQ GAP — got ${frame.seq}, expected ${expected}`);
      }
      // N8: frozen while resyncing — these frames are inside the CATCH_UP bundle
      if (netSyncRef.current) return;
      // Skip echoes — we already applied locally (spectators never send, never skip)
      if (net.seatId != null && frame.seatId === net.seatId) return;
      // N8: desync tripwire (landmine #1) — was console-only, now freeze + auto-recover
      if (frame.cursorBefore != null && engineRef.current.rng.cursor !== frame.cursorBefore) {
        return startResync(`DESYNC — local cursor=${engineRef.current.rng.cursor} ≠ sender's ${frame.cursorBefore} (${frame.action?.type})`);
      }
      // Apply the action — engine state only, no orchestration (addLog / FX / timeouts)
      actionLogRef.current.push({ action: frame.action, cursorBefore: frame.cursorBefore });
      const next = applyAction(engineRef.current, frame.action);
      engineRef.current = next;
      setEngineState(next);

      // ── N12: REMOTE BATTLE OVERLAY SYNC ─────────────────────────────────────
      // Battle overlays are presentation-only (React state, not engine state).
      // The acting client's orchestration sets them; remote clients need to
      // mirror the overlay so all players see and participate in battles.
      const aType = frame.action?.type;

      // ── RIFF-OFF: remote client opens the overlay when the engine battle starts
      if (aType === "RIFF_OFF_STARTED") {
        const eb = next.battle;
        if (eb) {
          const atk = eb.atkRiff, def = eb.defRiff;
          const defNotesArr = riffDegreesToNotes(def.degrees, def.sharps);
          setBattleState({
            riffOff: true, sonicAttack: true,
            oneLiner: null,
            phase: 'riff_intro',
            attackerId: eb.attackerId, defenderId: eb.defenderId,
            atkRiff: { notes: riffDegreesToNotes(atk.degrees, atk.sharps),
                       freqs: atk.degrees.map((d, i) => riffDegreeFreq(d, atk.sharps[i])),
                       rhythm: atk.rhythm, contour: atk.contour,
                       voicing: voiceRiff(atk.degrees, atk.sharps, atk.rhythm) },
            defRiff: { notes: defNotesArr,
                       freqs: def.degrees.map((d, i) => riffDegreeFreq(d, def.sharps[i])),
                       rhythm: def.rhythm, kind: def.kind,
                       voicing: voiceRiff(def.degrees, def.sharps, def.rhythm) },
            defGlitch: eb.defGlitch ?? [], glitchAt: null,
            defGhosts: eb.defGhosts ?? null, ghostHit: null,
            turn: 'attacker', noteIdx: -1, countdown: 3, round: 1,
            atkResults: [], defResults: [], feedback: null,
          });
          setDiceDisplay(null);
        }
      }

      // ── RIFF-OFF: when the remote side submits results, update our overlay
      if (aType === "RIFF_RESULTS_SUBMITTED") {
        const { role, results } = frame.action;
        const key = role === 'attacker' ? 'atkResults' : 'defResults';
        setBattleState(p => {
          if (!p?.riffOff) return p;
          const upd = { ...p, [key]: results };
          // N12: When the defender's client receives the attacker's results,
          // advance to the handoff phase so the defender can play their answer.
          const myId = netRef.current?.mySpiritId;
          if (role === 'attacker' && myId === p.defenderId) {
            upd.phase = 'riff_handoff';
          }
          return upd;
        });
      }

      // ── RIFF-OFF: the remote side resolved — show the verdict
      if (aType === "RIFF_RESOLVED") {
        const v = next.battle?.verdict;
        if (v) {
          const bs = battleStateRef.current;
          if (bs?.riffOff) {
            const { round, attackerWon, margin, tie, decidedBy, damage } = v;
            setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_clash', round, clashStage: 'charge',
              clashWinner: null, attackerWon, margin, damage, tie, decidedBy, atkStats: v.atkStats, defStats: v.defStats } : p);
          }
        }
      }

      // ── RIFF-OFF: Round 2 — update overlay with new riffs
      if (aType === "RIFF_ROUND2_STARTED") {
        const eb = next.battle;
        if (eb) {
          const atk = eb.atkRiff, def = eb.defRiff;
          const defNotesArr = riffDegreesToNotes(def.degrees, def.sharps);
          setBattleState(p => p?.riffOff ? {
            ...p, round: 2,
            atkRiff: { notes: riffDegreesToNotes(atk.degrees, atk.sharps),
                       freqs: atk.degrees.map((d, i) => riffDegreeFreq(d, atk.sharps[i])),
                       rhythm: atk.rhythm, contour: atk.contour,
                       voicing: voiceRiff(atk.degrees, atk.sharps, atk.rhythm) },
            defRiff: { notes: defNotesArr,
                       freqs: def.degrees.map((d, i) => riffDegreeFreq(d, def.sharps[i])),
                       rhythm: def.rhythm, kind: def.kind,
                       voicing: voiceRiff(def.degrees, def.sharps, def.rhythm) },
            defGlitch: eb.defGlitch ?? [], glitchAt: null,
            defGhosts: eb.defGhosts ?? null, ghostHit: null,
            atkResults: [], defResults: [], feedback: null,
            phase: 'riff_r2intro',
          } : p);
        }
      }

      // ── RIFF-OFF: closed — tear down the overlay
      if (aType === "RIFF_CLOSED") {
        riffEngineRef.current?.timers?.forEach(clearTimeout);
        riffEngineRef.current = null;
        setBattleState(null);
        setDiceDisplay(null);
      }

      // ── MELEE: remote client opens the battle overlay on a swing/sonic roll
      if (aType === "ATTACK_ROLLED") {
        const eb = next.battle;
        if (eb) {
          const { attackerId, defenderId } = frame.action;
          const isSonic = frame.action.kind === 'sonic';
          playBattleMusic(isSonic ? riffOffSong : battleSong, 0.7);
          dieSettledRef.current = { atk: false, def: false };
          setBattleState({
            phase: 'enter_attacker',
            attackerId, defenderId,
            atkStat: eb.atkStat ?? frame.action.atkStat, defStat: eb.defStat ?? frame.action.defStat,
            atkBase: frame.action.atkStat, atkBonus: 0, defBase: frame.action.defStat, defBonus: 0,
            atkRoll: eb.atkRoll, defRoll: eb.defRoll, atkTotal: eb.atkTotal, defTotal: eb.defTotal,
            attackerWon: eb.attackerWon, margin: eb.margin, damage: eb.damage,
            posing: frame.action.posing,
            pickPos: 0,
            spinFaceAtk: null, spinFaceDef: null,
            atkDieReady: true, defDieReady: true,
            sonicAttack: isSonic,
            sunbeam: frame.action.sunbeam,
          });
          setDiceDisplay(null);
          // Run the cinematic timeline (skip the slow enter-attacker intro for remote)
          const T = (fn, ms) => { const id = setTimeout(fn, ms / (gameSpeedRef.current || 1)); battleTimersRef.current.push(id); };
          T(() => setBattleState(p => p ? { ...p, phase: 'flash_drive' } : p), 700);
          T(() => setBattleState(p => p ? { ...p, phase: 'pick_drive_slide', pickPos: -(p.atkStat ?? 0) } : p), 1400);
          T(() => setBattleState(p => p ? { ...p, phase: 'enter_defender' } : p), 2800);
          T(() => setBattleState(p => p ? { ...p, phase: 'flash_sustain' } : p), 3500);
          T(() => setBattleState(p => p ? { ...p, phase: 'pick_sustain_slide', pickPos: -(p.atkStat ?? 0) + (p.defStat ?? 0) } : p), 4200);
          T(() => setBattleState(p => p ? { ...p, phase: 'atk_die_spin' } : p), 5600);
        }
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // N8: mid-game CATCH_UP — desync recovery AND wifi-blip rejoin both land here
  // (the client auto-rejoins after a drop; the server answers WELCOME+CATCH_UP).
  // Rebuild the engine from scratch: seed + config are immutable for the match,
  // so makeInitialState + the server's authoritative log IS the current state —
  // the same machinery as the N6 mount-time replay (engine replay is cheap).
  // Presentation state (open cinematics, camera) is NOT rebuilt — accepted v1;
  // the engine converges and the next turn renders normally. No remount
  // (landmine #2): gameState is untouched, only engine state is replaced.
  useEffect(() => {
    const net = netRef.current;
    if (!net) return;
    return net.client.on("CATCH_UP", f => {
      let s = makeInitialState(gameState, gameState.seed);
      for (const entry of f.log) s = applyAction(s, entry.action);
      engineRef.current = s;
      setEngineState(s);
      actionLogRef.current = f.log.map(e => ({ action: e.action, cursorBefore: e.cursorBefore }));
      lastSeqRef.current = f.log.length ? (f.log[f.log.length - 1].seq ?? null) : 0;
      netSyncRef.current = null;
      setNetSync(null);
      console.log(`[RLSW NET] resynced — ${f.log.length} actions replayed, cursor=${s.rng.cursor}`);
      setLog(p => ["🔄 Resynced with the room server.", ...p].slice(0, 40)); // local-only, don't relay
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // N8: presence — the server broadcasts ROOM_STATE on every connect/disconnect;
  // seats carry `connected` so we can hang "X disconnected" banners off it.
  useEffect(() => {
    const net = netRef.current;
    if (!net) return;
    return net.client.on("ROOM_STATE", f => setNetSeatsLive(f.seats));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Another player pressed "back to lobby" — the server reset the room. Follow
  // them out: close our socket (session survives, so the Lobby's auto-rejoin
  // reclaims our seat in the room's lobby) and unmount the Game.
  useEffect(() => {
    const net = netRef.current;
    if (!net) return;
    return net.client.on("RETURNED_TO_LOBBY", () => {
      net.client.close(); // keep session — auto-rejoin lands in the room lobby
      onReturnToLobby({ resetRoom: false });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // N8: own-socket status — the client auto-reconnects with backoff (N2);
  // surface the gap so the player knows their inputs aren't going anywhere.
  useEffect(() => {
    const net = netRef.current;
    if (!net) return;
    const offs = [
      net.client.on("net:close", () => setSelfConn("reconnecting")),
      net.client.on("net:open",  () => setSelfConn("ok")),
    ];
    return () => offs.forEach(o => o());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // N5: listen for remote LOG_LINE frames — display the acting client's narrative
  useEffect(() => {
    const net = netRef.current;
    if (!net) return;
    return net.client.on("LOG_LINE", frame => {
      setLog(p => [frame.text, ...p].slice(0, 40));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SPIRITS — engine is the source of truth (Phase 5c ownership flip) ──────
  // `spirits` is now a live view of engineState.spirits (built + owned by
  // makeInitialState on the seeded rng). `setSpirits(updater)` is a DIFFING
  // compatibility shim (mirrors the noteStates slice-5 shim): it applies the
  // (functional or plain-value) update against the CURRENT engine spirits
  // (engineRef is always live), field-diffs each spirit, and dispatches
  // SPIRIT_PATCHED { spiritId, patch } per changed spirit — small, per-spirit,
  // replayable writes. Anything a merge can't express (roster change, field
  // removal) falls back to the SPIRITS_SYNCED full replace — final state
  // identical either way, so the fallback likely never fires in normal play.
  // Sites still graduate to true semantic actions (VIBE_CHANGED, SPIRIT_MOVED,
  // …) when their rules move into reducers.
  const spirits = engineState.spirits;
  const setSpirits = (updater) => {
    const cur = engineRef.current.spirits;
    const next = typeof updater === "function" ? updater(cur) : updater;
    if (next === cur) return; // pure-reader / no-op updaters
    const expressible = Array.isArray(next) && next.length === cur.length
      && next.every((sp, i) => sp && sp.id === cur[i].id
        && Object.keys(cur[i]).every(k => k in sp));
    if (!expressible) {
      // N8 TRIPWIRE: the full-replace fallback must NEVER fire online — a SYNC
      // from one client would relay and stomp every other client's engine state
      // wholesale (handoff landmine #3). Loud console + log line for the report.
      if (netRef.current) {
        console.error("[RLSW NET] TRIPWIRE: SPIRITS_SYNCED fallback fired ONLINE — inexpressible spirits write; report this", next);
        setLog(p => ["🚨 NET TRIPWIRE: SPIRITS_SYNCED fired online — please report (see console).", ...p].slice(0, 40));
      }
      dispatch(spiritsSynced(next)); return;
    }
    next.forEach((sp, i) => {
      const old = cur[i];
      if (sp === old) return;
      const patch = {};
      let changed = 0;
      for (const k of Object.keys(sp)) {
        if (sp[k] !== old[k]) { patch[k] = sp[k]; changed++; }
      }
      if (changed) dispatch(spiritPatched(sp.id, patch));
    });
  };

  // ── ⏩ FAST-FORWARD (client presentation only) ─────────────────────────────
  // A global speed multiplier (1× / 2× / 4×) that divides every presentation
  // timer — bot pacing, battle/riff cinematics, FX, and camera. The engine and
  // all game RULES are untouched; only the display clock scales. At 1× the
  // arithmetic is identity, so default play is byte-for-byte unchanged. Read via
  // a ref so async timeout chains always see the LIVE speed, never a stale
  // closure.
  const [gameSpeed, setGameSpeed] = useState(1);   // 1 | 2 | 4
  const gameSpeedRef = useRef(1);
  useEffect(() => { gameSpeedRef.current = gameSpeed; }, [gameSpeed]);
  const cycleGameSpeed = () => setGameSpeed(s => (s === 1 ? 2 : s === 2 ? 4 : 1));
  // Scaled setTimeout — every presentation delay flows through here. Drop-in for
  // setTimeout(fn, ms): returns the timer id, clamps to ≥0, rounds to an int.
  const gt = (fn, ms = 0) => setTimeout(fn, Math.max(0, Math.round((Number(ms) || 0) / (gameSpeedRef.current || 1))));

  const [action, setAction]   = useState(null); // "move" | "swing" | null
  // 🎯 Hovering a HUD attack button previews that attack's range on the board
  // (same highlight the live aiming mode uses). null | 'swing'|'smash'|'blaster'|'sonic'
  const [hoverPreview, setHoverPreview] = useState(null);
  // ── BATTLE STATE ─────────────────────────────────────────────────────────────
  // actionTokenUsed: has the acting spirit used their action token this turn
  const actionTokenUsed = engineState.turn.actionTokenUsed; // engine-owned (Phase 2)
  // startedOnLimelight lives in the engine now (engineState.turn.startedOnLimelight)
  // battleState: the full in-progress battle, null when no battle
  // { phase: 'rolling_attack'|'rolling_defense'|'result'
  //          |'retaliation_prompt'|'retaliation_spin'|'retaliation_settling'|'retaliation_result'
  //   attackerId, defenderId,
  //   atkRoll, defRoll, atkTotal, defTotal,
  //   margin, attackerWon, damage,
  //   // counter ("Part 2"): counterRoll, vibeBonus, counterTotal, counterTarget,
  //   //   counterSuccess, counterFace, counterReady, counterDmg, counterMargin }
  const [battleState, setBattleState] = useState(null);
  const battleStateRef = useRef(null); // mirrors battleState for use in async callbacks
  const battleTimersRef = useRef([]);   // intro-cinematic setTimeout ids (so a Skip can cancel them)
  const dieSettledRef = useRef({ atk: false, def: false }); // ⛔ one settle chain per die per battle (see handleAtkDieClick)
  // 🎬 Board dive-bomb: triggers when a battle opens, clears after anim finishes
  const [boardDiveBomb, setBoardDiveBomb] = useState(false);
  const prevBattleRef = useRef(null);
  // Keep ref in sync so async callbacks can read latest state without closure issues
  useEffect(() => {
    battleStateRef.current = battleState;
    // Trigger dive-bomb when battleState goes from null → non-null
    if (battleState && !prevBattleRef.current) {
      setBoardDiveBomb(true);
      setTimeout(() => setBoardDiveBomb(false), 1200);
    }
    prevBattleRef.current = battleState;
  }, [battleState]);

  // Phase 5c slice 2d: the `spiritsRef` mirror is gone — async rule callbacks now
  // read `engineRef.current.spirits` (the authoritative store, updated
  // synchronously by dispatch), which is strictly fresher than the render-lagged
  // ref mirror was.

  // ── 🤖 BOT ORCHESTRATION — live-state mirrors so the async bot loop never
  //    reads stale closures. (acting / noteStates / moveStepsLeft / etc. are
  //    declared further down; these effects still capture their live values
  //    because effects run after every render.) ──
  // noteStatesRef removed (Phase 5c) — rule reads use engineRef.current.noteStates.
  const moveStepsLeftRef  = useRef(0);
  const actionTokenUsedRef= useRef(false);
  const actingRef         = useRef(null);
  const winnerRef         = useRef(null);
  const ampsInRangeRef    = useRef(0);
  const rigInRangeRef     = useRef(true);   // 📡 acting spirit inside their rig radius?
  // botBusyRef removed (Phase 7c) — debounce folded into botStepRef ('pending').

  // 🤘 MASTER OF MOSHPITS — spiritId → mob key. While set, the crowd PNGs
  // swarm that rival's hex on the board and "rock" them. Cleared after a beat.
  const [moshpitTargets, setMoshpitTargets] = useState({});

  // 🤘 MASTER OF MOSHPITS — the full cinematic. Three fans get up out of the
  // grandstand, walk onto the board, and mosh it out on the Monster's hex while
  // his song plays. Shape:
  //   { key, spiritId, hexNum, phase: 'walk'|'pit'|'out', movers: [{seed,isDie,sx,sy,tx,ty}] }
  // `phase` drives the CSS: 'walk' = travelling in, 'pit' = circling and moshing,
  // 'out' = fading as the song lands. null when no pit is running.
  const [moshCine, setMoshCine] = useState(null);
  const moshCineRef   = useRef(null);
  const moshTimersRef = useRef([]);   // cinematic setTimeouts, so Skip can cancel them
  const moshAudioRef  = useRef(null); // the song itself (separate from battle music)
  // Synchronous "already paid out" latch. The song ending and the Skip button can
  // race each other inside one tick, and React state won't have caught up — this
  // is what actually keeps the +Drive from landing twice.
  const moshPaidRef   = useRef(null);
  useEffect(() => { moshCineRef.current = moshCine; }, [moshCine]);

  // 🧪 POISON SLIME (Metalness Monster passive) — hexNum → turnsLeft, counted in
  // SPIRIT-TURNS (one tick per player's turn end, not per round).
  // MM drops slime on every hex it leaves; the trail lives a full round — from
  // the moment it's laid until the turn order comes back to him — and deals
  // 1 Vibe damage to anyone who walks onto it or is pushed into it.
  const [poisonSlime, setPoisonSlime] = useState({});

  // RIFF-OFF engine ref — timing-critical bookkeeping for the currently
  // flashing note lives here (not in React state) so reaction times are
  // measured against the real flash timestamp, not a render cycle.
  const riffEngineRef = useRef(null);
  // 🎸⏰ Back to the Past timing ref — fresh flash timestamp lives here, not in state.
  const bttpEngineRef = useRef(null);
  // Chosen instrument for the challenge + its input-window multiplier (guitar gets
  // more leeway since reading a fretboard cold is harder than the piano).
  const bttpModeRef = useRef({ view: 'piano', winMult: 1 });
  // 🎸⏰ Back to the Past — overlay state (declared here, before its input effect)
  const [bttpChallenge, setBttpChallenge] = useState(null);
  // 🎯/🎸/🎹 instrument used to read notes in riff-off battles (toggle on the
  // countdown card). NEON is the standard: notes land on the real neck, in the
  // position you actually play, and it is the only view a real guitar can be
  // played against comfortably. Piano and the falling-gem guitar remain for
  // players who prefer them — the choice is remembered.
  const [riffView, setRiffView] = useState(() => {
    try {
      const v = localStorage.getItem('rlsw.riffView');
      if (v === 'piano' || v === 'guitar' || v === 'neon') return v;
    } catch { /* default */ }
    return 'neon';
  });
  useEffect(() => {
    try { localStorage.setItem('rlsw.riffView', riffView); } catch { /* non-fatal */ }
  }, [riffView]);
  // 🎤 REAL GUITAR — play the riff-off on an actual instrument instead of the
  // keyboard. Persisted: a player who owns a guitar wants this every battle.
  const [riffMicOn, setRiffMicOn] = useState(() => {
    try { return localStorage.getItem('rlsw.riffMic') === '1'; } catch { return false; }
  });
  const [riffMicHeard, setRiffMicHeard] = useState(null);  // { key, at } — last note detected
  const [riffMicErr,   setRiffMicErr]   = useState(null);
  // 🎚️ falling-notes difficulty (toggle on the countdown card) — presets tune
  // fall speed + grade windows (riff/fallingNotes.js). Ref mirror so the run
  // builder (fired from timers) never reads a stale closure.
  const [riffDifficulty, setRiffDifficulty] = useState(() => {
    // Chosen on the Spirit select screen (Lobby) — persisted across sessions.
    try { const v = localStorage.getItem('rlsw.riffDifficulty'); if (v && RIFF_FALL_DIFFICULTY[v]) return v; } catch { /* default */ }
    return RIFF_FALL_DEFAULT;
  });
  const riffDifficultyRef = useRef(riffDifficulty);
  useEffect(() => {
    riffDifficultyRef.current = riffDifficulty;
    try { localStorage.setItem('rlsw.riffDifficulty', riffDifficulty); } catch { /* non-fatal */ }
  }, [riffDifficulty]);
  // 🐢 Riff-off TEMPO — the same setting the practice trainer uses, so a speed
  // you get comfortable with in practice is the speed duels run at. Set on the
  // Lobby settings row. Ref mirror because riffStartRun fires from a timer and
  // must never read a stale closure.
  const [riffSpeed, setRiffSpeed] = useState(loadRiffSpeed);
  const riffSpeedRef = useRef(riffSpeed);
  useEffect(() => { riffSpeedRef.current = riffSpeed; }, [riffSpeed]);
  // Re-read on focus: the Lobby and the practice trainer both write this key,
  // and a match started right after a practice session should honour it.
  useEffect(() => {
    const sync = () => setRiffSpeed(loadRiffSpeed());
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);
  // 🎨 Lite FX: strip GPU-heavy filter/shadow animations in the battle overlay
  const [liteFx, setLiteFx] = useState(() => {
    try { return localStorage.getItem('rlsw.liteFx') === '1'; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem('rlsw.liteFx', liteFx ? '1' : '0'); } catch { /* non-fatal */ } }, [liteFx]);

  // ⏭ when on, the lore/intro cards (riff_intro, round-2 intro) auto-advance to the countdown
  const [skipBattleIntros, setSkipBattleIntros] = useState(false);
  const skipBattleIntrosRef = useRef(false);
  useEffect(() => { skipBattleIntrosRef.current = skipBattleIntros; }, [skipBattleIntros]);

  // ⏭ Auto-skip: when the toggle is on, jump straight from a battle intro card into the
  // ante (or countdown for R2 intros). The ante is a gameplay decision, not a cinematic,
  // so it still appears even with skip-intros on.
  // N12: online — only the acting (attacker) client runs enterRiffAnte() because it calls
  // addLog / pickRandomOneLiner (Math.random) — the defender's client would produce
  // different one-liners and relay duplicate log lines.
  useEffect(() => {
    if (!battleState?.riffOff || !skipBattleIntrosRef.current) return;
    const net = netRef.current;
    const isDefClient = net && net.mySpiritId === battleState.defenderId;
    if (isDefClient) return; // N12: defender doesn't drive the intro
    if (battleState.phase === 'riff_intro') {
      const t = setTimeout(() => enterRiffAnte(), 60);
      return () => clearTimeout(t);
    }
    if (battleState.phase === 'riff_r2intro') {
      const t = setTimeout(() => riffBeginTurn('attacker'), 60);
      return () => clearTimeout(t);
    }
  }, [battleState?.phase, battleState?.riffOff]);

  // ── N12: ONLINE RIFF-OFF COORDINATION ──────────────────────────────────────
  // In online play the attacker and defender are on DIFFERENT machines. Each
  // side plays their own riff run locally and submits results; the acting
  // client resolves once both are in. This effect handles three jobs:
  //  1. Attacker's handoff: when the attacker is waiting at the handoff and
  //     the defender's results arrive (via the relay), trigger resolution.
  //  2. Defender's riff start: when the defender's client sees the handoff
  //     phase, auto-start the defender's riff run (they don't need the
  //     "PASS THE KEYBOARD" button — it's a different screen).
  //  3. Attacker wait screen: show "waiting" text while the defender plays
  //     on the other machine (the BattleMeterOverlay handoff button is
  //     hidden when not on the defender's client).
  useEffect(() => {
    const net = netRef.current;
    if (!net || !battleState?.riffOff) return;
    const myId = net.mySpiritId;
    const isDefClient = myId === battleState.defenderId;
    const isAtkClient = myId === battleState.attackerId;

    // Defender's client: when we see 'riff_handoff' phase, auto-start our riff
    if (isDefClient && battleState.phase === 'riff_handoff' && !battleState.waitingForResolve) {
      const t = setTimeout(() => {
        if (battleStateRef.current?.phase === 'riff_handoff') riffBeginTurn('defender');
      }, 800);
      return () => clearTimeout(t);
    }

    // Attacker's (acting) client: when we're at the handoff and the defender's
    // results arrive via the relay, both sides are in — resolve.
    if (isAtkClient && battleState.phase === 'riff_handoff') {
      const defResults = battleState.defResults;
      if (defResults && defResults.length > 0) {
        const t = setTimeout(() => {
          if (battleStateRef.current?.phase === 'riff_handoff') riffResolve();
        }, 300);
        return () => clearTimeout(t);
      }
    }
  }, [battleState?.phase, battleState?.riffOff, battleState?.defResults?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // RIFF-OFF keyboard listener — armed for the whole falling-notes run.
  // e.key gives 'a' for plain press, 'A' for Shift+A — exactly our sharp rule.
  // All judging lives in riffPressKey (RIFF-OFF ENGINE banner), which is also
  // fed by taps on the highway's strike-zone instrument (mobile / mouse play).
  useEffect(() => {
    if (!battleState?.riffOff || battleState.phase !== 'riff_play') return;
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key.length !== 1 || !/[a-gA-G]/.test(e.key)) return; // only note keys count
      riffPressKey(e.key);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [battleState?.riffOff, battleState?.phase, battleState?.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 🎤 RIFF-OFF MIC — play the riff on a REAL guitar ────────────────────────
  // A third input into the SAME judge the keyboard and the neck taps use. This
  // works with no translation layer because micPitch and guitarMap already
  // agree on the note alphabet: both index PC_KEYS
  // ['a','A','b','c','C','d','D','e','f','F','g','G'] from the same
  // DEGREE0_PITCH anchor, so micPitch's `key` IS a riffPressKey key. (Do not
  // "fix" this by routing through pcAbsolute — see the melody-step mic note;
  // there the target alphabet is NOTE_POOL, which is a different basis.)
  //
  // Pitch class only, deliberately: the mic hears WHAT you played, never WHERE.
  // A reticle on string 3 / fret 5 is satisfied by that pitch anywhere on the
  // neck, which is correct — riffPressKey has always judged by key, and boxing
  // a player into one fingering would punish valid alternate voicings.
  const riffMicHandleRef = useRef(null);
  const riffMicPressRef  = useRef(() => {});
  const riffMicClearRef  = useRef(null);
  // The readout self-clears on a timer. Deriving it from a timestamp compared
  // against performance.now() at render time is impure AND wrong: nothing
  // re-renders when the note goes stale, so the last note heard would stay on
  // screen until some unrelated state moved.
  useEffect(() => { riffMicPressRef.current = ({ key }) => {
    setRiffMicHeard(key);
    clearTimeout(riffMicClearRef.current);
    riffMicClearRef.current = setTimeout(() => setRiffMicHeard(null), 900);
    riffPressKey(key);
  }; });

  useEffect(() => {
    const bs = battleState;
    // Armed through the COUNTDOWN as well as the run: getUserMedia plus an
    // AudioContext spin-up costs real time, and opening it on the first gem
    // would eat the opening notes of the riff.
    const performerId = bs?.turn === 'attacker' ? bs?.attackerId : bs?.defenderId;
    const humanTurn   = !!bs?.riffOff && !isBot(spirits.find(s => s.id === performerId));
    const wanted = riffMicOn && humanTurn &&
      (bs.phase === 'riff_countdown' || bs.phase === 'riff_play');
    let cancelled = false;

    if (wanted && !riffMicHandleRef.current) {
      startMicListening(payload => {
        // Runs inside micPitch's rAF loop — an exception here would vanish into
        // the audio thread and look like a detection failure. Log it loudly.
        try { riffMicPressRef.current(payload); }
        catch (err) { console.error('[RLSW MIC] riff press failed:', err); }
      })
        .then(h => {
          if (cancelled) { h.stop(); return; }
          riffMicHandleRef.current = h;
          setRiffMicErr(null);
          addLog('🎤 Mic armed — play the riff on your guitar.');
        })
        .catch(() => { if (!cancelled) { setRiffMicErr('mic blocked'); setRiffMicOn(false); } });
    } else if (!wanted && riffMicHandleRef.current) {
      riffMicHandleRef.current.stop();
      riffMicHandleRef.current = null;
      setRiffMicHeard(null);
    }
    return () => { cancelled = true; };
  }, [riffMicOn, battleState?.riffOff, battleState?.phase, battleState?.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hand the device back if the battle unmounts mid-run.
  useEffect(() => () => {
    riffMicHandleRef.current?.stop(); riffMicHandleRef.current = null;
    clearTimeout(riffMicClearRef.current);
  }, []);

  function toggleRiffMic() {
    if (!micAvailable()) {
      setRiffMicErr('no mic');
      addLog('🎤 No microphone available (needs HTTPS or localhost).');
      return;
    }
    setRiffMicOn(v => {
      const next = !v;
      try { localStorage.setItem('rlsw.riffMic', next ? '1' : '0'); } catch { /* non-fatal */ }
      return next;
    });
  }

  // 🎸⏰ BACK TO THE PAST — note input listener (armed only while a note flashes).
  useEffect(() => {
    if (!bttpChallenge || bttpChallenge.phase !== 'play') return;
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key.length !== 1 || !/[a-gA-G]/.test(e.key)) return;
      const eng = bttpEngineRef.current;
      if (!eng || eng.resolved) return;
      bttpInput(e.key.toLowerCase());
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bttpChallenge?.phase, bttpChallenge?.idx, bttpChallenge?.stageKey]);
  // diceDisplay: { atk: null|number, def: null|number, rolling: 'atk'|'def'|null }
  const [diceDisplay, setDiceDisplay] = useState(null);
  // 🎤 RIFF-OFF TAUNT DISPLAY — big bold screen-wide text for one-liners
  const [tauntDisplay, setTauntDisplay] = useState(null); // { line, name, color, key }
  const moveStepsLeft = engineState.turn.moveStepsLeft; // engine-owned (Phase 2)
  const [stackCommitDest, setStackCommitDest] = useState(null); // 🎸 null = melody mode, 'drive' | 'sustain' = stack commit mode
  // 🎯 TURN STEP — progressive HUD flow: chord → melody → move_act
  // B8: 'pivot' is no longer a stage — the turn opens on the chord step.
  const [turnStep, setTurnStep] = useState('chord');
  // 🎵 FLY NOTE — animated chip that flies from Note Stock to the commit track
  const [flyNote, setFlyNote] = useState(null); // { note, x, y, slotIdx, key }
  const commitTrackRef = useRef(null); // ref on the commit track container for target coords
  // 🎸 FLY CHORD NOTE — animated chip that flies from Note Stock to the chord stack
  const [flyChordNote, setFlyChordNote] = useState(null); // { note, x, y, dx, dy, key }
  const chordStackRef = useRef(null); // ref on the vertical chord stack for target coords
  // 🎛️ FLOATING VOICING PANEL — toggle show/hide
  const [voicingOpen, setVoicingOpen] = useState(false);
  const [hoverScale, setHoverScale] = useState(null); // 🎼 { note, x, y } | null — stock note hover → scale-peek popup
  const hoverScaleTimerRef = useRef(null); // 1.5s delay before showing scale peek
  const [movedThisTurn, setMovedThisTurn] = useState(false);

  // 🎓 BEGINNER MODE — tutorial tip popups that fire once per event type
  const [beginnerEnabled, setBeginnerEnabled] = useState(gameState.beginnerMode ?? true);
  const [beginnerTipsSeen, setBeginnerTipsSeen] = useState(new Set());
  const [activeTip, setActiveTip] = useState(null); // { id, title, body } or null
  // The very first tip (welcome) is triggered by the initial Full Scale grant
  // useEffect, which also queues the chord tip to follow it. The skill_tree tip
  // fires the first time the Theory Tree opens (DB bar filled → upgradesPending).
  const turnQueue = engineState.turnQueue; // engine-owned (Phase 2)
  // 🧪 TESTING GROUNDS — dev panel (only when the sandbox was launched from the
  // menu). N8: hard-disabled online — dev grants dispatch real actions and the
  // config rides over the wire, so a testMode flag must never enable it in a room.
  const testMode = !!gameState.testMode && !gameState.net;
  const [devOpen, setDevOpen] = useState(false);
  // (devEventId removed — Testing Grounds now fires stage FX directly)
  // N5: winner derives from engine state so remote clients see it via N4 relay
  const winner = engineState.winner;
  const [hovered, setHovered] = useState(null);
  // ─── TRANSIENT BOARD FX ── (moved to ./hooks/useTransientFx.js)
  const {
    slideOffAnimations, setSlideOffAnimations,
    respawnFlashes, setRespawnFlashes,
    rumblingIds, setRumblingIds,
    floatingDmg, setFloatingDmg,
    effectFlashes, setEffectFlashes,
    spentNotes, setSpentNotes,
  } = useTransientFx();
  const [cameraView, setCameraView]   = useState(null);
  const [manualZoomActive, setManualZoomActive] = useState(false);
  // N6: pre-populate the display log from catch-up logLines (most recent first)
  const [log, setLog] = useState(() => {
    if (gameState.catchUp?.logLines?.length) {
      return gameState.catchUp.logLines.map(e => e.text).reverse().slice(0, 40);
    }
    return ["⚡ RLSW v3.0 — Melody Line System", "🎵 Build your Melody Line → Confirm → Move"];
  });

  // ─── NOTE SYSTEM STATE (per-character) ─────────────────────────────────────
  // makeInitialNoteState now lives in the ENGINE (src/engine/systems/economy.js)
  // and is imported at the top of this file — the temporary client duplicate is
  // gone (it was dead for init since the 5c flip; the engine builds every sheet
  // in makeInitialState on the seeded forked rng). Single source, no drift.

  // ── NOTESTATES — engine is the source of truth (Phase 5c ownership flip) ──────
  // `noteStates` is a live view of engineState.noteStates (built + OWNED by
  // makeInitialState on a seeded FORKED rng). `setNoteStates(updater)` is a
  // compatibility shim: it applies the (functional or plain-value) update against
  // the CURRENT engine map (engineRef is always live), then DIFFS the result per
  // spirit and dispatches NOTE_SHEET_PATCHED for each changed sheet — so the
  // action log carries small, per-spirit writes instead of full-map replaces.
  // Anything a merge can't express (sheet-key removal, added/removed spirit ids)
  // falls back to the NOTE_STATES_SYNCED full replace; final state is identical
  // either way. Sites still graduate to true semantic actions (FAME_CHANGED,
  // FANS_CHANGED, …) as their rules move into reducers.
  const noteStates = engineState.noteStates;
  const setNoteStates = (updater) => {
    const cur = engineRef.current.noteStates;
    const next = typeof updater === "function" ? updater(cur) : updater;
    if (next === cur) return; // no-op update (e.g. a guard returned prev)
    const nextIds = Object.keys(next);
    let fallback = nextIds.length !== Object.keys(cur).length || nextIds.some(id => !(id in cur));
    if (!fallback) {
      for (const id of nextIds) {
        const a = cur[id], b = next[id];
        if (a === b) continue;
        if (Object.keys(a).some(k => !(k in b))) { fallback = true; break; } // key removal → full replace
        const patch = {};
        for (const k of Object.keys(b)) if (a[k] !== b[k]) patch[k] = b[k];
        dispatch(noteSheetPatched(id, patch));
      }
    }
    if (fallback) {
      // N8 TRIPWIRE: same contract as the spirits shim — the full-map replace
      // must never fire online (handoff landmine #3). Loud console + log line.
      if (netRef.current) {
        console.error("[RLSW NET] TRIPWIRE: NOTE_STATES_SYNCED fallback fired ONLINE — inexpressible noteStates write; report this", next);
        setLog(p => ["🚨 NET TRIPWIRE: NOTE_STATES_SYNCED fired online — please report (see console).", ...p].slice(0, 40));
      }
      dispatch(noteStatesSynced(next));
    }
  };


  // ─── BGM ── (state moved to ./hooks/useBgmState.js)
  const { audioRef, currentTrackIdxRef, bgmMuted, setBgmMuted, bgmVolume, setBgmVolume, bgmTrackNum, setBgmTrackNum } = useBgmState();

  // ─── BATTLE / RIFF-OFF MUSIC ──────────────────────────────────────────────
  const battleAudioRef = useRef(null);

  // ⚡ PERF — audio elements are CACHED, never rebuilt.
  //
  // This used to be `new Audio(src)` on every battle. battle_song.mp3 is ~1.6 MB
  // and Riff_off_song.mp3 ~1.9 MB, so each battle threw away the decoded buffer
  // and forced the browser to decode megabytes of MP3 again — on the main
  // thread, at the exact moment the battle overlay animates in. That is the
  // stutter. Decode once, reuse forever: replays are just currentTime = 0.
  const audioCacheRef = useRef(new Map());
  function getCachedAudio(src) {
    const cache = audioCacheRef.current;
    let audio = cache.get(src);
    if (!audio) {
      audio = new Audio(src);
      audio.preload = 'auto';
      audio.loop = true;
      cache.set(src, audio);
    }
    return audio;
  }

  // Warm the decode during idle time after mount, so even the FIRST battle
  // doesn't pay for it. requestIdleCallback keeps this off the critical path;
  // browsers without it fall back to a lazy timeout.
  useEffect(() => {
    if (liteFx) return;
    const warm = () => { [battleSong, riffOffSong].forEach(src => { try { getCachedAudio(src).load(); } catch {} }); };
    const ric = window.requestIdleCallback;
    const handle = ric ? ric(warm, { timeout: 4000 }) : setTimeout(warm, 2500);
    return () => { if (ric && window.cancelIdleCallback) window.cancelIdleCallback(handle); else clearTimeout(handle); };
  }, [liteFx]); // eslint-disable-line react-hooks/exhaustive-deps

  function playBattleMusic(src, volume = 0.5) {
    if (liteFx) return;   // 🎨 lite FX: skip audio decoding to save CPU
    stopBattleMusic();
    const audio = getCachedAudio(src);
    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    battleAudioRef.current = audio;
  }
  function stopBattleMusic() {
    if (battleAudioRef.current) {
      battleAudioRef.current.pause();
      battleAudioRef.current.currentTime = 0;
      // Only drop the "currently playing" pointer — the element stays in the
      // cache with its decoded buffer intact, ready for the next battle.
      battleAudioRef.current = null;
    }
  }
  // Stop battle/riff-off music whenever the battle closes
  useEffect(() => {
    if (!battleState) stopBattleMusic();
  }, [battleState]);

  // ─── 📊 MATCH STATS ────────────────────────────────────────────────────────
  // Cumulative riff-off note grades + battle totals per spirit, shown on the
  // victory scoreboard. A ref, not state: written during play, read once at
  // game end (local display only — never enters the engine or the netcode).
  const matchStatsRef = useRef({});
  function statsFor(id) {
    const m = matchStatsRef.current;
    if (!m[id]) m[id] = {
      riff: { perfect: 0, good: 0, ok: 0, miss: 0, wrong: 0 },
      battleFor: 0, battleAgainst: 0, battleW: 0, battleL: 0,
    };
    return m[id];
  }
  // Every dice battle (Thrash swing, physical special, Sonic): bank both sides'
  // totals — "your number vs the rival's number" — plus the W/L.
  function recordBattleTotals(attackerId, defenderId, atkTotal, defTotal, attackerWon) {
    const a = statsFor(attackerId), d = statsFor(defenderId);
    a.battleFor += atkTotal; a.battleAgainst += defTotal;
    d.battleFor += defTotal; d.battleAgainst += atkTotal;
    if (attackerWon) { a.battleW++; d.battleL++; } else { a.battleL++; d.battleW++; }
  }
  // Every riff-off performance: tally each judged note's grade.
  function recordRiffResults(spiritId, results) {
    const r = statsFor(spiritId).riff;
    (results ?? []).forEach(x => { if (x?.grade != null && r[x.grade] != null) r[x.grade]++; });
  }

  // Manual zoom/pan
  const manualVBRef  = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef  = useRef(null);
  const svgRef       = useRef(null);
  const boardDivRef  = useRef(null);

  const addLog = useCallback(m => {
    setLog(p => [m, ...p].slice(0, 40));
    // N5: relay log lines so remote clients read the same story (N6: spectators don't send)
    if (netRef.current && !netRef.current.spectator) netRef.current.client.sendLogLine(m);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Spawn initial board cards on game start
  useEffect(() => {
    setBoardCards(spawnBoardCards([], gameState.spirits, []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── POINTS FLASH STATE ──────────────────────────────────────────────────────
  const [pointsFlash, setPointsFlash] = useState(null);
  // voiceRollFx: { value:1..6, success:bool, key } — drives the animated Mic d6
  const [voiceRollFx, setVoiceRollFx] = useState(null);
  // 🔊 Amp deck thump — { id, key } bumps a 300ms speaker-thump on that
  // Spirit's corner stack when their Sonic beam fires (AMP_DECK_DESIGN.md §3.2)
  const [deckThump, setDeckThump] = useState(null);
  // pointsFlash: { lines: ['...','...'], key: Date.now() } — clears after animation
  // freshNoteIdx: { spiritId, indices:Set<number>, key } — which Note Stock slots
  // just got refilled at turn start, so they can pop in instead of silently changing.
  const [freshNoteIdx, setFreshNoteIdx] = useState(null);

  const [pulsingHex, setPulsingHex] = useState(null); // hex num that glows on turn start
  // ─── BOARD DEPLOYABLES ── (moved to ./hooks/useBoardState.js)
  const {
    boardCards, setBoardCards,
    cardRespawnIn, setCardRespawnIn,
  } = useBoardState();
  // Phase 2 stub: board amps removed — empty array keeps downstream reads safe.
  const amps = [];
  // ─── FAN ECONOMY ── (moved to ./hooks/useFanEconomy.js)
  const {
    limelightScores, setLimelightScores,
    posing, setPosing,
    unsurePool, setUnsurePool,
    unsureFx, setUnsureFx,
    fanFx, setFanFx,
  } = useFanEconomy(SPOTLIGHT_POOL);
  // ── SPOTLIGHT ── (ENGINE-owned — Phase 6a, fully migrated) ─────────────────
  const spotlightHex = engineState.board.spotlightHex;
  // 💥 Floating combat numbers (e.g. −2 ❤️) that drift up over an affected hex.
  const [damageFx, setDamageFx] = useState([]); // [{ key, hexNum, text, color }]
  // turnCount lives in the engine now (engineState.turn.count)

  // ─── EVENT SPACES STATE ── (ENGINE-owned — Phase 6a, fully migrated) ───────
  const eventHexes = engineState.board.eventHexes;
  // activeEvent: { spiritId, eventId, phase:'reveal'|'result', resultLines:[], rolls? }
  const [activeEvent, setActiveEvent] = useState(null);
  // 🧠 Trivia: questions already asked this game (no repeats until the pool is exhausted).
  const usedTriviaRef = useRef(new Set());
  const eventRespawnIn = engineState.board.eventRespawnIn;
  const flamingHexes = engineState.board.flamingHexes;

  // ─── 🎇 STAGE EFFECTS ── (ENGINE-owned — Phase 6b full flip) ────────────────
  // Board hazards fired once each at ⭐8/16/24 — seeded deck, no repeats. The
  // active effects (smoke/laser/pyro/animatronics) now live in
  // engineState.stageFx; these are render views. Hazard checks inside timeout
  // chains read engineRef.current.stageFx (synchronously fresh — the old
  // stageFxHazardRef mirror is gone). Only the activation marquee stays React.
  const { stageFxBanner, setStageFxBanner } = useStageEffects();
  const smokeFx = engineState.stageFx.smoke;
  const pyroFx = engineState.stageFx.pyro;
  const animatronics = engineState.stageFx.animatronics;
  // `key` re-arms the beam CSS animation per pattern; roundsLeft is unique per
  // pattern within the one laser show a game can have (deck never repeats).
  const laserFx = engineState.stageFx.laser
    ? { ...engineState.stageFx.laser, key: engineState.stageFx.laser.roundsLeft } : null;

  /** 🎇 True when at least one Stage Effect is active on the board. */
  function anyStageEffectActive() {
    const fx = engineRef.current.stageFx;
    return !!(fx?.smoke || fx?.laser || fx?.pyro || fx?.animatronics);
  }

  // ─── 🤘 ROCK GOD ── (ENGINE-owned — Phase 6c flip; clock stays React) ───────
  // Endgame boss: summoned from grantFame when 25 FP is reached WITHOUT a
  // runaway lead. The god object + outcome live in engineState.rockGod (views
  // below; async/timeout reads use engineRef.current.rockGod — the old
  // rockGodRef/godSummonedRef mirrors are gone). Rules: engine/systems/rockGod.js.
  const {
    bossTimer, setBossTimer,
    bossTimerExpired, setBossTimerExpired,
    godBanner, setGodBanner,
  } = useRockGod();
  const rockGod = engineState.rockGod.god;
  const bossOutcome = engineState.rockGod.outcome;
  // The fight is LIVE while the god stands and neither side has won.
  const rockGodActive = !!(rockGod && rockGod.hp > 0 && !bossOutcome && !winner);

  // ─── BOARD MINI-GOALS — Lost Chords ── (ENGINE-owned — Phase 6a, migrated) ──
  const boardTokens = engineState.board.boardTokens;

  // 🎵 pendingLostChordPickup: { spiritId, note, roninGreed } — waiting on the
  // add-to-Chord-Stack vs bank-it choice (skipped/auto-banked if the revoice's
  // already spent this turn). See ECONOMY_HANDOFF.md.
  const [pendingLostChordPickup, setPendingLostChordPickup] = useState(null);

  const [skillsCollapsed, setSkillsCollapsed] = useState(true); // HUD skills section starts collapsed

  // ─── CHARGE ZONES ── (ENGINE-owned — Phase 6a, fully migrated) ─────────────
  const chargeZones = engineState.board.chargeZones;
  // chargeChoicePending: { spiritId, num } — Overcharge unlocked, waiting on the
  // die-tier-boost vs chord-assist choice.
  const [chargeChoicePending, setChargeChoicePending] = useState(null);

  // 🎼 Delayed hover tooltip — shows a hovered track note's scales (teaching aid).
  const [noteScaleTip, setNoteScaleTip] = useState(null); // { note, x, y } | null
  const noteTipTimerRef = useRef(null);

  // ─── RIFF STATE ── (moved to ./hooks/useRiffState.js)
  const {
    riffBook, setRiffBook,
    riffBanner, setRiffBanner,
    showRiffbook, setShowRiffbook,
    signatureSpirit, setSignatureSpirit,
    riffbookTab, setRiffbookTab,
    legacyPlayingId, setLegacyPlayingId,
    cadenceToast, setCadenceToast,
  } = useRiffState();

  // ─── BGM DISABLED ────────────────────────────────────────────────────────────
  // BGM tracks removed — using custom music only.  Uncomment to re-enable.
  //
  // useEffect(() => {
  //   const idx = nextBgmTrack();
  //   currentTrackIdxRef.current = idx;
  //   setBgmTrackNum(idx + 1);
  //   const audio = new Audio(BGM_TRACKS[idx]);
  //   audio.volume = bgmVolume;
  //   audio.loop = false;
  //   audioRef.current = audio;
  //   audio.play().catch(() => {});
  //   function handleEnded() {
  //     const next = nextBgmTrack(currentTrackIdxRef.current);
  //     currentTrackIdxRef.current = next;
  //     setBgmTrackNum(next + 1);
  //     audio.src = BGM_TRACKS[next];
  //     audio.play().catch(() => {});
  //   }
  //   audio.addEventListener("ended", handleEnded);
  //   return () => { audio.removeEventListener("ended", handleEnded); audio.pause(); };
  // }, []); // eslint-disable-line
  //
  // useEffect(() => { if (audioRef.current) audioRef.current.muted = bgmMuted; }, [bgmMuted]);
  // useEffect(() => { if (audioRef.current) audioRef.current.volume = bgmVolume; }, [bgmVolume]);
  //
  // const bgmSkip = useCallback(() => {
  //   const audio = audioRef.current;
  //   if (!audio) return;
  //   const next = nextBgmTrack(currentTrackIdxRef.current);
  //   currentTrackIdxRef.current = next;
  //   setBgmTrackNum(next + 1);
  //   audio.src = BGM_TRACKS[next];
  //   if (!bgmMuted) audio.play().catch(() => {});
  // }, [bgmMuted]);
  const bgmSkip = () => {}; // no-op stub

  // Attach wheel listener as non-passive
  useEffect(() => {
    const div = boardDivRef.current;
    if (!div) return;
    const handler = (evt) => handleBoardWheel(evt);
    div.addEventListener("wheel", handler, { passive: false });
    return () => div.removeEventListener("wheel", handler);
  });

  // ─── 🎓 BEGINNER TIP DEFINITIONS (spoken by PICKLES) ───────────────────────
  // Each tip = { title, pages: [ page ] }, where a page is:
  //   { body, anchor?, emote?, act?, tag?, mood?, gate?, gateHint? }
  //
  //   anchor   — a HUD element wearing data-tip-anchor="<name>". The overlay
  //              spotlights it, and Pickles flies over and AIMS HIS POINT at it.
  //              Missing/off-screen anchors degrade to a centred card.
  //   emote    — 'drive'|'sustain'|'flex'|'paid'|'ko'|'gold'|'fame' (see Pickles.jsx)
  //   act      — 'lunge'|'recoil'|'swing'|'smash'|'travel' — he acts it out
  //   foe      — true spawns the GRAY PICK he spars with. Only does anything
  //              alongside act 'lunge' (he rams it) or 'recoil' (it rams him).
  //   crowd    — true and a crowd of fans runs in and gathers around him.
  //   tag      — { text, color } floating label, e.g. −DRIVE coming off a hit
  //   gate     — key in the `tipGates` map. The page WAITS for the player to do
  //              the thing; the overlay stops eating clicks so they can reach
  //              the real button, and auto-advances when the gate opens.
  //   gateHint — what the waiting badge says, e.g. 'HIT ⚔️ DRIVE'
  //
  // Content is written against the CURRENT rules — if a system changes, the tip
  // lies until someone updates it. Don't let the tip lie.
  //
  // ✍️ VOICE: Pickles is a guitar pick with opinions. Loud, encouraging, a
  // little unhinged. He is NOT a manual — every page is one idea, said fast,
  // pointed at one thing on screen. The overlay types him out at reading speed,
  // so a page past ~4 lines outstays its welcome. SHOW, don't list: if a page
  // is about taking a hit, he should take one.
  //
  // 📄 ONE IDEA PER PAGE. Pages are free; attention is not. If a page introduces
  // a thing AND explains what the thing does, split it — the reader needs a beat
  // to actually look at what the arrow is pointing at before the next noun
  // arrives. Two ideas welded together with "and" is a page break you haven't
  // taken yet.
  //
  // 🔁 SAY IT ONCE. Each system gets ONE home page, and every other page is
  // allowed to reference it but not re-teach it. Two symptoms to watch for when
  // editing: the same `anchor` appearing twice in one tip (he flies back to a
  // thing he already pointed at, which reads as him losing his place), and a
  // later tip re-explaining what an earlier one already covered. The welcome tip
  // is the usual offender — it's the one written before the others existed.
  const BEGINNER_TIPS = {
    welcome: {
      title: '🎸 Welcome to The Stage',
      pages: [
        // 🎸 PICKLES INTRODUCES HIMSELF. These pages have to earn his presence —
        // a floating cartoon that never says who it is reads as an ad. Three
        // beats, one per page: name, why he's here, how to shut him up.
        { body: 'Hey! HEY. Down here. Name\'s PICKLES. I\'m a guitar pick. Yes, with a face. Long story, don\'t worry about it.' },
        // ⚠️ His backstory page ("dropped, stepped on, more gig bags than you've
        // had hot dinners") lived here and is CUT. Nobody is here for the pick's
        // history — the name page already establishes who's talking, and the
        // sooner he's pointing at the HUD the better. Don't reinstate it.
        // ⚠️ "Now — let's get you on stage" used to close this page, one line
        // before the next page says "Welcome... to THE STAGE!". Two welcomes in
        // a row; the second one is the real one, so this page just gets out of
        // the way. Don't re-add a hand-off line here.
        { body: 'Had enough of me? "Turn off tips" down there, no hard feelings.' },
        { body: 'Welcome, intrepid Rock Spirit, to... THE STAGE! On this stage you will harness the Awesome power of Music and face your Rivals head on.' },
        { body: 'Use your MELODY to — one! MOVE. Every note you play is a hex you travel.', anchor: 'note-stock', act: 'travel' },
        // 💲 THE ONLY Db PAGE IN THIS TIP. Db used to be explained three times
        // across the welcome — here, again on the root-note page, and a third
        // time on a SECOND db-bar page right after it, which flew him back to a
        // bar he'd already pointed at. All of it is folded into this one beat.
        { body: 'Two! Gain DECIBILLS (Db). That\'s the currency of learning — Db is what buys you new skills, new tech and better gear.', anchor: 'db-bar', emote: 'paid' },
        // 🎟️ The fans don't just get named — they run in and gather round him.
        { body: 'Three! Gain FANS. They\'re out there listening to your tune, and they make everything you earn worth more.', anchor: 'fan-crowd', crowd: true },
        // 🎸 A ROADMAP LINE, not a lesson. The `chord` tip teaches the stacks
        // properly the moment the player reaches that step — so this stays at
        // "these two things exist and here's where they live" and goes no
        // further. Anything more detailed here gets said twice.
        { body: 'And use your CHORDS to improve your attack strength (DRIVE) and your defense (SUSTAIN). Totally rad.', anchor: 'chord-stack', emote: 'flex' },
        { body: 'This glowing badge is your ROOT NOTE — the tonal centre of your turn. It\'s what decides which notes in your pool light up as CLEAN.', anchor: 'root-note' },
        { body: 'Those lit-up ones are the money notes. Play clean, get paid.', anchor: 'note-stock' },
        // ⚠️ The TRANSPOSE card used to be introduced here and AGAIN in the
        // chord tip. It's a rescue tool for a bad hand — meaningless before the
        // player has met a hand they dislike — so it now lives only in `chord`.
      ],
    },
    skill_tree: {
      title: '🌳 The Theory Tree',
      pages: [
        { body: 'Your Db bar is FULL — the THEORY TREE is open! Pick a SKILL TARGET: scale tones, amps, crew, combat tricks. Pick a route that fits how you wanna play. Or panic-pick. Everyone does, their first game.' },
        { body: 'In-scale notes keep feeding Db toward that target — when the bar refills, the skill is yours and you pick the next one. The mini progress bar lives on your spirit card.', anchor: 'db-bar' },
      ],
    },
    // 🎸 B8: the `pivot` tip is GONE along with the step it explained. There is no
    // "choose your scale" moment any more — the Drive Stack's chord quality sets
    // Major/Minor at turn start. What that tip had to teach (root, mode, what
    // Discord costs you) now belongs to the chord step, which is where the player
    // actually influences it. Anything queueing showTip('pivot') is a leftover.
    chord: {
      title: '🎸 Step 1 — Build Your Stacks',
      pages: [
        // 🚧 GATED. He points at the button and shuts up until you press it.
        // Explaining a panel the player has never opened is how tutorials get
        // skipped — make them open it, THEN talk about what's inside.
        { body: ['Step one: your combat stats live in here, and I\'m not explaining a thing you can\'t see.',
                 'Go on. Hit ⚔️ DRIVE. I\'ll wait.'],
          anchor: 'drive-btn', gate: 'stackOpen', gateHint: 'HIT ⚔️ DRIVE' },
        // 📄 ONE IDEA PER PAGE. The reveal, the red stack, the blue stack and
        // the size limit used to be two crammed pages; a player meeting all of
        // this for the first time can't hold four new nouns at once. He names
        // ONE thing, then shuts up and lets them look at it.
        { body: 'THERE it is. These are your combat stats, spelled in notes.', anchor: 'chord-stack' },
        { body: 'The DRIVE STACK — the red one — powers your attacks. Better chord, harder hit.', anchor: 'chord-stack', emote: 'drive' },
        { body: 'And the SUSTAIN STACK, the blue one, is your armor. How much can you *SUSTAIN* the hit?', anchor: 'sustain-btn', emote: 'sustain' },
        { body: `Each one holds ${STACK_CAP_MAX} notes total — ${STACK_CAP_BASE} to start, ${STACK_CAP_MAX - STACK_CAP_BASE} to upgrade. The better the chord they spell, the stronger the effect.`, anchor: 'chord-stack', emote: 'flex' },
        // 🔴🔵 The little ▲s under the note grid are the whole chord-building
        // system made visible, and nobody had ever pointed at them. A player who
        // never learns to read them is guessing at every commit for the rest of
        // the game — so this page exists purely to say "those mean something".
        { body: ['See the little arrows under the notes? Those are me doing the theory for you.',
                 'A 🔴 RED ▲ means that note makes the chord you\'re building STRONGER for Drive. A 🔵 BLUE ▲ means it feeds Sustain. Two arrows? Greedy. Take it.',
                 'Chase the arrows and you\'ll build better chords without knowing a lick of theory. Learn WHY later — the arrows work now.'], anchor: 'stack-note-grid' },
        // 🩶 SHOW, DON'T LIST — these two pages are why the gray pick exists.
        // "Hitting" and "getting hit" are the only ideas in this tip that need a
        // second body on screen; he rams it, then it rams him.
        { body: 'Stacks are *ammo*, not decoration. Landing a hit SPENDS notes off your DRIVE stack.',
          anchor: 'chord-stack', act: 'lunge', foe: true, tag: { text: '−DRIVE', color: '#ff6644' } },
        { body: 'And getting hit CHIPS notes off your SUSTAIN stack.',
          anchor: 'chord-stack', act: 'recoil', foe: true, tag: { text: '−SUSTAIN', color: '#44aaff' } },
        { body: 'You can commit up to 3 notes to your stacks per turn, split between the two however you like.', anchor: 'chord-stack' },
        { body: 'Don\'t forget to commit here. Unless you wanna Kurt Cobain it.', anchor: 'chord-stack', emote: 'ko' },
        // ⚠️ The Power Chord aside used to ride along on the end of this page.
        // It taught a NON-event (nothing happens to the mode), which is a
        // terrible use of the one page where something does. Deliberately cut —
        // don't reinstate it.
        // ⚠️ A second page here ("Nobody asks you to declare it. Change the
        // chord, change what plays clean.") is CUT. The line above already says
        // the stack picks the key; restating that nothing else picks it is a
        // page spent on a non-event. Don't reinstate it.
        { body: 'Your DRIVE Stack also picks the KEY. (For the music nerds out there —) Stack a MAJ 3rd, and the tune becomes Major (bright, +1 Db). Stack a min 3rd and it turns minor (dark, +1 Sustain — needs an upgrade first!).', anchor: 'derived-mode' },
        { body: 'Root feels wrong? That\'s what your TRANSPOSE card is for — a one-time swap of your ROOT NOTE for any note in stock. Bad opening hand? Slam that card down, homie.', anchor: 'mod-cards' },
      ],
    },
    melody: {
      title: '🎶 Step 2 — Build Your Melody',
      pages: [
        { body: 'Now spend your remaining notes on your MELODY LINE. Each note = 1 hex of movement, up to your Spirit\'s Speed stat.', anchor: 'note-stock', act: 'travel' },
        { body: 'In-scale notes — the ones that light up — also earn Db.', anchor: 'note-stock', emote: 'paid' },
        { body: ['Do you commit your best Db-earning notes to your Chord Stacks? Do you burn a DISCORD (grayed-out) note just to move farther?',
                 'These are choices you make while playing. Just don\'t second-guess yourself. Play it HARD!'], anchor: 'note-stock' },
      ],
    },
    // ✳️ CONDITIONAL — only fires the first time a 4th or 5th is actually
    // sitting in the stock. Naming a colour the player can't see is noise.
    harmonic_45: {
      title: '💜 The 4th & the 5th',
      pages: [
        { body: ['First time seeing the purple and pink notes? Those are the 4th and the 5th — your harmonic balance notes.',
                 'End your melody commit on one to earn *even MORE* Db. Purple = some. Pink = even more.',
                 'These notes bring balance to the Force... of Music.'], anchor: 'interval-legend' },
      ],
    },
    // ✳️ CONDITIONAL — only when a chord-pardoned note is actually on screen.
    chord_notes: {
      title: '🔴 Red & Blue Notes',
      pages: [
        { body: 'A RED note means that note lines up with your DRIVE chord stack — extra Drive for you. You know what BLUE means.', anchor: 'note-stock', emote: 'drive' },
        { body: 'A note flashing blue AND red? Only the Rock Gods know.', anchor: 'note-stock', mood: 'wow' },
      ],
    },
    // ✳️ Fires once the track is committed — the moment the last note stops
    // being a hypothetical and becomes next turn's problem.
    last_note: {
      title: '🎯 The Last Note',
      pages: [
        { body: 'The LAST note *matters* a whole lot. It becomes next turn\'s ROOT NOTE, and it feeds cadences — how your melody line ends across turns.', anchor: 'commit-track' },
      ],
    },
    // ✳️ CONDITIONAL — only when a gold cadence hex is on the board to look at.
    gold_hex: {
      title: '🥇 Gold Hex',
      pages: [
        { body: 'A GOLD hex means ending there resolves a cadence. And it looks cool.', anchor: 'commit-track', emote: 'gold' },
        { body: 'Gold hexes are what the fans are *dying* to hear — commit it LAST for a boost in fans. Unless you maybe want that Db...', anchor: 'fan-crowd', emote: 'gold' },
      ],
    },
    move_act: {
      title: '🚶 Step 3 — Move & Act!',
      pages: [
        { body: ['Track committed — those notes are now Action Points (AP). MOVE across hexes, FACE to turn (1 AP), and FIGHT!',
                 'Attacks fire into the cone or beam you are FACING. Sneaking up behind someone isn\'t just rude — it\'s tactics, baby! Hit a rival in the wedge behind them and they lose an EXTRA note off their Sustain stack. Watch for the 🔪 badge while you aim — that\'s a back with nobody home.'], anchor: 'actions-bar' },
        { body: 'Three ways to RUIN someone\'s set. One — ⚔️ SWING (1 AP): the melee jab. Cheap, defended, literally using your electric instrument as a weapon. Drives your chord into them!',
          anchor: 'actions-bar', act: 'swing' },
        { body: 'Two — 🎸 SMASH (2 AP): the haymaker. Undefendable, ignores Sustain, hurls your unused stock... and leaves you exposed. Commitment issues, in weapon form.',
          anchor: 'actions-bar', act: 'smash' },
        { body: 'Three — 🔊 SONIC (2 AP): the ranged beam off your amp rig. Less damage, way more Fame and pushback. Only fires from inside your RANGE ring (hover an amp to see it).',
          anchor: 'actions-bar' },
        { body: '🔥 THE RIFF-OFF is the big one, and you don\'t pick it from a menu — you EARN it. Aim a Sonic at a rival facing straight back down the same beam and it escalates into a head-to-head rhythm duel. Straight skill.',
          anchor: 'fame-bar', emote: 'fame' },
        { body: 'One catch, and it cuts both ways: BOTH of you must be inside your OWN amp\'s range when it fires. A duel needs two live rigs. Catch a rival stranded outside theirs and there\'s no riff-off at all — the beam just lands, and with no amp to brace against it they defend on a bare d4 instead of a d6.',
          anchor: 'actions-bar' },
        { body: 'Done? Hit END TURN. Your last committed note becomes next turn\'s Root Note — that throwaway discord you ended on is tomorrow\'s tonal center. Plan the ending.', anchor: 'end-turn' },
      ],
    },
    combat: {
      title: '⚔️ Battle!',
      pages: [
        { body: 'A SWING is a Thrash battle: both sides roll a d4 — attacker adds DRIVE, defender adds SUSTAIN. Win and you deal up to 4 Vibe damage. Lose as the attacker and you take a 1-Vibe humiliation tap. It\'s supposed to sting.', anchor: 'stat-knobs' },
        { body: ['A SONIC is the ranged version, and it rolls differently: you throw your whole rig pool and KEEP THE HIGHEST die. The defender answers with a d6 — unless they\'re caught outside their own amp range, in which case they\'ve got no rig to brace with and scramble a d4. Position is damage.', 'Both of you beam-to-beam AND both inside your own range? That\'s not an attack any more. That\'s a RIFF-OFF.'], anchor: 'stat-knobs' },
        { body: ['The fine print your rival hopes you skip:',
                 'Your stacks are AMMUNITION. A landed Swing burns 2 notes off your Drive Stack; a Sonic burns 1 win or lose. When a hit lands, the rival\'s Sustain Stack frays too — watch the notes tear off their standee and vanish. That\'s their armour leaving.',
                 `Land it in the wedge BEHIND them and they shed ${REAR_FRAY_BONUS} more. Facing decides what you can hit AND what you can brace against — it cuts both ways, so mind which way YOUR back is pointing.`,
                 'Swinging also drops your guard: −1 Sustain until your next turn. Thrash pays a flat 1 FP — it\'s for hurting people. For FAME, go Sonic: margin-scaled FP, multiplied by your crowd.'], anchor: 'chord-stack' },
      ],
    },
    fans: {
      title: '🎤 Fans',
      pages: [
        { body: 'You drew a crowd! Fans never hand you FP directly — they MULTIPLY every FP you earn, up to ×2 with a full house. Diehards (♥) are your loyal core, worth about three Casuals (👥), who are... emotionally flexible.' },
        { body: ['Grow the crowd: commit clean tracks near centre stage — inner rings pay casuals every turn, the back row pays zero. Perform well and casuals harden into Diehards.', 'Lose the crowd: lurk on the edge and casuals wander off. Get knocked down and some flee on the spot — a couple straight to whoever flattened you. Fans, man.'] },
      ],
    },
    cadence: {
      title: '🎼 Cadences',
      pages: [
        { body: 'A CADENCE is a pattern spelled by the FINAL notes of your tracks across turns — V→I, or the full IV→V→I. Land the resolution and the crowd swells: bonus FANS, on the spot. The hints in your Note Stock panel tell you exactly which final note keeps the sequence alive. Take the hint!', anchor: 'note-stock' },
      ],
    },
    riff: {
      title: '🎸 Riff Discovered!',
      pages: [
        { body: 'Riff discovered! That pattern you just played? A legendary riff. Gotta play \'em all!', anchor: 'riffbook', mood: 'wow' },
        { body: 'First discovery writes it into the Riffdex (📖 up top) and pays FP. Replaying a known one pays \'aight\' too.', anchor: 'fame-bar', emote: 'fame' },
        { body: 'Dig out the music — more are hidden in the note space! Play those songs that enjoy freedom in the Public Domain! Not ROCK enough? Tough!', anchor: 'riffbook' },
      ],
    },
    knockdown: {
      title: '😵 Knock Down!',
      pages: [
        { body: 'A spirit\'s Vibe hit zero — KNOCKED DOWN. The bill: 1 life gone, −1 FP, and part of the crowd bolts (some straight to whoever did the flattening). They respawn at their home corner with full Vibe... after sitting out one turn to think about it.', anchor: 'vibe-bar' },
        { body: 'Burn through ALL your lives and it\'s a true KO — out of the game, merch table\'s on the left. Watch your Vibe bar. Retreating to heal isn\'t cowardice, it\'s set management.', anchor: 'vibe-bar' },
      ],
    },
    fame: {
      title: '⭐ Fame Points (FP)',
      pages: [
        { body: `We finally got to the system whereby players WIN the game! FAME POINTS — first to ${fameToWin} FP (set by total lives and number of Spirits) becomes LEGEND... unless you dead first.`, anchor: 'fame-bar', emote: 'fame' },
        { body: 'This gold bar is the only bar that matters — everything else exists to feed it. If you\'re halfway there, better have a good prayer!', anchor: 'fame-bar' },
        { body: ['The Fame menu: 🔊 Sonic wins (margin-scaled — style points are real), 🎸 riff discoveries, ✨ holding centre-stage Limelight a full turn. (🎼 Cadences and 🧠 trivia pay FANS, not FP — the crowd is how you amplify everything else.)',
                 'Every payout is multiplied by your crowd (up to ×2), and if you\'re trailing badly the underdog bonus inflates it up to ×2.5. The comeback is canon.',
                 `But the arena has a volume limit: at most ${FAME_PER_TURN_CAP} FP banked per turn. Spread your legend across the set, not one blowout.`], anchor: 'fame-bar' },
        { body: [`One final WARNING — reach ${fameToWin} FP without winning comfortably and the ROCK GODS become undecided about your Victory. Probably they just want an excuse to jump in the fray.`,
                 'Anyways: they become EVERYONE\'S Rival. Your Spirit buddies become your allies. Temporarily. Good luck with that!',
                 'Sorry to impede your playing. Go get \'em, little Rocker!! 🐯🎸'], anchor: 'fame-bar' },
      ],
    },
    skill_unlock: {
      title: '🌳 Skill Unlocked!',
      pages: [
        { body: 'New ability unlocked — the Db grind paid off! Skills are permanent: scale tones, amps, crew, combat upgrades, signature moves. Your spirit card wears the new badge. Hover it to gloat.' },
        { body: 'Now pick your NEXT target and keep the loop rolling: in-scale notes → Db → skill → repeat. Spirits who stop building become content in other people\'s highlight reels.', anchor: 'db-bar' },
      ],
    },
    status_effect: {
      title: '⚡ Status Effect!',
      pages: [
        { body: ['Someone\'s wearing a status effect. The house specials:', '🔥 BURN — Vibe damage over time, straight off the pyro. 😵 STAGGER — freezes note slots so part of your kit is just... gone. 🧿 MOJO DRAIN — saps your performance and fan draw.', 'They wear off after a few turns. The badges sit in your Note Stock panel; glance before you plan.'], anchor: 'note-stock' },
        { body: ['Read the board, not just the panel. Afflicted Spirits wear a dashed ring and their icons; ⚡ charged ones crackle amber (floor) or blue (ceiling).', 'And if a Spirit is glowing RED and burning — that\'s 6️⃣ BERSERK. Uncapped Drive, immune to knockback, bleeding a Vibe with every attack. It only ends when somebody hits the floor or they heal back out of danger. Deciding whether to be that somebody is the whole game right there.'] },
      ],
    },
    intervals: {
      title: '🎵 Special Intervals',
      pages: [
        { body: ['Some notes carry more weight than others — this legend names the exact ones in play this turn:',
                 '🔴 TRITONE — maximum dissonance, the devil\'s interval. 💗 5th / 💜 4th — your harmonic balance notes. 💚 MAJOR 3rd — the bright one. 🔵 MINOR 7th — the blues note.',
                 'End on the 4th, 5th or the octave and you get PAID in Db. The rest start out grey and costly — climbing the Theory Tree is what turns them clean. Wrong notes become your best notes. That\'s rock, baby.'], anchor: 'interval-legend' },
      ],
    },
    // edge tips — REMOVED (system cut)
  };

  // 🚧 TIP GATES — the conditions a gated tip page waits on. A page with
  // `gate: 'stackOpen'` sits there pointing at the ⚔️ DRIVE button until this
  // flips true, then advances itself. Keep these cheap and derived; they're
  // read on every render of the overlay.
  const tipGates = useMemo(() => ({
    stackOpen: stackCommitDest != null,
  }), [stackCommitDest]);

  const activeTipRef = useRef(null);
  useEffect(() => { activeTipRef.current = activeTip; }, [activeTip]);
  // 🎓 Tips fired while the Theory Tree modal is up get QUEUED, not shown —
  // their arrows would point at HUD the modal covers (and competing overlays
  // look broken). The flush effect below (next to `upgradesPending`) replays
  // them once the modal closes. skill_tree/skill_unlock are ABOUT the modal,
  // so they still show immediately.
  const upgradesPendingRef = useRef(0);
  const pendingTipsRef = useRef([]);
  function showTip(tipId) {
    if (!beginnerEnabled) return;
    if (beginnerTipsSeen.has(tipId)) return;
    if (upgradesPendingRef.current > 0 && tipId !== 'skill_tree' && tipId !== 'skill_unlock') {
      if (!pendingTipsRef.current.includes(tipId)) pendingTipsRef.current.push(tipId);
      return;
    }
    // 🐛 THE MISSING-AP-TIP BUG: this used to `return` here, silently DROPPING
    // any tip that fired while another was on screen. Commit fires three tips in
    // 300ms — last_note, gold_hex, move_act — so move_act (the one that explains
    // Action Points, movement and the whole attack menu) was thrown away every
    // time. It then reappeared at the NEXT commit, by which point the player had
    // already moved, attacked and ended their turn, and a rival had taken one.
    // Being told how to move a turn after you worked it out yourself is worse
    // than not being told.
    //
    // Blocked tips now QUEUE instead. The flush effect beside `upgradesPending`
    // reruns whenever `activeTip` clears, so the queue drains one page-turn at a
    // time in the order they fired.
    if (activeTipRef.current) {
      if (!pendingTipsRef.current.includes(tipId)) pendingTipsRef.current.push(tipId);
      return;
    }
    const tip = BEGINNER_TIPS[tipId];
    if (!tip) return;
    setBeginnerTipsSeen(prev => new Set([...prev, tipId]));
    setActiveTip({ id: tipId, ...tip });
  }

  // ─── DERIVED STATE ────────────────────────────────────────────────────────────
  const acting = useMemo(() => {
    for (const id of turnQueue) {
      const sp = spirits.find(s => s.id === id && !s.knockedOut);
      if (sp) return sp;
    }
    return null;
  }, [turnQueue, spirits]);

  // ── RECOVER FROM KNOCK DOWN ───────────────────────────────────────────────
  // A Spirit that was Knocked Down loses its next turn. When the queue reaches
  // it, clear the flag and advance past it once.
  useEffect(() => {
    if (!acting) return;
    if (!noteStates[acting.id]?.recovering) return;
    const recoveringName = acting.name;
    setNoteStates(prev => prev[acting.id]
      ? { ...prev, [acting.id]: { ...prev[acting.id], recovering: false } }
      : prev);
    addLog(`😵 ${recoveringName} is still recovering from the Knock Down — turn skipped!`);
    {
      const nextId = dispatch(turnSkipped()).turn.lastReport?.nextId;
      if (nextId) {
        startNewTurnNotes(nextId);
        const nextSpirit = spirits.find(s => s.id === nextId);
        if (nextSpirit) { setPulsingHex(nextSpirit.num); setTimeout(() => setPulsingHex(null), 1800); }
      }
    }
  }, [acting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convenience: pull the acting character's note state (falls back to empty defaults)
  const actingNoteState = acting ? (noteStates[acting.id] ?? makeInitialNoteState(acting.id)) : null;
  // 🎸 B0b — stack capacity is EARNED. Slots 1–3 are baseline, slot 4 comes with
  // `theory_dom7` and slot 5 with `theory_modes`. Every "is this stack full?" test
  // must go through here; never compare against STACK_CAP_MAX (that's the render
  // ceiling, used only to draw the locked slots).
  const stackCapOf = (spiritId) =>
    stackCapFor(noteStates[spiritId]?.unlockedSkills ?? []);
  const actingStackCap = stackCapFor(actingNoteState?.unlockedSkills ?? []);
  const noteStock    = actingNoteState?.noteStock    ?? [];
  const melodyLine    = actingNoteState?.melodyLine    ?? [];
  // 🔁 Parallel to melodyLine: which noteStock slot each placed note came from.
  // melodyLine only ever stored the note NAME, so the link back to the stock
  // slot was lost the moment a note was placed — that's why the track was
  // append-only. Recording the source index makes removal exact: pulling a
  // note frees the specific slot it came from, even when the stock holds
  // duplicates of the same note (or the same note also sits in a chord stack).
  const melodySrcIdx  = actingNoteState?.melodySrcIdx  ?? [];
  // 🎤 Parallel to melodyLine: the REGISTER each note was played in, as an
  // equal-tempered frequency, or null for notes that were clicked rather than
  // played. melodyLine stores a pitch class only ('C', 'F#'), so a note placed
  // by mic used to sound in whatever fixed octave PC_FREQ_BASE holds — you
  // played the low E and the game answered an octave up. Keeping the frequency
  // alongside lets playback answer in the octave you actually played.
  // Frequencies, not MIDI, because playNoteSound's `freq` override already
  // speaks Hz and every other voicing path in this file does too.
  // ⚠️ Index-parallel to melodyLine: every write to one is a write to the other.
  const melodyFreq    = actingNoteState?.melodyFreq    ?? [];
  const usedStockIdx = actingNoteState?.usedStockIdx ?? [];
  const rootNote     = actingNoteState?.rootNote     ?? 'C';
  const scaleMode    = actingNoteState?.scaleMode    ?? 'major';
  // ⚠️ B8: nothing sets pivotPending true any more (the mode is derived from the
  // Drive Stack at turn start). Its read sites are left in place on purpose —
  // they now all read false and gate nothing. Don't reintroduce a writer.
  const pivotPending  = actingNoteState?.pivotPending ?? false;
  // 🔒 B8 'locked': the Drive Stack spells a minor chord but theory_minor isn't
  // unlocked, so the mode holds major. The HUD gets to advertise the skill at the
  // one moment the player actively wants it — this inherits the amber treatment
  // the old "PICK MODE" badge used.
  const modeLocked    = (actingNoteState?.modeReason ?? '') === 'locked';
  // ── SONIC RIG (AMP_DECK_DESIGN.md §2) ──────────────────────────────────────
  // Every Spirit has a Main Amp at their corner from turn 1. Pool size comes
  // from Amp I–III, die upgrades from Power I–III, effective radius from
  // Range I–III. "Goes to eleven" charge becomes +1 d8 anywhere.
  const elevenBoost = (actingNoteState?.elevenTurns ?? 0) > 0 ? 1 : 0;
  const actingHomeHex = acting ? HEX_BY_NUM[CORNERS[acting.corner]?.homeNum] : null;
  const actingHexObj  = acting ? HEX_BY_NUM[acting.num] : null;
  const distFromHome  = (actingHomeHex && actingHexObj)
    ? axialDist(actingHomeHex.q, actingHomeHex.r, actingHexObj.q, actingHexObj.r)
    : 0;
  const actingRig = acting
    ? sonicRig(actingNoteState?.unlockedSkills ?? [], distFromHome, elevenBoost)
    : { pool: [6], inRange: true };
  // Backward compat: ampsInRange ≥ 1 always (Main Amp — unplugged state is gone).
  // Old callers that checked `ampsInRange >= 1` will see "plugged in" universally.
  const ampsInRange = actingRig.pool.length;
  // 📡 Live rig for ANY spirit, read straight from current positions. Combat
  // paths (and the bot's scheduled closures) must not trust `actingRig`, which
  // is a render-time snapshot of the acting Spirit only — and the defender's
  // rig now decides both the riff-off gate and their defence die.
  function rigForSpirit(sp, chargeBoost = 0) {
    if (!sp) return { pool: [SONIC_BASE_DIE], inRange: false };
    const homeHex = HEX_BY_NUM[CORNERS[sp.corner]?.homeNum];
    const hex     = HEX_BY_NUM[sp.num];
    const dist    = (homeHex && hex)
      ? axialDist(homeHex.q, homeHex.r, hex.q, hex.r) : 0;
    return sonicRig(noteStates[sp.id]?.unlockedSkills ?? [], dist, chargeBoost);
  }
  // 🤖 keep the bot's live-state mirrors fresh
  useEffect(() => { moveStepsLeftRef.current = moveStepsLeft; }, [moveStepsLeft]);
  useEffect(() => { actionTokenUsedRef.current = actionTokenUsed; }, [actionTokenUsed]);
  useEffect(() => { actingRef.current = acting; }, [acting]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);
  useEffect(() => { ampsInRangeRef.current = ampsInRange; }, [ampsInRange]);
  useEffect(() => { rigInRangeRef.current = actingRig.inRange; }, [actingRig.inRange]);
  const diceTier = rigPoolLabel(actingRig.pool);
  const dbPoints      = actingNoteState?.dbPoints      ?? 0;
  const upgradesPending = actingNoteState?.upgradesPending ?? 0;
  // 🎓 showTip runs from setTimeouts — a ref keeps its view of the Theory Tree
  // modal fresh (the closure's `upgradesPending` can be a render behind).
  useEffect(() => { upgradesPendingRef.current = upgradesPending; }, [upgradesPending]);
  // 🎓 The Theory Tree first opens when the DB bar fills (the initial pick was
  // replaced by the free Full Scale grant) — introduce the tree at that moment.
  useEffect(() => {
    if (upgradesPending > 0 && canAct && !acting?.cpu) showTip('skill_tree');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradesPending]);
  // 🎓 Flush QUEUED tips — one at a time (this reruns as each one closes), after
  // a beat so the previous card animates out. Two things fill this queue: tips
  // fired while the Theory Tree modal was up, and tips fired while another tip
  // was already on screen (see showTip). Without this drain, whichever tip lost
  // the race was gone for good.
  useEffect(() => {
    if (upgradesPending > 0 || !beginnerEnabled || activeTip) return;
    if (!pendingTipsRef.current.length) return;
    const t = setTimeout(() => {
      const nextId = pendingTipsRef.current.shift();
      if (nextId) showTip(nextId);
    }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upgradesPending, activeTip, beginnerEnabled]);
  const discordCount  = actingNoteState?.discordCount  ?? 0;
  const hasConfirmed  = actingNoteState?.hasConfirmed  ?? false;
  // Speed, banking, discord unlocks
  const actingSpeed     = Math.min(5, acting?.speed ?? 5); // Speed caps at 5
  const bankedNote      = actingNoteState?.bankedNote ?? null;
  const discordUnlocks  = actingNoteState?.discordUnlocks ?? [];
  // Which interval keys are currently unlocked for this spirit
  // Mode-aware interval unlocks: each tier specifies which interval keys are
  // unlocked per mode (major/minor). Only keys relevant to the current scaleMode count.
  const unlockedIntervalKeys = new Set(
    DISCORD_UPGRADE_TIERS
      .filter(t => discordUnlocks.includes(t.id))
      .flatMap(t => (t.notesByMode?.[scaleMode] ?? t.notes ?? []))
  );

  function setNoteField(id, patch) {
    setNoteStates(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  const currentScale = playableScale(rootNote, scaleMode, actingNoteState?.unlockedSkills ?? []);
  const intervals = getIntervalNotes(rootNote, scaleMode);
  const { fourth: fourthNote, fifth: fifthNote,
          tritone: tritoneNote, majorThird: majorThirdNote,
          minorSeventh: minorSeventhNote } = intervals;

  // ── 🎸 CHORD CONTEXT (B3) ──────────────────────────────────────────────────
  // `keyScale` is everything legal BEFORE the stacks get a say: the playable scale
  // plus whatever the Discord unlocks have already made clean. It is the exact set
  // `isNotePlayable` used to check on its own, and it is what `classifyTrack` must
  // be handed at commit.
  //
  // ⚠️ keyScale and contextPcs stay SEPARATE VARIABLES, permanently. The pardon
  // changes what a wrong note COSTS; it must not change what COUNTS as one.
  // `classifyTrack` needs the bare key handed to it so it can tell "the key allows
  // this" from "your chord excused this" — that distinction is the entire B3/B4
  // mechanic, and it's what decides whether a note pays Drive/Sustain at all.
  // Merge them and the pardon silently stops being attributable to a stack.
  // (This warning used to be about `detectResolvedDiscords` collapsing a Flair
  //  spirit's earning to zero. That detector went with the Style system, but the
  //  rule it protected is older than Style and still load-bearing.)
  const keyScale = [...new Set([
    ...currentScale,
    ...[...unlockedIntervalKeys].map(k => intervals[k]).filter(Boolean),
  ])];
  const actingDriveStack   = actingNoteState?.driveStack   ?? [];
  const actingSustainStack = actingNoteState?.sustainStack ?? [];
  // Pitch classes the stacks have legalized right now, at the player's tiers. This
  // re-derives every render from the stack in front of them — the player never
  // learns a note list, they learn "whatever my chord made legal."
  const contextPcs = chordContext(
    actingDriveStack, actingSustainStack, actingNoteState?.unlockedSkills ?? []);
  // A note the context has legalized that the key alone would not have. This is the
  // set the note stock lights up: the highlight IS the teaching for this mechanic.
  function isNoteInContext(note) {
    const pc = pitchIndex(note);
    return pc >= 0 && contextPcs.has(pc) && !keyScale.some(n => pitchIndex(n) === pc);
  }
  // WHICH stack pardoned it — the note stock paints Drive red and Sustain blue off
  // this, and alternates the two when `both`. Attribution comes from `contextClaim`
  // rather than being re-derived here on purpose: it runs the same tier ladder and
  // the same tie-break `classifyTrack` settles the payout with, so the color on the
  // hex and the Db the note earns cannot drift apart. If you ever find yourself
  // reimplementing "is it in the Drive stack?" in this file, that's the bug.
  // Returns null for in-scale notes and for anything the stacks don't reach.
  function noteContextClaim(note) {
    if (!isNoteInContext(note)) return null;
    return contextClaim(pitchIndex(note), actingDriveStack, actingSustainStack,
                        actingNoteState?.unlockedSkills ?? []);
  }
  // ── PAYOUT ROUTING (dual-legal notes) ──────────────────────────────────────
  // { [trackIndex]: 'drive' | 'sustain' } — the player's answer for notes BOTH
  // stacks legalized. Keyed by track index rather than by note because the same
  // pitch can appear twice in one track and the player is entitled to split it.
  // Absent index = take the default (`claimAt`'s higher-rank-wins, tie to Drive),
  // which is why an empty map is a complete and correct state and nothing has to
  // seed it. Cleared with the track at turn start.
  const payoutRouting = actingNoteState?.payoutRouting ?? {};
  function setPayoutRoute(i, stack) {
    if (!acting || hasConfirmed) return;
    setNoteField(acting.id, { payoutRouting: { ...payoutRouting, [i]: stack } });
  }
  // The live read of the track as it stands — same function, same arguments the
  // commit will use, so the router row below the Commit Track is showing the
  // player the actual settlement and not a lookalike of it.
  const liveClassified = classifyTrack(
    melodyLine, keyScale, actingDriveStack, actingSustainStack,
    actingNoteState?.unlockedSkills ?? [], payoutRouting);

  // (C1's live Style preview lived here — it read `styleCommitDb` on every render
  //  and rendered the payout on the Commit Track as the track was built. Deleted
  //  with the Style system it previewed. The idea was sound and may be worth
  //  reviving for the four surviving Db sources, which are all pure functions of
  //  the provisional track and would preview just as cheaply.)


  // ── 🎓 CONDITIONAL TIPS: WHAT'S ACTUALLY ON SCREEN ────────────────────────
  // These tips name a COLOUR ("the purple and pink ones", "a red note"). Firing
  // them before that colour exists in the player's stock teaches nothing and
  // burns the one time the tip will ever show — showTip marks a tip seen
  // whether or not the player could make sense of it. So each one waits until
  // its subject is genuinely visible in the live note stock.
  //
  // Cheap by construction: a couple of passes over ≤12 notes, only on the human
  // player's own melody step, and each fires at most once per game.
  const stockSignature = noteStock.join(',');
  useEffect(() => {
    if (!beginnerEnabled || !acting || acting.cpu || !canAct) return;
    if (turnStep !== 'melody') return;
    const live = noteStock.filter((_, i) => !usedHas(usedStockIdx, i));
    if (!live.length) return;

    // 💜/💗 the 4th and the 5th — only once they're both defined and present
    const fourthPc = pitchIndex(fourthNote), fifthPc = pitchIndex(fifthNote);
    if (live.some(n => { const pc = pitchIndex(n); return pc === fourthPc || pc === fifthPc; })) {
      showTip('harmonic_45');
    }
    // 🔴/🔵 a note one of the stacks pardoned. Needs a stack to exist at all,
    // so this naturally holds off until the player has committed some chord.
    if (live.some(n => noteContextClaim(n) !== null)) showTip('chord_notes');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockSignature, turnStep, acting?.id, beginnerEnabled, canAct]);

  // ─── 🔴🔵 BEGINNER ARROW GUARANTEE ─────────────────────────────────────────
  // Pickles has a whole tip page pointing at the little ▲s under the stack-commit
  // notes — red ▲ = this note strengthens the chord's Drive, blue ▲ = Sustain.
  // Nothing guaranteed any were on screen when he said it.
  //
  // The odds are worse than they look. Both stacks seed with the ROOT ALONE, so
  // the preview is "root + this note" — a two-note set, and the ONLY two-note set
  // in CHORD_TEMPLATES is the power chord (0,7). Every other pair falls through to
  // Tone cluster, which is a DOWNGRADE from a single note, so it shows no arrows
  // at all. In other words: on turn one, only a 4th or a 5th in the stock can
  // produce an arrow of either colour. Ten notes drawn from a twelve-note pool
  // miss both about one game in six — and that beginner meets a tutorial page
  // confidently describing something that is not on their screen.
  //
  // So for beginners we repair the deal rather than the sentence: if nothing in
  // the live stock would raise Drive, swap a dead note for one that does; same
  // for Sustain. Deliberately NOT generalised to normal play — a stock that
  // always contains a 4th or a 5th is a real economy buff (those are the
  // high-Db balance notes), and that's a game-balance decision, not a tutorial one.
  //
  // Derived from the chord tables rather than hardcoding "put a 5th in it", so it
  // stays true if CHORD_TEMPLATES ever changes.
  const arrowFixRef = useRef(null);
  useEffect(() => {
    if (!beginnerEnabled || !acting || acting.cpu || !canAct) return;
    if (turnStep !== 'chord') return;
    if (beginnerTipsSeen.has('chord')) return;   // he's already said his piece
    const ns = noteStates[acting.id];
    if (!ns) return;
    // Guard against re-entry: this effect writes the very stock it reads.
    const fixKey = `${acting.id}:${stockSignature}`;
    if (arrowFixRef.current === fixKey) return;

    const stack = (ns.driveStack ?? []).filter(Boolean);
    if (!stack.length) return;
    const base = spiritChord(acting.id, stack);
    const gains = (note) => {
      const c = spiritChord(acting.id, [...stack, note]);
      return { d: c.drive - base.drive, s: c.sustain - base.sustain };
    };

    const stock = ns.noteStock ?? [];
    const liveIdx = stock.map((_, i) => i).filter(i => !usedHas(ns.usedStockIdx, i));
    if (!liveIdx.length) return;
    const hasRed  = liveIdx.some(i => gains(stock[i]).d > 0);
    const hasBlue = liveIdx.some(i => gains(stock[i]).s > 0);
    if (hasRed && hasBlue) { arrowFixRef.current = fixKey; return; }

    // Candidates from the spirit's own spelled pool, so a planted note is one
    // they could legitimately have drawn — right key, right spelling.
    const pool = getSpelledPool(ns.rootNote ?? rootNote, ns.scaleMode ?? scaleMode);
    const pickFor = (want) => pool.find(n => gains(n)[want] > 0) ?? null;
    // Sacrifice the deadest slot: a note that isn't already carrying the arrow
    // we're not fixing, and (failing that) any live slot at all.
    const nextStock = [...stock];
    const spent = new Set();
    const plant = (want, keep) => {
      const note = pickFor(want);
      if (!note) return;
      const victim = liveIdx.find(i => !spent.has(i) && !(gains(nextStock[i])[keep] > 0))
                  ?? liveIdx.find(i => !spent.has(i));
      if (victim == null) return;
      nextStock[victim] = note;
      spent.add(victim);
    };
    if (!hasRed)  plant('d', 's');
    if (!hasBlue) plant('s', 'd');

    arrowFixRef.current = fixKey;
    if (nextStock.some((n, i) => n !== stock[i])) {
      setNoteField(acting.id, { noteStock: nextStock });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockSignature, turnStep, acting?.id, beginnerEnabled, canAct]);

  // Returns the interval key name for a given note, or null if not an interval note
  function getIntervalKey(note) {
    const pc = pitchIndex(note);
    if (pc === pitchIndex(tritoneNote))      return 'tritone';
    if (pc === pitchIndex(majorThirdNote))   return 'majorThird';
    if (pc === pitchIndex(minorSeventhNote)) return 'minorSeventh';
    if (pc === pitchIndex(fourthNote))       return 'fourth';
    if (pc === pitchIndex(fifthNote))        return 'fifth';
    return null;
  }
  // Is a given note "playable" (not discord) given current scale + unlocks?
  // B3: the chord context is consulted LAST, so a note the key already allows is
  // never attributed to the stacks. This is the live placement check only — the
  // score is settled at commit by `classifyTrack`, which sees the approach-note
  // tier this function cannot (it depends on the note you play next).
  function isNotePlayable(note) {
    if (currentScale.includes(note)) return true;
    if (isNoteInContext(note)) return true;
    const key = getIntervalKey(note);
    if (!key) return false;
    if (key === 'tritone') return unlockedIntervalKeys.has('tritone');
    return unlockedIntervalKeys.has(key); // interval notes: playable once unlocked
  }
  // (B5: `feedbackBoost` removed — it was read only by a HUD badge advertising a
  //  damage multiplier that no code path applied. See the note at the self-effects
  //  block in confirmNoteTrack.)
  const dieFloorBoost  = actingNoteState?.dieFloorBoost  ?? 0;
  const statusEffects  = actingNoteState?.statusEffects  ?? [];
  const stagger        = actingNoteState?.stagger        ?? null;
  const mojoDrain      = actingNoteState?.mojoDrain      ?? 0;
  const staggeredSlots = stagger?.slots ?? [];

  const spiritByNum = useMemo(() => {
    const m = {};
    spirits.forEach(s => { if (!s.knockedOut) m[s.num] = s; });
    return m;
  }, [spirits]);

  // ─── 👤 SHADOW ILLUSION — derived decoy state ────────────────────────────────
  // The decoy is a *body double*: to every rival it is pixel-for-pixel the real
  // Ronin — same standee, same base ring, same facing arrow, same hex tint, and
  // it occupies its hex like a real Spirit. Only the Ronin's own client gets a
  // faint tell so its controller doesn't lose track of themselves.
  const shadowIllusion = (() => {
    const si = noteStates['cosmic_ronin']?.shadowIllusion;
    if (!si) return null;
    const ronin = spirits.find(s => s.id === 'cosmic_ronin');
    if (!ronin || ronin.knockedOut) return null;   // no Ronin, no shadow
    return si;
  })();
  const shadowHex = shadowIllusion?.hex ?? null;
  // A "spirit-shaped" view of the decoy — everything the board renderer needs to
  // draw it exactly as it draws the real Ronin.
  const shadowDecoy = useMemo(() => {
    if (!shadowIllusion) return null;
    const ronin = spirits.find(s => s.id === 'cosmic_ronin');
    if (!ronin) return null;
    return { ...ronin, num: shadowIllusion.hex, facing: shadowIllusion.facing ?? 0, isShadow: true };
  }, [shadowIllusion, spirits]);
  // Only the Ronin's controller sees which standee is the fake. Online that's
  // the seat holding the Ronin; in hotseat it's whoever is currently acting.
  const seesShadowTell = netRef.current
    ? netRef.current.mySpiritId === 'cosmic_ronin'
    : acting?.id === 'cosmic_ronin';

  const spiritById = useMemo(() => {
    const m = {};
    spirits.forEach(s => { m[s.id] = s; });
    return m;
  }, [spirits]);

  const queuedSpirits = turnQueue.map(id => spiritById[id]).filter(Boolean).filter(s => !s.knockedOut);

  // Reachable hexes for movement: immediate neighbors only, step by step
  const reachable = useMemo(() => {
    if (action !== "move" || !acting || moveStepsLeft < 1) return new Set();
    const from = HEX_BY_NUM[acting.num];
    if (!from) return new Set();
    return new Set(
      axialNeighbors(from.q, from.r)
        .map(({ q, r }) => HEX_BY_QR[`${q},${r}`])
        .filter(h => {
          if (!h) return false;
          if (spiritByNum[h.num]) return false;
          if (h.num === shadowHex) return false;  // 👤 the decoy blocks like a body
          return true;
        })
        .map(h => h.num)
    );
  }, [action, acting, moveStepsLeft, spiritByNum, shadowHex]);

  // 👤 The double's own movement pool — same size as the Ronin's budget, but a
  // separate pot, so walking the fake never costs the real body a step.
  const shadowSteps = shadowIllusion?.stepsLeft ?? 0;

  // 👤 Where the shadow can step. Identical rules to a real Spirit's move: one
  // hex at a time, can't walk through anyone (including the real Ronin).
  const shadowReachable = useMemo(() => {
    if (action !== "move_shadow" || !shadowHex || shadowSteps < 1) return new Set();
    const from = HEX_BY_NUM[shadowHex];
    if (!from) return new Set();
    return new Set(
      axialNeighbors(from.q, from.r)
        .map(({ q, r }) => HEX_BY_QR[`${q},${r}`])
        .filter(h => h && !spiritByNum[h.num])
        .map(h => h.num)
    );
  }, [action, shadowHex, shadowSteps, spiritByNum]);

  // ─── NOTE SOUND (distorted guitar) ───────────────────────────────────────────
  const audioCtxRef = useRef(null);

  // ── 🎛️ AMP KNOBS — player-adjustable tone for note playback ────────────────
  // drive: distortion amount · tone: brightness · echo: slapback level/repeats
  // verb: reverb wet level. Knob defaults, Spirit signature tones, voices, and
  // the amp DSP chain itself all live in audio/ampVoice.js (shared with the
  // lobby practice modes — one rig, every surface).
  // Per-spirit tone state: every Spirit owns its tone; the panel edits the ACTING
  // Spirit's, and the synth plays each note in the tone of whoever is performing.
  const [toneBySpirit, setToneBySpirit] = useState(() => {
    const m = {};
    for (const id of Object.keys(SPIRIT_DEFS)) m[id] = { ...TONE_KNOB_DEFAULTS, ...(SPIRIT_TONES[id] ?? {}) };
    return m;
  });
  const toneBySpiritRef = useRef(toneBySpirit);
  useEffect(() => { toneBySpiritRef.current = toneBySpirit; }, [toneBySpirit]);
  // Acting Spirit's tone (what the panel shows) + a writer that saves to that Spirit only.
  const toneKnobs = toneBySpirit[acting?.id] ?? TONE_KNOB_DEFAULTS;
  function setToneKnobs(updater) {
    const id = acting?.id; if (!id) return;
    setToneBySpirit(prev => {
      const cur = prev[id] ?? TONE_KNOB_DEFAULTS;
      return { ...prev, [id]: typeof updater === 'function' ? updater(cur) : updater };
    });
  }

  // (Reverb impulse cache moved into audio/ampVoice.js — cached per context.)

  function getAudioCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  // ── SHARED AUDIO BUSES — one master limiter + ONE reverb convolver per
  // context. Bus construction lives in audio/ampVoice.js (getAmpBuses) so the
  // practice modes share the exact same rig; this alias keeps existing callers.
  const getAudioBuses = getAmpBuses;

  const NOTE_FREQS = {
    'C':3,'C#':4,'Db':4,'D':5,'D#':6,'Eb':6,'E':7,'F':8,'F#':9,'Gb':9,
    'G':10,'G#':11,'Ab':11,'A':0,'A#':1,'Bb':1,'B':2,
  };
  const PC_FREQ_BASE = [
    440.00,  // A
    466.16,  // A#/Bb
    493.88,  // B
    261.63,  // C
    277.18,  // C#/Db
    293.66,  // D
    311.13,  // D#/Eb
    329.63,  // E
    349.23,  // F
    369.99,  // F#/Gb
    392.00,  // G
    415.30,  // G#/Ab
  ];

  // The amp DSP chain lives in audio/ampVoice.js (playAmpNote) — shared with
  // the lobby practice modes so every surface plays the same rig. This wrapper
  // resolves the note's frequency and the ACTING Spirit's live knob settings
  // (read from refs so timeouts get fresh values), then hands off.
  function playNoteSound(note, opts = {}) {
    try {
      const ctx = getAudioCtx();
      let freq = opts.freq; // optional raw-frequency override (riff-off octave contours)
      if (freq == null) {
        const pc = NOTE_FREQS[note];
        if (pc === undefined) return;
        freq = PC_FREQ_BASE[pc];
      }
      // 🎛️ Amp knob settings (live — read from ref so timeouts get fresh values)
      const kn = toneBySpiritRef.current?.[actingRef.current?.id] ?? TONE_KNOB_DEFAULTS;
      playAmpNote(ctx, freq, { ...opts, knobs: kn });
    } catch (_) { /* audio unavailable — silent fail */ }
  }

  // ⚡ CHARGE ZONE SFX — a quick rising electronic sweep that says "powered up!"
  function playChargeSound() {
    try {
      const ctx = getAudioCtx();
      const now = ctx.currentTime;
      const { master } = getAudioBuses(ctx);
      // Rising sine sweep 200→1200 Hz over 0.35s
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.35);
      // Crackling texture — second oscillator detuned square
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(400, now);
      osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.35);
      const g2 = ctx.createGain(); g2.gain.value = 0.04;
      osc2.connect(g2);
      // Envelope
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.18, now + 0.05);
      env.gain.setValueAtTime(0.18, now + 0.3);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(env); g2.connect(env);
      env.connect(master);
      osc.start(now); osc2.start(now);
      osc.stop(now + 0.7); osc2.stop(now + 0.7);
    } catch (_) { /* audio unavailable */ }
  }

  // 🎵 AUTO VOICE-LEADING — render `note` in the octave whose pitch is nearest the
  // previously played frequency, so a melody flows by small steps instead of bouncing
  // around one fixed octave. Pure pitch/contour layer: chords, cadences, riffs and runs
  // stay pitch-class based and are untouched. (A deliberate WIDE LEAP for Flair could
  // later opt out of this — see the Sticky Notes backlog in DESIGN_AUDIT_v2.)
  function voiceLeadFreq(note, prevFreq) {
    const idx = NOTE_FREQS[note];
    if (idx === undefined) return null;
    const base = PC_FREQ_BASE[idx];
    if (!prevFreq) return base;
    let best = base, bestDist = Infinity;
    for (let k = -1; k <= 1; k++) {
      const f = base * Math.pow(2, k);
      const d = Math.abs(Math.log2(f / prevFreq));
      if (d < bestDist) { bestDist = d; best = f; }
    }
    return best;
  }

  // 🎸 Signature commit builds — each Spirit plays their committed track in
  // their OWN voiceprint. Unknown ids fall through to the classic groove.
  const COMMIT_STYLES = {
    cosmic_ronin:      'shred',      // 🗡️ lightning passes + climax run
    Metalness_Monster: 'breakdown',  // 🤘 chug gallops + slam clusters
    intergalactic_0:   'scratch',    // 👽 80s DJ vinyl scratching
    Glamarchy:         'strut',      // 👑 stomp-clap swagger + glitter gliss
  };

  // `opts.freqs` — index-parallel to `track`: the register each note was played
  // in (mic), or null (clicked). Only the classic groove honours it; the four
  // signature styles below voice the track their own way on purpose — a
  // breakdown chugs in the low register whether or not you played it up the
  // neck, because that's the character's voice, not yours.
  function playTrackSequence(track, opts = {}) {
    if (opts.style === 'shred')     { playShredSequence(track); return; }
    if (opts.style === 'breakdown') { playBreakdownSequence(track); return; }
    if (opts.style === 'scratch')   { playDJScratchSequence(track); return; }
    if (opts.style === 'strut')     { playStrutSequence(track); return; }
    // The committed track plays as a real MELODY, not a slop of evenly
    // spaced notes. Each commit rolls a fresh groove: a mix of eighths,
    // quarters and dotted notes, the occasional breath between phrases,
    // a couple of random accents — and the final note rings out long,
    // because every phrase deserves a resolution.
    // ⏱️ All notes are scheduled UP FRONT on the audio clock (`when`) — the
    // whole phrase plays out sample-accurately even if the main thread jams.
    const t0 = getAudioCtx().currentTime + 0.06;
    let tMs = 60;
    let prevFreq = null; // 🎵 auto voice-leading — each note in the octave nearest the last
    track.forEach((note, i) => {
      const last = i === track.length - 1;
      const roll = Math.random();
      const dur  = last ? 0.95
        : roll < 0.30 ? 0.22   // eighth — skips along
        : roll < 0.75 ? 0.40   // quarter — the walking pulse
        : 0.62;                // dotted — leans on the note
      const breath = !last && Math.random() < 0.18 ? 150 : 0; // phrase break
      const accent = last || Math.random() < 0.22;
      // A note the player actually PLAYED already has a register — use it, and
      // let it seed the voice-leading so any clicked notes after it step from
      // where the player left off rather than from the fixed base octave.
      const heard = opts.freqs?.[i] ?? null;
      const vlf = heard ?? voiceLeadFreq(note, prevFreq); if (vlf) prevFreq = vlf;
      playNoteSound(note, {
        holdTime: dur,
        fadeTime: last ? 0.9 : 0.35,
        volume: accent ? 0.19 : 0.14,
        freq: vlf ?? undefined,
        when: t0 + tMs / 1000,
      });
      tMs += dur * 580 + 90 + breath; // longer notes breathe longer before the next
    });
  }

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
    const t0 = getAudioCtx().currentTime + 0.06;       // audio-clock anchor
    const at = ms => t0 + ms / 1000;
    let tMs = 60;

    // Spacing shrinks as the track grows so all passes always fit the budget.
    const sp1 = Math.max(58, Math.min(105, Math.round(640 / n)));

    // ── PASS 1 — the statement: the track in order, brutally fast ──
    let prev = null;
    track.forEach((note, i) => {
      const f = voiceLeadFreq(note, prev); if (f) prev = f;
      playNoteSound(note, {
        holdTime: 0.12, fadeTime: 0.08,
        volume: i % 2 === 0 ? 0.16 : 0.13,             // alternate-picked accents
        freq: f ?? undefined,
        when: at(tMs + jitter()),
      });
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
      playNoteSound(note, {
        holdTime: 0.11, fadeTime: 0.08,
        volume: i % 2 === 0 ? 0.17 : 0.14,
        freq: f ?? undefined,
        when: at(tMs + jitter()),
      });
      tMs += sp2;
    });

    // Short tracks stop here — two fast passes IS the shred…
    if (n < 4) {
      const last = track[n - 1];                       // …but the ending still rings.
      playNoteSound(last, {
        holdTime: 1.0, fadeTime: 0.9, volume: 0.19,
        when: at(tMs + 90),
      });
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
      playNoteSound(note, {
        holdTime: 0.10, fadeTime: 0.07,
        volume: 0.14 + (0.05 * i) / run.length,        // swelling into the peak
        freq: f ?? undefined,
        when: at(tMs + jitter()),
      });
      tMs += sp;
    });
    // 🎸 The money note — the track's real final note, octave up, ringing long.
    const last = track[n - 1];
    const lastF = voiceLeadFreq(last, prev);
    playNoteSound(last, {
      holdTime: 1.1, fadeTime: 1.0, volume: 0.2,
      freq: lastF ? lastF * 2 : undefined,
      when: at(tMs + 40),
    });
  }

  // 🤘 METALNESS MONSTER — the commit is a BREAKDOWN: the track dropped two
  // octaves into chug register and played in GALLOPS (da-da-DUM palm mutes),
  // trashed up with dissonant slam clusters on the offbeats, capped by a full
  // power-chord SLAM. His fuzz voice supplies the distortion; this supplies
  // the violence.
  function playBreakdownSequence(track) {
    const n = track.length;
    if (!n) return;
    const t0 = getAudioCtx().currentTime + 0.06;          // audio-clock anchor
    const at = ms => t0 + ms / 1000;
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
        playNoteSound(note, {
          holdTime: accent ? 0.16 : 0.08, fadeTime: 0.06,
          volume: accent ? 0.20 : 0.13,
          freq: low,
          when: at(tMs + jitter()),
        });
        tMs += accent ? unit * 1.6 : unit * 0.7;
      });
      // Every third note: a trashing CLUSTER — the chug note smeared against
      // its own detuned neighbours, struck together. Pure noise-wall.
      if (i % 3 === 2 && low) {
        const w = at(tMs + jitter());
        playNoteSound(note, { holdTime: 0.10, fadeTime: 0.08, volume: 0.13, freq: low * 1.06, when: w });
        playNoteSound(note, { holdTime: 0.10, fadeTime: 0.08, volume: 0.13, freq: low * 0.94, when: w });
        tMs += unit * 0.9;
      }
    });

    // ── THE SLAM — final note as a power chord (root + fifth + sub-octave),
    // struck once after a half-beat of dead air, left to ring ugly and long.
    const lastNote = track[n - 1];
    const lf = voiceLeadFreq(lastNote, prev);
    const root = lf ? lf / 2 : undefined;
    tMs += 90;
    const wSlam = at(tMs);
    playNoteSound(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.22, freq: root, when: wSlam });
    playNoteSound(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.15, freq: root ? root * 1.5 : undefined, when: wSlam });
    playNoteSound(lastNote, { holdTime: 1.2, fadeTime: 1.1, volume: 0.17, freq: root ? root / 2 : undefined, when: wSlam });
  }

  // 👽 INTERGALACTIC 0 — the commit is a DJ SCRATCH SESSION: each note becomes
  // a vinyl scratch — rapid frequency sweeps (the "wicka-wicka"), transformer
  // cuts, chirps, and flares — all driven by the Web Audio API's frequency
  // automation for smooth, continuous sweeps (not discrete note hops).
  // The sequence cycles through scratch patterns on a swung hip-hop grid,
  // finishing with a scribble scratch into a deep sub drop.
  //
  // Scratching bypasses playNoteSound to get CONTINUOUS frequency sweeps —
  // each atom builds its own mini audio graph routed through the Spirit's
  // tone knobs so drive / tone / echo / verb still apply.
  function playDJScratchSequence(track) {
    const n = track.length;
    if (!n) return;
    const BEAT = 270;                                       // ~111 BPM quarter note
    const patterns = ['baby', 'chirp', 'transformer', 'chirp', 'flare', 'baby'];
    const t0 = getAudioCtx().currentTime + 0.06;            // audio-clock anchor
    const at = ms => t0 + ms / 1000;
    let tMs = 60;
    let prev = null;

    track.forEach((note, i) => {
      const f = voiceLeadFreq(note, prev); if (f) prev = f;
      const base = f ?? 330;
      const last = i === n - 1;

      if (last) {
        // Finale: scribble scratch → deep sub drop
        playScratchAtom(note, base, 'scribble', at(tMs));
        tMs += 380;
        playNoteSound(note, {
          holdTime: 0.85, fadeTime: 1.1, volume: 0.22, freq: base / 4,
          when: at(tMs),
        });
        return;
      }

      const pat = patterns[i % patterns.length];
      playScratchAtom(note, base, pat, at(tMs));

      // Swung spacing — long-short pairs with tiny humanisation
      const swing = i % 2 === 0 ? BEAT * 0.62 : BEAT * 0.38;
      tMs += Math.round(swing + (Math.random() * 16 - 8));
      if (i % 4 === 3) tMs += Math.round(BEAT * 0.45);     // phrase breath
    });
  }

  // ── SCRATCH ATOM — a single vinyl scratch with continuous frequency sweeps ──
  // Builds a lightweight audio graph per scratch and schedules frequency +
  // gain automation for the chosen pattern. Routes through the Spirit's tone
  // stack (drive → distortion → lowpass → echo → verb → master limiter).
  function playScratchAtom(note, baseFreq, pattern, when) {
    try {
      const ctx = getAudioCtx();
      const now = Math.max(ctx.currentTime, when ?? 0);
      const kn = toneBySpiritRef.current?.[actingRef.current?.id] ?? TONE_KNOB_DEFAULTS;
      const V  = TONE_VOICES[kn.voice] ?? TONE_VOICES.saw;

      // ── Pattern durations & sweep targets ──
      const hi  = baseFreq * 2;       // octave up
      const lo  = baseFreq * 0.5;     // octave down
      const dur = ({ baby: 0.22, chirp: 0.12, transformer: 0.34,
                     flare: 0.26, scribble: 0.38 })[pattern] ?? 0.22;
      const vol = 0.17;

      // ── Oscillators (two detuned + sub for thickness) ──
      const osc1 = ctx.createOscillator(); osc1.type = V.osc1;
      const osc2 = ctx.createOscillator(); osc2.type = V.osc2;
      const sub  = ctx.createOscillator(); sub.type  = V.sub;
      osc1.frequency.setValueAtTime(baseFreq, now);
      osc2.frequency.setValueAtTime(baseFreq * 1.008, now);
      sub.frequency.setValueAtTime(baseFreq / 2, now);

      // ── Frequency sweeps — the soul of each scratch ──
      const f1 = osc1.frequency, f2 = osc2.frequency, fs = sub.frequency;
      const sweep = (t, v) => {
        f1.linearRampToValueAtTime(v,         t);
        f2.linearRampToValueAtTime(v * 1.008, t);
        fs.linearRampToValueAtTime(v / 2,     t);
      };
      const set = (t, v) => {
        f1.setValueAtTime(v,         t);
        f2.setValueAtTime(v * 1.008, t);
        fs.setValueAtTime(v / 2,     t);
      };

      switch (pattern) {
        case 'baby': {
          // Forward (rises) → back (falls)
          sweep(now + dur * 0.42, hi);
          sweep(now + dur,        lo * 1.2);
          break;
        }
        case 'chirp': {
          // Fast rise → instant cut & reset at the peak
          sweep(now + dur * 0.65, hi * 1.4);
          set  (now + dur * 0.67, baseFreq);
          sweep(now + dur,        baseFreq * 0.85);
          break;
        }
        case 'transformer': {
          // Slow steady rise — the gain cuts (below) create the rhythm
          sweep(now + dur, hi * 1.2);
          break;
        }
        case 'flare': {
          // Slow fall — gain flutters slice it up
          sweep(now + dur, lo * 0.8);
          break;
        }
        case 'scribble': {
          // Rapid tiny back-and-forth (8 segments)
          const segs = 8;
          const segDur = dur / segs;
          for (let s = 0; s < segs; s++) {
            const target = s % 2 === 0
              ? baseFreq * (1.3 + Math.random() * 0.3)
              : baseFreq * (0.6 + Math.random() * 0.2);
            sweep(now + segDur * (s + 0.92), target);
          }
          break;
        }
      }

      // ── Gain envelope — amp envelope + transformer / flare cuts ──
      const ampEnv = ctx.createGain();
      ampEnv.gain.setValueAtTime(0, now);
      ampEnv.gain.linearRampToValueAtTime(vol, now + 0.004);            // near-instant attack

      if (pattern === 'transformer') {
        // Rapid on/off cuts — the crossfader stutter
        const cuts = 5;
        const step = dur / cuts;
        for (let c = 0; c < cuts; c++) {
          const on  = now + step * c;
          const off = on + step * 0.55;
          ampEnv.gain.setValueAtTime(vol,   on  + 0.004);
          ampEnv.gain.setValueAtTime(0.005, off);
        }
      } else if (pattern === 'flare') {
        // Two quick gain dips mid-scratch
        const t1 = now + dur * 0.30, t2 = now + dur * 0.60;
        ampEnv.gain.setValueAtTime(0.005, t1);
        ampEnv.gain.setValueAtTime(vol,   t1 + 0.018);
        ampEnv.gain.setValueAtTime(0.005, t2);
        ampEnv.gain.setValueAtTime(vol,   t2 + 0.018);
      }

      // Release tail
      ampEnv.gain.setValueAtTime(vol * 0.7,  now + dur);
      ampEnv.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.12);

      // ── Oscillator mix ──
      const g1 = ctx.createGain(); g1.gain.value = 0.5;
      const g2 = ctx.createGain(); g2.gain.value = 0.5;
      const gs = ctx.createGain(); gs.gain.value = 0.18;
      osc1.connect(g1); osc2.connect(g2); sub.connect(gs);

      // ── Drive → distortion ──
      const drive = ctx.createGain();
      drive.gain.value = (1 + kn.drive * 10) * V.driveMul;
      g1.connect(drive); g2.connect(drive); gs.connect(drive);

      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(20 + kn.drive * 900 * V.driveMul);
      shaper.oversample = '4x';
      drive.connect(shaper);

      // ── Tone stack — lowpass + highpass + mid presence ──
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1200 + kn.tone * 5300; lp.Q.value = 0.9;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 120;
      shaper.connect(lp); lp.connect(hp);

      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking'; mid.frequency.value = 1800;
      mid.gain.value = 3 + kn.tone * 4; mid.Q.value = 1.2;
      hp.connect(mid);

      const comp = ctx.createGain();
      comp.gain.value = 1 - kn.drive * 0.12;
      mid.connect(comp);

      // ── Master limiter — shared bus (see getAudioBuses) ──
      const { master, verbBus } = getAudioBuses(ctx);

      // Route through envelope
      comp.connect(ampEnv);
      ampEnv.connect(master);

      // ── Echo (slapback delay) ──
      if (kn.echo > 0.02) {
        const dl = ctx.createDelay(0.7); dl.delayTime.value = 0.19;
        const dg = ctx.createGain(); dg.gain.value = kn.echo * 0.68;
        const fb = ctx.createGain(); fb.gain.value = Math.min(0.72, kn.echo * 0.7);
        const df = ctx.createGain();
        df.gain.setValueAtTime(1, now + 0.19);
        df.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.8 + kn.echo * 1.4);
        ampEnv.connect(dl); dl.connect(fb); fb.connect(dl);
        dl.connect(dg); dg.connect(df); df.connect(master);
      }

      // ── Reverb — send to the SHARED convolver ──
      if (kn.verb > 0.02) {
        const rg = ctx.createGain(); rg.gain.value = kn.verb * 0.85;
        ampEnv.connect(rg); rg.connect(verbBus);
      }

      // ── Start / stop ──
      const tail = 0.3 + kn.echo * 1.4;
      osc1.start(now); osc2.start(now); sub.start(now);
      osc1.stop(now + dur + tail);
      osc2.stop(now + dur + tail);
      sub.stop(now + dur + tail);
    } catch (_) { /* audio unavailable */ }
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
    const t0 = getAudioCtx().currentTime + 0.06;          // audio-clock anchor
    const at = ms => t0 + ms / 1000;
    let tMs = 60;
    const unit = Math.max(120, Math.min(170, Math.round(920 / n))); // half-time swagger
    let prev = null;
    track.forEach((note, i) => {
      const f = voiceLeadFreq(note, prev); if (f) prev = f;
      if (i === n - 1) return;                            // finale below
      // STOMP — low and fat…
      playNoteSound(note, {
        holdTime: 0.22, fadeTime: 0.14, volume: 0.19, freq: f ? f / 2 : undefined,
        when: at(tMs),
      });
      tMs += unit;
      // …answered an octave up on the offbeat — the hip-swing.
      playNoteSound(note, {
        holdTime: 0.12, fadeTime: 0.10, volume: 0.13, freq: f ?? undefined,
        when: at(tMs),
      });
      tMs += Math.round(unit * 0.55);
      // Every third pair: the CLAP — two octaves up, short and bright.
      if (i % 3 === 2) {
        playNoteSound(note, {
          holdTime: 0.07, fadeTime: 0.08, volume: 0.15, freq: f ? f * 2 : undefined,
          when: at(tMs),
        });
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
      playNoteSound(note, {
        holdTime: 0.07, fadeTime: 0.06,
        volume: 0.10 + (0.05 * i) / run.length,
        freq: f ?? undefined,
        when: at(tMs),
      });
      tMs += 55;
    });
    // ── THE POSE — final note as a wide two-octave chord, held like a bow.
    const lastNote = track[n - 1];
    const lf = voiceLeadFreq(lastNote, prev);
    const wPose = at(tMs + 60);
    playNoteSound(lastNote, { holdTime: 1.1, fadeTime: 1.0, volume: 0.18, freq: lf ?? undefined, when: wPose });
    playNoteSound(lastNote, { holdTime: 1.1, fadeTime: 1.0, volume: 0.14, freq: lf ? lf / 2 : undefined, when: wPose });
  }

  // ─── RIFF PLAYBACK ───────────────────────────────────────────────────────────
  // Plays a riff with its real rhythm — durations and rests, not a slop of
  // evenly spaced notes. Transposed to whatever pitch the player started on.
  // Returns total playback length in ms.
  // 🎸 Play a CHORD — its notes strummed in a quick voice-led roll (used when a
  // Sonic Attack projects the chord you prepared for battle).
  function playChord(notes) {
    if (!notes || !notes.length) return;
    let prev = null;
    notes.forEach((note, i) => {
      const f = voiceLeadFreq(note, prev); if (f) prev = f;
      setTimeout(() => playNoteSound(note, { holdTime: 1.0, fadeTime: 0.8, volume: 0.16, freq: f ?? undefined }), i * 55);
    });
  }

  // 🔊 Whiff chord — a dissonant, twangy pluck: notes are detuned sharp/flat,
  // staggered with awkward timing, and cut short like botched strings snapping.
  function playWhiffChord(notes) {
    if (!notes || !notes.length) return;
    let prev = null;
    notes.forEach((note, i) => {
      const f = voiceLeadFreq(note, prev); if (f) prev = f;
      // Detune each note randomly ±5-12% to sound "wrong" / out of tune
      const detune = 1 + (Math.random() * 0.14 - 0.07) * (i % 2 === 0 ? 1 : -1);
      const wrongFreq = f ? f * detune : undefined;
      // Stagger unevenly and cut short — a clumsy pluck, not a clean strum
      const stagger = i * 90 + Math.random() * 60;
      setTimeout(() => playNoteSound(note, {
        holdTime: 0.12 + Math.random() * 0.1, // very short — twangy snap
        fadeTime: 0.3 + Math.random() * 0.2,
        volume: 0.12 + Math.random() * 0.06,
        freq: wrongFreq,
      }), stagger);
    });
  }

  // 🤘 Smash chord — chaotic burst of random notes like smashing hands on
  // an instrument. Fires when a Thrash (CQC) attack lands a hit.
  function playSmashChord() {
    const ALL_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const count = 8 + Math.floor(Math.random() * 5); // 8-12 notes
    for (let i = 0; i < count; i++) {
      const note = ALL_NOTES[Math.floor(Math.random() * 12)];
      const stagger = i * (20 + Math.random() * 25); // rapid fire 20-45ms apart
      setTimeout(() => playNoteSound(note, {
        holdTime: 0.04 + Math.random() * 0.08,   // very percussive
        fadeTime: 0.15 + Math.random() * 0.15,
        volume: 0.10 + Math.random() * 0.10,
      }), stagger);
    }
  }

  function playRiffSequence(riff, rootPc) {
    const spb = 60 / (riff.bpm ?? 110); // seconds per beat
    let t = 0.08;
    riff.notes.forEach(([off, beats, gap]) => {
      const pc   = ((rootPc + off) % 12 + 12) % 12;
      const name = PC_PLAY_NAMES[pc];
      const dur  = (beats ?? 1) * spb;
      setTimeout(() => playNoteSound(name, {
        holdTime: Math.max(0.18, dur * 0.85),
        fadeTime: 0.4,
        volume: 0.2,
      }), t * 1000);
      t += dur + (gap ? gap * spb : 0);
    });
    return t * 1000;
  }

  // ─── MELODY LINE FUNCTIONS ─────────────────────────────────────────────────────
  // `_micFreq` — set only when the mic placed this note: the equal-tempered
  // frequency of the register it was played in. Clicks pass nothing and behave
  // exactly as before (null = "no register recorded, use the base octave").
  function clickNoteStock(idx, _flyEvent, _forceChordMode, _micFreq = null) {
    if (!acting || !canAct) return; // N4/N7: gate
    // ── 🎚️ MIXER — once per turn, tap an already-played note to layer it again ──
    if (usedHas(usedStockIdx, idx)) {
      const hasMixer  = (actingNoteState?.unlockedSkills ?? []).includes('mixer');
      const mixerUsed = actingNoteState?.mixerUsedThisTurn ?? false;
      if (!hasMixer || mixerUsed || hasConfirmed || melodyLine.length >= 8 || pivotPending) return;
      if (staggeredSlots.includes(idx)) { addLog('⚡ Staggered — that slot is unavailable this turn.'); return; }
      const note     = noteStock[idx];
      const playable = isNotePlayable(note);
      const newTrack = [...melodyLine, note];
      playNoteSound(note);
      setNoteField(acting.id, {
        melodyLine:         newTrack,
        // -1 = "frees no stock slot". The mixer re-plays a note whose slot was
        // already spent by the original placement, so pulling this copy back
        // out must not hand the slot back a second time.
        melodySrcIdx:      [...melodySrcIdx, -1],
        // The mixer layers a note the player TAPPED, not one they played, so
        // there's no register to record. (The mic can't reach this path at all
        // — micPlaceNote only matches unused stock slots.)
        melodyFreq:        [...melodyFreq, null],
        discordCount:      playable ? discordCount : discordCount + 1,
        mixerUsedThisTurn: true,
      });
      addLog(`🎚️ MIXER — ${acting.name} layers ${note} a second time! (${newTrack.length} notes)`);
      return;
    }
    // Transpose card intercept: clicking a note picks the new root
    if (actingNoteState?.transposeCardPending) { resolveTransposeCard(idx); return; }
    // 🎸 CHORD MODE — lift this note into your combat chord instead of the melody.
    // A note spent on the chord is NOT in the track, so it doesn't carry you forward
    // (harmony vs. movement). Consumes the stock slot.
    if (stackCommitDest || _forceChordMode) {
      if (hasConfirmed) { addLog('✓ Already confirmed this turn.'); return; }
      if (pivotPending) { addLog('⚡ Declare Major or Minor first!'); return; }
      if ((actingNoteState?.stackCommitsThisTurn ?? 0) >= STACK_COMMIT_BUDGET) { addLog('🎸 Stack commit budget spent this turn (3/turn).'); return; }
      const dest = stackCommitDest || 'drive'; // _forceChordMode fallback
      const stack = dest === 'sustain' ? (actingNoteState?.sustainStack ?? []) : (actingNoteState?.driveStack ?? []);
      if (stack.length >= actingStackCap) {
        const locked = actingStackCap < STACK_CAP_MAX;
        addLog(`🎸 ${dest === 'sustain' ? 'Sustain' : 'Drive'} stack is full (${actingStackCap} slot${actingStackCap !== 1 ? 's' : ''}).${locked ? ' 📖 More Theory unlocks more slots.' : ''}`);
        return;
      }
      const note = noteStock[idx];
      playNoteSound(note);
      // 🎸 FLY — launch chord note chip animation toward the chord stack slot
      if (typeof _flyEvent === 'object' && _flyEvent && chordStackRef.current) {
        const src = _flyEvent.currentTarget?.getBoundingClientRect?.();
        const stackEl = chordStackRef.current;
        const stackRect = stackEl.getBoundingClientRect();
        // Target = centre of the slot this note will land in (vertical, top→bottom)
        const slotH = (stackRect.height - 30) / STACK_CAP_MAX; // rough per-slot height (all slots render, locked included)
        const slotIdx = stack.length; // about to become this index
        const tgtX = stackRect.left + stackRect.width / 2;
        const tgtY = stackRect.top + 20 + slotIdx * slotH + slotH / 2;
        if (src) {
          const srcX = src.left + src.width / 2;
          const srcY = src.top + src.height / 2;
          setFlyChordNote({ note, x: tgtX, y: tgtY, dx: srcX - tgtX, dy: srcY - tgtY, key: Date.now() });
          setTimeout(() => setFlyChordNote(null), 500);
        }
      }
      const stackKey = dest === 'sustain' ? 'sustainStack' : 'driveStack';
      setNoteField(acting.id, {
        [stackKey]:   [...stack, note],
        usedStockIdx: usedAdd(usedStockIdx, idx),
        stackCommitsThisTurn: (actingNoteState?.stackCommitsThisTurn ?? 0) + 1,
      });
      addLog(`🎸 ${note} → ${dest} stack (${stack.length + 1} notes, ${STACK_COMMIT_BUDGET - (actingNoteState?.stackCommitsThisTurn ?? 0) - 1} commits left)`);
      return;
    }
    if (melodyLine.length >= 8) return;
    if (hasConfirmed) { addLog('✓ Already confirmed this turn — end your turn to continue.'); return; }
    if (staggeredSlots.includes(idx)) { addLog('⚡ Staggered — that slot is unavailable this turn.'); return; }
    // Pivot must be declared before building can start (if Root Note is A/E/B)
    if (pivotPending) { addLog('⚡ Declare Major or Minor for your Root Note before building!'); return; }
    const note = noteStock[idx];
    const isTritone      = pitchIndex(note) === pitchIndex(tritoneNote);
    const intervalKey    = getIntervalKey(note);
    const isUnlocked     = intervalKey ? unlockedIntervalKeys.has(intervalKey) : false;
    const playable       = isNotePlayable(note);
    const newTrack       = [...melodyLine, note];
    const newDiscord     = playable ? discordCount : discordCount + 1;
    // Answer in the register it was played in when the mic supplied one.
    playNoteSound(note, _micFreq ? { freq: _micFreq } : {});
    // 🎵 FLY — launch note chip animation toward the commit track slot
    if (typeof _flyEvent === 'object' && _flyEvent && commitTrackRef.current) {
      const src = _flyEvent.currentTarget?.getBoundingClientRect?.();
      const trackEl = commitTrackRef.current;
      const trackRect = trackEl.getBoundingClientRect();
      // Target = centre of the slot this note will land in
      const slotW = (trackRect.width - 40) / 8; // rough per-slot width
      const slotIdx = melodyLine.length; // about to become this index
      const tgtX = trackRect.left + 40 + slotIdx * slotW + slotW / 2;
      const tgtY = trackRect.top + trackRect.height / 2;
      if (src) {
        const srcX = src.left + src.width / 2;
        const srcY = src.top + src.height / 2;
        setFlyNote({ note, x: tgtX, y: tgtY, dx: srcX - tgtX, dy: srcY - tgtY, key: Date.now() });
        setTimeout(() => setFlyNote(null), 500);
      }
    }
    setNoteField(acting.id, {
      melodyLine:    newTrack,
      melodySrcIdx: [...melodySrcIdx, idx],
      melodyFreq:   [...melodyFreq, _micFreq ?? null],
      usedStockIdx: usedAdd(usedStockIdx, idx),
      discordCount: newDiscord,
    });
    const noteLabel = isTritone && !isUnlocked ? '🔥 TRITONE — discord'
                    : isTritone && isUnlocked  ? '🔥 TRITONE — unlocked'
                    : playable                 ? 'in scale'
                    : intervalKey && !isUnlocked ? `🔒 ${intervalKey} — locked (discord)`
                    : '⚡ discord';
    addLog(`🎵 ${note} → track (${noteLabel}) · ${newTrack.length} notes`);
  }

  // ── 🔁 PULL A NOTE BACK OUT OF THE TRACK ────────────────────────────────────
  // The track is a DRAFT until confirmNoteTrack() locks it in. Clicking a placed
  // note lifts it back out and returns its stock slot, so building a melody is
  // an editable arrangement rather than eight irreversible decisions. Nothing
  // about scoring changes — this only runs before hasConfirmed.
  //
  // Notes carry where they came from (melodySrcIdx), so each source returns
  // correctly: a stock note frees its exact slot, a banked note goes back to the
  // bank, and a mixer duplicate simply disappears (its slot was already spent).
  //
  // discordCount is RECOMPUTED from the surviving notes rather than decremented,
  // because a stale count would quietly corrupt the commit payout.
  function removeMelodyNote(i) {
    if (!acting || !canAct) return;
    if (hasConfirmed) { addLog('✓ Already confirmed this turn — the track is locked in.'); return; }
    if (pivotPending) { addLog('⚡ Declare Major or Minor for your Root Note first!'); return; }
    const note = melodyLine[i];
    if (note === undefined) return;

    const src        = melodySrcIdx[i];
    const heardFreq  = melodyFreq[i] ?? null;
    const newTrack   = melodyLine.filter((_, k) => k !== i);
    const newSrc     = melodySrcIdx.filter((_, k) => k !== i);
    // Same splice as melodySrcIdx — melodyFreq is index-parallel to melodyLine,
    // so dropping a note from the middle without dropping its frequency would
    // slide every later note's register one slot out of alignment.
    const newFreq    = melodyFreq.filter((_, k) => k !== i);
    const newDiscord = newTrack.reduce((n, nt) => n + (isNotePlayable(nt) ? 0 : 1), 0);

    // ⚠️ payoutRouting is keyed by TRACK INDEX, so pulling a note out of the
    // middle shifts every choice made after it. Left unremapped, the note that
    // slides into slot 3 would silently inherit slot 3's old routing and get
    // paid to the wrong stack. Drop the removed index, shift everything above
    // it down one.
    const oldRouting = actingNoteState?.payoutRouting ?? {};
    const newRouting = {};
    for (const [k, v] of Object.entries(oldRouting)) {
      const k2 = Number(k);
      if (k2 === i) continue;
      newRouting[k2 > i ? k2 - 1 : k2] = v;
    }

    const patch = {
      melodyLine:    newTrack,
      melodySrcIdx:  newSrc,
      melodyFreq:    newFreq,
      discordCount:  newDiscord,
      payoutRouting: newRouting,
    };

    if (src === 'bank') {
      patch.bankedNote = { note };
      addLog(`🔁 ${note} pulled from the track — back in the bank · ${newTrack.length} notes`);
    } else if (typeof src === 'number' && src >= 0) {
      patch.usedStockIdx = usedList(usedStockIdx).filter(x => x !== src);
      addLog(`🔁 ${note} pulled from the track — back in your stock · ${newTrack.length} notes`);
    } else {
      // Mixer duplicate (or a legacy note placed before source tracking existed).
      addLog(`🔁 ${note} pulled from the track · ${newTrack.length} notes`);
    }

    // Pulling a note out echoes it in the register it went in with.
    playNoteSound(note, heardFreq ? { freq: heardFreq } : {});
    setNoteField(acting.id, patch);
  }

  // ── 🎤 MIC INPUT — play the note, place the note ─────────────────────────────
  // The detection layer already exists and is proven (audio/micPitch.js drives
  // Discord Coach and Fretboard Recon). All that happens here is routing its
  // output into the SAME clickNoteStock() a click calls — no separate code path,
  // so mic-placed notes score, route and undo identically to clicked ones.
  //
  // No debounce here on purpose: micPitch already gates on RMS, YIN confidence,
  // pitch stability and minGapMs, and fires once per onset. Adding a second
  // debounce would just swallow fast legitimate playing.
  //
  // Immediate-commit rather than arm-then-confirm is only safe because the track
  // is editable — a misheard note costs one click to pull back out.
  const [micOn, setMicOn]       = useState(false);
  const [micHeard, setMicHeard] = useState(null);   // { note, ok } — last thing heard
  const [micErr, setMicErr]     = useState(null);
  const micHandleRef            = useRef(null);
  const micNoteHandlerRef       = useRef(() => {});

  // ⚠️ Match on `pcAbsolute`, NOT on `key`.
  //
  // micPitch's `key` is a guitarMap code, not a note name: PC_KEYS is
  // ['a','A','b','c','C','d','D','e','f','F','g','G'] where lowercase is the
  // natural and UPPERCASE is the sharp. So the mic's 'C' means C#, and feeding
  // it to pitchIndex() silently resolved to C natural — placing a real but
  // WRONG note rather than simply failing. `pcAbsolute` is already a C-based
  // 0–11 pitch class, the same basis pitchIndex returns, so the two compare
  // directly and enharmonics (F#/Gb) collapse for free.
  // `freqTempered` is the detected note snapped to A440. Deliberately NOT the
  // raw `freq`: a guitar that's a few cents flat would otherwise put a
  // permanently out-of-tune note into a track that everything else voices in
  // equal temperament. We keep the octave you played, not your intonation.
  function micPlaceNote({ key, pcAbsolute, freqTempered }) {
    if (!acting || !canAct || hasConfirmed || pivotPending) return;
    const heardName = NOTE_POOL[pcAbsolute] ?? key;
    if (melodyLine.length >= 8) { setMicHeard({ note: heardName, ok: false }); return; }
    // Strip any octave digits a stock note may carry before the lookup.
    const pc  = (n) => pitchIndex(String(n).replace(/\d/g, ''));
    const idx = noteStock.findIndex((n, i) =>
      !usedHas(usedStockIdx, i) && !staggeredSlots.includes(i) && pc(n) === pcAbsolute);
    if (idx < 0) { setMicHeard({ note: heardName, ok: false }); return; }
    setMicHeard({ note: heardName, ok: true });
    // The exact entry point a click uses. Called with no fly-event, so the
    // chip animation is skipped (it needs a DOM source rect) — everything
    // else, scoring and undo included, is the identical path. The 4th arg is
    // the only thing a mic placement carries that a click doesn't.
    clickNoteStock(idx, null, false, freqTempered ?? null);
  }

  // Keep the live handler in a ref. The mic callback is created once when the
  // stream opens, so calling micPlaceNote directly would capture that render's
  // melodyLine/usedStockIdx forever and place notes against stale state.
  useEffect(() => { micNoteHandlerRef.current = micPlaceNote; });

  // Open the stream only while the player is actually building a melody, and
  // hand it back the moment they aren't — no hot mic sitting open all game.
  useEffect(() => {
    const wanted = micOn && turnStep === 'melody' && !!acting && canAct && !hasConfirmed;
    let cancelled = false;
    if (wanted && !micHandleRef.current) {
      // Wrapped: this callback runs inside micPitch's rAF loop, so an exception
      // here disappears into the audio thread instead of surfacing as a visible
      // failure — the note readout still updates and nothing places, which looks
      // like a detection problem rather than a code error. Log it loudly.
      startMicListening(payload => {
        try { micNoteHandlerRef.current(payload); }
        catch (err) { console.error('[RLSW MIC] note placement failed:', err); }
      })
        .then(h => {
          if (cancelled) { h.stop(); return; }
          micHandleRef.current = h;
          setMicErr(null);
          addLog('🎤 Mic armed — play a note to place it in your track.');
        })
        .catch(() => { if (!cancelled) { setMicErr('mic blocked'); setMicOn(false); } });
    } else if (!wanted && micHandleRef.current) {
      micHandleRef.current.stop();
      micHandleRef.current = null;
      setMicHeard(null);
    }
    return () => { cancelled = true; };
  }, [micOn, turnStep, acting?.id, canAct, hasConfirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Release the device if the component goes away mid-turn.
  useEffect(() => () => { micHandleRef.current?.stop(); micHandleRef.current = null; }, []);

  function toggleMic() {
    if (!micAvailable()) { setMicErr('no mic'); addLog('🎤 No microphone available (needs HTTPS or localhost).'); return; }
    setMicOn(v => !v);
  }

  // 🎸 Drop not available — use the stack commit system.
  // Kept as a no-op to avoid breaking any event handler references.
  function removeChordNote(i) {
    addLog('🎸 Drop not available — use the stack commit system.');
  }

  // ── 🎸 B8 MODE BONUS — the applier ──────────────────────────────────────────
  // This was `declarePivot(mode)`, wired to two buttons. The mode itself is now
  // derived and respelled inside the startNewTurnNotes reducer (B8); all that is
  // left here is the part that reducer can't do — pay the bonus, announce it, and
  // award a skill if the DB bar tipped over.
  //
  //   Major → +1 DB          (bright momentum; major favours harmonic runs)
  //   Minor → +1 tempSustain (dark resolve, defensive edge) — blocked by Mojo Drain
  //
  // The asymmetry is deliberate and load-bearing: major is tempo, minor is
  // defense. If both paid DB the "choice" would collapse into "always the bigger
  // number". (It also used to pay minor in tempDRIVE, contradicting both the
  // comment above it and the design doc — fixed in the B8 core pass.)
  function payModeBonus(spiritId) {
    const ns = noteStates[spiritId];
    const staged = ns?.pendingModeBonus;
    if (!staged) return;
    const { mode, reason, root } = staged;

    const isMojoDrained = (ns.mojoDrain ?? 0) > 0;
    let bonusPatch = {};
    let bonusMsg = '';
    if (mode === 'major') {
      const targetSkill = ns.targetSkillId ? SKILL_BY_ID[ns.targetSkillId] : null;
      const targetCost  = targetSkill?.dbCost ?? DB_UPGRADE_THRESHOLD;
      const { newDBPoints, upgradeTriggered } = advanceDB(ns.dbPoints ?? 0, 1, targetCost);
      const newUpgradesPending = upgradeTriggered
        ? (ns.upgradesPending ?? 0) + 1
        : (ns.upgradesPending ?? 0);
      bonusPatch = { dbPoints: newDBPoints, upgradesPending: newUpgradesPending,
        totalDB: (ns.totalDB ?? 0) + 1 };
      bonusMsg = upgradeTriggered
        ? ` · ☀️ Major bonus: +1 DB → 🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!`
        : ` · ☀️ Major bonus: +1 DB [${newDBPoints}/${targetCost}]`;
    } else {
      if (!isMojoDrained) {
        const newSustain = (ns.tempSustain ?? 0) + 1;
        bonusPatch = { tempSustain: newSustain };
        bonusMsg = ` · 🌑 Minor bonus: +1 Sustain (now +${newSustain})`;
      } else {
        bonusMsg = ' · 🌑 Minor (Mojo Drained — Sustain bonus blocked)';
      }
    }

    setNoteField(spiritId, { ...bonusPatch, pendingModeBonus: null });

    // Say WHY the mode is what it is — the line is doing the teaching the two
    // buttons used to do. 'locked' is the most valuable of the three: hearing a
    // minor chord and being told the game can't spell it yet sells Minor Tonality
    // far better than a greyed-out button at the moment of least interest.
    const chord  = ns.modeChordName ?? 'your stack';
    const why = reason === 'quality'   ? `${chord} sets the key`
              : reason === 'ambiguous' ? `${chord} has no third — mode held`
              : /* locked */             `${chord} wants minor — 🔒 unlock Minor Tonality`;
    addLog(`🎸 ${root} ${mode} — ${why}.${bonusMsg}`);

    if (bonusPatch.upgradesPending > (ns.upgradesPending ?? 0) && ns.targetSkillId) {
      setTimeout(() => awardTargetSkill(spiritId), 60);
    }
  }

  function clearNoteTrack() {
    if (!acting || !canAct) return; // N4/N7: gate
    setNoteField(acting.id, {
      melodyLine: [],
      melodySrcIdx: [],
      melodyFreq: [],
      usedStockIdx: [],
      discordCount: 0,
      // Routing is keyed by track index, so it MUST die with the track — a stale
      // map would silently reroute whatever note lands on index 3 next.
      payoutRouting: {},
      // pivotPending intentionally NOT cleared — must still be resolved if active
    });
    addLog('✕ Melody Line cleared');
  }

  // Player taps "Use Bank" — adds banked note to track as a free extra note
  function useBankedNote() {
    if (!acting || !canAct || !bankedNote) return; // N4/N7: gate
    if (hasConfirmed) { addLog('✓ Already confirmed — cannot use bank this turn.'); return; }
    if (pivotPending) { addLog('⚡ Declare Major/Minor before using the banked note.'); return; }
    const note = bankedNote.note;
    const playable = isNotePlayable(note);
    const newTrack = [...melodyLine, note];
    const newDiscord = playable ? discordCount : discordCount + 1;
    setNoteField(acting.id, {
      melodyLine:    newTrack,
      // 'bank' = came from the bank, not the stock. Pulling it back out
      // re-banks it rather than freeing a stock slot, so an edit never
      // silently destroys a banked note.
      melodySrcIdx: [...melodySrcIdx, 'bank'],
      melodyFreq:   [...melodyFreq, null],  // tapped, not played — no register
      discordCount: newDiscord,
      bankedNote:   null,  // consumed
    });
    addLog(`💾 Banked note ${note} → track (${playable ? 'playable' : '⚡ discord'}) · ${newTrack.length} notes`);
  }

  function confirmNoteTrack() {
    if (!acting || !canAct) return; // N4/N7: gate
    const baseTrack = actingNoteState?.melodyLine ?? [];
    if (baseTrack.length === 0) { addLog('❌ No notes in track!'); return; }
    // (Style is gone — `actingStyle` and its two Task-C consumers with it. The
    //  spirit's style survives only as character flavour in data/styles.js.)
    // ── 🎤 MIC — voice roll: d6, on 4+ a bonus in-scale note joins the track ──
    // (shadows the outer derived melodyLine so all scoring below includes the bonus)
    let melodyLine = baseTrack;
    if ((actingNoteState?.unlockedSkills ?? []).includes('mic')) {
      const voiceRoll = Math.floor(Math.random() * 6) + 1;
      // 🎤 Show the roll as a spinning-then-settling d6 so the player SEES it land.
      const vKey = Date.now() + Math.random();
      setVoiceRollFx({ value: voiceRoll, success: voiceRoll >= 4, key: vKey });
      setTimeout(() => setVoiceRollFx(prev => (prev && prev.key === vKey ? null : prev)), 2600);
      if (voiceRoll >= 4) {
        const scaleNotes = buildScale(rootNote, scaleMode);
        // (C1's `micBonusNote` guard is gone with the Style system. It existed only
        //  to stop a rolled note overwriting a Groove spirit's root landing — the
        //  one non-monotone rule in the Style scorer. Every surviving Db source is
        //  monotone under append, so a bonus note can no longer cost the player
        //  anything and the roll is once again a plain upside.)
        const bonusNote  = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
        melodyLine = [...baseTrack, bonusNote];
        addLog(`🎤 Voice roll ${voiceRoll} — your vocals land! Bonus note ${bonusNote} joins the track.`);
      } else {
        addLog(`🎤 Voice roll ${voiceRoll} — the crowd drowns you out. No bonus note.`);
      }
    }
    // ── 🎼 RIFF DETECTION — does this track hide a legendary riff? ──
    // If the opening intervals of a riff are on the track (any key), the FULL
    // riff plays out with real rhythm instead of the plain arpeggio.
    const riffMatch = detectRiff(melodyLine);
    if (riffMatch) {
      const { riff, rootPc } = riffMatch;
      const isNew = !riffBook[riff.id];
      const fp = isNew ? riff.fp : 1;
      if (isNew) {
        setRiffBook(prev => ({ ...prev, [riff.id]: acting.id }));
        addLog(`🎼✨ RIFF DISCOVERED — ${riff.name}! ${acting.name} writes it into the Riffbook!`);
        showTip('riff');
      } else {
        addLog(`🎼 ${acting.name} plays ${riff.name}!`);
      }
      playRiffSequence(riff, rootPc);
      setRiffBanner({ riffId: riff.id, spiritId: acting.id, fp, isNew });
      setTimeout(() => setRiffBanner(prev => (prev && prev.riffId === riff.id ? null : prev)), 5600);
      setTimeout(() => grantFame(acting.id, fp, `🎼 ${riff.name}`), 500);
    } else {
      playTrackSequence(melodyLine, { style: COMMIT_STYLES[acting?.id], freqs: melodyFreq });
    }

    // ── 🎯 CADENCE OBJECTIVES — your track's FINAL note is this turn's "final" ──
    // String the right finals across consecutive turns (any key) to resolve a
    // cadence for Fame. e.g. THE FULL RESOLVE: end on C, then F, then G, then C.
    let cadenceResolved = false;  // 🎭 set when a cadence completes this commit (feeds P)
    {
      const lastPc = pitchIndex(melodyLine[melodyLine.length - 1]);
      if (lastPc >= 0) {
        const newTrail = [...(actingNoteState?.finalsTrail ?? []), lastPc].slice(-6);
        const cooldowns = actingNoteState?.cadenceCooldowns ?? {};
        const cadence = detectCadence(newTrail, cooldowns);
        if (cadence) {
          cadenceResolved = true;
          setNoteField(acting.id, {
            finalsTrail: [lastPc], // resolution note starts a fresh run
            cadenceCooldowns: { ...cooldowns, [cadence.id]: 3 },
          });
          addLog(`🎯✨ ${acting.name} resolves ${cadence.name} (${cadence.formula})!`);
          showTip('cadence');
          setCadenceToast({ cadenceId: cadence.id, spiritId: acting.id, fans: cadence.fp });
          setTimeout(() => setCadenceToast(prev => (prev && prev.cadenceId === cadence.id ? null : prev)), 5600);
          // 🎤 Cadences are a melody-line feat, not a battle — they build crowd, not Fame.
          setTimeout(() => gainFansFromDeed(acting.id, cadence.fp, `🎯 ${cadence.name}`), 700);
        } else {
          setNoteField(acting.id, { finalsTrail: newTrail });
        }
      }
    }
    // 🌀 FREESTYLE — Intergalactic 0's first wrong note each turn lands intentional, not wrong:
    // it's pardoned from the discord penalty (and, below, doesn't drag the crowd + earns Flair).
    const freestylePardon = acting?.id === 'intergalactic_0';
    // ── 🎸 CHORD CONTEXT — THE SINGLE PASS (B3) ──────────────────────────────
    // One classification per commit, read by everything downstream. B4 (color notes
    // pay the stack that authorized them), B5 (Harmonic Lock), B7 (per-note discord
    // penalty) and the commit log must all count from THIS array — do not recompute
    // the pardon in three places, they will drift.
    //
    // `discordCount` is incremented at PLACEMENT time, before the approach-note tier
    // can be known (it depends on the note played next). It stays as live UI
    // feedback; the SCORE comes from here. The two agree for every tier except
    // theory_chromatic, where the commit count can only be lower — a pardon the
    // player earns by resolving, revealed at the moment they resolve it.
    //
    // `payoutRouting` is the last argument: the player's picks for notes both
    // stacks legalized. It can only redirect a pardon between the two stacks that
    // already earned it, never create one, so it cannot change `unpardonedDiscord`
    // or any score below — only which of Drive/Sustain gets credited.
    const trackClassified = classifyTrack(
      melodyLine, keyScale, actingDriveStack, actingSustainStack,
      actingNoteState?.unlockedSkills ?? [], payoutRouting);
    const unpardonedDiscord = countUnpardoned(trackClassified);
    const contextPardons    = countPardonedByStack(trackClassified);  // B4 reads this
    const effectiveDiscord = Math.max(0, unpardonedDiscord - (freestylePardon ? 1 : 0));
    // `allInScale` — "the crowd heard a clean track." Fed to gainFans and the maj3
    // gated ending. B6 removed its old scoring role: a chromatic run of 3+ still
    // flips it true (see the B6 block below) but that no longer waives the Db
    // penalty, which is now per-note via B7. Declared `let` here and possibly
    // reassigned after the discord-unlock flags are known.
    let allInScale     = effectiveDiscord === 0;
    const lastNote     = melodyLine[melodyLine.length - 1];
    const firstNote    = melodyLine[0];
    // B8: there is no pivot to pend. The mode is DERIVED at the start of the next
    // turn (startNewTurnNotes → modeFromStack), so this stays false forever and the
    // mode carried here is only a placeholder that turn start will overwrite.
    const newPivotPending = false;
    const newMode = scaleMode;
    // Respell the new root note using enharmonic map (split roots resolve at turn start)
    const newRootRaw = ENHARMONIC_RESPELL[lastNote] ?? lastNote;

    // ── SPEED & BANKING ───────────────────────────────────────────────────────
    // Total notes placed = movement potential, capped at Spirit's Speed
    const totalNotes    = melodyLine.length;
    const usableMoves   = Math.min(totalNotes, actingSpeed);
    const overflow      = totalNotes - usableMoves; // notes beyond speed cap
    // If overflow >= 1 AND bank is empty, auto-bank the last overflow note
    const existingBank  = actingNoteState?.bankedNote ?? null;
    const canBank       = overflow >= 1 && !existingBank;
    const newBankedNote = canBank ? { note: melodyLine[totalNotes - 1] } : existingBank;

    const hexes    = usableMoves;
    const intervals = getIntervalNotes(rootNote, scaleMode);
    const isMojoDrained = (actingNoteState?.mojoDrain ?? 0) > 0;

    // ── INTERVAL EFFECTS ──────────────────────────────────────────────────────
    // Tritone: anywhere in track → +1 Performance Score (works even with Dischord).
    // This is the tritone's whole remaining payout; B5 removed the feedbackBoost
    // charge it used to arm. Consumed by economy.js's performanceScore kernel.
    const trackHasTritone   = melodyLine.includes(intervals.tritone);
    // Octave resolution: first and last note identical
    const isOctaveResolution = hexes >= 2 && firstNote === lastNote;
    // Major 3rd end: clean only
    const hasBlues      = (actingNoteState?.discordUnlocks ?? []).includes('discord_1');
    const hasBorrowed   = (actingNoteState?.discordUnlocks ?? []).includes('discord_2');
    const hasTritoneUp  = (actingNoteState?.discordUnlocks ?? []).includes('discord_3');
    const hasChromClimb = (actingNoteState?.discordUnlocks ?? []).includes('discord_4');

    // Minor 7th end — only fires if Blues Lick (discord_1) is unlocked, major scale only
    const isMinorSeventhEnd  = hasBlues && scaleMode === 'major' && lastNote === intervals.minorSeventh;
    // Major 3rd end — only fires if Borrowed Chord (discord_2) is unlocked, minor scale only
    const isMajorThirdEnd    = hasBorrowed && scaleMode === 'minor' && allInScale && lastNote === intervals.majorThird;
    // Tritone end — only fires if Devil's Interval (discord_3) is unlocked
    const isTritoneEnd       = hasTritoneUp && lastNote === intervals.tritone;
    // ── B6: CHROMATIC RUN — PARDON BECAME PAYOUT ─────────────────────────────
    // The run used to switch the discord penalty off for the WHOLE track. It no
    // longer does: it pays Db instead (`chromRun.db`, applied in the DB scoring
    // block below) and the wrong notes are priced per-note by B7.
    //
    // Dropping the blanket pardon is the substance of "pardon becomes payout," and
    // it matters more than it looks: the old rule pardoned every unrelated wrong
    // note elsewhere in the track too, so one chromatic run bought total immunity.
    // Now the run's own notes are pardoned only where the Approach Notes tier
    // actually pardons them — i.e. where they RESOLVE onto a chord tone — and
    // anything else you got wrong still costs. Same gesture, real gradient.
    const chromRunLen        = detectChromaticRun(melodyLine);
    const chromClimbActive   = hasChromClimb && chromRunLen >= 3;
    // ⚠️ `allInScale` is KEPT true for a 3+ run, but note what it now feeds: the
    // maj3 gated ending and `gainFans` — flavour and crowd, NOT the Db penalty.
    // A deliberate chromatic run should still read to the crowd as intent rather
    // than as a fistful of mistakes. If that ever needs to change, change it here;
    // the scoring path no longer looks at this flag at all.
    if (chromClimbActive) allInScale = true;

    // ── ⚔️ COMBAT FLAVOR TRIGGERS — REMOVED (B1) ─────────────────────────────
    // Four melody→combat triggers used to hang off these endings: Blues Lick
    // (♭7 → Mojo Drain), Devil's Interval (tritone → Burn), Borrowed Chord
    // (maj3 → cleanse/shield) and Stagger (chromatic run). They were skippable,
    // awkward, and their removal is what frees the discord unlocks to become the
    // chord-context system (B3) instead.
    //
    // The interval DETECTION above stays — B5's Harmonic Lock needs it, and
    // `hasGatedEnding` still pays Performance Score for the flair of landing one.
    //
    // ⚠️ The STATUSES themselves are NOT gone, because none of them were
    // exclusive to these triggers:
    //   • mojoDrain ← the Riff-Off "convicted" verdict
    //   • stagger   ← an ultimate, and the candle event rolling a 1
    //   • burn      ← Pyrotechnics (walk-in and eruption waves)
    // Only the ARMING fields (pendingMojoDrain / pendingStagger / burnArmed) and
    // statusShield — which really was Borrowed-Chord-only — were removed. The
    // `isMojoDrained` gates below are likewise KEPT: Mojo Drain still lands from
    // the Riff-Off, and stripping its suppression would quietly gut that penalty.
    const feedbackOverloadMsg = '';

    // ── DRIVE BOOST: diatonic step runs (scale-only, blocked by Mojo Drain) ──
    const diatonicRunLen   = detectDiatonicRun(melodyLine, currentScale);

    // (Riff Slayer + Paranoia removed — replaced by Slime / Number of the Beast)
    // NOTE: the Riff Slayer removal took `skipClimbLen` with it, but the
    // Performance Score kernel below still reads it (economy.js scores a
    // skip-climb of 3+ as +1 flair). Keep it defined here — leaving it out
    // throws a ReferenceError mid-commit, which silently aborts the rest of
    // confirmNoteTrack (no move budget, no `move_act` step → turn deadlock).
    const skipClimbLen     = detectSkipClimb(melodyLine, currentScale);

    // (E-Rush removed — Ronin rework)

    // ── B4: COLOR NOTES PAY THE STACK THAT AUTHORIZED THEM ───────────────────
    // A pardoned off-scale note doesn't just escape the Discord penalty, it earns —
    // in Drive/Sustain, never in Db. Db is the ENDING's payout (scoreTrackDB reads
    // the last note); Drive/Sustain is the INTERIOR's payout (driveBoostFromRun and
    // sustainBoostFromPattern both read the middle). Color is an interior gesture,
    // so it pays where interior gestures already pay and the player has no second
    // mental column to keep.
    //
    // Routing is already decided for us: classifyTrack stamped each pardoned note
    // with the stack that legalized it, and claimAt resolved "legal in both" to the
    // higher-ranked chord with ties going to Drive. Count from contextPardons; do
    // NOT re-derive which stack wins here, or this and the flash line will drift.
    //
    // Cap +2 per stack per commit — a 6-note chromatic smear over a dom9 shouldn't
    // out-earn the diatonic run the boost was built for.
    //
    // ⚠️ THIS IS NOW THE PARDON ECONOMY'S ONLY PAYOUT, AND THAT IS DELIBERATE.
    // The Db audit found the pardon ladder worth only ~+0.24 Db per commit across
    // all 46 Db of Theory — because a pardon can never be worth more than the
    // penalty it forgives, and most tracks carry 0–1 wrong notes. That reads as
    // alarming until you notice the audit measured Db only: colour's real payoff
    // was always HERE, in Drive and Sustain. Db answers "did you play it right";
    // colour answers "did you play it hard". Two currencies, two questions, and
    // the reason the pardon was left alone rather than inflated.
    // (C4's Flair "Outside" inverted this routing for one style — deleted with the
    //  Style system. It fired on 5% of commits and was worth 0.06 Db.)
    const colorDrive   = !isMojoDrained ? Math.min(2, contextPardons.drive)   : 0;
    const colorSustain = !isMojoDrained ? Math.min(2, contextPardons.sustain) : 0;

    // Folded into the raw boost rather than added after the fact, so color flows
    // through the SAME highest-wins/overflow-to-Db machinery as every other boost.
    // The alternative — adding on top once newTempDrive settles — would make color
    // the only boost in the game that can't be discarded, i.e. a guaranteed +2 that
    // ignores the economy the other two sources pay into.
    const rawDriveBoost    = !isMojoDrained ? driveBoostFromRun(diatonicRunLen) + colorDrive : 0;
    const prevTempDrive    = actingNoteState?.tempDrive ?? 0;
    let newTempDrive       = prevTempDrive;
    let driveOverflowToDB  = 0; // lower-value discard feeds Decibills
    if (rawDriveBoost > 0) {
      if (rawDriveBoost > prevTempDrive) {
        driveOverflowToDB = prevTempDrive; // discard lower into DB
        newTempDrive = rawDriveBoost;
      } else {
        driveOverflowToDB = rawDriveBoost; // new one is lower — discard it
        // prevTempDrive stays
      }
    }

    // ── FEEDBACK BOOST: repeat patterns (scale-only, blocked by Mojo Drain) ───
    const repeatPatLen      = detectRepeatPattern(melodyLine, currentScale);
    const rawSustainBoost   = !isMojoDrained ? sustainBoostFromPattern(repeatPatLen) + colorSustain : 0;
    const prevTempSustain   = actingNoteState?.tempSustain ?? 0;
    let newTempSustain      = prevTempSustain;
    let sustainOverflowToDB = 0;
    if (rawSustainBoost > 0) {
      if (rawSustainBoost > prevTempSustain) {
        sustainOverflowToDB = prevTempSustain;
        newTempSustain = rawSustainBoost;
      } else {
        sustainOverflowToDB = rawSustainBoost;
      }
    }

    // Total overflow fed to Decibills as bonus points
    // ⚠️ NO LONGER FED TO Db. The "discard the lower boost into Decibills" rule was
    // 13% of all Db income — the single largest source the player could neither
    // see, name, nor aim at, because it pays out the half of a comparison that
    // LOST. The Drive/Sustain boosts themselves are untouched above; only this
    // consolation Db is gone. Kept as a display value: the flash still shows what
    // was discarded, it just no longer turns into currency.
    const dbOverflow = 0;
    const discarded  = driveOverflowToDB + sustainOverflowToDB;

    // ── APPLY SELF EFFECTS (blocked by Mojo Drain) ───────────────────────────
    // (B5: `newFeedbackBoost` removed. The tritone used to light a "Damage ×2"
    //  charge that multiplied nothing — the badge was the whole feature. Damage is
    //  banded and hard-capped (Thrash 4, Sonic 2) against a max Vibe of 4–5, so an
    //  honest ×2 would have one-shot every spirit in the game; there was no version
    //  of this worth shipping. The tritone keeps its colour, its discord_3 unlock
    //  and its +1 Performance Score — three things that do what they advertise.)
    const newDieFloorBoost = !isMojoDrained && isOctaveResolution ? 2 : 0;

    // ── MAJOR 3RD CLEANSE / SHIELD — REMOVED (B1) ────────────────────────────
    // `newStatusEffects` is still threaded through the commit write below, so it
    // survives as a plain pass-through of the existing list.
    const newStatusEffects = [...(actingNoteState?.statusEffects ?? [])];
    const majorThirdMsg = '';
    const cleansePatch = {};

    // ── DB SCORING ────────────────────────────────────────────────────────────
    // ── B7: THE DISCORD PENALTY GETS TEETH ───────────────────────────────────
    // Was a flat −1 for the whole track however many notes were wrong, which made
    // the entire pardon economy worth at most one point — a 46-Db ladder sold to
    // dodge a one-point tax. Now it's per note, first one free, floored at 3.
    // The curve lives in `discordPenaltyFor` (music/context.js) so the assertions
    // can reach it; see there for why the grace and the floor are both load-bearing.
    //
    // `effectiveDiscord` is the count from `classifyTrack` — the SETTLED count,
    // after the chord context has had its say — minus Intergalactic 0's freestyle
    // pardon. The two pardons stack (freestyle + grace = two free notes for that
    // spirit), which is deliberate: freestyle is his identity and it also feeds the
    // P-score and the crowd, so it isn't merely a discount on this one line.
    //
    // Removed here: the `theory_chromatic` "penalties halved" effect and the
    // Chromatic Climb full pardon. B3's Approach Notes tier already pardons the
    // notes that resolve, and halving on top of it was near-total immunity — two
    // effects doing one job, one of them invisible.
    // (`hasChromMastery` is gone with the halving it gated. B6's payout reads the
    //  same skill through `chromaticPayout`, which does its own tier check.)
    const discordPenalty = discordPenaltyFor(effectiveDiscord);
    const baseScore = scoreTrackDB(melodyLine, fourthNote, fifthNote);

    // ── B6: THE CHROMATIC RUN'S PAYOUT ───────────────────────────────────────
    // The capstone's one loud effect: a run of 3+ pays +3 Db, +1 per note beyond,
    // capped +5. ⚠️ DELETED — IT FIRED ON 1% OF COMMITS. Measured across 15,000
    // simulated commits it was worth 0.02 Db each, which made it 16 Db of skill
    // ladder buying a payout essentially nobody would ever see. Chromatic Mastery
    // now sells the sixth stack slot instead, which is the lever that demonstrably
    // moves the ladder (Harmonic Lock climbs 0.00 → 0.83 on slots alone).
    //
    // The chromatic RUN still matters, just not in Db: `chromRunLen` below keeps
    // flipping `allInScale`, which feeds `gainFans`. A chromatic smear reads to the
    // crowd as showmanship — which is exactly where flair belongs now.

    // ── B5: HARMONIC LOCK ────────────────────────────────────────────────────
    // B2 halved the ending ladder so Db came from playing well rather than from
    // turning up. This is where the other half returns — to a player who built a
    // sophisticated chord AND landed the line on it. A 5th ending into a dom9
    // stack is 3 + 2 = 5 Db: about the pre-B2 value, earned instead of baseline.
    //
    // ⚠️ It ESCALATES the ending bonus, so it requires one. No ending bonus → no
    // lock, even if the final note is a chord tone. That's the doc's arithmetic
    // ("stacks on top of B2's ladder") and it's the tighter design: the last note
    // has to resolve at the key level AND belong to something worth building.
    // Gated on `endingBonus` rather than on the breakdown strings, which are copy.
    //
    // Stack selection is B4's rule (higher rank, ties to Drive), decided inside
    // harmonicLock so there is exactly one tie-break in the codebase.
    const lock = baseScore.endingBonus > 0
      ? harmonicLock(melodyLine[melodyLine.length - 1], actingDriveStack, actingSustainStack)
      : { bonus: 0, stack: null, rank: 0, chordName: null };

    // ═══ THE WHOLE Db PAYOUT — FOUR SOURCES, AND THAT IS THE POINT ═══════════
    // A commit used to move the Db number nine different ways: track length, the
    // ending bonus, Harmonic Lock, the chromatic payout, Flair's Outside, the
    // discord penalty, the Drive/Sustain overflow, the Performance-Score top-up,
    // and Style Db. Nobody can hold nine inputs in their head, so the Db a player
    // earned read as weather rather than as consequence — which quietly wrecked
    // the thing the game is actually about, because you cannot feel rewarded for
    // building a good chord if you can't tell which of nine things paid you.
    //
    // Four remain, and each asks a question a player can aim at:
    //
    //   length   — how much did you play?          (scoreTrackDB step A)
    //   ending   — where did you come to rest?     (scoreTrackDB step B: 4th/5th/8ve)
    //   lock     — was that landing in YOUR CHORD? (harmonicLock)
    //   penalty  — how many notes fought the key?  (discordPenaltyFor)
    //
    // The design line that decided the cuts: Db pays for FACTS, not for taste.
    // "You landed on the 5th" and "your last note was in your chord" are facts a
    // player can hear, aim at, and verify. "That phrase was interesting" is not,
    // and every source cut was some version of trying to score it. That judgement
    // didn't disappear — it moved to the crowd, where being impressionistic is
    // correct. See `perfScore` below: it still runs, and it now feeds fans alone.
    let breakdown = [...baseScore.breakdown];
    if (lock.bonus > 0) breakdown.push(`🔒 ${lock.chordName} +${lock.bonus}`);
    const preDiscordPoints = baseScore.points + lock.bonus;
    let earned = Math.max(0, preDiscordPoints - discordPenalty);
    if (discordPenalty > 0 && preDiscordPoints > 0) {
      breakdown.push(`−${discordPenalty} discord`);
    }
    // ── 🎭 PERFORMANCE SCORE P — FLAIR (Crowd & Intimidation layer, §4) ──
    // P measures how INTERESTING the placement was, not how long the track is:
    // melodic shape (contour, leaps, interval variety) + palette + recognized
    // gestures + repeated motifs, with track length only a small nudge. 0–10.
    // The pure kernel now lives in engine/systems/economy.js (`performanceScore`,
    // Phase 5a — single source of truth); it's invoked below once its remaining
    // inputs (suspended ending) are known.

    // ── ⚡ DISSONANCE EDGE — REMOVED (system cut — Theory streamlined) ──
    const newEdgeStage          = 0;
    const edgeDbCost            = 0;
    const edgeFanCost           = 0;
    const edgeDbBonus           = 0;
    const edgeCollapseFans      = 0;
    const edgeResolvedThisTurn  = false;
    const edgeCollapsedThisTurn = false;

    // theory_sus — a suspended ending (the 2nd or 4th) earns a small "hang" flair once unlocked
    const perfSusEnd = (actingNoteState?.unlockedSkills ?? []).includes('theory_sus')
      && (lastNote === semitonesUpSpelled(rootNote, scaleMode, 2) || lastNote === intervals.fourth);
    // 🎭 Performance Score P — pure kernel (engine/systems/economy.js). `freestyle`
    // (Intergalactic 0's pardoned first wrong note) comes back too, since the flash/
    // log below need it and its arithmetic must not drift from the score's.
    // ✨ FLAIR EXEMPTION (STYLE_SYSTEM_HANDOFF.md §3.3) — Flair spirits are exempt
    // from the P penalty on RESOLVED discords (an out-of-scale note immediately
    // followed by an in-scale one), capped at 3. Unresolved/trailing discords still
    // hurt everyone, Flair included. This stacks independently with Intergalactic 0's
    // freestylePardon (Groove today, but kept separate on purpose).
    // NOTE: performanceScore doesn't take a resolvedDiscordCount param (yet) — the
    // exemption is folded into discordCount here at the call site instead.
    // (The Flair P-exemption is gone with the Style system — it waived the P
    //  penalty on resolved discords for one style, and both the style and the
    //  detector it called no longer exist. Every spirit is now judged the same way,
    //  which is also what makes P a fair crowd signal.)
    const flairExemptDiscords = 0;
    // B3: score the SETTLED count, not the placement counter — a note the chord
    // legalized was never a wrong note, so it must not drag the flair score either.
    const perfDiscordCount = Math.max(0, unpardonedDiscord - flairExemptDiscords);
    const { score: perfScore, freestyle: perfFreestyle } = performanceScore({
      melodyLine,
      trackHasTritone, isOctaveResolution,
      diatonicRunLen, repeatPatLen, skipClimbLen,
      hasGatedEnding: isMinorSeventhEnd || isMajorThirdEnd || isTritoneEnd,
      hasRiff: !!riffMatch, cadenceResolved,
      earned, edgeResolved: edgeResolvedThisTurn, susEnd: perfSusEnd,
      discordCount: perfDiscordCount, freestylePardon,
    });

    // ── 🎭 STAGE B ROUTING: Performance Score P → DB top-up (§5b) + crowd excitement (§5a) ──
    // Baseline-on for now (no skill gate yet — will later sit behind Crowd Read / Stage Presence).
    // ⚠️ P NO LONGER PAYS Db — IT PAYS THE CROWD, AND ONLY THE CROWD.
    // The Performance Score is the game's one aesthetic judge: it scores contour
    // changes, leaps, interval variety, palette, motifs — "was that interesting?".
    // That question has no honest answer, which is why it made a bad Db source and
    // makes a *good* crowd source: a crowd's taste is supposed to be impressionistic.
    // Nobody minds a fickle audience; everybody minds a fickle upgrade bar.
    // So P survives entirely intact and keeps driving excitement, loyalty, fans and
    // the Fame multiplier below. It simply stops also minting Decibills.
    const perfDbBonus = 0;
    // §5a — fans NEVER hand out Fame directly (they only multiply earned FP via grantFame).
    // A strong performance instead SLOWLY grows the crowd and hardens casuals into diehards.
    const perfVibeFactor = (acting?.maxVibe ?? 5) / 5;
    // 🗡️ SHREDDING RONIN — the fans came for a masterpiece. A virtuosic show (P≥5) wins him
    // ~double the crowd of a normal Spirit; a show that falls short BORES them — the meter
    // cools (negative), and sustained mediocrity sheds a casual. His Fame engine swings on
    // sheer quality: dazzle and they swarm, coast and they drift. (Other Spirits: P<5 = no
    // change, as before.) Reuses the existing Performance Score → excitement pipeline.
    const isRonin = acting?.id === 'cosmic_ronin';
    // Deliberately NOT crowd-amplified — a bigger crowd must not snowball into faster growth.
    const perfExciteGain = isRonin
      ? (perfScore >= 5 ? (perfScore - 4) * perfVibeFactor * 2        // virtuoso: crowd swarms
                        : (perfScore - 5) * perfVibeFactor * 0.5)     // short of it: crowd cools (gentle)
      : Math.max(0, perfScore - 4) * perfVibeFactor;
    let perfExcitement = (actingNoteState?.excitement ?? 0) + perfExciteGain;  // → new casual fans (slow)
    let perfLoyalty    = Math.max(0, (actingNoteState?.loyalty ?? 0) + perfExciteGain);  // → harden casual→diehard
    // Edge fan costs (stepping onto/escalating the stance, or its collapse) apply
    // through this same bored-fans pipeline — one floor-at-0 path, not a new one.
    let perfFansGained = 0, perfPromotions = 0, perfFansLost = edgeFanCost + edgeCollapseFans;
    const loyaltyPerDiehard = LOYALTY_PER_DIEHARD;
    while (perfExcitement >= EXCITE_PER_CASUAL)   { perfExcitement -= EXCITE_PER_CASUAL;   perfFansGained += 1; }
    while (perfLoyalty    >= loyaltyPerDiehard)   { perfLoyalty    -= loyaltyPerDiehard;   perfPromotions += 1; }
    // 🗡️ Bored crowd (only reachable when the meter has cooled below empty — i.e. Ronin
    // stringing together weak shows): one casual drifts off, then the meter resets up.
    while (perfExcitement <= -EXCITE_PER_CASUAL)  { perfExcitement += EXCITE_PER_CASUAL;   perfFansLost  += 1; }

    // 🥱 SUSTAINED MEDIOCRITY (every Spirit except Ronin, who has his own stronger,
    // instant version above) — a run of weak shows (P below the same floor
    // perfExciteGain already uses) bores the crowd, mirroring the positional
    // boredom decay in tickFans (same FAN_BORED_AFTER / FAN_DECAY constants, same
    // "keeps decaying every turn the condition holds" shape, just triggered by
    // performance instead of position).
    const prevLowPerfStreak = actingNoteState?.lowPerfStreak ?? 0;
    const lowPerfStreak = (!isRonin && perfScore < 4) ? prevLowPerfStreak + 1 : 0;
    if (!isRonin && lowPerfStreak >= FAN_BORED_AFTER) perfFansLost += FAN_DECAY;

    // Drive/Sustain overflow feeds DB points (non-stacking rule); Edge DB cost is
    // a real sacrifice, not a soft floor — it can eat into points earned this turn.
    // Four sources in, one number out. `dbOverflow` and `perfDbBonus` are pinned to
    // 0 above rather than deleted from this line, so the arithmetic still reads as
    // the single pot it is and a future source has an obvious place to join.
    const earnedTotal = earned + dbOverflow + perfDbBonus + edgeDbBonus - edgeDbCost;

    // Check upgrade threshold against target skill cost
    const targetSkill = actingNoteState?.targetSkillId ? SKILL_BY_ID[actingNoteState.targetSkillId] : null;
    const targetCost  = targetSkill?.dbCost ?? DB_UPGRADE_THRESHOLD;
    const { newDBPoints: rawDBPoints, upgradeTriggered } = advanceDB(dbPoints, earnedTotal, targetCost);
    let newDBPoints = Math.max(0, rawDBPoints); // floor — a heavy Edge cost can't drive the bar negative
    const newUpgradesPending = upgradeTriggered
      ? (actingNoteState?.upgradesPending ?? 0) + 1
      : (actingNoteState?.upgradesPending ?? 0);

    // ── POINTS FLASH ─────────────────────────────────────────────────────────
    const flashLines = [];
    if (earned > 0) {
      flashLines.push(`+${earned} DB pts`);
      breakdown.forEach(b => flashLines.push(b));
      if (upgradeTriggered) flashLines.push(`🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!`);
    }
    if (rawDriveBoost > 0)    flashLines.push(`⚔️ Drive +${newTempDrive}`);
    if (rawSustainBoost > 0)  flashLines.push(`🛡️ Sustain +${newTempSustain}`);
    // (B5: the '🔥 Tritone — Damage ×2' flash is gone with the effect it announced.
    //  The tritone's surviving payout is +1 Performance Score, which the
    //  '🎭 Performance n/10' line below already accounts for.)
    // 🔒 B5 — name the chord the ending locked onto. This is the line that teaches
    // the mechanic: the player sees WHICH chord paid and how much, so "build
    // something and land on it" becomes a rule they can restate.
    if (lock.bonus > 0) flashLines.push(`🔒 Harmonic Lock — ${lock.chordName} · DB +${lock.bonus}`);
    if (isOctaveResolution)   flashLines.push('🎶 Octave — DB +2');
    // (B1: Borrowed Chord / Blues Lick / Devil's Interval / Stagger flashes removed
    //  along with their effects. The endings still pay Performance Score via
    //  hasGatedEnding, and B5 will give them a Db payoff.)
    // (E-Rush flash removed — Ronin rework)
    // ⚡ The chromatic run no longer pays Db (B6 deleted — it fired on 1% of
    // commits). It still lands, and the player should still be told: a run of 3+
    // flips `allInScale`, which is what the CROWD reads. Flair pays fans now.
    if (chromRunLen >= 3) {
      flashLines.push(`⚡ Chromatic run ×${chromRunLen} — the crowd eats it up`);
    }
    // 🎸 B3/B4 — say the pardon out loud, and say which stack paid for it. The
    // player should be able to point at a stack and name the reason a grey note
    // scored, the turn it happens. B4 names the destination too, because the two
    // stacks pay different currencies and "your chord legalized 2 notes" doesn't
    // tell you to look at Drive. The ⚔️/🛡️ amounts are replaced with an explicit
    // "no payout" when Mojo Drain ate it — claiming credit for points that never
    // landed teaches the wrong rule. (With no drain, pardonedTotal > 0 guarantees at
    // least one of the two is non-zero, so the bare-suffix case is unreachable.)
    const pardonedTotal = contextPardons.drive + contextPardons.sustain;
    if (pardonedTotal > 0) {
      const paidTo = [];
      if (colorDrive   > 0) paidTo.push(`⚔️ +${colorDrive}`);
      if (colorSustain > 0) paidTo.push(`🛡️ +${colorSustain}`);
      flashLines.push(
        `🎸 Your chord legalized ${pardonedTotal} note${pardonedTotal !== 1 ? 's' : ''}`
        + (paidTo.length > 0 ? ` — ${paidTo.join(' ')}` : isMojoDrained ? ' — Mojo Drain, no payout' : ''));
    }
    if (perfFreestyle > 0)    flashLines.push('🌀 Freestyle — first wrong note landed perfect!');
    if (canBank)              flashLines.push(`💾 Banked: ${newBankedNote.note}`);
    if (totalNotes > actingSpeed && !canBank) flashLines.push(`⚠️ ${totalNotes - actingSpeed} note(s) discarded (bank full)`);
    // B7 — the count and the charge are different numbers now (first one free,
    // floor 3), so show both or the player reads the grace as a bug.
    if (discordPenalty > 0) {
      flashLines.push(`⚡ ${unpardonedDiscord} Dischord — −${discordPenalty} DB (1st free)`);
    } else if (unpardonedDiscord > 0) {
      flashLines.push(`⚡ ${unpardonedDiscord} Dischord — free this turn`);
    }
    flashLines.push(`🎭 Performance ${perfScore}/10`);

    if (perfFansGained > 0) flashLines.push(`🎤 +${perfFansGained} new fan${perfFansGained !== 1 ? 's' : ''} won over!`);
    if (perfPromotions > 0) flashLines.push(`💜 ${perfPromotions} fan${perfPromotions !== 1 ? 's' : ''} → Diehard!`);
    if (flashLines.length > 0) {
      setPointsFlash({ lines: flashLines, key: Date.now() });
      setTimeout(() => setPointsFlash(null), 4500);
    }

    // ── LOG ───────────────────────────────────────────────────────────────────
    const scoreStr = earned > 0
      ? ` · 🎯 +${earned}pts (${breakdown.join(', ')})${upgradeTriggered ? ` · 🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!` : ` · DB [${newDBPoints}/${targetCost}]`}`
      : (discordPenalty > 0 ? ` · ⚡ ${unpardonedDiscord} Dischord — −${discordPenalty}, no points` : ` · DB [${newDBPoints}/${targetCost}]`);
    const driveMsg   = rawDriveBoost > 0   ? ` · ⚔️ Drive +${newTempDrive}` : '';
    const sustMsg    = rawSustainBoost > 0  ? ` · 🛡️ Sustain +${newTempSustain}` : '';
    const triMsg     = '';   // B5 — tritone "Damage ×2" removed (it multiplied nothing)
    const lockMsg    = lock.bonus > 0 ? ` · 🔒 Harmonic Lock ${lock.chordName} DB+${lock.bonus}` : '';
    const octMsg     = isOctaveResolution   ? ' · 🎶 Octave DB+2'           : '';
    const m7Msg      = '';   // B1 — Blues Lick / Mojo Drain arming removed
    const rsMsg      = '';
    const tritoneEndMsg = '';
    const chrMsg     = '';   // B1 — chromatic-run Stagger removed
    // B6 — the payout replaces the old "no discord" pardon note. `breakdown` already
    // carries the +N inside scoreStr; this is the headline copy for the log.
    const chromClimbMsg = '';   // B6 payout deleted — the run pays the crowd now, not Db
    // C4 — Flair's colour went to Db instead of Drive/Sustain. Named in the log so
    // the player can see WHY their colour paid differently from everyone else's.
    const outsideMsg = '';      // C4 Flair "Outside" deleted with the Style system
    const speedMsg   = totalNotes > actingSpeed
      ? ` · SPD ${actingSpeed}/${totalNotes}${canBank ? ` · 💾 ${newBankedNote.note} banked` : ' · bank full'}`
      : ` · SPD ${hexes}/${actingSpeed}`;
    addLog(`✓ Committed · ${hexes} hexes${scoreStr}${driveMsg}${sustMsg}${triMsg}${lockMsg}${octMsg}${majorThirdMsg}${m7Msg}${tritoneEndMsg}${chrMsg}${chromClimbMsg}${outsideMsg}${feedbackOverloadMsg}${rsMsg}${speedMsg} · Next RN: ${newRootRaw}`);
    if (trackHasTritone || isMinorSeventhEnd || isMajorThirdEnd || isOctaveResolution) showTip('intervals');

    // ── STYLE Db PAYOUT — DELETED ────────────────────────────────────────────
    // `styleCommitDb` paid every commit a tier (1–3 Db) plus a signature bonus for
    // matching the acting spirit's fixed Style. It was 15% of all Db income and it
    // is gone, along with C4's per-style chord-context reads and C1's live preview.
    //
    // The measurement that decided it: the three Style detectors re-scored gestures
    // the game already pays for. `detectStyleRun` was written as a generalisation of
    // the Drive boost's own run detectors; `detectRepeatPattern` was *literally the
    // same function* the Sustain boost calls; Flair's resolved discords were the
    // notes the pardon economy already routed. Three gestures, scored twice, in two
    // currencies — a large part of how one commit acquired nine Db sources.
    //
    // The design argument, which matters more: Style was an aesthetic judge, and it
    // was assigned rather than chosen, so it rewarded a play pattern without ever
    // requiring one. A player could ignore their Style completely and lose ~0.59 Db
    // a commit — real, but nowhere near enough to shape behaviour. It asked "was
    // that the kind of phrase your character plays?", which is a taste question, and
    // Db has stopped answering taste questions.
    //
    // Character flavour survives in data/styles.js (icon, colour, tagline) and on
    // the character-select screen. Nothing reads it for scoring.


    // 🎸 Your chord is a STANDING stance — it persists across turns and is only
    // changed by a revoice (one note add/drop per turn), so we don't touch it here.
    setStackCommitDest(null);
    setNoteField(acting.id, {
      melodyLine:       [],
      melodySrcIdx:     [],
      melodyFreq:       [],
      // Phase R1: stash the committed melody + riff-match for riff-off use.
      // startRiffOff reads these; cleared at turn start (startNewTurnNotes).
      committedMelody:  melodyLine,
      // Registers ride along with the committed melody so the riff-off can
      // voice it where the player played it (melodyToRiff still infers octave
      // on its own for now — this is the raw material for when it doesn't).
      // ⚠️ Mapped over `melodyLine`, not copied straight from melodyFreq: the
      // mic skill's voice roll SHADOWS melodyLine above and may append a bonus
      // note the player never played. Aligned by construction, one null on the
      // tail for the bonus, so the two stay the same length downstream.
      committedFreq:    melodyLine.map((_, i) => melodyFreq[i] ?? null),
      committedHasRiff: !!riffMatch,
      discordCount:    0,
      pivotPending:    newPivotPending,
      rootNote:        newRootRaw,
      scaleMode:       newMode,
      dbPoints:        newDBPoints,
      totalDB:         (actingNoteState?.totalDB ?? 0) + earnedTotal,
      edgeStage:       newEdgeStage,
      perfScore:       perfScore,
      recentP:         [...(actingNoteState?.recentP ?? []), perfScore].slice(-2),
      excitement:      perfExcitement,
      loyalty:         perfLoyalty,
      lowPerfStreak:   lowPerfStreak,
      upgradesPending: newUpgradesPending,
      hasConfirmed:    true,
      dieFloorBoost:   newDieFloorBoost,
      statusEffects:   newStatusEffects,
      tempDrive:       newTempDrive,
      tempSustain:     newTempSustain,
      bankedNote:      newBankedNote,
      // B1 — pendingMojoDrain / pendingStagger / burnArmed removed with the four
      // combat flavor triggers. `cleansePatch` is now always empty; it is spread
      // here only so B5 has an obvious seam to hang the Harmonic Lock patch on.
      transposeCardPending: null,
      ...cleansePatch,
    });
    // If a skill was just earned, award it now (adds to unlockedSkills, fires side-effects).
    // Small timeout so the state update above settles before awardTargetSkill reads noteStates.
    if (upgradeTriggered && actingNoteState?.targetSkillId) {
      setTimeout(() => awardTargetSkill(acting.id), 60);
    }
    // 🎵 WA NO KOE — melody/chord alignment, Ronin's harmony passive.
    // ⚠️ B10 BUG FIX: this read `driveStack ?? sustainStack`, which only ever saw
    // the Drive Stack — `??` falls through on null/undefined only, and the stacks are
    // arrays that always exist (B0a seeds both with the root). So the Sustain Stack
    // was silently invisible to Ronin's signature passive.
    //
    // Fixed to pass BOTH stacks, which is also what the skill's own text promises
    // ("your chord stack") and what every other part of the chord-context system
    // does — B4 and B5 both weigh Drive and Sustain against each other rather than
    // privileging one. Note `checkWaNoKoe` already reads both to decide WHICH stat
    // to boost, so passing only Drive made it inconsistent with itself.
    if (acting?.id === 'cosmic_ronin') {
      const chordNotes = [
        ...(actingNoteState?.driveStack   ?? []),
        ...(actingNoteState?.sustainStack ?? []),
      ];
      applyWaNoKoe(melodyLine, chordNotes);
    }
    setTurnStep('move_act'); // advance HUD flow → movement & actions
    // 🎓 The last note only becomes a real idea once it's been committed — up to
    // that moment it's just "the note on the end". Teach it here, and only then
    // mention the gold hex, and only if one was actually in play this track.
    if (!acting?.cpu) {
      const goldWasLive = (() => {
        const resolvePcs = new Set(
          cadenceHints(actingNoteState?.finalsTrail ?? [], actingNoteState?.cadenceCooldowns ?? {})
            .filter(h => h.resolves).map(h => h.nextPc));
        return resolvePcs.size > 0;
      })();
      setTimeout(() => showTip('last_note'), 250);
      if (goldWasLive) setTimeout(() => showTip('gold_hex'), 450);
    }
    // ⏱️ Fires LAST of the three commit tips on purpose. All three now queue
    // rather than fight (see showTip), and the queue drains in fire order — so
    // this delay is what puts move_act after the two tips that are about the
    // track just committed, rather than cutting in front of them.
    setTimeout(() => showTip('move_act'), 600);
    // Grant the movement budget — the engine applies the tripped-halving rule.
    // (tripped is still true at commit time; it clears at the START of this spirit's NEXT turn)
    const grantedSteps = dispatch(moveBudgetSet(hexes, !!actingNoteState?.tripped)).turn.moveStepsLeft;
    if (actingNoteState?.tripped) {
      addLog(`🌀 ${acting?.name} is TRIPPED — movement halved this turn! (${grantedSteps} hex${grantedSteps !== 1 ? 'es' : ''})`);
    }
    // 👤 SHADOW ILLUSION — the double gets its OWN legs, refreshed to whatever
    // the real Ronin was granted this turn. Same range, separate pool: a body
    // double that ate the Ronin's movement would be a tax on his own ability,
    // not a threat to anyone else. `lastMoveBudget` is stashed so a shadow
    // summoned later this turn can be handed a full budget too.
    if (acting?.id === 'cosmic_ronin') {
      const si = actingNoteState?.shadowIllusion;
      setNoteField('cosmic_ronin', {
        lastMoveBudget: grantedSteps,
        ...(si ? { shadowIllusion: { ...si, stepsLeft: grantedSteps, stepsMax: grantedSteps } } : {}),
      });
    }
    setMovedThisTurn(false);
    setAction('move');
    // 🎤 FAN ECONOMY — a clean track in the centre rings pulls a crowd to you.
    gainFans(acting.id, acting.num, allInScale);
    // 🎭 §5a — a strong performance slowly grows the crowd (new casuals) and hardens casuals
    // into diehards. NO Fame is granted here: fans only ever MULTIPLY earned FP (grantFame).
    // Applied after gainFans via a functional update so it stacks with position-based gains.
    if (perfFansGained > 0 || perfPromotions > 0 || perfFansLost > 0) {
      const ns0 = engineRef.current.noteStates[acting.id];
      if (ns0) {
        let cas = ns0.casuals ?? FAN_CASUAL_START, die = ns0.diehards ?? FAN_DIEHARD_START;
        cas = Math.min(FAN_CASUAL_CAP, cas + perfFansGained);
        for (let i = 0; i < perfPromotions; i++) { if (cas > 0 && die < FAN_DIEHARD_CAP) { cas -= 1; die += 1; } }
        cas = Math.max(0, cas - perfFansLost);     // 🗡️ bored fans walk (Ronin's weak shows)
        dispatch(fansChanged(acting.id, { casuals: cas, diehards: die }));
      }
      if (perfFansGained > 0) { addLog(`🎤 ${acting.name}'s performance wins over ${perfFansGained} new fan${perfFansGained !== 1 ? 's' : ''}!`); showTip('fans'); }
      if (perfPromotions > 0) addLog(`💜 ${perfPromotions} of ${acting.name}'s casuals harden into Diehards!`);
      if (perfFansLost > 0)   addLog(`😴 ${acting.name}'s show falls flat — ${perfFansLost} bored fan${perfFansLost !== 1 ? 's' : ''} drift off.`);
    }
  }

  // Called when this character's turn begins — replenish only the used slots.
  // B8: the Major/Minor mode is DERIVED here from the Drive Stack instead of
  // prompting the player, so pivotPending is now set false rather than true.
  // Also clears per-turn debuffs: tripped (movement halved), dazed, instrumentDropped.
  function startNewTurnNotes(spiritId) {
    // Record whether this spirit starts their turn on the limelight hex.
    // (The engine reads its own synced spirit positions.)
    dispatch(turnStarted(spiritId));
    // ⛔ Fresh turn window — everyone's per-turn FP cap meter resets (a
    // defender who banked capped FP during the last turn gets a clean slate).
    fameThisTurnRef.current = {};
    setNoteStates(prev => {
      const ns = prev[spiritId];
      if (!ns) return prev;

      // ── 🎸 B8: THE CHORD DECLARES THE MODE ──────────────────────────────────
      // Was a per-turn "Major or Minor?" button prompt. The root changes every
      // turn, so it fired every turn — the highest-frequency modal in the game,
      // asking a theory question of players who may not have one. It also bought
      // less than it looked like: after B3, stacking a minor triad already
      // legalizes the ♭3 through Chord Tone Pardon without declaring anything.
      // So the stack decides, and the decision moves into the thing the player is
      // already manipulating.
      //
      // ⚠️ DERIVE AT TURN START ONLY — never on stack commit. Re-deriving mid-turn
      // would respell the note stock underneath notes the player has already
      // placed. A stack committed this turn changes the mode NEXT turn; the HUD
      // says so rather than reaching back and rewriting the current one.
      const derived     = modeFromStack(ns.driveStack ?? [], ns.unlockedSkills ?? [], ns.scaleMode ?? 'major');
      const derivedMode = derived.mode;
      const derivedRoot = canonicalRoot(ns.rootNote, derivedMode);
      const modePool    = getSpelledPool(derivedRoot, derivedMode);
      const driveChord  = evaluateChord((ns.driveStack ?? []).filter(Boolean));

      // 🎵 GRADUAL REFILL — unused notes carry over; only up to STOCK_REFILL_RATE
      // spent slots recharge this turn. Spend big one turn, run short the next.
      // Axe Swing whiff penalty: halve refill rate for one turn
      const refillRate = ns.halfRefillNextTurn ? Math.floor(STOCK_REFILL_RATE / 2) : STOCK_REFILL_RATE;
      const usedIdxs   = usedList(ns.usedStockIdx);
      const refreshing = new Set(usedIdxs.slice(0, refillRate));
      // Fresh notes are drawn in the DERIVED key and carried-over notes are
      // respelled into it — both here, before the player ever sees the stock.
      // Drawing with ns.scaleMode would spell this turn's new notes in last
      // turn's mode, which is exactly the bug the old pivot's respell-on-declare
      // was there to prevent.
      const newStock = ns.noteStock.map((note, idx) => {
        if (refreshing.has(idx)) return randomNote(derivedRoot, derivedMode);
        const pi = pitchIndex(note);
        return pi !== -1 ? modePool[pi] : note;
      });
      const carriedUsed = usedIdxs.filter(i => !refreshing.has(i)); // insertion order preserved (was a Set)

      // 🎵 Announce the refill instead of letting it happen silently — same
      // "pop in like fans do" treatment as flashFanFx, deferred via setTimeout
      // so it fires safely outside this functional update (mirrors tickFans).
      if (ns.halfRefillNextTurn && refreshing.size > 0) {
        setTimeout(() => addLog(`🪓 Axe Swing whiff — stock recovery halved this turn!`), 0);
      }
      if (refreshing.size > 0) {
        const nm = spirits.find(s => s.id === spiritId)?.name;
        setTimeout(() => {
          addLog(`🎵 ${nm} draws ${refreshing.size} new note${refreshing.size !== 1 ? 's' : ''} into the pool!`);
          setPointsFlash({ lines: [`🎵 +${refreshing.size} new note${refreshing.size !== 1 ? 's' : ''}`], key: Date.now() });
          setTimeout(() => setPointsFlash(null), 2200);
          setFreshNoteIdx({ spiritId, indices: refreshing, key: Date.now() });
          setTimeout(() => setFreshNoteIdx(prev => (prev?.spiritId === spiritId ? null : prev)), 700);
        }, 0);
      }

      // NOTE: mojoDrain / stagger / tripped / dazed / instrumentDropped are NO
      // LONGER ticked or cleared here. Clearing them at the start of your own
      // turn meant they expired before they could ever affect you (the bug that
      // made CQC slip/daze/drop and Stagger feel like they never fired).
      // They now tick down / clear at the END of your own turn — see endTurn().

      // ── 🎫 CREW ASSIGNMENTS take effect here (CREW_SYSTEM_DESIGN.md §2) ──
      // The fan had to get backstage overnight: pendingAssignments becomes the
      // active roster. Stagehand's roadie is pushed/popped alongside (the whole
      // roadie UI/flow reads ns.roadies — §4.2).
      const nextRoadies = (ns.roadies ?? []).map(r =>
        r.cooldownTurns > 0 ? { ...r, cooldownTurns: r.cooldownTurns - 1 } : r
      );

      return {
        ...prev,
        [spiritId]: {
          ...ns,
          noteStock:    newStock,
          melodyLine:    [],
          melodySrcIdx:  [],
          melodyFreq:    [],
          committedMelody:  null,   // Phase R1: clear stashed melody from last turn
          committedFreq:    null,
          committedHasRiff: false,
          stackCommitsThisTurn: 0,  // 🎸 fresh stack commit budget each turn
          usedStockIdx: carriedUsed,
          discordCount: 0,
          payoutRouting: {},        // dies with the track it indexes into
          hasConfirmed: false,
          dieFloorBoost: 0,
          smashExposed: false,   // 🎸💥 exposure clears at the start of your own turn
          halfRefillNextTurn: false,  // 🪓 Axe Swing whiff penalty consumed
          // 🌌 Displace cooldown ticks down on Intergalactic 0's own turns
          displaceCd: Math.max(0, (ns.displaceCd ?? 0) - 1),
          // 🌀 Psycho Bushido cooldown ticks down on Ronin's own turns
          psychoBushidoCd: Math.max(0, (ns.psychoBushidoCd ?? 0) - 1),

          // Tick down roadie cooldowns
          roadies: nextRoadies,
          // Tick down cadence objective cooldowns
          cadenceCooldowns: Object.fromEntries(
            Object.entries(ns.cadenceCooldowns ?? {}).map(([k, v]) => [k, Math.max(0, v - 1)])
          ),
          // (acousticDuelCds tick REMOVED — the Acoustic Duel and its per-pair
          // cooldowns are gone. Any stale field on an old save just goes unread.)
          // Tick down "goes to eleven" boost
          elevenTurns: Math.max(0, (ns.elevenTurns ?? 0) - 1),
          // ⚡ Charge Zone charges tick down on the holder's own turns (2 ≈ 2 rounds);
          // battles burn them early via burnChargesAfterBattle.
          chargeFloorTurns: Math.max(0, (ns.chargeFloorTurns ?? 0) - 1),
          chargeCeilTurns:  Math.max(0, (ns.chargeCeilTurns  ?? 0) - 1),
          // (bonusRevoiceAvailable removed — stack commit system replaces it)
          // Mixer recharges every turn
          mixerUsedThisTurn: false,
          // 🤘 Moshpit once per turn
          moshpitUsedThisTurn: false,
          // 🥊 CQC swing exposure clears at the start of your next turn
          swingExposed: false,
          // Refresh modulation cards (exhausted resets each turn) — but spent
          // one-shots (e.g. the starter Transpose) fall away instead of recharging.
          modCards: (ns.modCards ?? [])
            .filter(c => !(c.oneShot && c.exhausted))
            .map(c => ({ ...c, exhausted: false })),
          // 🎸 B8: mode derived from the Drive Stack, applied here. The bonus it
          // earns can't be paid inside this updater (advanceDB / awardTargetSkill
          // have side effects, and React may run the updater more than once), so
          // it is STAGED and a small effect pays it exactly once — see
          // applyModeBonus below.
          rootNote:     derivedRoot,
          scaleMode:    derivedMode,
          modeReason:   derived.reason,     // 'quality' | 'ambiguous' | 'locked'
          modeChordName: driveChord.name,   // e.g. "C Minor triad" — the HUD cites it
          pivotPending: false,              // ⚠️ never true again; guards stay, harmless
          pendingModeBonus: { mode: derivedMode, reason: derived.reason, root: derivedRoot },
          // 👤 Shadow Illusion: tick down turns, dismiss if expired.
          // Note this counts the Ronin's OWN turns, so a 3-turn double survives
          // three full rounds of rivals guessing wrong.
          shadowIllusion: (() => {
            const si = ns.shadowIllusion;
            if (!si) return null;
            const left = (si.turnsLeft ?? 1) - 1;
            // Zero the double's legs here and let the melody commit refill them
            // to this turn's granted budget — otherwise last turn's leftover
            // steps would carry over into a turn whose budget isn't known yet.
            return left > 0 ? { ...si, turnsLeft: left, stepsLeft: 0 } : null;
          })(),
        },
      };
    });
    // 🗡️ Ronin rework: tick Cursed Shamisen + Wa no Koe at turn start
    if (spiritId === 'cosmic_ronin') {
      // 👤 Read the PRE-tick value: if this was its last turn, the updater above
      // has just cleared it, so announce the double melting away.
      const siBefore = noteStates['cosmic_ronin']?.shadowIllusion;
      if (siBefore && (siBefore.turnsLeft ?? 1) <= 1) {
        triggerDamageNumber(siBefore.hex, '👤 GONE', '#4488ff');
        addLog('👤 The shadow illusion thins out and melts back into the Ronin — the double is spent.');
      }
      tickCursedShamisen();
      tickWaNoKoe();
    }
  }

  // ─── consumeAttackCharges — REMOVED (B5) ─────────────────────────────────────
  // B1 gutted this down to one job: clearing the attacker's tritone feedback
  // charge on a hit. B5 removed the charge itself (it lit a "Damage ×2" badge that
  // no damage path read), so the function had nothing left to clear and all three
  // call sites are gone with it.
  //
  // If a melody→combat charge is ever reintroduced, note the shape that made this
  // fragile: the flag was set at commit and cleared ONLY here, with no turn-start
  // reset, so any path that hit without calling this left the charge lit forever.
  // A future version should reset at turn start instead of relying on one call site.

  // ─── INITIAL SKILL — auto-grant THE FULL SCALE at the very start of a spirit's first turn ───
  // The old flow opened the Theory Tree as the very first thing a player saw —
  // dull AND confusing. Now every spirit starts with theory_major (the full
  // Major scale) for free, no modal. The tree first opens when the DB bar
  // fills (default threshold) — see the upgradesPending → UpgradeModal path.
  useEffect(() => {
    if (!acting) return;
    // OWNERSHIP: only the client that controls the acting spirit may write to
    // its tree — remote clients would otherwise dispatch a duplicate
    // NOTE_SHEET_PATCHED and relay it (desync). They receive the acting
    // client's write via the ACTION relay instead.
    if (!canAct) return;
    const ns = noteStates[acting.id] ?? {};
    // ⚠️ BUG FIX (B9 pass). This used to read:
    //     const hasSkills = (ns.unlockedSkills?.length ?? 0) > 0;
    //   ... && !hasSkills && ...
    // but `makeInitialNoteState` seeds `unlockedSkills: ["amp_1"]` for every spirit,
    // so `hasSkills` was true on turn one, always, and **this grant never fired
    // once**. Every spirit has been playing the Major PENTATONIC — no 4th, no 7th —
    // while the comment above, the skill's own `desc`, and every "46-Db ladder"
    // figure in PENDING_CHANGES (= 52 list price − theory_major's 6) all assume the
    // full scale is free from the start.
    //
    // It also got quietly more expensive in the B6/B7 pass: B7 charges discord PER
    // NOTE now, and two of the notes it was charging for are notes the player was
    // supposed to already own.
    //
    // The correct gate is "do they hold the scale", not "is their skill list empty" —
    // the latter can never again be true while any starting skill exists. Ronin now
    // also starts with `theory_minor` (B10), which would have broken an emptiness
    // check a second way.
    const hasTarget   = !!ns.targetSkillId;
    const hasScale    = (ns.unlockedSkills ?? []).includes('theory_major');
    const hasPending  = (ns.upgradesPending ?? 0) > 0;
    const alreadyPrompted = !!ns.initialPickDone;
    // Only grant once, and only if they don't already hold the full scale.
    if (!hasTarget && !hasScale && !hasPending && !alreadyPrompted) {
      setNoteStates(prev => ({
        ...prev,
        [acting.id]: {
          ...prev[acting.id],
          unlockedSkills: [...(prev[acting.id]?.unlockedSkills ?? []), 'theory_major'],
          initialPickDone: true,
        }
      }));
      applySkillEffects(acting.id, 'theory_major'); // logs "THE FULL SCALE!" (no discord grants at this tier)
      // 🎓 Welcome walkthrough for humans only (bots don't read), then the
      // chord tip queued so it appears right after the welcome card closes.
      // (Was the pivot tip — B8 deleted that step and folded its lesson in.)
      if (!acting.cpu) {
        setTimeout(() => showTip('welcome'), 400);
        if (!pendingTipsRef.current.includes('chord')) pendingTipsRef.current.push('chord');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting?.id]);

  // ── 🎸 B8: pay the staged mode bonus ────────────────────────────────────────
  // startNewTurnNotes derives the mode inside its reducer and stages the bonus;
  // this pays it out here, where side effects are legal. It fires once per turn
  // because payModeBonus clears pendingModeBonus as it pays.
  //
  // OWNERSHIP: same rule as the initial-skill grant above — only the client that
  // controls the acting spirit may write, or a remote client would dispatch a
  // duplicate patch and relay it (desync).
  useEffect(() => {
    if (!acting || !canAct) return;
    if (!noteStates[acting.id]?.pendingModeBonus) return;
    payModeBonus(acting.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting?.id, canAct, noteStates[acting?.id]?.pendingModeBonus]);
  function move(toNum) {
    const s = spirits.find(sp => sp.id === acting.id);
    const ns = noteStates[acting.id] ?? {};
    const fromHex = s.num; // capture hex BEFORE move for poison slime drop

    // Movement rules — including the dazed 33% redirect roll — live in the
    // engine now (src/engine/systems/movement.js). Spirits are engine-owned
    // (Phase 5c), so no bridge sync is needed before the move.
    const mv = dispatch(engineMoveStep(acting.id, toNum, !!ns.dazed)).turn.lastMove;
    if (!mv) return; // safety: off-board redirect — the engine refused the step
    const actualTarget = mv.to;
    if (mv.redirected) {
      addLog(`😵 ${s.name} is DAZED & CONFUSED — stumbles to #${actualTarget} instead of #${toNum}!`);
    }
    const to = HEX_BY_NUM[actualTarget];
    const newSteps = mv.stepsLeft;
    // (position + facing already applied by the MOVE_STEP reducer — the old
    // setSpirits mirror write was a diff-empty no-op and is gone.)
    if (!ns.dazed) addLog(`🚶 ${s.name} → #${actualTarget} (${newSteps} step${newSteps !== 1 ? "s" : ""} left)`);
    else addLog(`🚶 ${s.name} → #${actualTarget} (${newSteps} step${newSteps !== 1 ? "s" : ""} left)`);
    if (to.edge) addLog(`⚠️ ${s.name} is on the EDGE — knockback risk!`);
    if (newSteps <= 0) setAction(null);
    // 🧪 Poison Slime — Metalness Monster drops slime on the hex it just left
    if (acting.id === 'Metalness_Monster') dropPoisonSlime(fromHex);
    // 🧪 Poison Slime — check if anyone stepped in slime
    checkPoisonSlime(acting.id, actualTarget);
    // Flaming disc hazard (Disco Inferno)
    checkFlamingDisc(acting.id, actualTarget);
    // 🎇 Stage hazards (lasers / erupting pyro / animatronics)
    checkStageFxHex(acting.id, actualTarget);
    // 🎵 Board mini-goal pickup (Lost Chord)
    checkTokenPickup(acting.id, actualTarget);
    // ⚡ Charge zone pickup
    checkChargeZonePickup(acting.id, actualTarget);
    // Marquee event hex
    checkEventTrigger(acting.id, actualTarget);
    // 🎸 Cursed Shamisen — did this step land ON the shamisen's hex? Must pass
    // the destination: `spirits` in scope here is the pre-move snapshot.
    calmCursedShamisen(acting.id, actualTarget);
  }

  // ─── SKILL TREE — TARGET SELECTION & AWARD ───────────────────────────────────
  // New flow:
  //   1. Player picks a target skill → stored as targetSkillId, dbCost stored as target cost
  //   2. Every DB earned counts toward dbPoints (resets at targetCost, carries overflow)
  //   3. When threshold hit → upgradesPending=1, skill awarded automatically, overlay opens to pick next
  //   4. Player picks next target → overlay closes, cycle repeats

  function applySkillEffects(spiritId, skillId) {
    // Pure side-effects only (state mutations outside noteStates)
    // noteStates.unlockedSkills is updated by the caller
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    const skill  = SKILL_BY_ID[skillId];

    if (skillId === 'hero_pose')    addLog(`🌟 ${spirit?.name} — HERO POSE unlocked! Pose on centre hex for 2 turns to win.`);

    // (v1 stance route removed — v2 stances are fixed ability kits, no learning tiers)
    if (skillId === 'number_of_the_beast') addLog(`6️⃣ ${spirit?.name} — NUMBER OF THE BEAST! At 2 Vibe or less, spend 1 Db to go BERSERK: +6 Drive with no cap, immune to knockback, 1 Vibe per attack. It ends when somebody hits the floor.`);
    if (skillId === 'master_moshpits') addLog(`🤘 ${spirit?.name} — MASTER OF MOSHPITS! Pull 3 fans onto the board for a pit — +2 Drive that stands until the next pit.`);
    if (skillId === 'slime')        addLog(`🧪 ${spirit?.name} — SLIME! Swing/Smash hits can spend 1 Db to slime rivals — halving their next turn's note regen.`);
    if (skillId === 'azrael')       addLog(`💀 ${spirit?.name} — AZRAEL! Every rival you knock down feeds Fame equal to your knockdown streak. Resets when you go down.`);
    if (skillId === 'psycho_bushido')  addLog(`🌀 ${spirit?.name} — PSYCHO BUSHIDO! Dash in a straight line — remaining AP becomes bonus Drive. 2-round cooldown.`);
    if (skillId === 'shadow_illusion') addLog(`👤 ${spirit?.name} — SHADOW ILLUSION! Split into a second, identical Ronin (costs 1 Drive token). It moves on its own legs at your full range — rivals can't tell which body is real, and whoever guesses wrong burns their whole turn.`);
    if (skillId === 'cursed_shamisen') addLog(`🎸 ${spirit?.name} — CURSED SHAMISEN! Set it down (2 Db per use). It plays itself every turn — 2 rings, then 3 — and on the third turn it starts HUNTING the nearest Spirit. Including you.`);
    if (skillId === 'wa_no_koe')      addLog(`🎵 ${spirit?.name} — WA NO KOE! Half your melody inside your stacks now pays +1 Drive or Sustain for 3 rounds — the amplifier on the Chord Tone Pardon he already owns.`);
    // B9: the unlock logs name the CONTEXT TIER too, matching the descs. Each line
    // is the one moment the player is guaranteed to be looking, so it's where the
    // ladder's rule gets taught — not just the scale note that came with it.
    if (skillId === 'theory_major')     addLog(`🎼 ${spirit?.name} — THE FULL SCALE! The 4th & 7th are now Discord-free — your Major scale is complete.`);
    if (skillId === 'theory_minor')     addLog(`🌑 ${spirit?.name} — MINOR TONALITY! A minor third in your Drive Stack turns the song minor. And CHORD TONE PARDON is live: notes sitting in your stacks are never Discord, whatever the key says.`);
    if (skillId === 'theory_sus')       addLog(`🕊️ ${spirit?.name} — SUSPENSIONS! Ending on the 2nd or 4th now rings out for bonus Flair.`);
    if (skillId === 'theory_dom7')      addLog(`🎷 ${spirit?.name} — DOMINANT 7th! The ♭7 joins your clean palette and your stacks open a 4th slot. PLAY THE CHANGES: your stack's whole implied chord is clean now, seventh included — even the notes you never stacked.`);
    if (skillId === 'theory_modes')     addLog(`🌀 ${spirit?.name} — MODAL SHIFT! Lydian ♯4 and Mixolydian ♭7 go clean, stacks open a 5th slot. EXTENSIONS: your chord's own tensions are pardoned too — ♯4 over major, nat-6 over minor, ♭9 and 9 over dominant.`);
    if (skillId === 'theory_chromatic') addLog(`⚡ ${spirit?.name} — CHROMATIC MASTERY! Approach notes are clean, and a chromatic run of 3+ now PAYS (+3 Db, up to +5).`);
    // THE LADDER absorbs the old Discord path: climbing Theory grants the colour-note
    // capabilities the combat logic checks for (discordUnlocks + unlockedSkills flags).
    // Table is now the pure `THEORY_DISCORD_GRANTS` from engine/systems/skills.js.
    if (THEORY_DISCORD_GRANTS[skillId]) {
      const grants = THEORY_DISCORD_GRANTS[skillId];
      setNoteStates(prev => {
        const ns2 = prev[spiritId] ?? {};
        const du  = new Set(ns2.discordUnlocks ?? []);
        const us  = new Set(ns2.unlockedSkills ?? []);
        grants.forEach(g => { du.add(g); us.add(g); });
        return { ...prev, [spiritId]: { ...ns2, discordUnlocks: [...du], unlockedSkills: [...us] } };
      });
      addLog(`🎨 ${spirit?.name} — colour notes online: ${grants.map(g => DISCORD_UPGRADE_TIERS.find(t => t.id === g)?.label ?? g).join(', ')}.`);
    }
    // (hydra removed — Ronin rework)
    if (skillId === 'blaster_of_ra') addLog(`🌀 ${spirit?.name} — BLASTER OF RA! Your Smash becomes a ranged, piercing bass-drop down the beam — undefendable, scatters & knocks back every rival in line.`);
    if (skillId === 'displace')      addLog(`🌌 ${spirit?.name} — DISPLACE! Warp to your amp rig for 3 AP (2-turn cooldown). He doesn't run — he transcends space.`);
    if (skillId === 'sunbeam')       addLog(`☀️ ${spirit?.name} — SUNBEAM! With 3 amps, your Sonic beam reaches +2 hexes and leaves burning ground in its wake.`);

    if (['amp_1','amp_2','amp_3'].includes(skillId)) {
      const tier = ['amp_1','amp_2','amp_3'].indexOf(skillId) + 1;
      addLog(`🔊 ${spirit?.name} — Amp ${tier}! +1d6 to the Sonic pool (roll ${tier + 1}, keep highest).`);
    }
    if (['power_1','power_2','power_3'].includes(skillId)) {
      const tier = ['power_1','power_2','power_3'].indexOf(skillId) + 1;
      addLog(`🎛️ ${spirit?.name} — Power ${tier}! ${tier} ${tier === 1 ? 'die' : 'dice'} in the pool upgraded to d8.`);
    }
    if (['range_1','range_2','range_3'].includes(skillId)) {
      const labels = ['Range I — full rig reaches 4 hexes from home.', 'Range II — the Limelight is inside your field.', 'Range III — fully wired. The whole venue is your stage.'];
      addLog(`📡 ${spirit?.name} — ${labels[['range_1','range_2','range_3'].indexOf(skillId)]}`);
    }
    // Legacy roadie_2/roadie_3 (if any saves reference them); crew_stagehand handled above.
    if (['roadie_2','roadie_3'].includes(skillId)) {
      const newRoadie = { id:`roadie-${spiritId}-${Date.now()}`, cooldownTurns:0, onBoard:false, boardHex:null };
      setNoteStates(prev => ({ ...prev, [spiritId]: {
        ...prev[spiritId], roadies: [...(prev[spiritId]?.roadies ?? []), newRoadie]
      }}));
      addLog(`🔧 ${spirit?.name} hires Roadie ${(ns.roadies?.length ?? 0) + 1}!`);
    }
    if (['discord_1','discord_2','discord_3','discord_4'].includes(skillId)) {
      const tier = DISCORD_UPGRADE_TIERS.find(t => t.id === skillId);
      addLog(`${tier?.icon ?? '🎵'} ${spirit?.name} unlocks ${tier?.label}! ${tier?.desc ?? ''}`);
      // Also update discordUnlocks so confirmNoteTrack applies the new interval rules
      setNoteStates(prev => {
        const ns2 = prev[spiritId] ?? {};
        const existing = ns2.discordUnlocks ?? [];
        if (existing.includes(skillId)) return prev;
        return { ...prev, [spiritId]: { ...ns2, discordUnlocks: [...existing, skillId] } };
      });
    }
    if (skillId === 'mic')          addLog(`🎤 ${spirit?.name} — Mic! Voice roll d6 bonus note.`);
    if (skillId === 'pedal_dist')   addLog(`🎛️ ${spirit?.name} — Pedal Distortion! +1 Drive on Sonic Attacks.`);
    if (skillId === 'mixer')        addLog(`🎚️ ${spirit?.name} — Mixer! Play 2 notes simultaneously once per turn.`);
    if (skillId === 'power_chords') addLog(`🤘 ${spirit?.name} — Power Chords! +2 Drive on Sonic when 2+ amps.`);
    if (skillId === 'ultimate')     addLog(`💀 ${spirit?.name} — ULTIMATE ABILITY UNLOCKED!`);
    // (The old stage-effect skills — laser_show / stage_light / fog_machine /
    //  pyrotechnics — were RETIRED. Stage Effects now live on the board and fire
    //  at Fame thresholds: see the STAGE EFFECTS SYSTEM + data/stageEffects.js.)
  }

  // Called when player selects a skill to target (from the overlay).
  // The previously awarded skill is already in unlockedSkills — just set the new target.
  function setSkillTarget(spiritId, skillId) {
    if (!canAct) return; // OWNERSHIP: only the controlling client sets skill targets
    const ns    = noteStates[spiritId] ?? {};
    const skill = SKILL_BY_ID[skillId];
    if (!skill) return;

    const unlocked = ns.unlockedSkills ?? [];
    if (unlocked.includes(skillId)) return;

    // Prereq / chain gating — shared pure kernel (engine/systems/skills.js), the
    // same gate the bot uses. Human path passes no owner-route (the overlay only
    // ever offers the player their own skills), preserving prior behavior.
    const elig = skillEligibility(skill, unlocked);
    if (!elig.ok) {
      if (elig.reason === 'prereq') {
        const names = (elig.missing ?? []).map(id => SKILL_BY_ID[id]?.label ?? id).join(' + ');
        addLog(`❌ Requires ${names} first.`);
      }
      else if (elig.reason === 'ultimate') addLog(`❌ Ultimate requires: ${elig.missing.join(', ')}`);
      else if (elig.reason === 'pa')       addLog(`❌ PA system requires Amp I first.`);
      return;
    }

    setNoteStates(prev => ({
      ...prev,
      [spiritId]: {
        ...prev[spiritId],
        targetSkillId:       skillId,
        pendingAwardSkillId: null,
        upgradesPending:     0,
        skillRoute:          ns.skillRoute,
        dbPoints:            prev[spiritId]?.dbPoints ?? 0,
      }
    }));

    const spirit = spirits.find(s => s.id === spiritId);
    addLog(`🎯 ${spirit?.name} is saving toward: ${skill.icon} ${skill.label} (${skill.dbCost} DB)`);
    if (turnStep === 'chord') setTimeout(() => showTip('chord'), 400);
  }

  // Called when advanceDB fires upgradeTriggered — awards the target skill & opens overlay.
  function awardTargetSkill(spiritId) {
    let awardedSkillId = null;
    // Functional update reads fresh state even when called from a stale setTimeout closure
    setNoteStates(prev => {
      const ns      = prev[spiritId] ?? {};
      const skillId = ns.targetSkillId;
      if (!skillId) {
        return { ...prev, [spiritId]: { ...ns, upgradesPending: 1 } };
      }
      awardedSkillId = skillId;
      const unlocked    = ns.unlockedSkills ?? [];
      const newUnlocked = unlocked.includes(skillId) ? unlocked : [...unlocked, skillId];
      return {
        ...prev,
        [spiritId]: {
          ...ns,
          unlockedSkills:      newUnlocked,
          upgradesPending:     1,
          pendingAwardSkillId: skillId,
          targetSkillId:       null,
        }
      };
    });
    // Side-effects run after state settles — use a second timeout so React has batched the update
    setTimeout(() => {
      if (awardedSkillId) {
        const skill = SKILL_BY_ID[awardedSkillId];
        addLog(`🏆 ${spirits.find(s => s.id === spiritId)?.name} earned: ${skill?.icon} ${skill?.label}!`);
        applySkillEffects(spiritId, awardedSkillId);
        showTip('skill_unlock');
      }
    }, 60);
  }

  // Legacy alias
  function purchaseSkill(spiritId, skillId) { setSkillTarget(spiritId, skillId); }
  function chooseUpgrade(spiritId, categoryId) {
    const legacyMap = { amp:'amp_1', roadie:'roadie_1',
      discord_1:'discord_1', discord_2:'discord_2', discord_3:'discord_3', discord_4:'discord_4' };
    // Old crew ids (roadie_1/crew_stagehand, fans_4eva/crew_backstage, pranksta/crew_heckler, crew_merch, crew_manager) drop silently
    const DEAD_IDS = new Set(['roadie_1','crew_stagehand','fans_4eva','crew_backstage','pranksta','crew_heckler','crew_merch','crew_manager']);
    const resolved = legacyMap[categoryId] ?? categoryId;
    if (DEAD_IDS.has(resolved)) return;
    setSkillTarget(spiritId, resolved);
  }

  // ENCORE APOCALYPSE — the Ultimate. Once per game: 2 Vibe damage + 1-turn
  // Stagger to every rival within 4 hexes.
  function fireUltimate(spiritId) {
    if (!canAct) return; // N4/N7: gate
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    if (!spirit || spirit.knockedOut) return;
    if (!(ns.unlockedSkills ?? []).includes('ultimate') || ns.ultimateUsed) return;
    const spiritHex = HEX_BY_NUM[spirit.num];
    if (!spiritHex) return;
    const victims = spirits.filter(s => {
      if (s.id === spiritId || s.knockedOut) return false;
      const sh = HEX_BY_NUM[s.num];
      return sh && axialDist(spiritHex.q, spiritHex.r, sh.q, sh.r) <= 4;
    });
    if (victims.length === 0) { addLog(`💀 No rivals within 4 hexes — don't waste the Encore!`); return; }
    setNoteStates(prev => {
      let next = { ...prev, [spiritId]: { ...prev[spiritId], ultimateUsed: true } };
      victims.forEach(v => {
        const vNs = next[v.id] ?? {};
        if (!vNs.stagger) {
          const slots = Array.from({ length: 8 }, (_, i) => i);
          for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
          }
          next = { ...next, [v.id]: { ...vNs, stagger: { slots: slots.slice(0, 2), turnsLeft: 1 } } };
        }
      });
      return next;
    });
    addLog(`💀⚡ ${spirit.name} unleashes ENCORE APOCALYPSE! The whole venue shakes!`);
    victims.forEach((v, i) => {
      triggerRumble(v.id);
      setTimeout(() => applyVibeDamage(v.id, 2, 'Encore Apocalypse'), 120 + i * 80);
      setTimeout(() => triggerEffectFlash(v.id, '⚡', 'STAGGERED!', '#ff8800'), 250 + i * 120);
      addLog(`💀 ${v.name} takes 2 Vibe damage and is STAGGERED!`);
    });
  }

  // ── LIMELIGHT / POSE ─────────────────────────────────────────────────────────
  function togglePose() {
    if (!acting || !canAct) return; // N4/N7: gate
    if (!(noteStates[acting.id]?.unlockedSkills ?? []).includes('hero_pose')) {
      addLog(`🌟 Unlock HERO POSE (Thrash route) before striking a winning pose!`);
      return;
    }
    if (acting.num !== LIMELIGHT_HEX) {
      addLog(`🎤 ${acting.name} is not on the centre stage hex!`);
      return;
    }
    if (!hasConfirmed) {
      addLog(`🎤 Build and confirm your Melody Line before posing.`);
      return;
    }
    setPosing(prev => {
      const current = !!prev[acting.id];
      addLog(current
        ? `🎤 ${acting.name} stops posing.`
        : `🎤 ${acting.name} STRIKES A POSE! ✨ In the Limelight!`);
      return { ...prev, [acting.id]: !current };
    });
  }

  // Roadie action flow — board amps removed (Phase 2); roadie move is a no-op.
  function startRoadieAction() {}



  // ─── MODULATION CARDS — CUT to a single survivor (Stance rework, §8) ─────────
  // Chromatic Shift + Overdrive are GONE (the Theory ladder rescues bad tracks
  // now). The starter Transpose one-shot survives as a beginner mercy: re-draw
  // your Root Note once, then the card falls away.
  const MOD_CARD_DEFS = {
    transpose: {
      icon: '🔄',
      name: 'Transpose',
      desc: 'Re-draw your Root Note from any note in your current stock — you choose.',
      color: '#ffcc44',
      usableWhen: 'before-build', // was 'during-pivot' (B8 removed the pivot step)
    },
  };

  function playModCard(cardId) {
    if (!acting || !canAct) return; // N4/N7: gate
    const ns = actingNoteState;
    const card = (ns?.modCards ?? []).find(c => c.id === cardId);
    if (!card || card.exhausted) return;
    const def = MOD_CARD_DEFS[card.type];
    if (!def) return;

    if (card.type === 'transpose') {
      // Open a "pick your new root" overlay — set a pending state
      setNoteField(acting.id, {
        transposeCardPending: cardId,
        modCards: (ns.modCards ?? []).map(c => c.id === cardId ? { ...c, exhausted: true } : c),
      });
      addLog('🔄 Transpose — click any note in your stock to use it as your new Root Note.');
    }
  }

  function resolveTransposeCard(noteIdx) {
    if (!acting) return;
    const ns = actingNoteState;
    if (!ns?.transposeCardPending) return;
    const newRoot = ns.noteStock[noteIdx];
    if (!newRoot) return;
    // 🎸 B8: the root just moved, so re-derive the mode from the Drive Stack and
    // respell around the new root. Safe to respell here: Transpose is
    // `usableWhen: 'before-build'`, i.e. before any melody note has been placed.
    //
    // ⚠️ Deliberately does NOT re-pay the mode bonus. The old flow re-opened the
    // Major/Minor prompt, so declaring again paid a second +1 DB — affordable when
    // it cost the player a decision, but now that the mode is automatic, re-paying
    // would quietly turn Transpose into a DB battery.
    const derived   = modeFromStack(ns.driveStack ?? [], ns.unlockedSkills ?? [], scaleMode);
    const newMode   = derived.mode;
    const canonRoot = canonicalRoot(newRoot, newMode);
    // Respell stock
    const pool = getSpelledPool(canonRoot, newMode);
    const newStock = (ns.noteStock ?? []).map(n => {
      const idx = pitchIndex(n);
      return idx !== -1 ? pool[idx] : n;
    });
    setNoteField(acting.id, {
      rootNote: canonRoot,
      noteStock: newStock,
      scaleMode: newMode,
      modeReason: derived.reason,
      modeChordName: evaluateChord((ns.driveStack ?? []).filter(Boolean)).name,
      pivotPending: false,
      transposeCardPending: null,
    });
    addLog(`🔄 Transpose — new Root Note: ${canonRoot} ${newMode === 'major' ? '☀️ Major' : '🌑 Minor'}.`);
  }

  // ─── SKILL EFFECT HELPERS ─────────────────────────────────────────────────────

  // Returns any battle modifiers granted by the attacker's/defender's unlocked skills.
  // Called at the start of initiateSwing / initiateSonicAttack stat setup.
  function getBattleSkillMods(attackerId, defenderId) { // eslint-disable-line no-unused-vars
    let extraAtkDrive    = 0;

    // ⚠️ RETIRED — the old stage-effect skill battle buffs (laser_show halving
    // the defender's die, stage_light heal-on-win, fog_machine -1/-1, and the
    // pyrotechnics +d6) are gone. Stage Effects live ON THE BOARD now, fired at
    // Fame thresholds (see STAGE EFFECTS SYSTEM). The flags below stay in the
    // skillMods shape so downstream battle code/overlay visuals stay inert
    // rather than crashing — they are always false/0.
    const halveDef         = false;
    const fogActive        = false;
    const pyroBonus        = 0;
    const laserActive      = false;
    const stageLightActive = false;
    // Pedal Distortion / Power Chords handled in initiateSonicAttack

    return { halveDef, laserActive, fogActive, pyroBonus, extraAtkDrive, stageLightActive };
  }

  // ─── SWING EFFECTS — CUT (Stance rework, §8) ──────────────────────────────────
  // The entire CQC %-proc subsystem (slip/trip/dazed/drop/confused, the chance
  // tables, the guaranteed-proc roll, and the apply step) is GONE. Melee identity
  // now lives entirely in per-Spirit innates and Signature arsenals (the Style
  // rework retired the Stance system that briefly held this). The status FIELDS
  // (tripped/dazed/instrumentDropped) remain in state + engine ticks — nothing
  // sets them from combat any more, but events/future systems may.
  // (✨ BORROWED CHORD SHIELD removed in B1 — `consumeStatusShield` and the
  //  `statusShield` field went with the maj3 trigger that was its only source.)

  // ─── BOARD CARD SYSTEM ───────────────────────────────────────────────────────
  function spawnBoardCards(currentCards /* currentSpirits, currentAmps */) {
    // Mod Cards cut (Phase 6): the board no longer spawns 🃏 Mod Cards — that
    // scattered-pickup role is now Lost Chords (Lighters were cut too; see
    // ECONOMY_HANDOFF.md). No-op keeps callers safe. The pickup/replace flow
    // was deleted with the Stance-rework mod-card cut (§8).
    return currentCards ?? [];
  }

  // ─── EVENT SPACES SYSTEM ─────────────────────────────────────────────────────

  // 🧠 Pick a fresh trivia question — no repeats until the whole pool is used.
  // `rngVal` is a pre-drawn [0,1) engine rng value for deterministic selection.
  function pickTrivia(rngVal) {
    const used = usedTriviaRef.current;
    let pool = TRIVIA_QUESTIONS.filter(q => !used.has(q.id));
    if (pool.length === 0) { used.clear(); pool = TRIVIA_QUESTIONS; }
    const q = pool[Math.floor(rngVal * pool.length)];
    used.add(q.id);
    return q;
  }

  // Player answered the trivia card — grade it, pay fans on a correct answer.
  // 🎤 Fans, not DB: knowing rock trivia is crowd cred, not musicianship.
  function answerTrivia(idx) {
    if (!activeEvent || activeEvent.phase !== 'question') return;
    const q = activeEvent.q;
    const correct = idx === q.answer;
    const reward = correct ? (TRIVIA_REWARD[q.difficulty] ?? 3) : 0;
    const sp = spirits.find(s => s.id === activeEvent.spiritId);
    if (correct) { gainFansFromDeed(activeEvent.spiritId, reward, '🧠 Trivia'); addLog(`🧠 ${sp?.name} nails the trivia — +${reward} fans! 💡 ${q.sauce}`); }
    else { addLog(`🧠 ${sp?.name} blanks on the trivia — no bonus. 💡 ${q.sauce}`); }
    setActiveEvent(prev => prev ? { ...prev, phase: 'result', chosen: idx, correct, reward } : prev);
  }

  // Called from move() — stepping on a marquee hex triggers ROCK TRIVIA.
  function checkEventTrigger(spiritId, hexNum) {
    if (!eventHexes.includes(hexNum)) return;
    if (activeEvent) return; // one at a time
    const spirit = spirits.find(s => s.id === spiritId);
    // Pre-draw engine rng: [0] for trivia pick, [1] for bot odds (wasted for humans)
    dispatch(randomBatchDrawn(2));
    const triviaRng = engineRef.current.lastRandomBatch;
    const q = pickTrivia(triviaRng[0]);
    if (!q) return;
    // Marquee burns out — a new one lights up after the cooldown
    dispatch(eventHexTriggered(spiritId, hexNum));
    addLog(`🎪 ${spirit?.name} steps on a marquee hex — 🎤 ROCK TRIVIA! (${q.era})`);
    if (isBot(spirit)) {
      // Bots can't "know" trivia — fair fixed odds, resolved instantly, no modal.
      const got = triviaRng[1] < (TRIVIA_BOT_ODDS[q.difficulty] ?? 0.5);
      if (got) {
        const reward = TRIVIA_REWARD[q.difficulty] ?? 3;
        gainFansFromDeed(spiritId, reward, '🧠 Trivia');
        addLog(`🧠 ${spirit?.name} answers correctly — +${reward} fans! 💡 ${q.sauce}`);
      } else {
        addLog(`🧠 ${spirit?.name} guesses wrong — no bonus. 💡 ${q.sauce}`);
      }
      return;
    }
    setActiveEvent({ spiritId, q, phase: 'question', chosen: null });
  }

  // Flaming disc hazard — called whenever a spirit ENTERS a hex (move or push)
  function checkFlamingDisc(spiritId, hexNum) {
    if (!(flamingHexes.roundsLeft > 0) || !flamingHexes.hexes.includes(hexNum)) return;
    const spirit = spirits.find(s => s.id === spiritId);
    // 😎 DIVINE MISSION blessing — the flames part. Blessing is then spent.
    if (noteStates[spiritId]?.divineShield) {
      dispatch(fansChanged(spiritId, { divineShield: 0 }));
      addLog(`🛡️ The flaming disc fizzles at ${spirit?.name}'s feet — divine blessing spent.`);
      return;
    }
    addLog(`🔥💿 ${spirit?.name} hits a flaming disc on #${hexNum} — 1 Vibe damage!`);
    triggerRumble(spiritId);
    applyVibeDamage(spiritId, 1, 'Disco Inferno');
  }

  // 🧪 POISON SLIME (Metalness Monster innate passive) ─────────────────────────
  // Drop slime on the hex MM just LEFT (called with fromHex before the move).
  //
  // LIFETIME: one FULL ROUND — the trail has to survive long enough for rivals
  // to actually blunder into it. `turnsLeft` is counted in spirit-turns, not
  // rounds, and decayPoisonSlime() runs at the end of EVERY spirit's turn —
  // including the Monster's own, moments after he laid it. Dropping with a flat
  // 1 therefore wiped the whole trail the instant his turn ended and nobody
  // ever stepped in it.
  //
  // Seeding with the number of living Spirits makes it expire exactly as the
  // turn order comes back around: with 4 alive, drop=4 → MM's end 3 → each
  // rival's end 2, 1, 0, so the board is clean again just before MM acts. It
  // self-scales as Spirits are knocked out, so the trail is always "up until my
  // next turn" regardless of how many are left standing.
  function dropPoisonSlime(fromHex) {
    if (fromHex == null) return;
    const aliveCount = Math.max(1, spirits.filter(s => !s.knockedOut).length);
    setPoisonSlime(prev => ({ ...prev, [fromHex]: aliveCount }));
  }
  // Check if a spirit stepped/was pushed into poison slime.
  function checkPoisonSlime(spiritId, hexNum) {
    if (!poisonSlime[hexNum]) return;
    if (spiritId === 'Metalness_Monster') return; // MM is immune to its own goo
    const spirit = spirits.find(s => s.id === spiritId);
    addLog(`🧪 ${spirit?.name} steps in POISON SLIME on #${hexNum} — 1 Vibe damage!`);
    triggerRumble(spiritId);
    setTimeout(() => triggerEffectFlash(spiritId, '🧪', 'SLIMED!', '#44ff44'), 80);
    applyVibeDamage(spiritId, 1, 'Poison Slime');
  }
  // Decay all poison slime by 1 turn — called at end-of-turn for each spirit.
  function decayPoisonSlime() {
    setPoisonSlime(prev => {
      const next = {};
      for (const [hex, turns] of Object.entries(prev)) {
        if (turns > 1) next[hex] = turns - 1;
        // else it expires
      }
      return next;
    });
  }

  // 🎵 Board mini-goal pickup — called whenever a spirit enters a hex during a move.
  // Lighters (direct, unearned Fame) were cut -- see ECONOMY_HANDOFF.md. Every
  // board token is a Lost Chord now. Landing on one now offers a real choice —
  // bank it into your stock (as before) or weave it straight into your Chord
  // Stack, spending this turn's revoice — unless that revoice is already spent,
  // in which case we skip the modal and auto-bank (still animated).
  function checkTokenPickup(spiritId, hexNum) {
    const tok = boardTokens.find(t => t.num === hexNum);
    if (!tok) return;
    // 🎵 Play the note's pitch on pickup — the chord rings out
    playNoteSound(tok.note, { holdTime: 0.6, fadeTime: 0.8, volume: 0.22 });
    dispatch(tokenPickedUp(spiritId, hexNum));
    // 🗡️ SHREDDING RONIN — the virtuoso finds more music in it: ~50% of the time he
    // pockets a SECOND (fresh in-scale) note from the same find. Roll once, here.
    const roninGreed = spiritId === 'cosmic_ronin' && Math.random() < 0.5;
    const budgetSpent = (noteStates[spiritId]?.stackCommitsThisTurn ?? 0) >= STACK_COMMIT_BUDGET;
    if (budgetSpent) {
      bankLostChordNote(spiritId, tok.note, roninGreed);
      return;
    }
    // 🤖 Bots auto-decide: drive/sustain stack if it improves their stats, otherwise bank.
    const pickupSpirit = spirits.find(s => s.id === spiritId);
    if (pickupSpirit?.cpu) {
      const ns = noteStates[spiritId] ?? {};
      const drive = ns.driveStack ?? [];
      const sustain = ns.sustainStack ?? [];
      const cap = stackCapOf(spiritId);
      // Try drive stack first
      let placed = false;
      if (drive.length < cap) {
        const curW = botSpiritChord(spiritId, drive);
        const newW = botSpiritChord(spiritId, [...drive, tok.note]);
        if (newW.drive > curW.drive) {
          const sp = spirits.find(s => s.id === spiritId);
          setNoteStates(prev => {
            const cur = prev[spiritId]; if (!cur) return prev;
            return { ...prev, [spiritId]: { ...cur, driveStack: [...(cur.driveStack ?? []), tok.note], stackCommitsThisTurn: (cur.stackCommitsThisTurn ?? 0) + 1 } };
          });
          addLog(`🎸 ${sp?.name} weaves the Lost Chord (${tok.note}) into the Drive Stack!`);
          if (roninGreed) bankLostChordNote(spiritId, randomNote(ns.rootNote, ns.scaleMode), false);
          placed = true;
        }
      }
      if (!placed && sustain.length < cap) {
        const curW = botSpiritChord(spiritId, sustain);
        const newW = botSpiritChord(spiritId, [...sustain, tok.note]);
        if (newW.sustain > curW.sustain) {
          const sp = spirits.find(s => s.id === spiritId);
          setNoteStates(prev => {
            const cur = prev[spiritId]; if (!cur) return prev;
            return { ...prev, [spiritId]: { ...cur, sustainStack: [...(cur.sustainStack ?? []), tok.note], stackCommitsThisTurn: (cur.stackCommitsThisTurn ?? 0) + 1 } };
          });
          addLog(`🎸 ${sp?.name} weaves the Lost Chord (${tok.note}) into the Sustain Stack!`);
          if (roninGreed) bankLostChordNote(spiritId, randomNote(ns.rootNote, ns.scaleMode), false);
          placed = true;
        }
      }
      if (!placed) bankLostChordNote(spiritId, tok.note, roninGreed);
      return;
    }
    setPendingLostChordPickup({ spiritId, note: tok.note, roninGreed });
  }

  // Bank path — slot the found note into an unused stock slot (ready next turn),
  // then pop it in visibly instead of letting it silently splice into the stock.
  function bankLostChordNote(spiritId, note, roninGreed) {
    const sp = spirits.find(s => s.id === spiritId);
    setNoteStates(prev => {
      const ns = prev[spiritId]; if (!ns) return prev;
      const stock = [...(ns.noteStock ?? [])];
      const used  = usedList(ns.usedStockIdx);
      const placed = new Set();
      const place = (n) => {
        const slot = stock.findIndex((_, i) => !usedHas(used, i) && !placed.has(i));
        if (slot === -1) { stock.push(n); placed.add(stock.length - 1); }
        else { stock[slot] = n; placed.add(slot); }
      };
      place(note);
      if (roninGreed) place(randomNote(ns.rootNote, ns.scaleMode));
      // 🎬 Same "pop in like it just arrived" treatment as a turn-start refill —
      // deferred via setTimeout so it fires safely outside this functional update.
      setTimeout(() => {
        setFreshNoteIdx({ spiritId, indices: placed, key: Date.now() });
        setTimeout(() => setFreshNoteIdx(prevF => (prevF?.spiritId === spiritId ? null : prevF)), 700);
      }, 0);
      return { ...prev, [spiritId]: { ...ns, noteStock: stock } };
    });
    addLog(`🎵 ${sp?.name} picks up a Lost Chord (${note}) — it lands in your stock!`);
    if (roninGreed) addLog(`🗡️ ${sp?.name} hears a second note in it — an extra lands in the stock!`);
  }

  // Modal resolver for the Lost Chord pickup choice.
  function resolveLostChordPickup(choice) {
    if (!canAct || !pendingLostChordPickup) return; // N4/N7: gate
    const { spiritId, note, roninGreed } = pendingLostChordPickup;
    setPendingLostChordPickup(null);
    if (choice === 'bank') { bankLostChordNote(spiritId, note, roninGreed); return; }
    if (choice === 'drive' || choice === 'sustain') {
      const sp = spirits.find(s => s.id === spiritId);
      const ns = noteStates[spiritId] ?? {};
      const stackKey = choice === 'sustain' ? 'sustainStack' : 'driveStack';
      const stack = ns[stackKey] ?? [];
      if (stack.length >= stackCapOf(spiritId)) { bankLostChordNote(spiritId, note, roninGreed); return; }
      setNoteStates(prev => {
        const cur = prev[spiritId]; if (!cur) return prev;
        return { ...prev, [spiritId]: { ...cur, [stackKey]: [...(cur[stackKey] ?? []), note], stackCommitsThisTurn: (cur.stackCommitsThisTurn ?? 0) + 1 } };
      });
      addLog(`🎸 ${sp?.name} weaves the Lost Chord (${note}) into the ${choice === 'sustain' ? 'Sustain' : 'Drive'} Stack!`);
      // The Ronin's serendipitous second note (if any) still lands in the stock —
      // the chosen stack only applies to the primary found note.
      if (roninGreed) bankLostChordNote(spiritId, randomNote(ns.rootNote, ns.scaleMode), false);
    }
  }

  // ─── CHARGE ZONES — pickup ── (lightning-track hexes; see state comment above) ─
  // Base effect: the zone CHARGES the Spirit — a random 50/50 grant of either a
  // die FLOOR charge (attack dice can't roll below 1+CHARGE_FLOOR_BONUS) or a die
  // CEILING charge (attack dice upgrade one size: Thrash d6→d8; every Sonic pool
  // die bumps a step). Floor + ceiling stack with EACH OTHER but never double:
  // a duplicate draw flips to the other type; already holding both refreshes
  // both. Lasts CHARGE_ZONE_BOOST_TURNS of the holder's turns (≈2 rounds) or
  // until a battle ensues — fighting burns the charge, win or lose.
  function grantChargeSpark(spiritId) {
    const sp = spirits.find(s => s.id === spiritId);
    const ns = noteStates[spiritId] ?? {};
    const hasFloor = (ns.chargeFloorTurns ?? 0) > 0;
    const hasCeil  = (ns.chargeCeilTurns  ?? 0) > 0;
    // 50/50 draw on the engine's seeded rng — deterministic for replays/netplay.
    dispatch(randomBatchDrawn(1));
    const draw = engineRef.current.lastRandomBatch?.[0] ?? Math.random();
    let kind = draw < 0.5 ? 'floor' : 'ceil';
    if (hasFloor && hasCeil)                kind = 'both';   // full — refresh both
    else if (kind === 'floor' && hasFloor)  kind = 'ceil';   // dupe flips to the other type
    else if (kind === 'ceil'  && hasCeil)   kind = 'floor';
    const patch = {};
    if (kind === 'floor' || kind === 'both') patch.chargeFloorTurns = CHARGE_ZONE_BOOST_TURNS;
    if (kind === 'ceil'  || kind === 'both') patch.chargeCeilTurns  = CHARGE_ZONE_BOOST_TURNS;
    setNoteField(spiritId, patch);
    if (kind === 'floor') {
      triggerEffectFlash(spiritId, '⚡', 'FLOOR CHARGED!', '#ffcc44');
      addLog(`⚡ ${sp?.name} is CHARGED — die floor +${CHARGE_FLOOR_BONUS}! Attack dice can't roll below ${1 + CHARGE_FLOOR_BONUS} (2 rounds or until a battle).`);
    } else if (kind === 'ceil') {
      triggerEffectFlash(spiritId, '⚡', 'CEILING CHARGED!', '#44aaff');
      addLog(`⚡ ${sp?.name} is CHARGED — die ceiling up! Attack dice grow a size, d6→d8 (2 rounds or until a battle).`);
    } else {
      triggerEffectFlash(spiritId, '⚡', 'FULLY CHARGED!', '#cceeff');
      addLog(`⚡ ${sp?.name} is FULLY CHARGED — floor AND ceiling refreshed to ${CHARGE_ZONE_BOOST_TURNS} rounds!`);
    }
  }

  // ⚡ A battle ensued — both combatants' charges burn off (the charged side got
  // its boost applied to this fight's dice first; the other side just loses it).
  function burnChargesAfterBattle(ids, reason) {
    const burned = ids.filter(id => {
      const ns = noteStates[id] ?? {};
      return (ns.chargeFloorTurns ?? 0) > 0 || (ns.chargeCeilTurns ?? 0) > 0;
    });
    if (!burned.length) return;
    setNoteStates(prev => {
      const next = { ...prev };
      for (const id of burned) {
        if (!next[id]) continue;
        next[id] = { ...next[id], chargeFloorTurns: 0, chargeCeilTurns: 0 };
      }
      return next;
    });
    for (const id of burned) {
      const sp = spirits.find(s => s.id === id);
      addLog(`⚡ ${sp?.name}'s charge burns off — ${reason}.`);
    }
  }

  // 🎸 Pick the note the Overcharge chord-assist grants — biased toward whichever
  // available stock pitch improves the targeted stack the most, falling back to a
  // fresh in-scale note if the stock has nothing useful.
  function curatedChordNote(spiritId, stackKey = 'driveStack') {
    const ns = noteStates[spiritId] ?? {};
    const stack = ns[stackKey] ?? [];
    const have  = new Set(stack.map(pitchIndex));
    const cands = [...new Set((ns.noteStock ?? []).filter(n => !have.has(pitchIndex(n))))];
    if (cands.length) {
      const weight = (c) => c.drive + c.sustain;
      let best = cands[0], bestW = weight(spiritChord(spiritId, [...stack, cands[0]]));
      for (const note of cands.slice(1)) {
        const w = weight(spiritChord(spiritId, [...stack, note]));
        if (w > bestW) { bestW = w; best = note; }
      }
      return best;
    }
    return randomNote(ns.rootNote, ns.scaleMode);
  }

  // Chord-assist alternative (Overcharge only): ONE extra note into the Drive Stack,
  // counts against the stack commit budget.
  function grantChargeChordAssist(spiritId) {
    const sp = spirits.find(s => s.id === spiritId);
    const ns = noteStates[spiritId] ?? {};
    const dStack = ns.driveStack ?? [];
    const sStack = ns.sustainStack ?? [];
    const cap = stackCapOf(spiritId);
    if (dStack.length >= cap && sStack.length >= cap) {
      addLog(`🎸 ${sp?.name}'s stacks are already full — the charge sparks into the dice instead.`);
      grantChargeSpark(spiritId);
      return;
    }
    // Pick the stack with room; prefer drive
    const stackKey = dStack.length < cap ? 'driveStack' : 'sustainStack';
    const note = curatedChordNote(spiritId, stackKey);
    setNoteStates(prev => {
      const cur = prev[spiritId]; if (!cur) return prev;
      return { ...prev, [spiritId]: { ...cur, [stackKey]: [...(cur[stackKey] ?? []), note], stackCommitsThisTurn: (cur.stackCommitsThisTurn ?? 0) + 1 } };
    });
    triggerEffectFlash(spiritId, '🎸', 'OVERCHARGED!', '#ff66cc');
    addLog(`🎸 ${sp?.name} overcharges — ${note} lands straight in the ${stackKey === 'driveStack' ? 'Drive' : 'Sustain'} Stack!`);
  }

  // Called whenever a spirit enters a hex during a move.
  function checkChargeZonePickup(spiritId, hexNum) {
    const zone = chargeZones.find(z => z.num === hexNum && (z.cooldown ?? 0) <= 0);
    if (!zone) return;
    // ⚡ Charge-up SFX — the lightning crackles
    playChargeSound();
    dispatch(chargeZoneUsed(spiritId, hexNum));
    const overcharged = (noteStates[spiritId]?.unlockedSkills ?? []).includes('overcharge');
    if (overcharged) {
      const sp = spirits.find(s => s.id === spiritId);
      addLog(`⚡ ${sp?.name} taps a Charge Zone — Overcharge lets you pick your payoff!`);
      setChargeChoicePending({ spiritId, num: hexNum });
      return;
    }
    grantChargeSpark(spiritId);
  }

  // Modal resolver for the Overcharge choice.
  function resolveChargeChoice(choice) {
    if (!canAct || !chargeChoicePending) return; // N4/N7: gate
    const { spiritId } = chargeChoicePending;
    setChargeChoicePending(null);
    if (choice === 'boost') grantChargeSpark(spiritId);
    else if (choice === 'chord') grantChargeChordAssist(spiritId);
  }

  // ⚡ Bonus revoice — DEPRECATED (replaced by stack commit budget system).
  // Kept as no-ops to avoid breaking any stale event handler references.
  function spendBonusRevoiceAdd(idx) { /* no-op */ }
  function spendBonusRevoiceDrop(i) { /* no-op */ }

  // Resolve the active event (fired by the modal's ROLL / RESOLVE button)
  function resolveActiveEvent() {
    if (!activeEvent || activeEvent.phase !== 'reveal') return;
    const { spiritId, eventId } = activeEvent;
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    const lines  = [];
    let rolls    = null;
    // ── Pre-draw engine rng for deterministic event resolution ──
    const alive = spirits.filter(s => !s.knockedOut);
    const rngNeeded = eventId === 'disco_inferno' ? FLAMING_DISC_COUNT
      : eventId === 'satanic_panic' ? alive.length
      : eventId === 'seance_27' ? 8   // 1 d6 + up to 7 shuffle values
      : eventId === 'stage_dive' ? 2
      : (eventId === 'bat_snack' || eventId === 'payola') ? 1
      : 0;
    let rCursor = 0;
    let batch = [];
    if (rngNeeded > 0) {
      dispatch(randomBatchDrawn(rngNeeded));
      batch = engineRef.current.lastRandomBatch;
    }
    const rng01 = () => batch[rCursor++];
    const d6 = () => Math.floor(rng01() * 6) + 1;

    if (eventId === 'disco_inferno') {
      const occupied = new Set([
        ...spirits.filter(s => !s.knockedOut).map(s => s.num),
        ...amps.map(a => a.hexNum),
        ...eventHexes, LIMELIGHT_HEX,
      ]);
      const pool = ALL_HEXES.filter(h => !occupied.has(h.num)).map(h => h.num);
      const discs = [];
      for (let i = 0; i < FLAMING_DISC_COUNT && pool.length > 0; i++) {
        const idx = Math.floor(rng01() * pool.length);
        discs.push(pool.splice(idx, 1)[0]);
      }
      dispatch(flamingHexesSet(discs, FLAMING_DISC_ROUNDS));
      lines.push(`🔥 ${discs.length} flaming discs crash down on hexes ${discs.map(n => '#' + n).join(', ')}.`);
      lines.push(`They burn for ${FLAMING_DISC_ROUNDS} full rounds — entering one costs 1 Vibe.`);
      addLog(`🔥💿 DISCO INFERNO — ${discs.length} flaming discs litter the board for ${FLAMING_DISC_ROUNDS} rounds!`);
    }

    else if (eventId === 'bat_snack') {
      const roll = d6();
      rolls = { you: roll };
      if (roll >= 4) {
        setSpirits(prev => prev.map(s => s.id === spiritId
          ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 2) } : s));
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, tempDrive: Math.max(cur.tempDrive ?? 0, 1) } };
        });
        lines.push(`🦇 Rolled ${roll} — DOWN THE HATCH. Absolute legend behavior.`);
        lines.push(`+2 Vibe restored and +1 Drive for your next battle.`);
        addLog(`🦇 ${spirit?.name} eats the bat — LEGENDARY! +2 Vibe, +1 Drive next battle.`);
      } else {
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, tempDrive: 0, tempSustain: 0 } };
        });
        applyVibeDamage(spiritId, 1, 'Bat Snack');
        lines.push(`🦇 Rolled ${roll} — that bat was NOT rubber.`);
        lines.push(`Infection: all temp boosts lost and -1 Vibe. Rabies shots are no joke.`);
        addLog(`🦇 ${spirit?.name} gets an infection from the Bat Snack — boosts lost, -1 Vibe!`);
      }
    }

    else if (eventId === 'satanic_panic') {
      const alive = spirits.filter(s => !s.knockedOut);
      const allRolls = alive.map(s => ({ id: s.id, name: s.name, color: s.color, roll: d6() }));
      rolls = { community: allRolls };
      const best = Math.max(...allRolls.map(r => r.roll));
      const winners = allRolls.filter(r => r.roll === best);
      const convicted = allRolls.filter(r => r.roll === 1);
      setNoteStates(prev => {
        let next = { ...prev };
        winners.forEach(w => {
          const cur = next[w.id] ?? {};
          next = { ...next, [w.id]: { ...cur, tempDrive: Math.max(cur.tempDrive ?? 0, 2) } };
        });
        convicted.forEach(c => {
          const cur = next[c.id] ?? {};
          if ((cur.mojoDrain ?? 0) === 0) {
            next = { ...next, [c.id]: { ...cur, mojoDrain: 1 } };
            setTimeout(() => triggerEffectFlash(c.id, '💧', 'MOJO DRAINED!', '#4499ff'), 200);
          }
        });
        return next;
      });
      lines.push(`😈 The congressional hearing convenes. Everyone rolls...`);
      lines.push(`Acquitted WITH STYLE (${best}): ${winners.map(w => w.name).join(', ')} — +2 Drive next battle.`);
      if (convicted.length > 0) lines.push(`CONVICTED of backmasking: ${convicted.map(c => c.name).join(', ')} — Mojo Drain 1 turn.`);
      else lines.push(`Nobody rolled a 1 — the moral panic fizzles on live TV.`);
      addLog(`😈 SATANIC PANIC! ${winners.map(w => w.name).join(', ')} acquitted with style (+2 Drive).${convicted.length ? ` ${convicted.map(c => c.name).join(', ')} convicted — Mojo Drain!` : ''}`);
    }

    else if (eventId === 'spinal_tap') {
      const ownsAmp = amps.some(a => a.ownerId === spiritId);
      if (ownsAmp) {
        setNoteStates(prev => ({
          ...prev, [spiritId]: { ...(prev[spiritId] ?? {}), elevenTurns: 2 },
        }));
        lines.push(`🎚️ Your rig now goes to ELEVEN.`);
        lines.push(`For your next 2 turns, your dice tier counts +1 amp in range.`);
        addLog(`🎚️ ${spirit?.name}'s amps go to ELEVEN — dice tier +1 amp for 2 turns!`);
      } else {
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, dieFloorBoost: Math.max(cur.dieFloorBoost ?? 0, 1) } };
        });
        lines.push(`🎚️ You don't own an amp... but you FEEL one louder.`);
        lines.push(`Die floor +1 on your next roll.`);
        addLog(`🎚️ ${spirit?.name} feels one louder — die floor +1 next roll!`);
      }
    }

    else if (eventId === 'seance_27') {
      const roll = d6();
      rolls = { you: roll };
      if (roll === 6) {
        grantDB(spiritId, 3);
        lines.push(`🕯️ Rolled 6 — the legends ANSWER. A chord you've never heard rings out.`);
        lines.push(`+3 Decibills.`);
        addLog(`🕯️ The 27 Club answers ${spirit?.name}'s séance — +3 DB!`);
      } else if (roll === 1) {
        // Pre-read shuffle values from the batch (drawn above; rCursor already past the d6)
        const shuffleVals = batch.slice(rCursor, rCursor + 7);
        rCursor += 7;
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          if (cur.stagger) return prev;
          const slots = Array.from({ length: 8 }, (_, i) => i);
          for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(shuffleVals[slots.length - 1 - i] * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
          }
          // turnsLeft: 2 — this stagger is applied mid-way through the spirit's
          // OWN turn, and stagger now ticks down at the end of your own turn,
          // so 2 here = frozen for exactly 1 full upcoming turn.
          return { ...prev, [spiritId]: { ...cur, stagger: { slots: slots.slice(0, 2), turnsLeft: 2 } } };
        });
        lines.push(`🕯️ Rolled 1 — the candle blows out by itself. Something touched your fretting hand.`);
        lines.push(`Spooked: 2 stock slots frozen for 1 turn.`);
        addLog(`🕯️ ${spirit?.name} is SPOOKED by the séance — 2 slots frozen!`);
        setTimeout(() => triggerEffectFlash(spiritId, '⚡', 'SPOOKED!', '#ff8800'), 200);
      } else {
        grantDB(spiritId, 1);
        lines.push(`🕯️ Rolled ${roll} — a faint whisper of a melody drifts through.`);
        lines.push(`+1 Decibill.`);
        addLog(`🕯️ A faint whisper reaches ${spirit?.name} — +1 DB.`);
      }
    }

    else if (eventId === 'hotel_trash') {
      const sHex = HEX_BY_NUM[spirit?.num];
      const adj = sHex ? spirits.filter(r => {
        if (r.id === spiritId || r.knockedOut) return false;
        const rh = HEX_BY_NUM[r.num];
        return rh && axialDist(sHex.q, sHex.r, rh.q, rh.r) === 1;
      }) : [];
      if (adj.length === 0) {
        setSpirits(prev => prev.map(s => s.id === spiritId
          ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
        lines.push(`📺 The TV hits the pool. Nobody around to see it. Somehow that's even better.`);
        lines.push(`Pure catharsis: +1 Vibe.`);
        addLog(`📺 ${spirit?.name} trashes the suite in private — +1 Vibe of pure catharsis!`);
      } else {
        const moved = [];
        setSpirits(prev => {
          let next = [...prev];
          adj.forEach(rival => {
            const rh = HEX_BY_NUM[rival.num];
            if (!rh || !sHex) return;
            const away = angleTo(sHex, rh); // direction from actor toward rival = push direction
            const dest = neighborInDirection(rh, away);
            if (!dest) return;
            const occupied = next.some(s => !s.knockedOut && s.id !== rival.id && s.num === dest.num)
                          || amps.some(a => a.hexNum === dest.num);
            if (occupied) return;
            next = next.map(s => s.id === rival.id ? { ...s, num: dest.num } : s);
            moved.push({ id: rival.id, name: rival.name, to: dest.num });
            // Pushed into poison slime?
            setTimeout(() => checkPoisonSlime(rival.id, dest.num), 60);
            // Pushed into the inferno?
            setTimeout(() => checkFlamingDisc(rival.id, dest.num), 100);
            // 🎇 …or into a stage hazard?
            setTimeout(() => checkStageFxHex(rival.id, dest.num), 130);
            // Knocked off the limelight?
            if (rival.num === LIMELIGHT_HEX) setPosing(p => ({ ...p, [rival.id]: false }));
          });
          return next;
        });
        lines.push(`📺 SPLASH ZONE! Everyone adjacent scatters from the falling television.`);
        lines.push(moved.length > 0
          ? `Shoved away: ${moved.map(m => `${m.name} → #${m.to}`).join(', ')}.`
          : `Rivals brace against the walls — nobody could be moved.`);
        addLog(`📺 ${spirit?.name} TRASHES THE SUITE!${moved.length ? ` ${moved.map(m => m.name).join(', ')} shoved away!` : ' Rivals hold their ground.'}`);
      }
    }

    else if (eventId === 'payola') {
      const roll = d6();
      rolls = { you: roll };
      if (roll % 2 === 0) {
        grantDB(spiritId, 2);
        lines.push(`💰 Rolled ${roll} — the envelope works. Your single is in HEAVY rotation.`);
        lines.push(`+2 Decibills.`);
        addLog(`💰 Payola pays off for ${spirit?.name} — +2 DB!`);
      } else {
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, dbPoints: Math.max(0, (cur.dbPoints ?? 0) - 2) } };
        });
        lines.push(`💰 Rolled ${roll} — BUSTED. Your face is on the evening news next to the word "scandal."`);
        lines.push(`-2 Decibills progress.`);
        addLog(`💰 ${spirit?.name} caught in the Payola Scandal — -2 DB progress!`);
      }
    }

    else if (eventId === 'stage_dive') {
      const sHex = HEX_BY_NUM[spirit?.num];
      const rivals = spirits.filter(r => r.id !== spiritId && !r.knockedOut);
      if (rivals.length === 0 || !sHex) {
        setSpirits(prev => prev.map(s => s.id === spiritId
          ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
        lines.push(`🤸 You dive. The crowd catches you. There was never any doubt. +1 Vibe.`);
        addLog(`🤸 ${spirit?.name} stage dives into adoring fans — +1 Vibe!`);
      } else {
        const nearest = rivals
          .map(r => { const rh = HEX_BY_NUM[r.num]; return rh ? { r, d: axialDist(sHex.q, sHex.r, rh.q, rh.r) } : null; })
          .filter(Boolean)
          .sort((a, b) => a.d - b.d)[0].r;
        const yourRoll  = d6();
        const theirRoll = d6();
        rolls = { duel: { you: { name: spirit?.name, roll: yourRoll }, them: { name: nearest.name, roll: theirRoll } } };
        if (yourRoll > theirRoll) {
          setSpirits(prev => prev.map(s =>
            s.id === spiritId ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
          applyVibeDamage(nearest.id, 1, 'Stage Dive');
          lines.push(`🤸 ${yourRoll} vs ${theirRoll} — YOUR crowd goes wild and carries you like royalty.`);
          lines.push(`Steal 1 Vibe from ${nearest.name}.`);
          addLog(`🤸 ${spirit?.name} out-dives ${nearest.name} (${yourRoll} vs ${theirRoll}) — steals 1 Vibe!`);
        } else if (theirRoll > yourRoll) {
          setSpirits(prev => prev.map(s =>
            s.id === nearest.id ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
          applyVibeDamage(spiritId, 1, 'Stage Dive');
          lines.push(`🤸 ${yourRoll} vs ${theirRoll} — their fans surge forward... and yours part like the sea.`);
          lines.push(`${nearest.name} steals 1 Vibe from you. The floor says hello.`);
          addLog(`🤸 ${nearest.name}'s crowd loves them more (${theirRoll} vs ${yourRoll}) — steals 1 Vibe from ${spirit?.name}!`);
        } else {
          setSpirits(prev => prev.map(s =>
            (s.id === spiritId || s.id === nearest.id)
              ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
          lines.push(`🤸 ${yourRoll} vs ${theirRoll} — TIE. The whole venue crowd-surfs you both. +1 Vibe each.`);
          addLog(`🤸 Stage dive TIE (${yourRoll}) — ${spirit?.name} and ${nearest.name} both ride the crowd, +1 Vibe each!`);
        }
      }
    }

    else if (eventId === 'backstage_pass') {
      grantDB(spiritId, 3);
      lines.push(`🎟️ The pass is real. The door opens onto a room full of legends swapping licks.`);
      lines.push(`You soak it all in: +3 Decibills.`);
      addLog(`🎟️ ${spirit?.name} works the Backstage Pass — +3 DB!`);
    }

    else if (eventId === 'divine_mission') {
      const recalled = unsurePool;
      if (recalled > 0) {
        setUnsurePool(0);
        const cur = engineRef.current.noteStates[spiritId] ?? {};
        dispatch(fansChanged(spiritId, {
          casuals: Math.min(FAN_CASUAL_CAP, (cur.casuals ?? 0) + recalled),
          fanLag: 0,
          divineShield: 1,
        }));
        flashFanFx(spiritId, 'gain', recalled);
        triggerUnsureWin(spiritId, recalled);
      } else {
        dispatch(fansChanged(spiritId, { fanLag: 0, divineShield: 1 }));
      }
      setSpirits(prev => prev.map(s => s.id === spiritId
        ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
      lines.push(`😎 The band is back together. You are on a mission from God.`);
      lines.push(recalled > 0
        ? `${recalled} Unsure fan${recalled !== 1 ? 's' : ''} march home as Casuals · lockout cleared · +1 Vibe.`
        : `No strays on the centre to recall, but the lockout clears and you stand renewed: +1 Vibe.`);
      lines.push(`🛡️ Blessing: you shrug off the next demolition or hazard against you.`);
      addLog(`😎 ${spirit?.name} — DIVINE MISSION! ${recalled > 0 ? `${recalled} fans recalled, ` : ''}lockout cleared, blessed against the next hit, +1 Vibe.`);
    }

    else if (eventId === 'back_to_past') {
      setActiveEvent(null);
      setTimeout(() => launchBackToPast(spiritId), 80);
      return; // hands off to the dedicated play-challenge overlay
    }

    setActiveEvent(prev => prev ? { ...prev, phase: 'result', resultLines: lines, rolls } : prev);
  }

  // ─── 🎸⏰ BACK TO THE PAST — engine ─────────────────────────────────────────
  // Self-contained mini riff challenge (never touches battleState). Stage 1 pays
  // Decibills, Stage 2 pays fans. Every fumbled note shaves 1 Vibe, but the
  // fade floors at 1 — it can NEVER knock a spirit out. Stage 2 always runs.
  function launchBackToPast(spiritId) {
    const sp = spirits.find(s => s.id === spiritId);
    addLog(`🎸⏰ ${sp?.name} grabs an instrument in the wrong decade — BACK TO THE PAST!`);
    bttpEngineRef.current = null;
    bttpModeRef.current = { view: 'piano', winMult: 1 };
    setBttpChallenge({
      spiritId, stageKey: 'angel', phase: 'choose', view: 'piano',
      idx: -1, hits: 0, misses: 0, flash: null, lastGrade: null,
      tally: { hc: 0, casuals: 0, vibeLost: 0 }, lines: [],
    });
  }

  // Player picks piano (standard) or guitar (harder read → more leeway time).
  function bttpChoose(spiritId, view) {
    const winMult = view === 'guitar' ? 1.5 : 1;
    bttpModeRef.current = { view, winMult };
    setBttpChallenge(prev => prev ? { ...prev, view, phase: 'countdown' } : prev);
    setTimeout(() => bttpStartStage(spiritId, 'angel'), 1200);
  }

  function bttpStartStage(spiritId, stageKey) {
    const mode = bttpModeRef.current;
    // Carry the chosen instrument + leeway onto the stage data the engine threads through.
    const data = { ...bttpStageData(stageKey), view: mode.view, winMult: mode.winMult };
    setBttpChallenge(prev => prev ? {
      ...prev, stageKey, view: mode.view, phase: 'play', idx: 0, hits: 0, misses: 0, flash: null, lastGrade: null,
    } : prev);
    setTimeout(() => bttpFlashChord(spiritId, stageKey, 0, data), 350);
  }

  // Sound a whole chord at once (a tiny roll so it reads as a chord, not a blip).
  function bttpSoundChord(letters, volume = 0.2) {
    letters.forEach((ltr, k) => setTimeout(() =>
      playNoteSound(null, { freq: bttpLetterFreq(ltr), holdTime: 0.5, fadeTime: 0.5, volume }), k * 16));
  }

  // INPUT — light the chord's keys (no labels). Player presses all of them within
  // the window. Individual presses are SILENT; only once the chord is complete does
  // it sound. A miss/clam drains 1 Vibe (floored at 1).
  function bttpFlashChord(spiritId, stageKey, idx, data) {
    if (idx >= data.chords.length) {
      // Whole progression entered — now play it back, in rhythm.
      setBttpChallenge(prev => prev ? { ...prev, phase: 'playback', idx: 0, flash: null, lastGrade: null } : prev);
      setTimeout(() => bttpPlayback(spiritId, stageKey, 0, data), 650);
      return;
    }
    const chord = data.chords[idx];
    const win = Math.round((data.rhythm[idx]?.window ?? 2400) * (data.winMult ?? 1));
    bttpEngineRef.current = {
      spiritId, stageKey, idx, need: new Set(chord), got: new Set(), wrong: false,
      shownAt: performance.now(), window: win, resolved: false, timeoutId: null,
    };
    setBttpChallenge(prev => prev ? { ...prev, idx, flash: { idx, chord, got: [] }, lastGrade: null } : prev);
    bttpEngineRef.current.timeoutId = setTimeout(() => {
      const eng = bttpEngineRef.current;
      if (!eng || eng.resolved || eng.idx !== idx || eng.stageKey !== stageKey) return;
      bttpResolveChord(false, data);
    }, win);
  }

  // Shared input — keyboard + on-screen pads. Silent per key; the chord only sounds
  // once every required note is in. A wrong key clams the chord (no clean credit).
  function bttpInput(letter) {
    const eng = bttpEngineRef.current;
    if (!eng || eng.resolved) return;
    const data = bttpStageData(eng.stageKey);
    if (eng.need.has(letter)) {
      if (!eng.got.has(letter)) {
        eng.got.add(letter);
        const got = [...eng.got];
        setBttpChallenge(prev => prev && prev.flash ? { ...prev, flash: { ...prev.flash, got } } : prev);
      }
      if (eng.got.size === eng.need.size) {
        bttpSoundChord([...eng.need]);     // the payoff: the chord rings out, in full
        bttpResolveChord(true, data);
      }
    } else {
      eng.wrong = true; // a clam — the chord can still be completed but won't be clean
      setBttpChallenge(prev => prev ? { ...prev, lastGrade: 'clam' } : prev);
    }
  }

  function bttpResolveChord(complete, data) {
    const eng = bttpEngineRef.current;
    if (!eng || eng.resolved) return;
    eng.resolved = true;
    clearTimeout(eng.timeoutId);
    const { spiritId, stageKey, idx } = eng;
    const clean = complete && !eng.wrong;
    if (clean) {
      setBttpChallenge(prev => prev ? { ...prev, hits: prev.hits + 1, lastGrade: 'clean' } : prev);
    } else {
      let drained = 0;
      setSpirits(prev => prev.map(s => {
        if (s.id !== spiritId) return s;
        const v = s.vibe ?? 1;
        if (v <= 1) return s;
        drained = 1;
        return { ...s, vibe: v - 1 };
      }));
      playRiffMiss();
      triggerRumble(spiritId);
      setBttpChallenge(prev => prev ? {
        ...prev, misses: prev.misses + 1, lastGrade: complete ? 'clam' : 'miss',
        tally: { ...prev.tally, vibeLost: prev.tally.vibeLost + drained },
      } : prev);
    }
    const gap = data.rhythm[idx + 1]?.gap ?? 300;
    setTimeout(() => bttpFlashChord(spiritId, stageKey, idx + 1, data), gap);
  }

  // PLAYBACK — the progression as it should sound: each chord rings in rhythm and
  // lights the keys. Then the stage resolves.
  function bttpPlayback(spiritId, stageKey, idx, data) {
    if (idx >= data.chords.length) { bttpEndStage(spiritId, stageKey, data); return; }
    const chord = data.chords[idx];
    const lit = data.pbLit ?? 500, gap = data.pbGap ?? 140;
    setBttpChallenge(prev => prev ? { ...prev, idx, flash: { idx, chord, got: chord } } : prev);
    bttpSoundChord(chord, 0.2);
    setTimeout(() => {
      setBttpChallenge(prev => prev ? { ...prev, flash: null } : prev);
      setTimeout(() => bttpPlayback(spiritId, stageKey, idx + 1, data), gap);
    }, lit);
  }

  function bttpEndStage(spiritId, stageKey, data) {
    bttpEngineRef.current = null;
    const sp = spirits.find(s => s.id === spiritId);
    setBttpChallenge(prev => {
      if (!prev) return prev;
      const total  = data.chords.length;
      const passed = prev.hits >= Math.ceil(total * BTTP_PASS_RATIO);
      const lines  = [...prev.lines];
      const tally  = { ...prev.tally };
      if (data.reward === 'hc') {
        const gain = passed ? 3 : 1;
        tally.hc += gain;
        setTimeout(() => grantDB(spiritId, gain), 60);
        lines.push(passed
          ? `💫 SLOW-DANCE ANGEL — ${prev.hits}/${total} chords clean. The floor sways. +${gain} Decibills.`
          : `💫 SLOW-DANCE ANGEL — ${prev.hits}/${total} clean. Shaky, but you got through it. +${gain} Decibills.`);
      } else {
        const gain = passed ? 5 : 2;
        tally.casuals += gain;
        {
          const cur = engineRef.current.noteStates[spiritId] ?? {};
          let casuals  = Math.min(FAN_CASUAL_CAP, (cur.casuals ?? 0) + gain);
          let diehards = cur.diehards ?? FAN_DIEHARD_START;
          if (passed && casuals > 0 && diehards < FAN_DIEHARD_CAP) { casuals -= 1; diehards += 1; }
          dispatch(fansChanged(spiritId, { casuals, diehards }));
        }
        flashFanFx(spiritId, 'gain', gain);
        lines.push(passed
          ? `🦆 DUCKWALK DYNAMO — ${prev.hits}/${total} chords clean. The kids go wild! +${gain} Casuals (one hardens into a Diehard).`
          : `🦆 DUCKWALK DYNAMO — ${prev.hits}/${total} clean. A few heads turn. +${gain} Casuals.`);
      }
      return { ...prev, phase: stageKey === 'angel' ? 'stageclear' : 'done', flash: null, lines, tally };
    });
    addLog(`🎸⏰ ${sp?.name} finishes ${data.name}.`);
    if (stageKey === 'angel') {
      setTimeout(() => bttpStartStage(spiritId, 'goode'), 1600); // Stage 2 always runs
    }
  }

  // ─── 🎹🎸 Shared instrument diagram ────────────────────────────────────────
  // Renders a chord/notes on a piano or vertical fretboard. Used by BOTH the Back
  // to the Past challenge and riff-off battles. Note keys: lowercase = natural
  // (white key / open-ish fret), UPPERCASE = sharp (black key / +1 fret). `got` =
  // notes already hit (drawn green). `accent` colours the lit-but-unhit notes.
  // ── Neon palette (must match ui/RiffHighway.jsx) ──────────────────────────
  const NEON_CYAN_I    = '#19e6ff';
  const NEON_MAGENTA_I = '#ff2d95';
  const NEON_VIOLET_I  = '#8a5cff';
  const NEON_WHITE_I   = '#ffffee';
  const NEON_STR_COLS  = [NEON_CYAN_I, '#33ccff', '#6699ff', NEON_VIOLET_I, '#cc44dd', NEON_MAGENTA_I];

  function renderInstrument(view, noteKeys, gotKeys, accent) {
    const lit = new Set(noteKeys || []);
    const done = new Set(gotKeys || []);
    if (view === 'guitar') {
      const names = ['E','A','D','G','B','e'];
      const gauge = [3.2, 2.6, 2.0, 1.6, 1.2, 0.8];
      // Decorative — show melody notes at their lowest neck position, clamped
      // to 7 visible frets. Uses guitarMap.js for real pitch positions.
      const N = 6, FRETS = 7, colW = 30, fh = 24, side = 20, topPad = 20;
      const W = (N - 1) * colW + side * 2, H = topPad + FRETS * fh + 14;
      const sx = i => side + i * colW, nutY = topPad, fy = f => nutY + f * fh;
      const blips = [...lit].map(k => {
        const pos = nearestPositionForKey(k, [1, 2]);
        if (!pos) return null;
        return { k, pos: [pos[0], Math.min(pos[1], FRETS)], dn: done.has(k) };
      }).filter(Boolean);
      return (
        <svg width={W} height={H} style={{maxWidth:'100%'}}>
          <defs>
            <filter id="neonBrdBloom" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b1"/>
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b2"/>
              <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {/* string names — neon per string */}
          {names.map((nm, i) => (
            <text key={`n${i}`} x={sx(i)} y={topPad - 6} textAnchor="middle" fontSize={9} fontWeight="bold" fill={NEON_STR_COLS[i]} fontFamily="monospace">{nm}</text>
          ))}
          {/* fret inlays — violet glow */}
          {[3,5,7].filter(f => f <= FRETS).map(f => (
            <circle key={`in${f}`} cx={(sx(2) + sx(3)) / 2} cy={nutY + (f - 0.5) * fh} r={3.5}
              fill={`${NEON_VIOLET_I}55`} stroke={`${NEON_VIOLET_I}44`} strokeWidth={1}
              filter="url(#neonBrdBloom)"/>
          ))}
          {/* frets — dim cyan; nut = outline only */}
          {Array.from({ length: FRETS + 1 }).map((_, f) => (
            <line key={`f${f}`} x1={sx(0)} y1={fy(f)} x2={sx(N - 1)} y2={fy(f)}
              stroke={f === 0 ? NEON_CYAN_I : `${NEON_CYAN_I}22`}
              strokeWidth={f === 0 ? 2 : 0.8}
              filter={f === 0 ? 'url(#neonBrdBloom)' : undefined}/>
          ))}
          {/* strings — neon glow, cyan→magenta */}
          {names.map((_, i) => (
            <line key={`s${i}`} x1={sx(i)} y1={fy(0)} x2={sx(i)} y2={fy(FRETS)}
              stroke={NEON_STR_COLS[i]} strokeWidth={gauge[i] * 0.8}
              strokeLinecap="round" filter="url(#neonBrdBloom)"/>
          ))}
          {/* note blips — white-hot on done, neon outline on lit */}
          {blips.map(({ k, pos, dn }) => {
            const [s, f] = pos, cx = sx(s);
            if (f === 0) return <circle key={k} cx={cx} cy={nutY - 9} r={5}
              fill={dn ? NEON_WHITE_I : 'none'} stroke={dn ? NEON_CYAN_I : NEON_STR_COLS[s]}
              strokeWidth={1.5} filter="url(#neonBrdBloom)"/>;
            return <circle key={k} cx={cx} cy={nutY + (f - 0.5) * fh} r={7.5}
              fill={dn ? NEON_WHITE_I : `${NEON_STR_COLS[s]}44`}
              stroke={NEON_STR_COLS[s]} strokeWidth={1.5}
              filter="url(#neonBrdBloom)"/>;
          })}
        </svg>
      );
    }
    // Neon piano — transparent whites with cyan outlines, magenta-filled blacks.
    const whites = ['c','d','e','f','g','a','b'];
    const blackAfter = [0, 1, 3, 4, 5];
    const blackForSharp = { C:0, D:1, F:3, G:4, A:5 };
    const W = 26, H = 84, bw = 16, bh = 52, svgW = whites.length * W;
    return (
      <svg width={svgW} height={H} style={{maxWidth:'100%'}}>
        <defs>
          <filter id="neonPnBloom" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b1"/>
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b2"/>
            <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* white keys — transparent with cyan outline */}
        {whites.map((l, i) => {
          const isLit = lit.has(l), dn = done.has(l);
          const fill = dn ? NEON_WHITE_I : isLit ? `${NEON_CYAN_I}33` : 'transparent';
          const stroke = dn ? NEON_WHITE_I : isLit ? NEON_WHITE_I : NEON_CYAN_I;
          return <rect key={l} x={i * W + 1} y={1} width={W - 3} height={H - 2} rx={3}
            fill={fill} stroke={stroke} strokeWidth={1.5}
            filter={(isLit || dn) ? 'url(#neonPnBloom)' : undefined}/>;
        })}
        {/* black keys — filled magenta */}
        {blackAfter.map(i => {
          const sharp = Object.keys(blackForSharp).find(s => blackForSharp[s] === i);
          const isLit = sharp && lit.has(sharp), dn = sharp && done.has(sharp);
          const fill = dn ? NEON_WHITE_I : isLit ? NEON_WHITE_I : NEON_MAGENTA_I;
          return <rect key={`b${i}`} x={(i + 1) * W - bw / 2} y={0} width={bw} height={bh} rx={2}
            fill={fill} stroke={`${NEON_MAGENTA_I}cc`} strokeWidth={1}
            filter="url(#neonPnBloom)"/>;
        })}
      </svg>
    );
  }

  // ─── 🧪 TESTING GROUNDS — dev helpers ──────────────────────────────────────
  // The acting spirit (front of the turn queue, skipping any KO'd).
  function devCurrentSpiritId() {
    return turnQueue.find(id => !spiritById[id]?.knockedOut) ?? turnQueue[0];
  }
  // Fire ANY event on demand for the acting spirit — works for every entry in
  // EVENT_DECK, so new events become testable the moment you add them.
  function devFireEvent(eventId) {
    if (activeEvent || bttpChallenge) { addLog('🧪 Finish the current event before firing another.'); return; }
    const spiritId = devCurrentSpiritId();
    if (!spiritId) return;
    const ev = EVENT_BY_ID[eventId];
    addLog(`🧪 TEST → ${ev?.title} on ${spiritById[spiritId]?.name}`);
    setActiveEvent({ spiritId, eventId, phase: 'reveal', resultLines: [], rolls: null });
    setDevOpen(false);
  }
  // 🧪 Fire a stage effect from Testing Grounds — reuses the real activation
  // flow (banner, engine dispatch, cinematic logs). Threshold 0 signals "test".
  function devFireStageFx(fxId) {
    const meta = STAGE_FX_META[fxId];
    if (!meta) { addLog(`🧪 Unknown stage FX: ${fxId}`); return; }
    addLog(`🧪 TEST → ${meta.icon} ${meta.name.toUpperCase()}`);
    activateStageFx(fxId, 0);
  }
  // Quick resource grants to the acting spirit. Add a case here + a button below
  // to expose a new lever for testing.
  function devGrant(kind) {
    const id = devCurrentSpiritId(); if (!id) return;
    const nm = spiritById[id]?.name;
    if (kind === 'hc')       { grantDB(id, 3); addLog(`🧪 +3 DB → ${nm}`); }
    else if (kind === 'cas') { dispatch(fansChanged(id, { casuals: Math.min(FAN_CASUAL_CAP, (engineRef.current.noteStates[id]?.casuals ?? 0) + 5) })); flashFanFx(id, 'gain', 5); addLog(`🧪 +5 Casuals → ${nm}`); }
    else if (kind === 'die') { dispatch(fansChanged(id, { diehards: Math.min(FAN_DIEHARD_CAP, (engineRef.current.noteStates[id]?.diehards ?? FAN_DIEHARD_START) + 1) })); addLog(`🧪 +1 Diehard → ${nm}`); }
    else if (kind === 'uns') { setUnsurePool(p => p + 5); addLog('🧪 +5 to the Unsure pool'); }
    else if (kind === 'vup') { setSpirits(prev => prev.map(s => s.id === id ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s)); addLog(`🧪 +1 Vibe → ${nm}`); }
    else if (kind === 'vdn') { setSpirits(prev => prev.map(s => s.id === id ? { ...s, vibe: Math.max(0, (s.vibe ?? 0) - 1) } : s)); addLog(`🧪 −1 Vibe → ${nm}`); }
    else if (kind === 'fp')  { grantFame(id, 3, '🧪 test grant', false); }
  }

  // 🧪📼 Phase 8a — download the action log as JSON. `{seed, config} → makeInitialState`
  // plus `log` replayed through `applyAction` reproduces this exact game (the
  // engine selftest proves the byte-for-byte guarantee for engine-owned systems).
  function devExportLog() {
    const eng = engineRef.current;
    const payload = {
      schema: eng.schema,
      seed: eng.rng.seed,
      config: eng.config ?? null,
      actionCount: actionLogRef.current.length,
      log: actionLogRef.current,
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rlsw-action-log-${eng.rng.seed}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    addLog(`🧪📼 Action log exported — ${actionLogRef.current.length} actions (seed ${eng.rng.seed}).`);
  }

  // 🧪💥 Deal REAL combat damage to any spirit — routes through applyVibeDamage so
  // it exercises the full knockdown → respawn (resolveKnockdown) → KO → win
  // (decideWinner) chain the way a battle would. `amount` is a number, or 'ko' to
  // zero their current Vibe for an instant knockdown (spends one life per click).
  function devDamage(targetId, amount) {
    const t = spiritById[targetId];
    if (!t || t.knockedOut) { addLog('🧪 Nothing to hit there.'); return; }
    const dmg = amount === 'ko' ? Math.max(1, t.vibe ?? 1) : amount;
    addLog(`🧪 TEST → ${dmg} damage to ${t.name}${amount === 'ko' ? ' (instant knockdown)' : ''}.`);
    // attacker = acting spirit (drives Azrael/moshpit hooks realistically); a
    // self-hit is fine — those hooks already guard attacker !== target.
    applyVibeDamage(targetId, dmg, '🧪 test damage', devCurrentSpiritId());
  }

  // 🧪🤘 ROCK GOD test levers — summon the boss on demand (skipping the Fame
  // trigger entirely) and poke his HP to exercise the winded/kill flows.
  function devSummonGod() {
    if (engineRef.current.rockGod.summoned) { addLog('🧪 A Rock God has already been summoned this game.'); return; }
    const id = devCurrentSpiritId(); if (!id) return;
    addLog(`🧪 TEST → summoning a Rock God (keyed off ${spiritById[id]?.name}'s playstyle)…`);
    summonRockGod(id);
  }
  function devHurtGod() {
    const god = engineRef.current.rockGod.god;
    if (!god || god.hp <= 0 || engineRef.current.rockGod.outcome) { addLog('🧪 No living Rock God to hurt.'); return; }
    const id = devCurrentSpiritId(); if (!id) return;
    const def = ROCK_GODS[god.id];
    const dmg = Math.min(10, god.hp);
    addLog(`🧪 TEST → ${dmg} damage to ${def.name} (no FP granted).`);
    triggerDamageNumber(god.num, `−${dmg}`, def.color);
    // NOTE: raw damage — the engine doubles it if he's winded (same as a real hit).
    const hit = dispatch(godDamagedAction(id, dmg)).rockGod.lastHit;
    if (hit?.defeated) godDefeated(id);
  }
  function devGodAct() {
    if (!rockGodActive) { addLog('🧪 No living Rock God — summon one first.'); return; }
    addLog('🧪 TEST → forcing the Rock God to act.');
    rockGodAct();
  }

  // Unlock a signature skill (and any prereqs) for a specific spirit, applying
  // the same side-effects the skill tree would.
  function devUnlockSkill(spiritId, skillId, pre = []) {
    [...pre, skillId].forEach(id => {
      setNoteStates(prev => {
        const ns = prev[spiritId] ?? {};
        if ((ns.unlockedSkills ?? []).includes(id)) return prev;
        return { ...prev, [spiritId]: { ...ns, unlockedSkills: [...(ns.unlockedSkills ?? []), id] } };
      });
      applySkillEffects(spiritId, id);
    });
  }

  // Some signature skills have a self-contained trigger we can fire for testing.
  function devFireSignature(spiritId, skill) {
    devUnlockSkill(spiritId, skill.id, skill.pre);
  }

  // Add raw Decibills toward the spirit's current target skill.
  // Crossing the threshold awards the skill exactly like a committed track would.
  function grantDB(spiritId, amount) {
    const ns         = noteStates[spiritId] ?? {};
    const targetCost = ns.targetSkillId ? (SKILL_BY_ID[ns.targetSkillId]?.dbCost ?? DB_UPGRADE_THRESHOLD) : DB_UPGRADE_THRESHOLD;
    const { newDBPoints, upgradeTriggered } = advanceDB(ns.dbPoints ?? 0, amount, targetCost);
    setNoteStates(prev => ({
      ...prev,
      [spiritId]: {
        ...prev[spiritId],
        dbPoints: newDBPoints,
        totalDB: (prev[spiritId]?.totalDB ?? 0) + amount,
      },
    }));
    if (upgradeTriggered && ns.targetSkillId) {
      setTimeout(() => awardTargetSkill(spiritId), 80);
    }
  }


  // ─── BATTLE SYSTEM ───────────────────────────────────────────────────────────

  // Damage table (margin → Vibe damage), knockback distance, and the Fame
  // tables now live in the engine — src/engine/systems/combat.js (Phase 3a).
  // marginToDamage / fameFromMargin / knockbackSpaces / underdogBonus are
  // imported at the top of this file (single source of truth for the tables).

  // ─── 🎇 STAGE EFFECTS SYSTEM ─────────────────────────────────────────────────
  // The production escalates with the show: the FIRST time ANY Spirit crosses
  // ⭐8 / ⭐16 / ⭐24 total Fame, the next Stage Effect in this game's shuffled
  // deck fires (each threshold once per game). Effects are global board
  // spectacle/hazards — they hit everyone, bots included. Tuning lives in
  // data/stageEffects.js; geometry in board/stageFx.js.
  // (Earned-lens note: deliberately NOT a payout — a hazard tied to collective
  // fame progress. Stated trade-off per the STICs + Earned checklist.)

  // Called from grantFame with the spirit's fame before/after the grant.
  function checkStageFxThresholds(oldFame, newFame) {
    for (const t of stageFxThresholds) {
      if (oldFame < t && newFame >= t) {
        // Phase 6b — the engine records the threshold (exactly-once) and draws
        // from the SEEDED deck; a duplicate crossing reports lastDraw = null.
        const draw = dispatch(stageFxDrawn(t)).stageFx.lastDraw;
        if (draw?.threshold === t) {
          // Let the fame log land first, then hit the lights.
          setTimeout(() => activateStageFx(draw.fxId, t), 650);
        }
      }
    }
  }

  function activateStageFx(fxId, threshold) {
    const meta = STAGE_FX_META[fxId];
    if (!meta) return;
    addLog(`🎇 STAGE EFFECT — the show hits ⭐${threshold}: ${meta.icon} ${meta.name.toUpperCase()}!`);
    setStageFxBanner({ id: fxId, threshold, key: Date.now() });
    setTimeout(() => setStageFxBanner(prev => (prev?.id === fxId ? null : prev)), 5300);

    // Phase 6b — the ENGINE creates the active effect (beam patterns / pyro
    // hexes / animatronic spawns roll on its seeded rng); the client plays the
    // cinematic off the fresh slice + report. `occupied` is passed because
    // amps are still React-owned.
    // 👤 The Shadow Illusion counts as occupied: a pyro hex or animatronic
    // spawning *underneath* a standee would out it as an empty tile.
    const occupied = [...spirits.map(s => s.num), ...amps.map(a => a.hexNum),
      ...(shadowHex != null ? [shadowHex] : [])];
    const st = dispatch(stageFxActivated(fxId, occupied)).stageFx;
    if (fxId === 'smoke_machine') {
      addLog(`💨 Smoke floods the centre stage — Spirits in the cloud vanish from view! It spreads each round (${SMOKE_ROUNDS} rounds).`);
    }
    if (fxId === 'laser_show') {
      addLog(`🔺 Lasers rake the stage — crossing a beam costs ${LASER_DAMAGE} Vibe! New pattern every round (${LASER_ROUNDS} rounds).`);
      zapReportedSpirits(st.lastActivation?.zapped);
    }
    if (fxId === 'pyrotechnics') {
      addLog(`🎆 Pyro charges prime under ${st.pyro?.hexes.length ?? 0} hexes — they glow red and BLOW next turn! (${PYRO_WAVES} waves)`);
    }
    if (fxId === 'animatronics') {
      addLog(`🤖 ${st.animatronics.length} animatronics wake on the stage edge — they stalk the nearest Spirit at the end of every turn (${ANIMATRONIC_TURNS} turns)!`);
    }
  }

  // Beams appearing / re-patterning hit anyone already standing in the path.
  // The engine reports WHO (lastActivation/lastRoundTick .zapped); this plays
  // the flash and applies the damage on the same beat as before.
  function zapReportedSpirits(ids) {
    (ids ?? []).forEach((id, i) => {
      const sp = engineRef.current.spirits.find(s => s.id === id);
      setTimeout(() => {
        addLog(`🔺 ${sp?.name} is caught in a laser beam — ${LASER_DAMAGE} Vibe!`);
        triggerEffectFlash(id, '🔺', 'LASER!', '#ff2266');
        applyVibeDamage(id, LASER_DAMAGE, 'Laser Show');
      }, 500 + i * 450);
    });
  }

  // Stage-hazard entry check — called whenever a Spirit ENTERS a hex (move or
  // push), right beside checkFlamingDisc. Reads the ENGINE slice directly
  // (synchronously fresh) because pushes resolve inside setTimeout chains —
  // Phase 6b retired the stageFxHazardRef mirror.
  function checkStageFxHex(spiritId, hexNum) {
    const { laser: lf, pyro: pf, animatronics: bots } = engineRef.current.stageFx;
    const inBeam = lf && hexInBeams(hexNum, lf.beams);
    const inFlames = pf?.phase === 'erupting' && pf.hexes.includes(hexNum);
    const onBot = bots?.some(b => b.num === hexNum);
    if (!inBeam && !inFlames && !onBot) return;
    const sp = spirits.find(s => s.id === spiritId);
    // 😎 DIVINE MISSION blessing — one hazard parts around them, then it's spent.
    if (engineRef.current.noteStates?.[spiritId]?.divineShield) {
      dispatch(fansChanged(spiritId, { divineShield: 0 }));
      addLog(`🛡️ The stage hazards part around ${sp?.name} — divine blessing spent.`);
      return;
    }
    if (inBeam) {
      addLog(`🔺 ${sp?.name} crosses a laser beam on #${hexNum} — ${LASER_DAMAGE} Vibe!`);
      triggerEffectFlash(spiritId, '🔺', 'LASER!', '#ff2266');
      applyVibeDamage(spiritId, LASER_DAMAGE, 'Laser Show');
    }
    if (inFlames) {
      addLog(`🎆 ${sp?.name} steps into the pyro flames on #${hexNum} — ${PYRO_DAMAGE} Vibe + BURN!`);
      triggerEffectFlash(spiritId, '🔥', 'PYRO!', '#ff7722');
      applyVibeDamage(spiritId, PYRO_DAMAGE, 'Pyrotechnics');
      setNoteField(spiritId, { burn: { turnsLeft: PYRO_BURN_TURNS } });
    }
    if (onBot) {
      addLog(`🤖 ${sp?.name} walks into an animatronic on #${hexNum} — ${ANIMATRONIC_DAMAGE} Vibe!`);
      triggerEffectFlash(spiritId, '🤖', 'CLANG!', '#88ffcc');
      applyVibeDamage(spiritId, ANIMATRONIC_DAMAGE, 'Animatronic');
    }
  }

  // Per-TURN tick (end of every player's turn): pyro cadence + animatronic
  // steps. Phase 6b — the RULES run in the engine (STAGE_FX_TURN_TICKED, rng
  // included); this renders the report: logs, flashes, damage, burn status.
  function tickStageFxTurn() {
    const report = dispatch(stageFxTurnTicked()).stageFx.lastTurnTick;
    if (!report) return;
    const pr = report.pyro;
    // 🎆 PYRO — armed hexes blew; spent flames re-arm the next wave (finale bigger).
    if (pr?.event === 'erupted') {
      addLog(`🎆 The pyro charges BLOW — wave ${pr.wave}${pr.wave >= PYRO_WAVES ? ', the FINALE' : ''}!`);
      pr.caught.forEach((id, i) => {
        const sp = engineRef.current.spirits.find(s => s.id === id);
        setTimeout(() => {
          addLog(`🔥 ${sp?.name} is caught in the eruption — ${PYRO_DAMAGE} Vibe + BURN!`);
          triggerEffectFlash(id, '🔥', 'PYRO!', '#ff7722');
          applyVibeDamage(id, PYRO_DAMAGE, 'Pyrotechnics');
          setNoteField(id, { burn: { turnsLeft: PYRO_BURN_TURNS } });
        }, 350 + i * 450);
      });
    } else if (pr?.event === 'burnout') {
      addLog(`🎆 The pyrotechnics show burns out. The stage cools.`);
    } else if (pr?.event === 'rearmed') {
      addLog(`🎆 Fresh pyro charges prime under ${pr.hexes.length} hexes${pr.wave >= PYRO_WAVES ? ' — the FINALE' : ''}! They glow red…`);
    }
    // 🤖 ANIMATRONICS — each took one step toward the nearest Spirit (slams
    // reported), clocks ticked down, expired bots hauled offstage.
    if (report.anim) {
      report.anim.hits.forEach(({ victimId }) => {
        const victim = engineRef.current.spirits.find(sp => sp.id === victimId);
        addLog(`🤖 An animatronic slams into ${victim?.name} — ${ANIMATRONIC_DAMAGE} Vibe!`);
        triggerEffectFlash(victimId, '🤖', 'CLANG!', '#88ffcc');
        setTimeout(() => applyVibeDamage(victimId, ANIMATRONIC_DAMAGE, 'Animatronic'), 250);
      });
      for (let i = 0; i < report.anim.expired; i++) {
        addLog(`🤖 An animatronic winds down and is hauled offstage.`);
      }
    }
  }

  // Per-ROUND tick (once per full round, alongside the Disco Inferno tick):
  // smoke spreads then clears; the laser show re-patterns then powers down.
  // Phase 6b — rules in the engine (STAGE_FX_ROUND_TICKED); report rendered here.
  function tickStageFxRound() {
    const report = dispatch(stageFxRoundTicked()).stageFx.lastRoundTick;
    if (!report) return;
    if (report.smoke?.event === 'cleared') {
      addLog(`💨 The smoke finally clears — every Spirit is visible again.`);
    } else if (report.smoke?.event === 'spread') {
      addLog(`💨 The smoke rolls further out across the stage… (${report.smoke.left} round${report.smoke.left !== 1 ? 's' : ''} left)`);
    }
    if (report.laser?.event === 'off') {
      addLog(`🔺 The laser rig powers down. The stage is safe to cross.`);
    } else if (report.laser?.event === 'repatterned') {
      addLog(`🔺 The laser show re-patterns — new beams rake the stage! (${report.laser.left} round${report.laser.left !== 1 ? 's' : ''} left)`);
      zapReportedSpirits(report.laser.zapped);
    }
  }

  // 💨 Is this Spirit hidden inside the smoke cloud? (Purely visual — the acting
  // Spirit always stays visible so you can play your own turn.)
  function isHiddenBySmoke(sp) {
    return !!(smokeFx && sp && acting?.id !== sp.id && hexInSmoke(sp.num, smokeFx.radius));
  }

  // ─── 🤘 ROCK GOD SYSTEM ──────────────────────────────────────────────────────
  // The endgame boss. Reaching fameToWin with a lead < ROCK_GOD_RUNAWAY_LEAD
  // summons ONE god (picked from the leader's playstyle) to the Limelight.
  // Rules: no overlays — Drive = damage = FP (1:1, unamplified), the god acts at
  // the end of EVERY turn, big attacks telegraph one turn ahead, human turns are
  // timed, PvP is off. God falls → kill-blow bonus, FP leader crowned. Spirits
  // wiped → the God keeps the crown. Tuning: data/rockGods.js.

  function godTaunt(kind) {
    const def = ROCK_GODS[engineRef.current.rockGod.god?.id];
    const line = def ? godTauntLine(def, kind) : null;
    if (line) addLog(`${def.icon} ${line}`);
  }

  function summonRockGod(leaderId) {
    if (engineRef.current.rockGod.summoned) return;
    const leader = spirits.find(s => s.id === leaderId);
    const ns = engineRef.current.noteStates?.[leaderId] ?? {};
    // The god pick reads amps (still React-owned) — computed here, carried in
    // the GOD_SUMMONED payload; the engine owns the flag/god object and scales
    // HP off its own living-spirit count (Phase 6c).
    const godId = pickRockGod({
      unlockedSkills: ns.unlockedSkills ?? [],
      ampsOwned: amps.filter(a => a.ownerId === leaderId).length,
      livesLost: Math.max(0, (startingLives ?? 3) - (leader?.lives ?? startingLives ?? 3)),
    });
    const def = ROCK_GODS[godId];
    const alive = spirits.filter(sp => !sp.knockedOut);
    dispatch(godSummonedAction(leaderId, godId));

    // Clear the Limelight — anyone standing there is blasted to a neighbour hex.
    const squatter = alive.find(sp => sp.num === LIMELIGHT_HEX);
    if (squatter) {
      const occupied = [...spirits.map(sp => sp.num), ...amps.map(a => a.hexNum),
        ...(shadowHex != null ? [shadowHex] : [])];
      const dest = freeNeighborHex(LIMELIGHT_HEX, occupied);
      if (dest) setSpirits(prev => prev.map(sp => sp.id === squatter.id ? { ...sp, num: dest } : sp));
      addLog(`💥 ${squatter.name} is hurled off the Limelight by the shockwave — 1 Vibe!`);
      setTimeout(() => applyVibeDamage(squatter.id, 1, 'Divine Shockwave'), 300);
    }

    addLog(`🌩️🌩️🌩️ ${leader?.name} reaches ${fameToWin} Fame — but the race is TOO CLOSE. The sky splits open…`);
    addLog(`${def.icon} ${def.name.toUpperCase()} — ${def.title} — DESCENDS TO THE LIMELIGHT!`);
    addLog(`🤝 The Spirits stand united! Drive = damage = Fame. Watch the clock — ${ROCK_GOD_TIMER_SECONDS}s a turn, or face his VENGEANCE.`);
    setGodBanner({ key: Date.now() });
    setTimeout(() => setGodBanner(null), 6500);
    setTimeout(() => godTaunt('summon'), 900);
    focusOnHex(LIMELIGHT_HEX, 1600, 0.55, true);
  }

  // A Spirit strikes the God — melee (adjacent) or Sonic beam (needs Amp I,
  // facing him, ≤ beam reach). Chord Drive = damage, dealt straight, no dice.
  function attackRockGod(spiritId) {
    const god = engineRef.current.rockGod.god;
    if (!god || god.hp <= 0 || engineRef.current.rockGod.outcome || winner) return;
    const sp = spirits.find(s => s.id === spiritId);
    if (!sp || sp.knockedOut) return;
    if (actionTokenUsedRef.current) { addLog(`⚔️ ${sp.name} has already taken their shot this turn!`); return; }

    const spHex = HEX_BY_NUM[sp.num], godHex = HEX_BY_NUM[god.num];
    if (!spHex || !godHex) return;
    const adjacent = axialDist(spHex.q, spHex.r, godHex.q, godHex.r) <= 1;
    const hasAmp1  = ((engineRef.current.noteStates?.[spiritId]?.unlockedSkills) ?? []).includes('amp_1');
    const inBeam   = hasAmp1 && getSonicBeam(sp).has(god.num);
    const steps    = moveStepsLeftRef.current ?? 0;

    let cost, via;
    if (adjacent && steps >= 1)    { cost = 1; via = 'melee'; }
    else if (inBeam && steps >= 2) { cost = 2; via = 'sonic'; }
    else if (adjacent || inBeam)   { addLog(`⚡ Not enough steps left to strike the God! (melee 1 · sonic 2)`); return; }
    else { addLog(`🤘 Get in his face, or line your Sonic beam up on him!`); return; }

    const def = ROCK_GODS[god.id];
    const ns = engineRef.current.noteStates?.[spiritId] ?? {};
    const chord = ns.driveStack?.length ? spiritChord(spiritId, ns.driveStack) : null;
    const raw = (chord ? chord.drive : (sp.drive ?? 6)) + (ns.tempDrive ?? 0) + (ns.moshDrive ?? 0);
    const winded = god.winded;
    // Phase 6c — the hit lands in the ENGINE (it owns the winded ×2 + HP floor);
    // the report carries the final number for the log/FP.
    const hit = dispatch(godDamagedAction(spiritId, raw)).rockGod.lastHit;
    const dmg = hit?.dmg ?? raw;

    addLog(`${via === 'melee' ? '⚔️' : '🔊'} ${sp.name} ${via === 'melee' ? 'smashes into' : 'blasts'} ${def.name}${chord ? ` — ${chord.name} rings out (⚔️${chord.drive})` : ''}${winded ? ' — HE’S WINDED, DOUBLE DAMAGE' : ''}: ${dmg} damage!`);
    triggerDamageNumber(god.num, `−${dmg}`, def.color);
    focusOnHex(god.num, 850, 0.4, true);
    dispatch(beatsSpent(cost, true));
    grantFame(spiritId, dmg, `${def.icon} rocked ${def.name}`, false);

    if (hit?.defeated) {
      godDefeated(spiritId);
    } else {
      if (Math.random() < 0.5) setTimeout(() => godTaunt(dmg >= 9 ? 'bigHit' : 'hit'), 500);
    }
  }

  function godDefeated(killerId) {
    const def = ROCK_GODS[engineRef.current.rockGod.god?.id] ?? {};
    const killer = spirits.find(s => s.id === killerId);
    addLog(`🌩️💥 ${def.name} STAGGERS… drops to one knee… and POWERSLIDES INTO LEGEND.`);
    godTaunt('defeat');
    addLog(`⭐ ${killer?.name} lands the KILLING BLOW — +${ROCK_GOD_KILL_BLOW_FP} Fame flourish!`);
    grantFame(killerId, ROCK_GOD_KILL_BLOW_FP, 'the killing blow', false);
    dispatch(godDefeatedAction(killerId)); // Phase 6c — outcome locks in the engine
    // Crown the FP leader once the kill-blow fame settles.
    setTimeout(() => {
      const board = spirits.map(sp => ({ id: sp.id, fame: engineRef.current.noteStates?.[sp.id]?.fame ?? 0 }))
        .sort((a, b) => b.fame - a.fame);
      const champ = board[0];
      const champName = spirits.find(s => s.id === champ.id)?.name;
      addLog(`👑 The Gods are satisfied. ${champName} stands tallest at ⭐${champ.fame} — A LEGEND IS BORN!`);
      setTimeout(() => {
        dispatch(winnerDeclared(champ.id)); // N5: engine winner slice → derived `winner` renders on all clients
      }, 700);
    }, 600);
  }

  function godTriumphs() {
    if (engineRef.current.rockGod.outcome) return;
    godTaunt('victory');
    addLog(`💀 Every Spirit lies silent. The crown stays with the GODS.`);
    dispatch(godTriumphedAction()); // Phase 6c — outcome locks in the engine
  }

  // The God answers at the end of EVERY player turn: resolve an armed telegraph,
  // shake off the winded window, or open a new attack. Phase 6c — the whole
  // answer is an ENGINE rule (GOD_ACTED: the weighted pick rolls on engine rng,
  // telegraphs/winded/mosh shoves mutate engine state); this renders the report:
  // logs, flashes, damage timing, camera, hazard checks on shoved Spirits.
  function rockGodAct() {
    const rgBefore = engineRef.current.rockGod;
    if (!rgBefore.god || rgBefore.god.hp <= 0 || rgBefore.outcome || winner) return;
    const st = dispatch(godActedAction()).rockGod;
    const act = st.lastAct;
    if (!act) return;
    const god = st.god;
    const def = ROCK_GODS[god.id];
    const nameOf = id => engineRef.current.spirits.find(s => s.id === id)?.name;

    // 1) An armed telegraph RESOLVED.
    if (act.kind === 'resolved') {
      if (act.attackId === 'thunderclap') {
        addLog(`${def.icon}⚡ ${def.name} SLAMS the stage — ${act.label}!`);
        if (!act.caught.length) addLog(`💨 …and hits nothing but stage. The Spirits scattered in time!`);
        act.caught.forEach((id, i) => setTimeout(() => {
          addLog(`⚡ ${nameOf(id)} is caught in the shockwave — ${act.dmg} Vibe!`);
          triggerEffectFlash(id, '⚡', 'THUNDERCLAP!', def.color);
          applyVibeDamage(id, act.dmg, act.label);
        }, 350 + i * 400));
        focusOnHex(god.num, 1100, 0.5, true);
      } else if (act.attackId === 'power_slide') {
        addLog(`${def.icon}🛝 ${def.name} DROPS AND SLIDES — ${act.label}!`);
        if (!act.caught.length) addLog(`💨 …the line was clear. He glides to a stop, striking a pose.`);
        act.caught.forEach((id, i) => setTimeout(() => {
          addLog(`🛝 ${nameOf(id)} is bowled over — ${act.dmg} Vibe!`);
          triggerEffectFlash(id, '🛝', 'POWER SLIDE!', def.color);
          applyVibeDamage(id, act.dmg, act.label);
        }, 350 + i * 400));
        addLog(`😵 ${def.name} is WINDED from the slide — he takes DOUBLE DAMAGE until he acts again!`);
        focusOnHex(act.end, 1100, 0.5, true);
      }
      return;
    }

    // 2) Winded → he spent the beat recovering (the punish window closed).
    if (act.kind === 'recovered') {
      godTaunt('winded');
      addLog(`🤘 ${def.name} hauls himself upright. The window closes.`);
      return;
    }

    // 3) A new attack OPENED.
    if (act.kind === 'telegraph') {
      if (act.attackId === 'thunderclap') addLog(`${def.icon}⚡ ${act.warn}`);
      else addLog(`${def.icon}🛝 ${act.warn} (he's eyeing ${nameOf(act.targetId)}…)`);
    } else if (act.kind === 'melted') {
      addLog(`${def.icon}🎸 ${def.name} rips a FACE-MELTER SOLO straight at ${nameOf(act.targetId)} — ${act.dmg} Vibe!`);
      triggerEffectFlash(act.targetId, '🎸', 'FACE-MELTER!', def.color);
      setTimeout(() => applyVibeDamage(act.targetId, act.dmg, act.label), 350);
    } else if (act.kind === 'moshed') {
      addLog(`${def.icon}🌊 ${def.name} bellows "MOSH!" — the whole stage SURGES outward!`);
      act.crushed.forEach(id => setTimeout(() => {
        addLog(`🌊 ${nameOf(id)} is crushed against the crowd — ${act.dmg} Vibe!`);
        applyVibeDamage(id, act.dmg, act.label);
      }, 400));
      // Positions already moved in the engine; shoved Spirits can land in
      // stage hazards — same rule as any push.
      act.moves.forEach((mv, i) => setTimeout(() => checkStageFxHex(mv.id, mv.to), 450 + i * 120));
    }
    // (act.kind === 'fizzled' — the slide had no line; he shrugs it off silently.)
  }

  // ── ⏰ THE GOD'S CLOCK — human turns are timed while the fight is live.
  useEffect(() => {
    if (!rockGodActive || !acting || isBot(acting) || acting.knockedOut || winner) {
      setBossTimer(null);
      return;
    }
    setBossTimer(ROCK_GOD_TIMER_SECONDS);
    const iv = setInterval(() => {
      setBossTimer(prev => {
        if (prev == null) return prev;
        if (prev <= 1) { clearInterval(iv); setBossTimerExpired(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [rockGodActive, acting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expiry resolves in a FRESH render closure (endTurn reads live state).
  useEffect(() => {
    if (!bossTimerExpired) return;
    setBossTimerExpired(false);
    if (!rockGodActive || !acting || winner) return;
    dispatch(godTimerExpiredAction(acting.id)); // replay-log seam — the countdown itself stays client
    const def = ROCK_GODS[engineRef.current.rockGod.god?.id] ?? {};
    addLog(`⏰ TOO SLOW! ${def.name ?? 'The God'}'s attention snaps to ${acting.name} — VENGEANCE! ${ROCK_GOD_VENGEANCE_DMG} Vibe!`);
    triggerEffectFlash(acting.id, '⚡', 'VENGEANCE!', def.color ?? '#ffcc22');
    applyVibeDamage(acting.id, ROCK_GOD_VENGEANCE_DMG, 'Divine Vengeance');
    const punishedId = acting.id;
    setTimeout(() => {
      if (actingRef.current?.id === punishedId && !battleStateRef.current) endTurn();
    }, 700);
  }, [bossTimerExpired]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── FAME POINTS ──────────────────────────────────────────────────────────────
  // Winning a battle earns Fame. Bigger margins, bigger legend. fameFromMargin
  // (and the underdog ramp math) now live in the engine —
  // src/engine/systems/combat.js (Phase 3a); imported at the top of this file.

  // Core Fame grant — every FP in the game flows through here.
  // Hitting fameToWin triggers the Fame Legend victory.
  // ⛔ HARD PER-TURN CAP (2026-07-16 balance pass): a spirit can bank at most
  // FAME_PER_TURN_CAP FP inside one turn window (reset for everyone when any
  // new turn starts — see startNewTurnNotes). Overflow is DISCARDED. This is
  // the backstop against the compounding stack (margin FP + spotlight + rider
  // + groove, then underdog ×2.5 × crowd ×2) and applies to amplify=false
  // grants (boss damage, kill blow) too.
  // (🌟 The old SOLOIST ×1.5 all-sources Fame mult was REMOVED here — the
  // Soloist now earns extra FANS instead; see gainFans / gainFansFromDeed.)
  function grantFame(spiritId, fp, reason, amplify = true) {
    if (fp <= 0) return;
    const sp = spirits.find(s => s.id === spiritId);
    const ns = noteStates[spiritId] ?? {};
    // 🎤 Fans amplify the value of every deed (wins, riffs, cadences). The crowd
    // doesn't convert TO Fame — it multiplies the Fame you earn. Pass amplify=false
    // for non-deed awards (e.g. the future Rock Gods finale payout) to skip this.
    const assigned = (ns.assignments ?? []).length;
    const mult    = amplify ? crowdMultiplier(ns.diehards ?? FAN_DIEHARD_START, ns.casuals ?? 0, assigned) : 1;
    const uncapped = amplify ? Math.max(fp, Math.round(fp * mult)) : fp;
    // ⛔ Clamp against what this spirit already banked this turn window.
    const earnedSoFar = fameThisTurnRef.current[spiritId] ?? 0;
    const room        = Math.max(0, FAME_PER_TURN_CAP - earnedSoFar);
    const finalFp     = Math.min(uncapped, room);
    const clipped     = uncapped - finalFp;
    if (finalFp <= 0) {
      addLog(`⭐🚫 ${sp?.name} is already at the ${FAME_PER_TURN_CAP} FP turn cap — the crowd can only scream so loud${reason ? ` (${reason} lost to the noise)` : ''}.`);
      return;
    }
    fameThisTurnRef.current[spiritId] = earnedSoFar + finalFp;
    const newFame = (ns.fame ?? 0) + finalFp;
    // Phase 5c: fame write is now a semantic engine action (no-op vs the old
    // setNoteStates full-replace — finalFp>0 so applyFameChanged's floor never
    // bites here). The crowd mult / thresholds / win-check below stay client.
    dispatch(fameChanged(spiritId, finalFp));
    const crowdStr = (amplify && uncapped !== fp) ? ` (${fp} ×🎤${mult.toFixed(2)} crowd)` : '';
    const capStr   = clipped > 0 ? ` ⛔ capped at ${FAME_PER_TURN_CAP}/turn (${clipped} lost to the noise)` : '';
    addLog(`⭐ ${sp?.name} earns ${finalFp} Fame Point${finalFp !== 1 ? 's' : ''}${crowdStr}${capStr}${reason ? ` — ${reason}` : ''}! (${Math.min(newFame, fameToWin)}/${fameToWin})`);
    // 🎓 Explain FP the first time the PLAYER banks some. Firing on a bot's
    // first point would spend the tip on a moment the player wasn't part of.
    if (!sp?.cpu) showTip('fame');
    // 🎇 The show grows with the legend — Stage Effects fire at ⭐8/16/24.
    checkStageFxThresholds(ns.fame ?? 0, newFame);
    // 🐛 FIX (2026-07-16): read MY fame from the ENGINE after the dispatch above,
    // not from the client mirror. Back-to-back grants in one beat (riff-off
    // payouts, Azrael chains) left `newFame` one-plus grants stale — the runaway
    // check saw a smaller lead than reality and summoned the God into a blowout.
    const myFame = engineRef.current.noteStates?.[spiritId]?.fame ?? newFame;
    if (myFame >= fameToWin) {
      if (engineRef.current.rockGod.summoned) {
        // 🤘 A Rock God holds the gate — Fame alone can't end it now. Victory
        // flows only through the boss fight (godDefeated crowns the FP leader).
      } else {
        // 🤘 THE RULE OF THE GODS — a runaway lead is crowned outright; only a
        // genuinely close race summons a Rock God to settle it (data/rockGods.js).
        const rivalBest = Math.max(0, ...spirits.filter(s => s.id !== spiritId && !s.knockedOut)
          .map(s => engineRef.current.noteStates?.[s.id]?.fame ?? 0));
        const lead = myFame - rivalBest;
        if (lead >= ROCK_GOD_RUNAWAY_LEAD || startingLives < 3) {
          // Rock Gods only descend in games with 3+ lives (≥24 FP). Shorter games crown outright.
          addLog(`🌟🌟🌟 ${sp?.name} reaches ${fameToWin} Fame — ⭐${myFame} vs ⭐${rivalBest}, a runaway lead of ${lead}. A LEGEND IS BORN! 🌟🌟🌟`);
          setTimeout(() => {
            dispatch(winnerDeclared(spiritId)); // N5: engine winner slice → derived `winner` renders on all clients
          }, 600);
        } else {
          addLog(`⭐ ${sp?.name} hits ${fameToWin} Fame — but ⭐${myFame} vs ⭐${rivalBest} is only a ${lead}-point lead (needs ${ROCK_GOD_RUNAWAY_LEAD}). The Gods demand a FINALE.`);
          summonRockGod(spiritId);
        }
      }
    }
  }
  // 🔥 UNDERDOG / COMEBACK — fans live for a come-from-behind story. When a
  // trailing Spirit beats a rival who is AHEAD of them on Fame, the payout is
  // amplified by how big the deficit was. This doubles as the game's comeback
  // band: it only rewards punching UP (beating someone ahead of you), it scales
  // with the gap you're climbing out of, and it's capped so a single win closes
  // the gap rather than inverting it — you still have to keep performing to pass them.
  // Spirit-identity guard stays here (Game owns spirit/noteStates); the ramp
  // math delegates to the engine (src/engine/systems/combat.js, Phase 3a).
  function underdogBonus(winnerId, loserId, baseFp) {
    if (!loserId || winnerId === loserId) return { fp: baseFp, deficit: 0, mult: 1 };
    const wFame = noteStates[winnerId]?.fame ?? 0;
    const lFame = noteStates[loserId]?.fame ?? 0;
    return engineUnderdogBonus(wFame, lFame, baseFp);
  }
  function awardFame(spiritId, margin, loserId) {
    const base = fameFromMargin(margin);
    const { fp, deficit, mult } = underdogBonus(spiritId, loserId, base);
    if (deficit >= UNDERDOG_MIN_DEFICIT && fp > base) {
      const nm = spirits.find(s => s.id === spiritId)?.name;
      addLog(`🔥 UNDERDOG! ${nm} was down ${deficit} Fame — the crowd ROARS for the comeback! (${base} → ${fp}, ×${mult.toFixed(2)})`);
      triggerEffectFlash(spiritId, '🔥', 'UNDERDOG!', '#ffaa22');
      grantFame(spiritId, fp, `comeback win by ${margin}`);
    } else {
      grantFame(spiritId, base, `won by ${margin}`);
    }
    // 🎤 Battles are FP-only now — winning a crowd is earned through performance
    // and stage position (gainFans / perfExciteGain), not handed out on a win.
  }

  // ── 👑 HEADLINER RIDER — +1 FP on win-FP when you hold the title. ──
  // Applied in awardSonicFame / awardThrashFame / awardRiffFame (NOT in
  // grantFame, so riff discoveries / cadences / trivia are unaffected).
  function headlinerRider(spiritId) {
    return engineRef.current.headliner === spiritId ? 1 : 0;
  }

  // ── SONIC FAME — the primary FP engine. Margin-scaled + center-stage bonus. ──
  function awardSonicFame(spiritId, margin, loserId, centerBonus = 0) {
    const rider = headlinerRider(spiritId);
    const stageFxBonus = anyStageEffectActive() ? 1 : 0;
    const base = sonicFame(margin) + centerBonus + rider + stageFxBonus;
    const { fp, deficit, mult } = underdogBonus(spiritId, loserId, base);
    const riderTag = rider ? ' +👑' : '';
    const fxTag = stageFxBonus ? ' +🎇' : '';
    if (stageFxBonus) addLog(`🎇 The stage effects amplify the battle — +1 FP!`);
    if (deficit >= UNDERDOG_MIN_DEFICIT && fp > base) {
      const nm = spirits.find(s => s.id === spiritId)?.name;
      addLog(`🔥 UNDERDOG! ${nm} was down ${deficit} Fame — the crowd ROARS! (${base} → ${fp}, ×${mult.toFixed(2)})`);
      triggerEffectFlash(spiritId, '🔥', 'UNDERDOG!', '#ffaa22');
      grantFame(spiritId, fp, `sonic win by ${margin}${riderTag}${fxTag}`);
    } else {
      grantFame(spiritId, base, `sonic win by ${margin}${centerBonus ? ' +spotlight' : ''}${riderTag}${fxTag}`);
    }
    // 🎇 Stage FX bonus fan
    if (stageFxBonus) {
      gainFansFromDeed(spiritId, 1, '🎇 stage effects spectacle');
    }
  }

  // ── THRASH FAME — flat 1 FP. You fight to hurt, not to shine. ──
  function awardThrashFame(spiritId, loserId) {
    const rider = headlinerRider(spiritId);
    const stageFxBonus = anyStageEffectActive() ? 1 : 0;
    const base = thrashFame() + rider + stageFxBonus;
    const { fp, deficit, mult } = underdogBonus(spiritId, loserId, base);
    const riderTag = rider ? ' +👑' : '';
    const fxTag = stageFxBonus ? ' +🎇' : '';
    if (stageFxBonus) addLog(`🎇 The stage effects amplify the battle — +1 FP!`);
    if (deficit >= UNDERDOG_MIN_DEFICIT && fp > base) {
      const nm = spirits.find(s => s.id === spiritId)?.name;
      addLog(`🔥 UNDERDOG! ${nm} was down ${deficit} Fame — the crowd ROARS! (${base} → ${fp}, ×${mult.toFixed(2)})`);
      triggerEffectFlash(spiritId, '🔥', 'UNDERDOG!', '#ffaa22');
      grantFame(spiritId, fp, `thrash win${riderTag}${fxTag}`);
    } else {
      grantFame(spiritId, base, `thrash win${riderTag}${fxTag}`);
    }
    // 🎇 Stage FX bonus fan
    if (stageFxBonus) {
      gainFansFromDeed(spiritId, 1, '🎇 stage effects spectacle');
    }
  }

  // ── RIFF-OFF FAME (Phase R6) — the marquee event's dedicated FP engine. ──
  // Replaces the old awardSonicFame call in closeRiffOff. Higher floor than
  // sonic (this is the big show), style pay rewards HOW you played, and loser
  // consolation softens the dexterity gap for close duels. All numbers are
  // first-pass — tune in playtest.
  // (The old 'acoustic' tier multiplier is GONE along with the Acoustic Duel —
  // every riff-off is a plugged-in stadium duel now, so there's one rate.)
  function awardRiffFame(winnerId, loserId, battleS) {
    const round   = battleS.round ?? 1;
    const verdict = battleS;
    const margin  = verdict.margin ?? 0;
    const atkStats = verdict.atkStats ?? {};
    const defStats = verdict.defStats ?? {};
    const winStats = verdict.attackerWon ? atkStats : defStats;
    const loseStats = verdict.attackerWon ? defStats : atkStats;

    // ── Base: higher floor than sonic ──
    let base = 2 + Math.ceil(margin / 2);
    // ── Style pay: +1 per 3 perfects ──
    base += Math.floor((winStats.perfects ?? 0) / 3);
    // Round-2 flat bonus — sudden death pays extra
    if (round >= 2) base += 2;
    // ── Headliner rider ──
    const rider = headlinerRider(winnerId);
    base += rider;
    const riderTag = rider ? ' +👑' : '';
    // ── 🎇 Stage FX rider ──
    const stageFxBonus = anyStageEffectActive() ? 1 : 0;
    base += stageFxBonus;
    const fxTag = stageFxBonus ? ' +🎇' : '';
    if (stageFxBonus) addLog(`🎇 The stage effects amplify the riff-off — +1 FP!`);

    // ── Underdog ramp (applied to winner's total base) ──
    const { fp, deficit, mult } = underdogBonus(winnerId, loserId, base);
    const tierTag = round >= 2 ? ' R2' : '';
    if (deficit >= UNDERDOG_MIN_DEFICIT && fp > base) {
      const nm = spirits.find(s => s.id === winnerId)?.name;
      addLog(`🔥 UNDERDOG! ${nm} was down ${deficit} Fame — the crowd ROARS! (${base} → ${fp}, ×${mult.toFixed(2)})`);
      triggerEffectFlash(winnerId, '🔥', 'UNDERDOG!', '#ffaa22');
      grantFame(winnerId, fp, `riff-off win by ${margin}${tierTag}${riderTag}${fxTag}`);
    } else {
      grantFame(winnerId, base, `riff-off win by ${margin}${tierTag}${riderTag}${fxTag}`);
    }
    // 🎇 Stage FX bonus fan
    if (stageFxBonus) {
      gainFansFromDeed(winnerId, 1, '🎇 stage effects spectacle');
    }

    // ── Loser consolation: quality ≥ 80% → 1 FP ──
    if ((loseStats.quality ?? 0) >= 80) {
      const loserName = spirits.find(s => s.id === loserId)?.name;
      addLog(`🎵 ${loserName} played a worthy set — the crowd salutes! (+1 FP consolation)`);
      grantFame(loserId, 1, 'worthy riff-off set');
    }
  }

  // ─── 🎤 FAN ECONOMY HELPERS ───────────────────────────────────────────────
  // Grow a crowd by committing a CLEAN track in the centre rings. Recruits from
  // the Unsure pool first (fans a fallen rival left behind), then organic gain.
  function gainFans(spiritId, hexNum, clean) {
    const ring = hexRingFromCenter(hexNum);
    const inCentre   = ring === 'main' || ring === 'pit';        // hardens Diehards, recruits Unsure
    const inGainZone = inCentre || ring === 'floor';             // floor = neutral trickle
    const ns = noteStates[spiritId];
    if (!ns) return;
    // No gain if the track was discordant, you're out in the cheap seats, or you're
    // still shaken from a recent demolition. (Boredom decay is handled by position
    // in tickFans now, not here.)
    if (!clean || !inGainZone || (ns.fanLag ?? 0) > 0) return;

    // 📢 HECKLER — removed (crew system purged, AMP_DECK_DESIGN.md §6).
    if (ns.heckled) {
      // Legacy: clear stale flag from old saves, then proceed normally.
      setNoteStates(prev => ({
        ...prev, [spiritId]: { ...prev[spiritId], heckled: false },
      }));
    }

    const base = (FAN_GAIN_BY_RING[ring] ?? 0);
    // Only the spotlight (main/pit) wins over the undecided crowd left on the centre.
    const recruit = inCentre ? Math.min(unsurePool, base) : 0;
    if (recruit > 0) { setUnsurePool(p => Math.max(0, p - recruit)); triggerUnsureWin(spiritId, recruit); }
    let casuals  = Math.min(FAN_CASUAL_CAP, (ns.casuals ?? 0) + base + recruit);
    let diehards = ns.diehards ?? FAN_DIEHARD_START;
    // Sustained centre play hardens a Casual into a Diehard — neutral ground doesn't.
    let streak = ns.centerStreak ?? 0;
    let promoted = false;
    if (inCentre) {
      streak += 1;
      const promoteEvery = FAN_PROMOTE_EVERY;
      if (streak % promoteEvery === 0 && casuals > 0 && diehards < FAN_DIEHARD_CAP) {
        casuals -= 1; diehards += 1; promoted = true;
      }
    }
    dispatch(fansChanged(spiritId, { casuals, diehards, centerStreak: streak, fanActedThisTurn: inCentre }));
    flashFanFx(spiritId, 'gain', base + recruit);
    const nm = spirits.find(s => s.id === spiritId)?.name;
    const gainedStr = recruit > 0 ? `+${base} (+${recruit} won over)` : `+${base}`;
    const where = ring === 'main' ? 'the Mainstage' : ring === 'pit' ? 'the Pit' : 'the neutral floor';
    addLog(`🎤 ${nm} works ${where} — casuals ${gainedStr} → ♥${diehards}·👥${casuals} (×${crowdMultiplier(diehards, casuals, (noteStates[spiritId]?.assignments ?? []).length).toFixed(2)})`);
    if (promoted) addLog(`🎤 A casual hardens into a Diehard for ${nm}! (${diehards}♥)`);
  }

  // Fire a transient reaction at a Spirit's home corner: a rising gain burst or a scatter.
  function flashFanFx(spiritId, kind, n) {
    if (!n || n <= 0) return;
    if (kind === 'gain') playFanPop(n);   // 🎆 pop! — make new arrivals impossible to miss
    const key = `${spiritId}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setFanFx(prev => ({ ...prev, [spiritId]: { kind, n, key } }));
    setTimeout(() => setFanFx(prev => (prev[spiritId]?.key === key ? { ...prev, [spiritId]: null } : prev)), 1300);
  }

  // ❓ The Unsure crowd is won over: they cheer (excited + recolour) and stream home to the Spirit.
  function triggerUnsureWin(spiritId, n) {
    if (!n || n <= 0) return;
    const sp = spirits.find(s => s.id === spiritId);
    const color = sp ? (sp.corner ? (CORNER_LABELS[sp.corner]?.color ?? sp.color) : sp.color) : '#9a86c0';
    const key = `uns-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setUnsureFx({ key, spiritId, n, color });
    setTimeout(() => setUnsureFx(prev => (prev?.key === key ? null : prev)), 1800);
  }

  // End-of-turn fan tick — boredom is now POSITIONAL: fans only drift off after a
  // spirit has lingered in the outer ring for FAN_BORED_AFTER turns in a row. The
  // inner zones (and the neutral floor) keep the crowd; only the centre keeps the
  // hardening streak alive.
  function tickFans(spiritId) {
    // Phase 5d — the boredom/lag rule LIVES IN THE ENGINE now (applyFansTicked);
    // it derives the zone from its own spirit position (the old hexNum arg is
    // retired — it was always the same position). The client dispatches at the
    // same end-of-turn beat as before and renders the report.
    const report = dispatch(fansTicked(spiritId)).turn.lastFanTick;
    if (report?.spiritId === spiritId && report.lost > 0) {
      const nm = spirits.find(s => s.id === spiritId)?.name;
      addLog(`💤 ${nm} has been out in the cheap seats too long — ${report.lost} casual fan${report.lost !== 1 ? 's' : ''} drift off.`);
      flashFanFx(spiritId, 'scatter', report.lost);
    }
  }

  // Demolition — a public beating in the centre scatters the crowd.
  function demolishFans(targetId, attackerId, hexNum) {
    const ring = hexRingFromCenter(hexNum);
    if (ring !== 'main' && ring !== 'pit') return; // only humiliations in the spotlight count
    const ns = noteStates[targetId];
    if (!ns) return;
    // 😎 DIVINE MISSION blessing — shrug off this demolition, then the blessing is spent.
    if (ns.divineShield) {
      dispatch(fansChanged(targetId, { divineShield: 0 }));
      const blessed = spirits.find(s => s.id === targetId)?.name;
      addLog(`🛡️ ${blessed} is on a mission from God — the demolition just bounces off. Blessing spent.`);
      flashFanFx(targetId, 'gain', 0);
      return;
    }
    let diehards = ns.diehards ?? FAN_DIEHARD_START;
    let casuals  = ns.casuals ?? 0;
    // Assigned Diehards are safe backstage — only unassigned ones can be shaken
    // (CREW_SYSTEM_DESIGN.md §2: "Knockdown fan-flee and Demolition's Diehard
    // shake only touch the crowd, never assigned fans").
    const assignedCount = (ns.assignments ?? []).length;
    const unassignedDiehards = Math.max(0, diehards - assignedCount);
    // Shake up to 2 *unassigned* Diehards down into Casuals — their faith wavers.
    const shaken = Math.min(2, unassignedDiehards);
    diehards -= shaken; casuals += shaken;
    // 7–10 Casuals flee.
    const flee = Math.min(casuals, FAN_FLEE_MIN + Math.floor(Math.random() * (FAN_FLEE_MAX - FAN_FLEE_MIN + 1)));
    casuals -= flee;
    // Some defect straight to the demolisher; the rest pool as Unsure on the centre.
    const toVictor = (attackerId && attackerId !== targetId) ? Math.min(FAN_DEFECT_TO_VICTOR, flee) : 0;
    const toUnsure = flee - toVictor;
    dispatch(fansChanged(targetId, { diehards, casuals, centerStreak: 0, fanLag: FAN_RECOVERY_LAG }));
    {
      const atkNs = engineRef.current.noteStates[attackerId];
      if (toVictor > 0 && atkNs) {
        dispatch(fansChanged(attackerId, { casuals: Math.min(FAN_CASUAL_CAP, (atkNs.casuals ?? 0) + toVictor) }));
      }
    }
    if (toUnsure > 0) setUnsurePool(p => p + toUnsure);
    const tgtName = spirits.find(s => s.id === targetId)?.name;
    addLog(`💔 ${tgtName} is humiliated centre-stage! ${flee} fans bail (${shaken}♥ shaken) — ${toUnsure} go Unsure${toVictor ? `, ${toVictor} defect to the victor` : ''}.`);
    flashFanFx(targetId, 'scatter', flee);
    // 🎥 swing the camera to the humiliated act's home crowd as it bleeds fans
    const tgtHomeNum = CORNERS[spirits.find(s => s.id === targetId)?.corner]?.homeNum;
    if (tgtHomeNum != null) focusOnHex(tgtHomeNum, 1300, 0.55);
    if (toVictor > 0) flashFanFx(attackerId, 'gain', toVictor);
  }

  // 🎤 A crowd-worthy DEED (a resolved cadence, a landed riff, etc. — anything
  // melodic/expressive, never a battle win) wins fans — scaled by the deed's
  // own weight, with a bonus for doing it in the centre where the whole arena
  // is watching. Also reasserts you: clears demolition lag and, in the centre,
  // builds toward hardening a Diehard. Battles no longer route through here —
  // see the note in awardFame().
  function gainFansFromDeed(spiritId, baseAmount, label) {
    const spirit = spirits.find(s => s.id === spiritId);
    if (!spirit || baseAmount <= 0) return;
    const ring = hexRingFromCenter(spirit.num);
    const inCentre = ring === 'main' || ring === 'pit';
    const centreBonus = ring === 'main' ? 2 : ring === 'pit' ? 1 : ring === 'floor' ? 1 : 0;
    const deedNs = engineRef.current.noteStates[spiritId];
    const gain = baseAmount + centreBonus;
    {
      const ns = deedNs;
      if (ns) {
        let casuals  = Math.min(FAN_CASUAL_CAP, (ns.casuals ?? 0) + gain);
        let diehards = ns.diehards ?? FAN_DIEHARD_START;
        let streak   = ns.centerStreak ?? 0;
        let promoted = false;
        if (inCentre) {
          streak += 1;
          const promoteEvery = FAN_PROMOTE_EVERY;
          if (streak % promoteEvery === 0 && casuals > 0 && diehards < FAN_DIEHARD_CAP) {
            casuals -= 1; diehards += 1; promoted = true;
          }
        }
        if (promoted) setTimeout(() => addLog(`🎤 A casual hardens into a Diehard for ${spirit.name}! (${diehards}♥)`), 0);
        dispatch(fansChanged(spiritId, { casuals, diehards, centerStreak: streak, fanActedThisTurn: true, fanLag: 0 }));
      }
    }
    const where = ring === 'main' ? ' on the Mainstage' : ring === 'pit' ? ' in the Pit' : ring === 'floor' ? ' on the floor' : '';
    addLog(`🎤 ${spirit.name} wins the crowd${where}${label ? ` — ${label}` : ''} — +${gain} casual fan${gain !== 1 ? 's' : ''}!`);
    flashFanFx(spiritId, 'gain', gain);
  }

  // Total committed crowd across the arena — the gauge that will summon the
  // Rock Gods finale once that boss layer is built. (No trigger wired yet.)
  function arenaFans() {
    return Object.values(noteStates).reduce((sum, ns) =>
      sum + (ns?.diehards ?? 0) + (ns?.casuals ?? 0), unsurePool);
  }

  // ─── BATTLE KNOCKBACK ─────────────────────────────────────────────────────────
  // The loser is sent skidding away from the winner, one hex at a time
  // (animated steps). Stops early at occupied hexes or the stage edge.
  // Swing defeats: 1 hex. Sonic defeats: margin 1-2 = 1, 3-4 = 2, 5+ = 3.
  // knockbackSpaces now lives in the engine — src/engine/systems/combat.js
  // (Phase 3a); imported at the top of this file.
  function battleKnockback(fromId, targetId, spaces) {
    const fromSp = spirits.find(s => s.id === fromId);
    const target = spirits.find(s => s.id === targetId);
    if (!fromSp || !target || target.knockedOut || spaces <= 0) return;
    // 6️⃣ BERSERK — the Beast does not get moved. He comes at you.
    if (noteStates[targetId]?.berserk) {
      addLog(`6️⃣ ${target.name} doesn't move an inch — the Beast eats the hit and keeps coming.`);
      triggerRumble(targetId);
      return;
    }
    // 🌀 ROLLS HARD — Intergalactic 0 plants like a boulder: shrug off 1 hex of any shove.
    // Still pushable (and edge-able) on a committed hit — just sturdier. A floor of
    // 1 hex always lands, otherwise he'd be immune to Thrash's flat 1-hex push and
    // could squat the center untouchable.
    if (targetId === 'intergalactic_0') {
      if (spaces > 1) {
        spaces -= 1;
        addLog(`🌀 ${target.name} Rolls Hard — he digs in and eats a hex of the shove.`);
      } else {
        addLog(`🌀 ${target.name} Rolls Hard — he gives up the one hex and not an inch more.`);
      }
    }
    const fromHex = HEX_BY_NUM[fromSp.num];
    const tgtHex  = HEX_BY_NUM[target.num];
    if (!fromHex || !tgtHex) return;
    const angle = fromSp.num === target.num ? (fromSp.facing ?? 0) : angleTo(fromHex, tgtHex);
    addLog(`💢 ${target.name} is KNOCKED BACK ${spaces} hex${spaces !== 1 ? 'es' : ''}!`);
    triggerRumble(targetId);
    let curNum = target.num;
    let step = 0;
    const stepOnce = () => {
      const curHex = HEX_BY_NUM[curNum];
      if (!curHex) return;
      const nextHex = neighborInDirection(curHex, angle);
      if (!nextHex) {
        addLog(`💥 ${target.name} slams into the edge of the stage at #${curNum}!`);
        return;
      }
      const occupied = spirits.some(s => !s.knockedOut && s.id !== targetId && s.num === nextHex.num)
                    || amps.some(a => a.hexNum === nextHex.num);
      if (occupied) {
        addLog(`💥 ${target.name} crashes to a stop at #${curNum}!`);
        return;
      }
      const fromNum = curNum;
      let aborted = false;
      // Fresh-state guard: if the target was KO'd, respawned, or relocated since
      // the previous step (e.g. the battle damage just knocked them down), abort
      // the slide instead of dragging their respawned standee across the board.
      setSpirits(prev => {
        const t = prev.find(s => s.id === targetId);
        if (!t || t.knockedOut || (t.vibe ?? 0) <= 0 || t.num !== fromNum) {
          aborted = true;
          return prev;
        }
        return prev.map(s => s.id === targetId ? { ...s, num: nextHex.num } : s);
      });
      curNum = nextHex.num;
      step++;
      setTimeout(() => {
        if (aborted) return;
        if (fromNum === LIMELIGHT_HEX) {
          setPosing(prev => ({ ...prev, [targetId]: false }));
          addLog(`🎤 ${target.name} knocked off the Limelight!`);
        }
        if (nextHex.edge) addLog(`⚠️ ${target.name} skids onto the EDGE — #${nextHex.num}!`);
        checkPoisonSlime(targetId, nextHex.num);
        checkFlamingDisc(targetId, nextHex.num);
        checkStageFxHex(targetId, nextHex.num);
        if (step < spaces) stepOnce();
      }, 240);
    };
    setTimeout(stepOnce, 180);
  }

  // Roll a d12
  function rollD12() { return Math.floor(Math.random() * 12) + 1; }

  // 🌀 Per-spirit chord read — evaluateChord plus a spirit's innate harmony tweaks. Use this
  // (not raw evaluateChord) anywhere combat or the HUD reads a spirit's Drive/Sustain.
  // INTERGALACTIC 0 — "Rolls Hard": +1 Sustain on every voicing. "Freestyle": a tone cluster
  // (pure chaos) drives 7→8, so even a random string of notes hits dangerously hard (8/2).
  function spiritChord(spiritId, notes) {
    const ch = evaluateChord(notes);
    if (spiritId === 'intergalactic_0') {
      return {
        ...ch,
        drive:   ch.id === 'cluster' ? ch.drive + 1 : ch.drive,
        sustain: ch.sustain + 1,
      };
    }
    return ch;
  }

  // ⚡ Dissonance Edge — REMOVED. Returns zero mods for backward compat.
  function edgeCombatMods() {
    return { drive: 0, sustainPenalty: 0 };
  }

  // Returns hex nums in the forward attack cone of a spirit
  // Cone = forward hex + 2 diagonal-forward hexes (120° arc)
  function getSwingCone(spirit) {
    const hex = HEX_BY_NUM[spirit.num];
    if (!hex) return new Set();
    const neighbors = getFlatTopNeighborSlots(hex);
    const cone = new Set();
    neighbors.forEach(nb => {
      const angle = angleTo(hex, nb);
      const diff  = angleDiff(angle, spirit.facing ?? 0);
      if (diff <= Math.PI / 2.2) cone.add(nb.num); // ~80° half-arc = forward 3 hexes
    });
    return cone;
  }

  // Returns rival spirits in the attacker's swing cone
  function getRivalsInCone(attacker) {
    const cone = getSwingCone(attacker);
    return spirits.filter(s =>
      !s.knockedOut &&
      s.id !== attacker.id &&
      cone.has(s.num)
    );
  }

  // Returns hex nums in the Sonic Attack beam.
  // STRAIGHT LINE ONLY: exactly the 3 hexes directly in front of the spirit,
  // stepping along the facing axis. No cone, no splash — aim with your facing.
  function getSonicBeam(spirit) {
    const originHex = HEX_BY_NUM[spirit.num];
    if (!originHex) return new Set();
    // Lock in the axial step from the first forward neighbour, then repeat it —
    // this guarantees a perfectly straight line (no staircase drift)
    const first = neighborInDirection(originHex, spirit.facing ?? 0);
    if (!first) return new Set();
    const dq = first.q - originHex.q;
    const dr = first.r - originHex.r;
    // ☀️ SUNBEAM (Intergalactic 0, Amp-3 capstone) — the beam reaches +2 hexes farther.
    const hasSunbeam = spirit.id === 'intergalactic_0'
      && ((noteStates[spirit.id]?.unlockedSkills) ?? []).includes('sunbeam');
    const reach = hasSunbeam ? 5 : 3;
    const beam = new Set();
    let q = originHex.q, r = originHex.r;
    for (let depth = 0; depth < reach; depth++) {
      q += dq; r += dr;
      const hex = HEX_BY_QR[`${q},${r}`];
      if (!hex) break; // beam runs off the edge of the stage
      beam.add(hex.num);
    }
    return beam;
  }

  // Returns rivals in the sonic beam
  function getRivalsInBeam(attacker) {
    const beam = getSonicBeam(attacker);
    return spirits.filter(s =>
      !s.knockedOut &&
      s.id !== attacker.id &&
      beam.has(s.num)
    );
  }

  // Apply damage to a spirit — handles KD/KO.
  // attackerId (optional): the Spirit credited with this hit. Drives Azrael's
  // knockdown-streak Fame for Metalness Monster.
  function applyVibeDamage(targetId, dmg, sourceLabel, attackerId) {
    // 👤 Ronin being attacked dismisses shadow
    if (targetId === 'cosmic_ronin' && dmg > 0) dismissShadowIllusion('the Ronin was attacked');
    // 💥 Dramatise the hit: float a red number, shake the victim, push the camera in.
    if (dmg > 0) {
      const tgtNow = spirits.find(s => s.id === targetId);
      if (tgtNow) {
        triggerDamageNumber(tgtNow.num, `−${dmg} ❤️`, '#ff4455');
        focusOnHex(tgtNow.num, 950, 0.42, true);   // rumble fires as the push-in settles
      }
    }
    // Phase 5c slice 2a: the Vibe subtraction is now a semantic engine action.
    // Behavioral no-op vs the old setSpirits full-replace — applyDamageApplied
    // does the identical max(0, vibe−dmg) floor on the engine spirits (now the
    // source of truth). The knockdown check below reads the freshly-reduced
    // engine spirits (engineRef is updated synchronously by dispatch).
    dispatch(damageApplied(targetId, dmg));
    // Check for knock-down after state settles
    setTimeout(() => {
      // Phase 5c slice 2b: read the freshly-reduced engine spirits directly
      // (this was `setSpirits(prev => …)` used purely as a synchronous reader —
      // `prev` was always `engineRef.current.spirits`). The respawn transform now
      // dispatches KNOCKDOWN_RESOLVED (same resolveKnockdown kernel) instead of a
      // setSpirits full-replace; no-KD / KO paths just bail (the old self-write of
      // an unchanged array was a harmless no-op).
      const tgt = engineRef.current.spirits.find(s => s.id === targetId);
      if (!tgt || tgt.vibe > 0) return;
      // Vibe is 0 — KD
      const newLives = (tgt.lives ?? 1) - 1;
      addLog(`💥 ${tgt.name} is KNOCKED DOWN! (${newLives} life${newLives !== 1 ? 's' : ''} left)`);
      showTip('knockdown');

      // 🎤 FAN ECONOMY — a knockdown in the spotlight scatters the crowd. tgt.num
      // is still the hex they fell on (respawn moves them after this).
      setTimeout(() => demolishFans(targetId, attackerId, tgt.num), 0);

      // 6️⃣ BERSERK ends here, either way round:
      //   · the Monster put someone on the floor — the charge landed, glory, done
      //   · the Monster IS the one on the floor — the cannons won
      // Deferred a beat so it lands after the knockdown log, not before it.
      if (attackerId && attackerId !== targetId && noteStates[attackerId]?.berserk) {
        setTimeout(() => endBerserk(attackerId, `${tgt.name} went down — the charge landed`), 140);
      }
      // Immediate, not deferred: respawn restores full Vibe a beat later, and if
      // that lands first the heal-watcher below would claim this ending with the
      // wrong line ("the danger passed"). The cannons get the credit they're due.
      if (noteStates[targetId]?.berserk) {
        endBerserk(targetId, 'he charged the cannons and the cannons won');
      }

      // 💀 AZRAEL — credit the attacker's knockdown streak (Metalness only).
      // A rival going down feeds Metalness Fame equal to his running streak.
      if (attackerId && attackerId !== targetId) {
        setTimeout(() => {
          setNoteStates(nsPrev => {
            const atkNs = nsPrev[attackerId] ?? {};
            if (!(atkNs.unlockedSkills ?? []).includes('azrael')) return nsPrev;
            const newStreak = (atkNs.knockStreak ?? 0) + 1;
            const atkName = spirits.find(s => s.id === attackerId)?.name;
            // Grant Fame + log AFTER this updater settles (grantFame also setstates)
            setTimeout(() => {
              addLog(`💀 AZRAEL — ${atkName} feeds on the fallen! Knockdown streak ${newStreak} → +${newStreak} FP.`);
              triggerEffectFlash(attackerId, '💀', `AZRAEL ×${newStreak}`, '#ff2244');
              grantFame(attackerId, newStreak, `Azrael streak ${newStreak}`);
            }, 0);
            return { ...nsPrev, [attackerId]: { ...atkNs, knockStreak: newStreak } };
          });
        }, 120);
      }

      if (newLives <= 0) {
        // True KO
        setTimeout(() => knockOut(targetId, null, undefined), 200);
        return;
      }
      // Respawn at corner with full Vibe — position/facing/vibe via the engine
      // KNOCKDOWN_RESOLVED action (runs the resolveKnockdown kernel — Phase 5c).
      // Knock Down penalty: lose 1 FP (never below 0). The Spirit gets straight
      // back up in their home corner with full Vibe — no turn is skipped.
      // 💀 AZRAEL — if MetalNess himself is downed, his streak resets to zero.
      dispatch(fameChanged(targetId, -1)); // Knock Down penalty: −1 FP (engine floors at 0)
      setNoteStates(nsPrev => {
        const ns = nsPrev[targetId] ?? {};
        return { ...nsPrev, [targetId]: {
          ...ns,
          recovering: false,
          knockStreak: 0,
        }};
      });
      addLog(`💸 ${tgt.name} loses 1 FP and gets straight back up in their home corner!`);
      // Flash respawn
      setRespawnFlashes(rf => ({ ...rf, [targetId]: true }));
      setTimeout(() => setRespawnFlashes(rf => ({ ...rf, [targetId]: false })), 1200);
      dispatch(knockdownResolved(targetId));
    }, 80);
  }

  // Battle WIN damage — simplified after Master of Moshpits rework (no longer
  // a battle-win trigger). attackerId threaded for Azrael knockdown credit.
  function resolveWinDamage(winnerId, loserId, baseDmg, sourceLabel) {
    applyVibeDamage(loserId, baseDmg, sourceLabel, winnerId);
  }

  // Flood the board around a battered rival with moshing fans for a few seconds.
  function triggerMoshpit(loserId) {
    const loser = engineRef.current.spirits.find(s => s.id === loserId);
    if (!loser || loser.knockedOut || (loser.vibe ?? 0) <= 0) return; // nobody left to rock
    const key = Date.now();
    setMoshpitTargets(m => ({ ...m, [loserId]: key }));
    addLog(`🎸🤘 The moshpit floods the stage and ROCKS ${loser.name} where they stand!`);
    triggerRumble(loserId);
    setTimeout(() => {
      setMoshpitTargets(m => {
        if (m[loserId] !== key) return m; // a newer mob superseded this one
        const next = { ...m }; delete next[loserId]; return next;
      });
    }, 2800);
  }

  // Push defender 1 hex in the attacker's facing direction
  function pushDefender(attackerId, defenderId) {
    const attacker = spirits.find(s => s.id === attackerId);
    const defender = spirits.find(s => s.id === defenderId);
    if (!attacker || !defender) return;
    const defHex = HEX_BY_NUM[defender.num];
    if (!defHex) return;
    // 6️⃣ BERSERK — same rule as knockback: the Beast holds its ground.
    if (noteStates[defenderId]?.berserk) {
      addLog(`6️⃣ ${defender.name} plants — the Beast will not be pushed.`);
      return;
    }
    // Find neighbor in the direction the attacker is facing
    const pushHex = neighborInDirection(defHex, attacker.facing ?? 0);
    if (!pushHex) return;
    // Can't push onto an occupied hex or off the map
    const occupied = spirits.some(s => !s.knockedOut && s.id !== defenderId && s.num === pushHex.num)
                  || amps.some(a => a.hexNum === pushHex.num);
    if (occupied) {
      addLog(`💢 No room to push — ${defender.name} holds position!`);
      return;
    }
    setSpirits(prev => prev.map(s =>
      s.id !== defenderId ? s : { ...s, num: pushHex.num }
    ));
    addLog(`💢 ${defender.name} pushed to hex #${pushHex.num}!${pushHex.edge ? ' ⚠️ EDGE!' : ''}`);
    // 🧪 Pushed into poison slime?
    setTimeout(() => checkPoisonSlime(defenderId, pushHex.num), 60);
    // Pushed into the Disco Inferno?
    setTimeout(() => checkFlamingDisc(defenderId, pushHex.num), 100);
    // 🎇 …or into a stage hazard?
    setTimeout(() => checkStageFxHex(defenderId, pushHex.num), 130);
    // Clear pose if pushed off limelight
    if (defender.num === LIMELIGHT_HEX && pushHex.num !== LIMELIGHT_HEX) {
      setPosing(prev => ({ ...prev, [defenderId]: false }));
      addLog(`🎤 ${defender.name} knocked off the Limelight!`);
    }
  }

  // ── 🔪 HIT FROM BEHIND? ───────────────────────────────────────────────────
  // Reads the angle from the DEFENDER to the ATTACKER against the defender's
  // own facing. Everything past REAR_ARC (120° off) is the unguarded wedge.
  // Both spirits must be on the board for this to mean anything; a missing hex
  // degrades to "not behind", which is the safe answer (no free bonus).
  function isHitFromBehind(attacker, defender) {
    if (!attacker || !defender) return false;
    const defHex = HEX_BY_NUM[defender.num];
    const atkHex = HEX_BY_NUM[attacker.num];
    if (!defHex || !atkHex || defHex.num === atkHex.num) return false;
    return isRearHit(defender.facing ?? 0, angleTo(defHex, atkHex), angleDiff);
  }

  // ── 🛡️ CHORD FRAY (post-roll) ─────────────────────────────────────────────
  // The defender's chord frays only when the hit actually LANDS, and the wound
  // scales with the margin: 1 note on a graze (margin ≤ 2), 2 on a big hit
  // (margin ≥ 3) — see chordFrayAmount. A blow from the defender's REAR WEDGE
  // strips one more: they never got their guard around. Floored at 1 note
  // remaining — you're never bled to nothing, backstab or not.
  // Returns { frayed, destroyed, destroyedDrive, fromBehind }:
  //   destroyed      — the voicing was reduced below 2 notes
  //   destroyedDrive — the pre-fray chord's Drive
  function applyChordFray(targetId, margin, fromBehind = false) {
    const none = { frayed: 0, destroyed: false, destroyedDrive: 0, fromBehind: false };
    const defender = spirits.find(s => s.id === targetId);
    const nsD = noteStates[targetId] ?? {};
    const stack = nsD.sustainStack ?? [];
    if (stack.length <= 1 || posing[targetId]) return none;
    const defChord = spiritChord(targetId, stack);
    const amount = chordFrayAmount(margin, fromBehind);
    if (amount <= 0) {
      return none;
    }
    const fray = Math.min(amount, stack.length - 1); // floor: 1 note survives
    const frayedNotes = stack.slice(0, stack.length - fray);
    const lostNotes   = stack.slice(stack.length - fray); // the notes knocked loose
    const frayed = spiritChord(targetId, frayedNotes);
    setNoteField(targetId, { sustainStack: frayedNotes });
    // 🎵 A Spirit that got HIT visibly loses Sustain notes off its stack —
    // the glyphs scatter off the standee and disappear.
    showSpentNotes(targetId, lostNotes, 'sustain');
    if (fromBehind) addLog(`🔪 FROM BEHIND! ${defender?.name} never saw it coming — the guard never came up (−${REAR_FRAY_BONUS} extra Sustain note).`);
    addLog(`🛡️ ${defender?.name}'s chord frays under the blow — ${defChord.name} → ${frayed.name} (🛡️${frayed.sustain}, −${fray} note${fray !== 1 ? 's' : ''})`);
    return {
      frayed: fray,
      destroyed: stack.length >= 2 && frayedNotes.length <= 1,
      destroyedDrive: defChord.drive,
      fromBehind,
    };
  }

  // Main entry point — attacker initiates a Swing against target
  // Cinematic sequence:
  // enter_attacker → flash_drive → pick_drive_slide →
  // enter_defender → flash_sustain → pick_sustain_slide →
  // atk_die_spin → [click] → pick_atk_slide →
  // def_die_spin → [click] → pick_def_slide → result
  function initiateSwing(targetId) {
    if (!acting) return;
    if (rockGodActive) { addLog(`🤘 The Spirits stand UNITED — take it to the God!`); return; }
    if (actionTokenUsed) { addLog('⚔️ Already used your Action Token this turn!'); return; }
    const attacker = spirits.find(s => s.id === acting.id);
    const defender = spirits.find(s => s.id === targetId);
    if (!attacker || !defender) return;

    if (moveStepsLeft < 1) {
      addLog(`⚔️ Not enough Action Points — Swing costs 1 AP. Move steps left: ${moveStepsLeft}`);
      return;
    }

    // 👤 Ronin attacking dismisses shadow
    if (acting.id === 'cosmic_ronin') dismissShadowIllusion('the Ronin attacked');

    // 🥊 The jab: cheap (1 AP) and chord-driven, but still your one Action this turn.
    dispatch(beatsSpent(1, true));
    setAction(null);

    const nsA = noteStates[attacker.id] ?? {};
    const nsD = noteStates[targetId]    ?? {};

    // ── Stage Effects / skill mods ────────────────────────────────────────────
    const skillMods = getBattleSkillMods(attacker.id, targetId);
    if (skillMods.laserActive)  addLog(`🔴 Laser Show fires! Defender's die will be halved.`);
    if (skillMods.fogActive)    addLog(`🌫️ Fog Machine fires! Defender -1 Drive, -1 Sustain this battle.`);
    if (skillMods.pyroBonus > 0)addLog(`🔥 Pyrotechnics! +${skillMods.pyroBonus} bonus added to Drive roll.`);

    // 🎸 Harmony → combat: Drive from driveStack, Sustain from sustainStack
    // (falls back to the static spirit stat until a stack has been played).
    const atkChord = (nsA.driveStack?.length) ? spiritChord(attacker.id, nsA.driveStack) : null;
    const defChord = (nsD.sustainStack?.length) ? spiritChord(targetId, nsD.sustainStack) : null;
    const atkChordDrive   = atkChord ? atkChord.drive   : (attacker.drive ?? 6);
    let   defChordSustain = defChord ? defChord.sustain : (defender.sustain ?? 5);
    // 💥 SMASH EXPOSURE — a Smashed rival is wide open: this blow ignores their Sustain, then clears.
    if (nsD.smashExposed) { defChordSustain = 0; setNoteField(targetId, { smashExposed: false }); addLog(`💥 ${defender.name} is Exposed — the hit lands clean!`); }
    if (atkChord) addLog(`🎸 ${attacker.name}'s chord: ${atkChord.name} (⚔️${atkChord.drive})${defChord ? ` vs ${defender.name}'s ${defChord.name} (🛡️${defChord.sustain})` : ''}`);
    // 🛡️ Chord fray moved POST-ROLL (Stance rework): the defender's chord frays
    // only when the hit actually lands — see the fray step after the verdict.

    // 6️⃣ BERSERK rides on the BASE, deliberately outside ATK_BONUS_CAP — the
    // Beast is only ever out when the Monster is one hit from the floor, so it
    // gets to break the ceiling the ordinary buff tower lives under.
    const atkBerserk = nsA.berserk ? BEAST_DRIVE : 0;
    if (atkBerserk) { addLog(`6️⃣ THE BEAST IS LOOSE — +${BEAST_DRIVE} Drive, no ceiling.`); beastAttackToll(attacker.id); }
    const atkBase  = atkChordDrive + (nsA.instrumentDropped ? -1 : 0) + skillMods.pyroBonus + atkBerserk;
    const atkEdge  = edgeCombatMods(nsA);
    const defEdge   = edgeCombatMods(nsD);
    // ⚖️ Stacked bonuses cap at ATK_BONUS_CAP — no single turn should assemble
    // a +6-and-up tower on top of the chord (balance audit, 2026-07-16).
    // 🤘 moshDrive rides in here too: it's a standing buff, but it still has to
    // live under the same ceiling as everything else.
    const rawAtkBonus = (nsA.tempDrive ?? 0) + (nsA.moshDrive ?? 0) + atkEdge.drive;
    const atkBonus = Math.min(rawAtkBonus, ATK_BONUS_CAP);
    if (rawAtkBonus > atkBonus) addLog(`⚖️ The rig can only take so much — attack bonus capped at +${ATK_BONUS_CAP} (was +${rawAtkBonus}).`);
    const atkStat  = atkBase + atkBonus;
    const defBase  = defChordSustain - (skillMods.fogActive ? 1 : 0) - (nsD.swingExposed ? 1 : 0);
    const defBonus = (nsD.tempSustain ?? 0) - defEdge.sustainPenalty;
    const defStat  = defBase + defBonus;
    const defenderPosing = posing[targetId];

    // ⚡ CHARGE ZONE charges — attacks only. Ceiling grows the Thrash die
    // d4→d6; floor clamps every result to at least 1+CHARGE_FLOOR_BONUS. The
    // dormant dieFloorBoost (octave resolution / Spinal Tap) finally wires in
    // here too — strongest floor wins, they don't stack.
    const chargeFloorA = (nsA.chargeFloorTurns ?? 0) > 0;
    const chargeCeilA  = (nsA.chargeCeilTurns  ?? 0) > 0;
    const atkFloor = Math.max(chargeFloorA ? CHARGE_FLOOR_BONUS : 0, nsA.dieFloorBoost ?? 0);
    const atkDie   = chargeCeilA ? THRASH_CEIL_DIE : THRASH_DIE;   // d4 base, ceiling → d6
    const defDie   = THRASH_DIE;                                    // defender always d4 in Thrash
    if (chargeFloorA) addLog(`⚡ ${attacker.name}'s floor charge crackles — this die can't roll below ${1 + CHARGE_FLOOR_BONUS}!`);
    if (chargeCeilA)  addLog(`⚡ ${attacker.name}'s ceiling charge surges — the Thrash die grows to a d${THRASH_CEIL_DIE}!`);

    // 🎲 Roll the swing on the engine's seeded rng (Phase 3b). The client passes
    // the pre-computed stats + mod flags (they read noteStates — Phase 5); the
    // engine owns the dice + verdict. `atkStat`/`defStat` already bake in fog's
    // -1 Sustain, edge mods, etc. The spin overlay below just displays
    // the already-decided faces (battle.atkRoll / battle.defRoll).
    const rollState = dispatch(attackRolled('swing', attacker.id, targetId, {
      atkStat, defStat,
      posing: defenderPosing,
      halveDef: skillMods.halveDef,
      atkFloor, atkDie, defDie,
    }));
    const {
      atkRoll, defRoll, atkTotal, defTotal, attackerWon, margin,
    } = rollState.battle;
    let damage = rollState.battle.damage;
    recordBattleTotals(attacker.id, targetId, atkTotal, defTotal, attackerWon); // 📊 scoreboard

    // 🛡️ Fray on the verdict — the defender's chord takes real damage only when
    // the blow lands (margin-scaled, +1 from the rear wedge; see applyChordFray).
    // ⚠️ Measured against the positions as they stand AT THE VERDICT, not when
    // the swing was declared — the defender may have been shoved since.
    if (attackerWon) applyChordFray(targetId, margin, isHitFromBehind(attacker, defender));

    if (nsA.instrumentDropped) addLog(`🎸💥 ${attacker.name} playing on a dropped instrument — Drive -1!`);
    addLog(`⚔️ ${attacker.name} SWINGS at ${defender.name}!${defenderPosing ? ' — caught posing!' : ''}`);
    // ⚡ A battle ensued — Charge Zone charges burn off for BOTH combatants.
    burnChargesAfterBattle([attacker.id, targetId], 'the Thrash battle spent it');
    // 🎸 Chord note spending now deferred to closeBattleOverlay — only on a HIT.
    // Whiffing no longer burns your drive stack. Physical spends from driveStack ON HIT ONLY.
    const swingChordLeft = (nsA.driveStack ?? []).slice(2);
    const swingChordSpent = (nsA.driveStack ?? []).slice(0, 2);
    // 🥊 CQC EXPOSURE — committing to a swing drops your guard: −1 Sustain until your
    // next turn (melee-only risk; ranged Sonic keeps you safe).
    setNoteStates(prev => ({ ...prev, [acting.id]: { ...prev[acting.id],
      swingExposed: true,
    } }));

    // pickPos: 0 = center. Negative = toward attacker (left). Positive = toward defender (right).
    showTip('combat');
    playBattleMusic(battleSong, 0.7);
    dieSettledRef.current = { atk: false, def: false }; // fresh battle, fresh dice
    setBattleState({
      phase: 'enter_attacker',
      attackerId: acting.id, defenderId: targetId,
      atkStat, defStat, atkBase, atkBonus, defBase, defBonus,
      atkRoll, defRoll, atkTotal, defTotal,
      attackerWon, margin, damage,
      posing: defenderPosing,
      pickPos: 0,
      spinFaceAtk: 1, spinFaceDef: 1,
      atkDieReady: false, defDieReady: false,
      dieSides: atkDie, // ⚡ ceiling charge grows the Thrash die (d4 base, d6 with charge)
      defDieSides: defDie, // Thrash: defender rolls d4
      skillMods, // stage effects, pyro, laser, fog flags
      // Stable dance-craze name shown when a plain swing connects.
      danceName: pickDanceName(),
      swingChordLeft, swingChordSpent, // deferred chord burn — only on a hit
    });
    setDiceDisplay({ atk: null, def: null, rolling: null });

    // ⏭ When auto-skip is on, the whole pre-die cinematic is compressed: the
    // stat flashes and meter slides still play in order (so pickPos and the
    // standee entrances stay consistent), they just whip past in ~1s instead of
    // ~10.4s, landing on the same interactive die-spin. The die-click itself is
    // never skipped — that's the player's moment.
    const skipCine = skipBattleIntrosRef.current;
    battleTimersRef.current = [];
    const T = (fn, ms) => { const id = gt(fn, skipCine ? ms * 0.1 : ms); battleTimersRef.current.push(id); return id; };

    // 0.7s: Flash Drive stat
    T(() => setBattleState(p => p ? { ...p, phase: 'flash_drive' } : p), 700);

    // 1.4s: Pick slides toward attacker by atkStat slots
    T(() => setBattleState(p => p ? { ...p, phase: 'pick_drive_slide', pickPos: -atkStat } : p), 1400);

    // 2.8s: Defender slides in
    T(() => setBattleState(p => p ? { ...p, phase: 'enter_defender' } : p), 2800);

    // 3.5s: Flash Sustain stat
    T(() => setBattleState(p => p ? { ...p, phase: 'flash_sustain' } : p), 3500);

    // 4.2s: Pick slides right by defStat from where it landed
    T(() => setBattleState(p => p ? { ...p, phase: 'pick_sustain_slide', pickPos: -atkStat + defStat } : p), 4200);

    // 5.6s: Attacker die appears spinning — waits for click
    // ⚡ PERF: spin faces now animate inside NeonDie (local state) — no more
    // 80 ms setBattleState interval re-rendering the whole app during spins.
    T(() => setBattleState(p => p ? { ...p, phase: 'atk_die_spin' } : p), 5600);
    // Note: clicking the die triggers handleAtkDieClick (defined below)
  }

  // Random d6 face (1-6) — used during spin animation
  function randD6() { return Math.floor(Math.random() * 6) + 1; }
  function randDie(sides = 6) { return Math.floor(Math.random() * sides) + 1; }

  // ⏭ Skip the pre-die cinematic (standee slides + pick swings) straight to the
  // attacker's die spin. Only fires during the intro phases; the die-click itself
  // (the player's moment) is never skipped.
  function skipBattleIntro() {
    const bs = battleStateRef.current;
    const introPhases = ['enter_attacker','flash_drive','pick_drive_slide','enter_defender','flash_sustain','pick_sustain_slide'];
    if (!bs || bs.riffOff || !introPhases.includes(bs.phase)) return;
    battleTimersRef.current.forEach(clearTimeout);
    battleTimersRef.current = [];
    // ⚡ PERF: NeonDie self-animates its spin faces — no interval needed here.
    setBattleState(p => p ? { ...p, phase: 'atk_die_spin', pickPos: -(p.atkStat ?? 0) + (p.defStat ?? 0) } : p);
  }

  // ── SONIC ATTACK ─────────────────────────────────────────────────────────────
  // Available when attacker is connected to ≥1 amp.
  // KEEP-HIGHEST dice pool — amps buy reliability, not a bigger ceiling, so your Chord
  // Stack stats stay the deciding term (the pool caps at the rival's d6 ceiling until
  // the 3rd amp). 1 amp = 2d6 · 2 amps = 3d6 · 3 amps = 2d6 + 1d8 (the 3rd amp can finally
  // punch past a 6) · 🐉 Hydra overdrives the whole rig to 3d8. Defender still rolls a flat d6.
  // Range: narrow 3-hex forward beam. Unplugged defender cannot retaliate.
  function sonicDicePool(ampCount, hasHydra) {
    if (ampCount >= 3) return hasHydra ? [8, 8, 8] : [6, 6, 8];
    if (ampCount === 2) return [6, 6, 6];
    return [6, 6]; // 1 amp
  }
  // Pretty label for a pool: [6,6]→"2d6", [6,6,8]→"2d6+d8", [8,8,8]→"3d8".
  function dicePoolLabel(pool) {
    const counts = {};
    pool.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => a - b)
      .map(s => `${counts[s] > 1 ? counts[s] : ''}d${s}`).join('+');
  }

  // 🎸💥 THE SMASH — primal, undefendable melee. Hurl your unused RAW stock as pure
  // force: it bypasses the rival's Sustain, scales with how many notes you throw,
  // scatters their stock, and leaves YOU Exposed (your next hit taken lands clean).
  // Draws from stock only — never your chord or cadence. Outside tonal structure.
  // Universal 2-AP finisher (Style rework) — Blaster of Ra replaces it for Intergalactic 0.
  function resolveSmash(targetId) {
    if (!acting) return;
    if (rockGodActive) { addLog(`🤘 The Spirits stand UNITED — take it to the God!`); return; }
    const target = spirits.find(s => s.id === targetId);
    if (!target || target.knockedOut) return;
    if (moveStepsLeft < 2) { addLog('🎸 Not enough Action Points — the Smash costs 2 AP.'); return; }
    const ns    = actingNoteState ?? {};
    const stock = ns.noteStock ?? [];
    const used  = ns.usedStockIdx ?? [];
    const unusedIdxs = stock.map((_, i) => i).filter(i => !usedHas(used, i));
    const thrown = unusedIdxs.length;
    if (thrown < 2) { addLog('🎸 Nothing to throw — you need at least 2 unused notes to Smash.'); return; }

    // 🎸💥 The haymaker: the all-in wind-up roots you to the spot. Smash costs 2 AP
    // AND ends ALL remaining movement this turn — you commit everything to the blow.
    const stepsBeforeSmash = moveStepsLeft;
    dispatch(beatsSpent(0, true, { all: true }));
    setAction(null);

    // 🎸💥 Smash outcome is deterministic (no roll) — pure math in the engine (Phase 3b).
    const { damage, knockback, scatterN } = smashOutcome(thrown);

    // You hurl ALL your unused stock and go Exposed.
    setNoteField(acting.id, {
      usedStockIdx: usedAdd(used, unusedIdxs),
      smashExposed: true,
    });

    // Scatter the rival's raw stock — knock a few of their unused notes loose.
    setNoteStates(prev => {
      const tns = prev[targetId]; if (!tns) return prev;
      const tUsed   = tns.usedStockIdx ?? [];
      const tUnused = (tns.noteStock ?? []).map((_, i) => i).filter(i => !usedHas(tUsed, i));
      const toScatter = tUnused.slice(0, scatterN);
      return { ...prev, [targetId]: { ...tns, usedStockIdx: usedAdd(tUsed, toScatter) } };
    });

    addLog(`🎸💥 ${acting.name} brings the instrument DOWN — THE SMASH! ${thrown} notes hurled, UNDEFENDABLE — −${damage} Vibe${scatterN > 0 ? `, ${scatterN} of ${target.name}'s notes scatter loose` : ''}.`);
    triggerEffectFlash(targetId, '🎸', 'SMASH!', '#ff3344');
    // 6️⃣ The Smash is an attack like any other — the Beast takes its cut.
    beastAttackToll(acting.id);
    resolveWinDamage(acting.id, targetId, damage, 'The Smash');
    battleKnockback(acting.id, targetId, knockback);
    // 🧪 SLIME — Smash also triggers the Slime debuff
    if (acting.id === 'Metalness_Monster') {
      const atkNs = noteStates[acting.id] ?? {};
      const hasSlime = (atkNs.unlockedSkills ?? []).includes('slime');
      const atkDb = atkNs.dbPoints ?? 0;
      if (hasSlime && atkDb >= 1) {
        setNoteStates(prev => ({
          ...prev,
          [acting.id]: { ...prev[acting.id], dbPoints: (prev[acting.id]?.dbPoints ?? 0) - 1 },
          [targetId]:  { ...prev[targetId], halfRefillNextTurn: true },
        }));
        addLog(`🧪 SLIMED! ${target.name} is coated in toxic goo — note regen HALVED next turn! (−1 Db)`);
        setTimeout(() => triggerEffectFlash(targetId, '🧪', 'SLIMED!', '#44ff44'), 250);
      }
    }
    if (stepsBeforeSmash > 2) addLog(`🦶 ${acting.name} is rooted by the wind-up — no movement left this turn.`);
    addLog(`💢 ${acting.name} is left wide open — Exposed until their next turn.`);
  }

  // 🌀💥 BLASTER OF RA — Intergalactic 0's signature; REPLACES Smash once unlocked.
  // A ranged, PIERCING bass-drop: hurl your unused stock down the forward beam and hammer
  // EVERY rival in line — undefendable (ignores Sustain), scattering their stock and knocking
  // them back. Same fuel/commitment as the Smash (all stock, movement locked, Exposed), but
  // reach + multi-hit instead of melee. The slow zoner's get-off-me artillery.
  function resolveBlasterOfRa() {
    if (!acting) return;
    if (moveStepsLeft < 2) { addLog('🌀 Not enough Action Points — Blaster of Ra costs 2 AP.'); return; }
    const ns    = actingNoteState ?? {};
    const stock = ns.noteStock ?? [];
    const used  = ns.usedStockIdx ?? [];
    const unusedIdxs = stock.map((_, i) => i).filter(i => !usedHas(used, i));
    const thrown = unusedIdxs.length;
    if (thrown < 2) { addLog('🌀 Nothing to blast — you need at least 2 unused notes to fire.'); return; }
    const targets = getRivalsInBeam(acting);
    if (!targets.length) { addLog('🌀 No rivals in the beam — line up the shot.'); return; }

    const stepsBefore = moveStepsLeft;
    dispatch(beatsSpent(0, true, { all: true }));
    setAction(null);

    // 🌀 Same fuel/formula as the Smash — single source (Phase 3b).
    const { damage, knockback, scatterN: scatterEach } = smashOutcome(thrown);

    // Hurl ALL unused stock down the beam; ride the recoil into Exposed.
    setNoteField(acting.id, { usedStockIdx: usedAdd(used, unusedIdxs), smashExposed: true });

    addLog(`🌀💥 ${acting.name} drops the BLASTER OF RA — a bass-drop shockwave screams down the beam, UNDEFENDABLE, piercing ${targets.length} rival${targets.length > 1 ? 's' : ''}!`);
    triggerEffectFlash(acting.id, '🌀', 'RA!', '#aa55ff');

    targets.forEach(t => {
      const sc = scatterEach; // v1 Ronin double-scatter CUT (STANCE_V2_HANDOFF §2)
      setNoteStates(prev => {
        const tns = prev[t.id]; if (!tns) return prev;
        const tUsed   = tns.usedStockIdx ?? [];
        const tUnused = (tns.noteStock ?? []).map((_, i) => i).filter(i => !usedHas(tUsed, i));
        const toScatter = tUnused.slice(0, sc);
        return { ...prev, [t.id]: { ...tns, usedStockIdx: usedAdd(tUsed, toScatter) } };
      });
      triggerEffectFlash(t.id, '💥', 'BLAST!', '#aa55ff');
      resolveWinDamage(acting.id, t.id, damage, 'Blaster of Ra');
      battleKnockback(acting.id, t.id, knockback);
      addLog(`💥 ${t.name} — −${damage} Vibe${sc > 0 ? `, ${sc} note${sc > 1 ? 's' : ''} scatter loose` : ''}.`);
    });
    if (stepsBefore > 2) addLog(`🦶 ${acting.name} rides the recoil — no movement left this turn.`);
    addLog(`💢 ${acting.name} is left wide open — Exposed until their next turn.`);
  }

  // ── 🤘 MASTER OF MOSHPITS ────────────────────────────────────────────────────
  // Metalness Monster pulls three fans out of the stands, walks them onto the
  // board, and mosh it out on his own hex while his song plays. The pit pays
  // +2 Drive that STANDS — unlike tempDrive it survives battle resolution, and
  // it lasts until the next time he calls a pit (a fresh pit re-pays the 3 fans
  // and refreshes the buff to +2; it does not stack).
  //
  // Free action — no AP cost, but once per turn.
  //
  // ⚠️ HISTORY: this read `ns.casualFans` / `ns.diehardFans`, which have never
  // existed — the fan economy stores `ns.casuals` / `ns.diehards`. Both counts
  // came back undefined, so totalFans was permanently 0 and the button sat
  // grayed out at "(0/3 fans)" no matter how big the crowd got. Fixed below.
  const MOSH_FAN_COST = 3;
  const MOSH_DRIVE    = 2;

  // Total fans a spirit can actually throw into a pit. Diehards on crew
  // assignments are backstage and don't count — they can't mosh from there.
  function moshableFans(ns) {
    const assigned = (ns?.assignments ?? []).length;
    const diehards = Math.max(0, (ns?.diehards ?? 0) - assigned);
    return { casuals: ns?.casuals ?? 0, diehards, total: (ns?.casuals ?? 0) + diehards };
  }

  // Screen coords of a spirit's grandstand seats — mirrors the geometry the fan
  // crowd renderer uses, so departing fans start from the exact seat they were
  // drawn in and leave a visible gap behind them.
  function grandstandSeatXY(spirit, seatIdx) {
    const home = HEX_BY_NUM[CORNERS[spirit?.corner]?.homeNum];
    const hub  = HEX_BY_NUM[LIMELIGHT_HEX];
    if (!home || !hub) return null;
    const hx = home.px * SCALE, hy = home.py * SCALE;
    const cxC = hub.px * SCALE, cyC = hub.py * SCALE;
    let ox = hx - cxC, oy = hy - cyC;
    const L = Math.hypot(ox, oy) || 1; ox /= L; oy /= L;
    const FAN_OUT = HS * 3.5;
    const homeR   = Math.hypot(hx - cxC, hy - cyC);
    const seatGap = HS * 0.68, rowGap = HS * 0.78;
    return grandstandSeat(seatIdx, cxC, cyC, ox, oy, homeR + FAN_OUT, seatGap, rowGap);
  }

  function clearMoshTimers() {
    moshTimersRef.current.forEach(clearTimeout);
    moshTimersRef.current = [];
  }
  function stopMoshSong() {
    if (moshAudioRef.current) {
      moshAudioRef.current.onended = null;
      moshAudioRef.current.pause();
      moshAudioRef.current.currentTime = 0;
      moshAudioRef.current = null;
    }
  }

  function resolveMasterOfMoshpits() {
    if (!acting || acting.id !== 'Metalness_Monster') return;
    if (moshCineRef.current) return;                       // a pit is already running
    const ns = noteStates[acting.id] ?? {};
    if (ns.moshpitUsedThisTurn) { addLog(`🤘 Already moshed this turn!`); return; }
    const pool = moshableFans(ns);
    if (pool.total < MOSH_FAN_COST) {
      addLog(`🤘 Not enough fans — need at least ${MOSH_FAN_COST} (have ${pool.total}).`);
      return;
    }
    // Casuals get dragged in first — the loyal core only goes down when there
    // aren't enough emotionally flexible bodies left to fill the pit.
    const casualCost  = Math.min(pool.casuals, MOSH_FAN_COST);
    const diehardCost = MOSH_FAN_COST - casualCost;

    // The fans leave their seats NOW, so the gap in the grandstand opens as
    // they walk out. The Drive lands later, when the song does.
    setNoteStates(prev => ({
      ...prev,
      [acting.id]: {
        ...prev[acting.id],
        casuals:  Math.max(0, (prev[acting.id]?.casuals  ?? 0) - casualCost),
        diehards: Math.max(0, (prev[acting.id]?.diehards ?? 0) - diehardCost),
        moshpitUsedThisTurn: true,
      },
    }));

    addLog(`🤘 MASTER OF MOSHPITS! ${MOSH_FAN_COST} fans climb the barricade and head for the pit…`);
    startMoshCinematic(acting.id, acting.num, diehardCost);
  }

  // The show: fans walk in → camera pushes onto the pit → the song plays out →
  // fans evaporate and the Drive lands. Skippable at any point.
  const MOSH_WALK_MS = 1500;
  function startMoshCinematic(spiritId, hexNum, diehardCost) {
    const spirit = spirits.find(s => s.id === spiritId);
    const hex    = HEX_BY_NUM[hexNum];
    // No board position to stage the pit on — the fans are already spent, so pay
    // the Drive out flat rather than swallowing it with the cinematic.
    if (!spirit || !hex) {
      setNoteStates(prev => ({ ...prev, [spiritId]: { ...prev[spiritId], moshDrive: MOSH_DRIVE } }));
      addLog(`🤘 The pit erupts off-camera — +${MOSH_DRIVE} DRIVE.`);
      return;
    }

    const tx = hex.px * SCALE, ty = hex.py * SCALE;
    // Front-row seats empty first (they're closest to the rail), diehards first
    // in the seat sequence — same ordering the grandstand draws in.
    const movers = [];
    for (let i = 0; i < MOSH_FAN_COST; i++) {
      const seat = grandstandSeatXY(spirit, i) ?? { x: tx, y: ty };
      const ang  = (Math.PI * 2 * i) / MOSH_FAN_COST - Math.PI / 2;
      const ring = HS * 0.78;
      movers.push({
        seed: i * 37 + 11,
        isDie: i < diehardCost,          // diehards lead the charge
        sx: seat.x, sy: seat.y,
        // Land ringed around the Monster, squashed for pseudo-perspective —
        // matches the existing moshpit swarm treatment.
        tx: tx + Math.cos(ang) * ring,
        ty: ty + Math.sin(ang) * ring * 0.62,
      });
    }

    const key = Date.now();
    moshPaidRef.current = null;                 // fresh pit, fresh payout latch
    setMoshCine({ key, spiritId, hexNum, phase: 'walk', movers });
    moshCineRef.current = { key, spiritId, hexNum, phase: 'walk', movers };  // Skip may fire before the effect syncs
    clearMoshTimers();

    const skip = skipBattleIntrosRef.current;
    const T = (fn, ms) => { const id = gt(fn, skip ? ms * 0.1 : ms); moshTimersRef.current.push(id); return id; };

    // Camera pushes in on the Monster and holds for the whole song — passing a
    // huge hold keeps focusOnHex from easing back out under us; finishMoshpit
    // releases it with zoomReset.
    focusOnHex(hexNum, 10 * 60 * 1000, 0.34);

    // Fans arrive → the pit opens up.
    T(() => {
      setMoshCine(m => (m && m.key === key ? { ...m, phase: 'pit' } : m));
      triggerRumble(spiritId, 900);
      triggerMoshpit(spiritId);                  // the crowd-PNG swarm, on top
      if (!liteFx) {
        stopBattleMusic();                       // nothing competes with the song
        const audio = new Audio(moshpitSong);
        audio.loop = false;                      // it runs once, then the pit pays out
        audio.volume = 0.8;
        audio.onended = () => finishMoshpit(spiritId);
        // Autoplay blocked / decode failure — don't strand the pit on screen.
        audio.play().catch(() => finishMoshpit(spiritId));
        moshAudioRef.current = audio;
      } else {
        // 🎨 lite FX skips audio decoding — fall back to a fixed beat.
        T(() => finishMoshpit(spiritId), 3000);
      }
    }, MOSH_WALK_MS);
  }

  // Pay out the pit: fans evaporate, Drive lands, camera lets go. Safe to call
  // twice — moshPaidRef latches the first caller and the second one no-ops.
  function finishMoshpit(spiritId) {
    const cur = moshCineRef.current;
    if (!cur || cur.spiritId !== spiritId) return;
    if (moshPaidRef.current === cur.key) return;   // song end and Skip raced — first one wins
    moshPaidRef.current = cur.key;
    clearMoshTimers();
    stopMoshSong();
    setMoshCine(m => (m ? { ...m, phase: 'out' } : m));

    // 🤘 Standing buff: refresh to +2, never stack. A second pit costs another
    // 3 fans and buys you the same +2 — it's an upkeep, not a ladder.
    setNoteStates(prev => ({
      ...prev,
      [spiritId]: { ...prev[spiritId], moshDrive: MOSH_DRIVE },
    }));

    const nm = spirits.find(s => s.id === spiritId)?.name ?? 'The Monster';
    addLog(`🤘 The pit ERUPTS around ${nm} — the fans are spent, but the Drive stays: +${MOSH_DRIVE} DRIVE until the next pit!`);
    triggerEffectFlash(spiritId, '🤘', `MOSH PIT! +${MOSH_DRIVE} DRV`, '#ffcc00');

    const id = gt(() => { setMoshCine(null); zoomReset(0); }, 900);
    moshTimersRef.current.push(id);
  }

  // Skip button — jump straight to the payout.
  function skipMoshCinematic() {
    const cur = moshCineRef.current;
    if (!cur) return;
    finishMoshpit(cur.spiritId);
  }

  // Never leave a song playing or a camera pinned if the component unmounts.
  useEffect(() => () => { clearMoshTimers(); stopMoshSong(); }, []);

  // ── 6️⃣ NUMBER OF THE BEAST — BERSERK ────────────────────────────────────────
  // "The Trooper": you don't charge the cannons because it's clever, you charge
  // because there's nothing else left. The Beast can ONLY be called when the
  // Monster is already dying — at BEAST_VIBE_GATE Vibe or less.
  //
  // WHY IT ONLY COSTS 1 Db: the old version wanted 6 Db up front, which put it
  // in direct competition with the upgrade track — and the upgrade won every
  // time, so the ability may as well not have existed. 1 Db keeps it in line
  // with the other signature activations (Slime, the Shamisen) without being a
  // real choice against an upgrade. The rest is paid in blood: the Vibe gate IS
  // the cost, and every swing you take while raging burns another point.
  //
  // WHILE BERSERK:
  //   · +BEAST_DRIVE Drive, and it bypasses ATK_BONUS_CAP — the whole point is
  //     that the Beast is off the leash. It rides on the attack BASE, not the
  //     capped bonus tower.
  //   · Immune to knockback. He does not get moved. He comes at you.
  //   · Every attack he makes costs 1 Vibe.
  // IT ENDS WHEN:
  //   · he knocks a rival down (glory — the charge landed), or
  //   · he's knocked down himself (the cannons won), or
  //   · his Vibe climbs back above the gate (he's out of danger, so the Beast
  //     lets go — this is what stops you healing up while keeping the rage).
  const BEAST_VIBE_GATE = 2;
  const BEAST_DRIVE     = 6;
  const BEAST_DB_COST   = 1;

  function resolveNumberOfTheBeast() {
    if (!acting || acting.id !== 'Metalness_Monster') return;
    const ns = noteStates[acting.id] ?? {};
    if (ns.berserk) { addLog(`6️⃣ The Beast is already loose.`); return; }
    const vibe = acting.vibe ?? 0;
    if (vibe > BEAST_VIBE_GATE) {
      addLog(`6️⃣ The Beast only answers the dying — ${BEAST_VIBE_GATE} Vibe or less (you're on ${vibe}).`);
      return;
    }
    const db = ns.dbPoints ?? 0;
    if (db < BEAST_DB_COST) {
      addLog(`6️⃣ Not enough Db — calling the Beast costs ${BEAST_DB_COST} (you have ${db}).`);
      return;
    }

    setNoteStates(prev => ({
      ...prev,
      [acting.id]: {
        ...prev[acting.id],
        berserk: true,
        dbPoints: (prev[acting.id]?.dbPoints ?? 0) - BEAST_DB_COST,
      },
    }));
    addLog(`6️⃣🔥 NUMBER OF THE BEAST! ${acting.name} spends ${BEAST_DB_COST} Db — cornered, bleeding, and DONE RUNNING — BERSERK! +${BEAST_DRIVE} Drive, immune to knockback, and every swing costs a point of Vibe. It ends when someone goes down.`);
    triggerEffectFlash(acting.id, '6️⃣', `BERSERK! +${BEAST_DRIVE} DRV`, '#cc0000');
    triggerRumble(acting.id, 900);
    focusOnHex(acting.num, 1400, 0.40, true);
  }

  // Drop out of Berserk — one exit point so every ending logs the same way.
  function endBerserk(spiritId, reason) {
    if (!noteStates[spiritId]?.berserk) return;
    setNoteField(spiritId, { berserk: false });
    const nm = spirits.find(s => s.id === spiritId)?.name ?? 'The Monster';
    addLog(`6️⃣ The Beast lets go of ${nm} — ${reason}.`);
  }

  // The rage burns Vibe on every attack he throws. Called from the three attack
  // entry points (Swing / Smash / Sonic) the instant an attack is committed.
  //
  // The toll never takes the LAST point: the Beast bleeds him, but it doesn't
  // get to be what kills him — a rival has to finish the job. That's partly
  // flavour and partly practical, since a self-inflicted knockdown landing in
  // the middle of a swing cinematic would fight the battle overlay for control.
  function beastAttackToll(spiritId) {
    if (!noteStates[spiritId]?.berserk) return;
    const sp = spirits.find(s => s.id === spiritId);
    if (!sp || (sp.vibe ?? 0) <= 1) {
      addLog(`6️⃣ There's nothing left to burn — the Beast rides on fumes.`);
      return;
    }
    addLog(`6️⃣ The Beast takes its cut — 1 Vibe.`);
    applyVibeDamage(spiritId, 1, 'the Beast');
  }

  // 🩸 The Beast lets go the moment the Monster is out of danger. This is the
  // "can't be healed" clause, expressed as an exit condition rather than as a
  // block on every heal site in the game: heal up if you like, but the rage
  // goes with it. Also catches a knockdown (Vibe hits 0 → respawn).
  useEffect(() => {
    const mm = spirits.find(s => s.id === 'Metalness_Monster');
    if (!mm || !noteStates['Metalness_Monster']?.berserk) return;
    if ((mm.vibe ?? 0) > BEAST_VIBE_GATE) {
      endBerserk('Metalness_Monster', 'the danger passed, and so did the rage');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spirits, noteStates]);

  // 🌌 DISPLACE — Intergalactic 0's signature. He can't run; he WARPS. Teleport to an open
  // hex beside his amp rig for 3 AP, then a 2-turn cooldown. A deliberate get-out-of-jail
  // (the AP cost rules out a same-turn Sonic follow-up), not a kite tool. Needs ≥1 amp.
  const DISPLACE_AP = 3;
  function resolveDisplace(hexNum) {
    if (!acting) return;
    const ns = actingNoteState ?? {};
    if ((ns.displaceCd ?? 0) > 0) { addLog(`🌌 Displace is recharging — ${ns.displaceCd} turn${ns.displaceCd > 1 ? 's' : ''} left.`); return; }
    if (moveStepsLeft < DISPLACE_AP) { addLog(`🌌 Displace needs ${DISPLACE_AP} AP.`); return; }
    // Warp target: any open neighbor hex of the spirit
    const spHex = HEX_BY_NUM[acting.num];
    if (!spHex) return;
    const openNeighbors = new Set();
    const occupied = new Set(spirits.filter(s => !s.knockedOut).map(s => s.num));
    getFlatTopNeighborSlots(spHex).forEach(n => { if (!occupied.has(n.num)) openNeighbors.add(n.num); });
    if (!openNeighbors.has(hexNum)) { addLog('🌌 Warp to an open hex beside you.'); return; }

    triggerEffectFlash(acting.id, '🌌', 'WARP', '#aa55ff');
    dispatch(spiritWarped(acting.id, hexNum, DISPLACE_AP)); // reducer owns the position write
    setNoteField(acting.id, { displaceCd: 2 });
    setAction(null);
    addLog(`🌌 ${acting.name} folds space and WARPS to hex #${hexNum} — Space is the place.`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 🗡️ SHREDDING RONIN — REWORKED SIGNATURE ARSENAL
  // ═══════════════════════════════════════════════════════════════════════════

  // 🌀 PSYCHO BUSHIDO — Iaijutsu dash. Charge in a straight line from facing.
  // Remaining AP after reaching the target converts to bonus Drive. 2-round CD.
  // The Ronin warps to the hex adjacent to the target along the charge line,
  // then initiates a swing with Drive boosted by leftover AP.
  function resolvePsychoBushido(targetId) {
    if (!acting || acting.id !== 'cosmic_ronin') return;
    const ns = actingNoteState ?? {};
    if ((ns.psychoBushidoCd ?? 0) > 0) {
      addLog(`🌀 Psycho Bushido is recharging — ${ns.psychoBushidoCd} turn${ns.psychoBushidoCd > 1 ? 's' : ''} left.`);
      return;
    }
    if (actionTokenUsed) { addLog('🌀 Already used your Action Token this turn!'); return; }
    if (!hasConfirmed) { addLog('🌀 Commit your melody first!'); return; }

    const attacker = spirits.find(s => s.id === acting.id);
    const defender = spirits.find(s => s.id === targetId);
    if (!attacker || !defender || defender.knockedOut) return;

    // Build the straight line from Ronin's facing
    const originHex = HEX_BY_NUM[attacker.num];
    const targetHex = HEX_BY_NUM[defender.num];
    if (!originHex || !targetHex) return;

    // Verify target is on the facing line
    const first = neighborInDirection(originHex, attacker.facing ?? 0);
    if (!first) { addLog('🌀 No clear path ahead.'); return; }
    const dq = first.q - originHex.q;
    const dr = first.r - originHex.r;

    // Walk the line to find the target
    let distToTarget = 0;
    let q = originHex.q, r = originHex.r;
    for (let i = 1; i <= moveStepsLeft; i++) {
      q += dq; r += dr;
      const hex = HEX_BY_QR[`${q},${r}`];
      if (!hex) break;
      if (hex.num === defender.num) { distToTarget = i; break; }
    }
    if (distToTarget === 0) {
      addLog('🌀 Target is not in your line of sight, or out of AP range!');
      return;
    }

    // Calculate bonus Drive from leftover AP
    const apLeft = moveStepsLeft;
    const bonusDrive = Math.max(0, apLeft - distToTarget);

    // Warp Ronin to the hex just before the target
    const landQ = originHex.q + dq * (distToTarget - 1);
    const landR = originHex.r + dr * (distToTarget - 1);
    const landHex = HEX_BY_QR[`${landQ},${landR}`];
    if (landHex && landHex.num !== originHex.num) {
      dispatch(spiritWarped(acting.id, landHex.num, 0));
    }

    // Consume ALL remaining movement + action token
    dispatch(beatsSpent(0, true, { all: true }));

    // Apply bonus Drive as tempDrive (stacks with existing)
    const prevTemp = ns.tempDrive ?? 0;
    const newTemp = prevTemp + bonusDrive;
    setNoteField(acting.id, {
      psychoBushidoCd: 2,
      tempDrive: newTemp,
    });

    triggerEffectFlash(acting.id, '🌀', 'BUSHIDO!', '#4488ff');
    addLog(`🌀 PSYCHO BUSHIDO! ${attacker.name} dashes ${distToTarget} hex${distToTarget > 1 ? 'es' : ''} — +${bonusDrive} bonus Drive from ${apLeft} remaining AP!`);

    // Auto-initiate swing against the target
    setAction(null);
    // Small delay so the warp settles before the swing triggers
    setTimeout(() => initiateSwing(targetId), 100);
  }

  // Returns hex nums along Ronin's facing line within AP range (for highlighting)
  function getPsychoBushidoTargets() {
    if (!acting || acting.id !== 'cosmic_ronin') return new Set();
    const ns = actingNoteState ?? {};
    if ((ns.psychoBushidoCd ?? 0) > 0) return new Set();
    const originHex = HEX_BY_NUM[acting.num];
    if (!originHex) return new Set();
    const first = neighborInDirection(originHex, acting.facing ?? 0);
    if (!first) return new Set();
    const dq = first.q - originHex.q;
    const dr = first.r - originHex.r;
    const targets = new Set();
    const occupied = new Set(spirits.filter(s => !s.knockedOut).map(s => s.num));
    let q = originHex.q, r = originHex.r;
    for (let i = 1; i <= moveStepsLeft; i++) {
      q += dq; r += dr;
      const hex = HEX_BY_QR[`${q},${r}`];
      if (!hex) break;
      // Can only target a rival on the line
      if (occupied.has(hex.num) && hex.num !== acting.num) {
        const rival = spirits.find(s => s.num === hex.num && s.id !== acting.id && !s.knockedOut);
        if (rival) targets.add(hex.num);
        break; // stop at first occupied hex
      }
    }
    return targets;
  }

  // 👤 SHADOW ILLUSION — Ronin splits off a body double.
  //
  // The decoy is NOT a marker or an aura: it is rendered as a second, identical
  // Ronin standee. Rivals cannot tell the two apart — same sprite, same base
  // ring, same hex tint, same facing arrow, and it blocks movement like a body.
  // It can be walked around the board on the Ronin's own Action Points, so the
  // pair genuinely behaves like two Ronins on the field.
  //
  // Costs 1 Drive token from the stack. Lasts SHADOW_ILLUSION_TURNS of Ronin's
  // turns. Pops early if:
  //   - the decoy is attacked (the attacker's AP + Action Token are burned)
  //   - the real Ronin attacks
  //   - the real Ronin is attacked
  // The decoy cannot interact with board elements (no note pickups, no amp
  // placement, no hazard triggers) — it isn't really there.
  const SHADOW_ILLUSION_TURNS = 3;

  // The double is born STACKED on the Ronin — it peels out of his own body on
  // his own hex, so at the instant of the split there is visibly one Ronin, not
  // two. Nobody sees where the fake "came from", because it didn't come from
  // anywhere. The pair then walks apart (his legs, its legs) and by the time a
  // rival is looking at two standees there is no history to reason from. This
  // is the whole reason it isn't placed on an adjacent hex: watching a decoy
  // pop into an empty tile tells you exactly which one is the copy.
  function resolveShadowIllusion() {
    if (!acting || acting.id !== 'cosmic_ronin') return;
    const ns = actingNoteState ?? {};
    if (ns.shadowIllusion) { addLog('👤 A shadow is already on the board!'); return; }
    const driveStack = ns.driveStack ?? [];
    if (driveStack.length < 1) { addLog('👤 Need at least 1 Drive token to summon a shadow!'); return; }

    // Spend 1 Drive token. The double steps out already facing the way the real
    // Ronin faces — a mismatched arrow would give the game away instantly — and
    // with its own full set of legs (see moveShadow).
    const newStack = driveStack.slice(1);
    showSpentNotes(acting.id, driveStack.slice(0, 1), 'drive'); // 🎵 the note leaves
    const budget = ns.lastMoveBudget ?? Math.max(1, moveStepsLeft);
    setNoteField(acting.id, {
      driveStack: newStack,
      shadowIllusion: {
        hex: acting.num,                 // stacked on the real body
        facing: acting.facing ?? 0,
        turnsLeft: SHADOW_ILLUSION_TURNS,
        stepsLeft: budget,
        stepsMax:  budget,
      },
    });

    triggerEffectFlash(acting.id, '👤', 'SHADOW!', '#4488ff');
    addLog(`👤 ${acting.name} splits — a SHADOW ILLUSION peels out of him on hex #${acting.num}. Two Ronins, one shape. Walk them apart and nobody can say which is which.`);
    setAction(null);
  }

  // 👤 Walk the double one hex.
  //
  // The shadow has its OWN movement pool (`stepsLeft`), refreshed each of the
  // Ronin's turns to match whatever budget the real body was granted. It shares
  // the Ronin's *range*, not his Action Points. This is deliberate: if walking
  // the double drained the Ronin's own AP, summoning it would cost him tempo
  // every turn it stood on the board, and the ability would read as a drawback
  // rather than a threat. Two bodies, two sets of legs — that's the point.
  function moveShadow(toNum) {
    const si = noteStates['cosmic_ronin']?.shadowIllusion;
    if (!si) return;
    const stepsNow = si.stepsLeft ?? 0;
    if (stepsNow < 1) { addLog('👤 The shadow has no steps left this turn.'); return; }
    const from = HEX_BY_NUM[si.hex];
    const to   = HEX_BY_NUM[toNum];
    if (!from || !to) return;
    if (axialDist(from.q, from.r, to.q, to.r) !== 1) {
      addLog('👤 The shadow can only step to an adjacent hex.');
      return;
    }
    if (spiritByNum[toNum]) { addLog('👤 Something is already standing there.'); return; }

    // The double turns to face the way it walked, exactly like a real Spirit.
    const newFacing = angleTo(from, to);
    const stepsLeft = stepsNow - 1;
    setNoteField('cosmic_ronin', {
      shadowIllusion: { ...si, hex: toNum, facing: newFacing, stepsLeft },
    });
    // Deliberately worded like an ordinary Ronin move — the combat log must not
    // leak which of the two standees just moved.
    addLog(`🚶 ${spirits.find(s => s.id === 'cosmic_ronin')?.name ?? 'Ronin'} → #${toNum} (${stepsLeft} step${stepsLeft !== 1 ? 's' : ''} left)`);
    if (stepsLeft <= 0) setAction(null);
  }

  // Dismiss shadow when Ronin attacks, is attacked, or shadow is attacked
  function dismissShadowIllusion(reason) {
    const ns = noteStates['cosmic_ronin'] ?? {};
    if (!ns.shadowIllusion) return;
    const hex = ns.shadowIllusion.hex;
    setNoteField('cosmic_ronin', { shadowIllusion: null });
    triggerDamageNumber(hex, '👤 GONE', '#4488ff');
    if (action === 'move_shadow') setAction(null);
    addLog(`👤 The shadow illusion vanishes — ${reason}.`);
  }

  // 👤 Is `num` the decoy's hex, and is it legally in range of the attack the
  // acting Spirit is currently aiming? The Ronin can't be fooled by their own
  // double, so they're excluded. `mode` mirrors the attack's own range rule.
  function isShadowTarget(num, mode) {
    const si = noteStates['cosmic_ronin']?.shadowIllusion;
    if (!si || num !== si.hex) return false;
    if (!acting || acting.id === 'cosmic_ronin') return false;
    // Freshly summoned, the double is STACKED on the real Ronin. A blow aimed at
    // that hex has a real body in it, so it must land for real — whiffing on a
    // hex the Ronin is demonstrably standing on would be a free miss.
    if (spiritByNum[num]) return false;
    if (mode === 'cone')  return getSwingCone(acting).has(num);
    if (mode === 'beam')  return getSonicBeam(acting).has(num);
    if (mode === 'adjacent') {
      const a = HEX_BY_NUM[acting.num], b = HEX_BY_NUM[num];
      return !!a && !!b && axialDist(a.q, a.r, b.q, b.r) === 1;
    }
    return false;
  }

  // 👤 Does the decoy stand in the acting Spirit's cone / beam at all? Used for
  // the HUD target counts — the Swing button must read "(2)" when a rival can
  // see one real Spirit and the double, or the count itself becomes the tell.
  function shadowInRange(mode) {
    const si = noteStates['cosmic_ronin']?.shadowIllusion;
    if (!si || !acting || acting.id === 'cosmic_ronin') return false;
    // While stacked on the real Ronin it isn't a separate target — counting it
    // would show "(2)" on a hex holding one visible standee.
    if (spiritByNum[si.hex]) return false;
    if (mode === 'cone') return getSwingCone(acting).has(si.hex);
    if (mode === 'beam') return getSonicBeam(acting).has(si.hex);
    if (mode === 'adjacent') {
      const a = HEX_BY_NUM[acting.num], b = HEX_BY_NUM[si.hex];
      return !!a && !!b && axialDist(a.q, a.r, b.q, b.r) === 1;
    }
    return false;
  }

  // 👤 A rival swung at the double. The blow passes through empty air — but the
  // attacker pays the FULL price of the attack they just threw, down to the last
  // side-effect. This is not politeness, it's concealment: if whiffing on the
  // double were cheaper than a real hit (a Smash that didn't drain your movement,
  // a Blaster that didn't leave you Exposed), the discount itself would announce
  // that the standee was fake. The wasted tempo is the payoff for the bluff.
  //
  //   kind: 'swing' (1 AP) | 'sonic' (2 AP)
  //         | 'smash' | 'blaster' (2 AP minimum, then ALL movement, hurls the
  //           attacker's whole unused stock, leaves them Exposed)
  function resolveShadowWhiff(attacker, kind, label) {
    const si = noteStates['cosmic_ronin']?.shadowIllusion;
    if (!si || !attacker) return false;
    const heavy  = kind === 'smash' || kind === 'blaster';
    const apCost = kind === 'swing' ? 1 : 2;
    if (actionTokenUsed) { addLog('⚔️ Already used your Action Token this turn!'); return false; }
    if (moveStepsLeft < apCost) {
      addLog(`⚔️ Not enough Action Points — that costs ${apCost} AP.`);
      return false;
    }

    const ns    = noteStates[attacker.id] ?? {};
    const used  = ns.usedStockIdx ?? [];
    const unusedIdxs = (ns.noteStock ?? []).map((_, i) => i).filter(i => !usedHas(used, i));
    if (heavy && unusedIdxs.length < 2) {
      addLog(`${kind === 'blaster' ? '🌀' : '🎸'} Nothing to throw — you need at least 2 unused notes.`);
      return false;
    }

    if (heavy) {
      // Same commitment as a landed Smash / Blaster: all movement gone, all
      // unused stock hurled into thin air, and you're left wide open.
      dispatch(beatsSpent(0, true, { all: true }));
      setNoteField(attacker.id, { usedStockIdx: usedAdd(used, unusedIdxs), smashExposed: true });
    } else {
      dispatch(beatsSpent(apCost, true));
    }
    setAction(null);

    triggerDamageNumber(si.hex, 'MISS!', '#88bbff');
    focusOnHex(si.hex, 900, 0.42, true);
    addLog(`👤 ${attacker.name}'s ${label} tears straight through the Ronin — and the Ronin comes apart like smoke. It was the SHADOW.`);
    if (heavy) {
      addLog(`💢 ${attacker.name} hurled everything at a ghost — no movement left, stock spent, and Exposed until their next turn.`);
    } else {
      addLog(`💨 ${apCost} AP and ${attacker.name}'s Action Token, spent on nothing.`);
    }
    dismissShadowIllusion('a rival struck it');
    return true;
  }

  // 🎸 CURSED SHAMISEN — Drop a cursed shamisen on Ronin's current hex.
  //
  // Three-stage life, ticked at the start of each of Ronin's turns:
  //
  //   Stage 1 "LISTENING"  · 2 rings · sits still · spares the Ronin
  //   Stage 2 "SWELLING"   · 3 rings · sits still · spares the Ronin
  //   Stage 3 "HUNTING"    · 3 rings · stalks 1 hex/turn toward the nearest
  //                          Spirit · spares NOBODY, the Ronin included
  //
  // The aura FREEZES at 3 rings when the hunt begins — an expanding zone that
  // also chases you would eventually cover the whole stage with no counterplay.
  // Growth is the price of standing still; mobility is the price of growth.
  //
  // 8 Db to unlock, 2 Db per use. 1 Sustain damage per turn to everyone inside
  // the rings. Calmed (destroyed) by walking onto its hex, which also hands the
  // walker a bonus note — so the answer to it is always "go and touch it".
  const SHAM_RING_START  = 2;   // rings on the turn it lands
  const SHAM_RING_MAX    = 3;   // frozen ceiling once the hunt starts
  const SHAM_HUNT_STAGE  = 3;   // stage at which it starts stalking

  function resolveCursedShamisen() {
    if (!acting || acting.id !== 'cosmic_ronin') return;
    const ns = actingNoteState ?? {};
    if (ns.cursedShamisen) { addLog('🎸 A Shamisen is already haunting the board!'); return; }
    // Check Db cost (2 per use)
    const dbPts = ns.dbPoints ?? 0;
    if (dbPts < 2) { addLog('🎸 Not enough Db to summon the Shamisen — costs 2 Db.'); return; }

    setNoteField(acting.id, {
      dbPoints: dbPts - 2,
      cursedShamisen: {
        hex: acting.num,
        range: SHAM_RING_START,
        stage: 1,
        hunting: false,
        touched: [],      // ids the melody reached on its most recent tick
      },
    });

    triggerEffectFlash(acting.id, '🎸', 'SHAMISEN!', '#4488ff');
    addLog(`🎸 ${acting.name} sets the CURSED SHAMISEN down on hex #${acting.num}. It begins to play by itself — ${SHAM_RING_START} rings of haunted air.`);
    playShamisenMelody(false);
    setAction(null);
  }

  // 🎶 The haunting melody. An unaccompanied Japanese-flavoured minor phrase
  // (roughly the "insen" scale) let ring with long tails — while it hunts the
  // same shape drops an octave and speeds up into something predatory.
  function playShamisenMelody(hunting) {
    try {
      const ctx = getAudioCtx();
      // insen on D: D · Eb · G · A · C
      const phrase = hunting
        ? [146.83, 155.56, 196.00, 146.83, 130.81, 110.00]   // low, urgent, descending
        : [293.66, 311.13, 392.00, 440.00, 392.00, 311.13];  // higher, drifting
      const gap  = hunting ? 0.17 : 0.26;
      const knobs = { drive: 0.18, tone: 0.30, echo: 0.72, verb: 0.55, voice: 'triangle' };
      phrase.forEach((freq, i) => {
        playAmpNote(ctx, freq, {
          when: ctx.currentTime + i * gap,
          holdTime: hunting ? 0.28 : 0.42,
          fadeTime: hunting ? 0.5 : 0.9,
          volume: hunting ? 0.13 : 0.10,
          knobs,
        });
      });
    } catch (_) { /* audio unavailable — silent fail */ }
  }

  // 🎯 One stalking step toward the nearest living Spirit (the Ronin counts —
  // once it wakes up, the thing has no loyalties). It walks around bodies
  // rather than through them; if every route is blocked it simply stays put
  // and keeps playing.
  function shamisenHuntStep(fromNum) {
    const fromHex = HEX_BY_NUM[fromNum];
    if (!fromHex) return fromNum;
    const prey = spirits.filter(s => !s.knockedOut && HEX_BY_NUM[s.num]);
    if (!prey.length) return fromNum;
    // Nearest by hex distance; ties broken by lowest Vibe, so a wounded Spirit
    // is the one it drifts toward when two are equidistant.
    let target = null, bestD = Infinity;
    prey.forEach(sp => {
      const h = HEX_BY_NUM[sp.num];
      const d = axialDist(fromHex.q, fromHex.r, h.q, h.r);
      if (d < bestD || (d === bestD && target && sp.vibe < target.vibe)) { bestD = d; target = sp; }
    });
    if (!target) return fromNum;
    const tHex = HEX_BY_NUM[target.num];
    const occupied = new Set(spirits.filter(s => !s.knockedOut).map(s => s.num));
    // Pick the open neighbour that closes the most distance.
    let bestNum = fromNum, bestDist = bestD;
    getFlatTopNeighborSlots(fromHex).forEach(n => {
      if (occupied.has(n.num)) return;              // can't share a hex with a body
      const nHex = HEX_BY_NUM[n.num];
      if (!nHex) return;
      const d = axialDist(nHex.q, nHex.r, tHex.q, tHex.r);
      if (d < bestDist) { bestDist = d; bestNum = n.num; }
    });
    return bestNum;
  }

  // Tick the Shamisen at the start of each of Ronin's turns: advance its stage,
  // stalk if it has woken up, then play and resolve the melody.
  function tickCursedShamisen() {
    const ns = noteStates['cosmic_ronin'] ?? {};
    const sham = ns.cursedShamisen;
    if (!sham) return;

    const stage    = (sham.stage ?? 1) + 1;
    const hunting  = stage >= SHAM_HUNT_STAGE;
    const justWoke = hunting && !sham.hunting;
    // Grows one ring per turn until the hunt begins, then freezes.
    const newRange = hunting ? SHAM_RING_MAX : Math.min(SHAM_RING_MAX, (sham.range ?? SHAM_RING_START) + 1);
    const newHex   = hunting ? shamisenHuntStep(sham.hex) : sham.hex;

    if (justWoke) {
      addLog(`🎸💀 The Cursed Shamisen stops waiting. It lifts off the boards and starts HUNTING — its aura holds at ${SHAM_RING_MAX} rings, and it no longer cares whose Spirit you are. Even the Ronin.`);
    } else if (hunting && newHex !== sham.hex) {
      addLog(`🎸💀 The Shamisen drags itself to hex #${newHex}, still playing.`);
    } else if (!hunting) {
      addLog(`🎸 The Shamisen's melody swells — ${newRange} rings of haunted air now.`);
    }

    // 🎶 The melody plays every single turn it lives, hunting or not.
    playShamisenMelody(hunting);

    // Resolve the melody: 1 Sustain damage to every Spirit inside the rings.
    // Before it wakes, the Ronin is immune — it's still his instrument.
    const shamHex = HEX_BY_NUM[newHex];
    const touched = [];
    if (shamHex) {
      spirits.forEach(sp => {
        if (sp.knockedOut) return;
        if (sp.id === 'cosmic_ronin' && !hunting) return;
        const spHex = HEX_BY_NUM[sp.num];
        if (!spHex) return;
        const dist = axialDist(shamHex.q, shamHex.r, spHex.q, spHex.r);
        if (dist > newRange) return;

        touched.push(sp.id);
        // Sustain soaks the curse first; once that's gone it bites Vibe.
        const spNs = noteStates[sp.id] ?? {};
        const curSustain = spNs.tempSustain ?? 0;
        const soaked = curSustain > 0;
        if (soaked) setNoteField(sp.id, { tempSustain: curSustain - 1 });
        else applyVibeDamage(sp.id, 1, 'Cursed Shamisen');

        // 👁️ Make the hit unmissable: the victim's standee flashes, a cursed
        // note floats off their hex, and their aura is marked for the round.
        triggerEffectFlash(sp.id, '🎶', 'CURSED', '#aa55ff');
        triggerDamageNumber(sp.num, soaked ? '🎶 −1 🛡️' : '🎶 −1 ❤️', '#cc88ff');
        triggerRumble(sp.id, 420);
        addLog(dist === 0
          ? `🎶 ${sp.name} is standing right on top of the Shamisen — it plays straight through them. 1 ${soaked ? 'Sustain' : 'Vibe'} gone.`
          : `🎶 The Shamisen's melody catches ${sp.name} at ${dist} ring${dist !== 1 ? 's' : ''} — 1 ${soaked ? 'Sustain' : 'Vibe'} gone.`);
      });
    }
    if (touched.length === 0) {
      addLog(`🎶 The Shamisen plays to an empty room — nobody is close enough to hear it.`);
    }

    setNoteField('cosmic_ronin', {
      cursedShamisen: {
        hex: newHex,
        range: newRange,
        stage,
        hunting,
        touched,      // drives the lingering "you were played at" aura
      },
    });
  }

  // Calm the Shamisen — called when a Spirit finishes a step, with the hex they
  // just landed on.
  //
  // `landedOn` is passed explicitly and is NOT optional in practice: the render
  // closure's `spirits` array still holds the walker's PRE-move position, so
  // reading the position off it here calmed the Shamisen the instant the Ronin
  // stepped off the hex he'd just dropped it on — the ability killed itself on
  // the very next move. Every other post-move hook (poison slime, token pickup,
  // stage FX) already takes the destination hex for exactly this reason.
  function calmCursedShamisen(walkerId, landedOn) {
    const ns = noteStates['cosmic_ronin'] ?? {};
    if (!ns.cursedShamisen) return false;
    const walkerSpirit = spirits.find(s => s.id === walkerId);
    if (!walkerSpirit) return false;
    const at = landedOn ?? walkerSpirit.num;
    if (at !== ns.cursedShamisen.hex) return false;

    const wasHunting = !!ns.cursedShamisen.hunting;
    setNoteField('cosmic_ronin', { cursedShamisen: null });
    const walkerName = walkerSpirit.name;
    addLog(wasHunting
      ? `🎸🎵 ${walkerName} walks straight into the hunting Shamisen and lays a hand on the strings — the melody chokes off dead.`
      : `🎸🎵 ${walkerName} calms the Cursed Shamisen — the haunting melody fades.`);
    triggerEffectFlash(walkerId, '🎵', 'CALMED', '#44cc66');
    // The reward for walking into it: the silenced melody leaves a note behind.
    // (This used to return true and rely on the caller to grant it, but no caller
    // ever did — the promised bonus note simply never arrived.)
    const wNs = noteStates[walkerId] ?? {};
    bankLostChordNote(walkerId, randomNote(wNs.rootNote, wNs.scaleMode), false);
    return true;
  }

  // 🎵 WA NO KOE (和の声) — Voice of Harmony. Passive: when the melody commit
  // aligns with the Drive or Sustain chord stack, melody notes convert to
  // +1 Drive or Sustain for 3 rounds. Checked during confirmNoteTrack.
  function checkWaNoKoe(melodyLine, chordStack) {
    const ns = noteStates['cosmic_ronin'] ?? {};
    if (!(ns.unlockedSkills ?? []).includes('wa_no_koe')) return null;
    if (!melodyLine || melodyLine.length === 0 || !chordStack) return null;

    // "Aligns" means the melody notes overlap with the notes in the chord stack.
    // Check if at least half the melody notes appear in the chord stack.
    const chordNotes = new Set((chordStack ?? []).map(n => typeof n === 'string' ? n.replace(/\d/g, '') : n));
    if (chordNotes.size === 0) return null;
    const melodyNotes = melodyLine.map(n => typeof n === 'string' ? n.replace(/\d/g, '') : n);
    const matchCount = melodyNotes.filter(n => chordNotes.has(n)).length;
    const alignRatio = matchCount / melodyNotes.length;

    if (alignRatio >= 0.5) {
      // Determine which stat to boost based on chord quality
      // If more Drive notes → boost Drive, else boost Sustain
      const driveStack = ns.driveStack ?? [];
      const sustainStack = ns.sustainStack ?? [];
      const stat = driveStack.length >= sustainStack.length ? 'drive' : 'sustain';
      return { stat, turnsLeft: 3 };
    }
    return null;
  }

  // Apply Wa no Koe buff if triggered during melody commit
  function applyWaNoKoe(melodyLine, chordStack) {
    if (!acting || acting.id !== 'cosmic_ronin') return;
    const buff = checkWaNoKoe(melodyLine, chordStack);
    if (!buff) return;

    const ns = actingNoteState ?? {};
    const existing = ns.waNoKoeBuffs ?? [];
    const updated = [...existing, buff];

    // Apply the +1 bonus
    if (buff.stat === 'drive') {
      const curTemp = ns.tempDrive ?? 0;
      setNoteField(acting.id, { waNoKoeBuffs: updated, tempDrive: curTemp + 1 });
      addLog(`🎵 WA NO KOE! Melody harmonizes with the chord — +1 Drive for 3 rounds.`);
    } else {
      const curTemp = ns.tempSustain ?? 0;
      setNoteField(acting.id, { waNoKoeBuffs: updated, tempSustain: curTemp + 1 });
      addLog(`🎵 WA NO KOE! Melody harmonizes with the chord — +1 Sustain for 3 rounds.`);
    }
    triggerEffectFlash(acting.id, '🎵', '和', '#4488ff');
  }

  // Tick down Wa no Koe buffs at turn start (remove expired, decrement remaining)
  function tickWaNoKoe() {
    const ns = noteStates['cosmic_ronin'] ?? {};
    const buffs = ns.waNoKoeBuffs ?? [];
    if (buffs.length === 0) return;
    const updated = buffs
      .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
      .filter(b => b.turnsLeft > 0);
    // Expired buffs lose their bonus
    const expired = buffs.filter(b => b.turnsLeft <= 1);
    let driveLoss = 0, sustainLoss = 0;
    expired.forEach(b => {
      if (b.stat === 'drive') driveLoss++;
      else sustainLoss++;
    });
    const patch = { waNoKoeBuffs: updated };
    if (driveLoss > 0) {
      patch.tempDrive = Math.max(0, (ns.tempDrive ?? 0) - driveLoss);
      addLog(`🎵 Wa no Koe fades — Drive bonus -${driveLoss}.`);
    }
    if (sustainLoss > 0) {
      patch.tempSustain = Math.max(0, (ns.tempSustain ?? 0) - sustainLoss);
      addLog(`🎵 Wa no Koe fades — Sustain bonus -${sustainLoss}.`);
    }
    setNoteField('cosmic_ronin', patch);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // END SHREDDING RONIN REWORK
  // ═══════════════════════════════════════════════════════════════════════════

  function initiateSonicAttack(targetId) {
    if (!acting) return;
    if (rockGodActive) { addLog(`🤘 The Spirits stand UNITED — take it to the God!`); return; }
    if (actionTokenUsed) { addLog('🔊 Already used your Action Token this turn!'); return; }
    // (Main Amp — every Spirit is always wired from turn 1; no "unplugged" check.)

    const attacker = spirits.find(s => s.id === acting.id);
    const defender = spirits.find(s => s.id === targetId);
    if (!attacker || !defender) return;

    if (moveStepsLeft < 2) {
      addLog(`🔊 Not enough Action Points — Sonic Attack costs 2 AP.`);
      return;
    }

    // 👤 Ronin attacking dismisses shadow
    if (acting.id === 'cosmic_ronin') dismissShadowIllusion('the Ronin attacked');

    // 📡 RANGE GATE — outside your rig's radius the Sonic is OFFLINE entirely.
    // (Computed fresh from BOTH positions: bot calls arrive via scheduled
    // closures that may hold a stale render's actingRig, and the defender's
    // rig decides both the riff-off gate and their defence die below.)
    const atkRigLive = rigForSpirit(attacker);
    const defRigLive = rigForSpirit(defender);
    if (!atkRigLive.inRange) {
      addLog(`📡 ${attacker.name} is out of amp range — the rig can't reach this far. Move closer to home or buy Range.`);
      return;
    }

    dispatch(beatsSpent(2, true));
    setAction(null);
    setDeckThump({ id: attacker.id, key: Date.now() }); // corner stack thumps with the beam

    // 🔊 Sonic chord is saved for playback at the RESULT moment (beam blast/fizzle).
    // Moved from here to the result phase so the chord rings when the beam fires.
    const sonicChordNotes = [...(actingNoteState?.driveStack ?? [])];

    // ── RIFF-OFF TRIGGER ─────────────────────────────────────────────────────
    // A riff-off is a DUEL: both rigs have to be live for it to happen. Three
    // conditions, all required:
    //   1. the defender sits in the attacker's beam (already true to get here),
    //   2. the attacker sits in the defender's beam — they're facing each other
    //      down the same line,
    //   3. BOTH Spirits are inside their OWN rig's radius. A rival caught
    //      outside their amp range has nothing to answer with, so there's no
    //      duel — the Sonic lands as a plain attack and they defend on a d4.
    // (AP + Action Token were already spent above, same cost as a Sonic Attack.)
    if (!posing[targetId] && getSonicBeam(defender).has(attacker.num)) {
      if (defRigLive.inRange) {
        // ⚡ A riff-off is still a battle — charges burn off (no dice to boost here).
        burnChargesAfterBattle([attacker.id, targetId], 'the riff-off spent it');
        startRiffOff(attacker, defender);
        return;
      }
      addLog(`📡 ${defender.name} is beam-to-beam but OUT OF AMP RANGE — no rig to riff back with. No duel: the beam just hits, and they scramble a d4 defence.`);
    }

    const nsA     = noteStates[attacker.id] ?? {};
    const nsD     = noteStates[targetId]    ?? {};

    // ── Stage Effects / skill mods ────────────────────────────────────────────
    const skillMods = getBattleSkillMods(attacker.id, targetId);
    if (skillMods.laserActive)  addLog(`🔴 Laser Show fires! Defender's die will be halved.`);
    if (skillMods.fogActive)    addLog(`🌫️ Fog Machine fires! Defender -1 Drive, -1 Sustain this battle.`);
    if (skillMods.pyroBonus > 0)addLog(`🔥 Pyrotechnics! +${skillMods.pyroBonus} bonus added to Drive roll.`);

    // ── Rig pool (AMP_DECK_DESIGN.md §2) ────────────────────────────────────
    // The pool comes from sonicRig (computed at render); ampTier is derived
    // from skill IDs so Power Chords / Hydra gates stay readable.
    const atkSkills    = nsA.unlockedSkills ?? [];
    const ampTier     = ['amp_1','amp_2','amp_3'].filter(id => atkSkills.includes(id)).length;

    // PA skill bonuses for Sonic Attack
    const pedalBonus   = atkSkills.includes('pedal_dist') ? 1 : 0;
    const powerBonus   = (atkSkills.includes('power_chords') && ampTier >= 2) ? 2 : 0;
    if (pedalBonus)  addLog(`🎛️ Pedal Distortion! +1 Drive on Sonic Attack.`);
    if (powerBonus)  addLog(`🤘 Power Chords! +2 Drive (Amp ${ampTier}).`);

    // 🎸 Harmony → combat: Drive from driveStack, Sustain from sustainStack
    // (falls back to the static spirit stat until a stack has been played).
    const atkChord = (nsA.driveStack?.length) ? spiritChord(attacker.id, nsA.driveStack) : null;
    const defChord = (nsD.sustainStack?.length) ? spiritChord(targetId, nsD.sustainStack) : null;
    const atkChordDrive   = atkChord ? atkChord.drive   : (attacker.drive ?? 6);
    let   defChordSustain = defChord ? defChord.sustain : (defender.sustain ?? 5);
    // 💥 SMASH EXPOSURE — a Smashed rival is wide open: this blow ignores their Sustain, then clears.
    if (nsD.smashExposed) { defChordSustain = 0; setNoteField(targetId, { smashExposed: false }); addLog(`💥 ${defender.name} is Exposed — the hit lands clean!`); }
    if (atkChord) addLog(`🎸 ${attacker.name}'s chord: ${atkChord.name} (⚔️${atkChord.drive})${defChord ? ` vs ${defender.name}'s ${defChord.name} (🛡️${defChord.sustain})` : ''}`);
    // 🛡️ Chord fray moved POST-ROLL (Stance rework) — see after the verdict below.
    // 🔊 Sonic attack spends 1 note from driveStack hit-or-miss.
    // Defender loses 1 from sustainStack on hit (handled by fray).
    const sonicSpendN     = 1;  // always 1 in the new system
    const sonicChordLeft  = (nsA.driveStack ?? []).slice(sonicSpendN);
    const sonicChordSpent = (nsA.driveStack ?? []).slice(0, sonicSpendN);
    if (sonicChordSpent.length) {
      setNoteField(attacker.id, { driveStack: sonicChordLeft });
      // 🎵 The note leaves the Spirit — show it tearing off the standee.
      showSpentNotes(attacker.id, sonicChordSpent, 'drive');
      addLog(`🎸 ${attacker.name} projects ${sonicChordSpent.join('')} from the drive stack — ${sonicChordLeft.length ? spiritChord(attacker.id, sonicChordLeft).name : 'drive exhausted (base stats until committed)'}.`);
    }

    // 6️⃣ BERSERK — same uncapped base treatment as the Thrash path.
    const atkBerserk = nsA.berserk ? BEAST_DRIVE : 0;
    if (atkBerserk) { addLog(`6️⃣ THE BEAST IS LOOSE — +${BEAST_DRIVE} Drive, no ceiling.`); beastAttackToll(acting.id); }
    const atkBase  = atkChordDrive + (nsA.instrumentDropped ? -1 : 0)
                   + skillMods.pyroBonus + pedalBonus + powerBonus + atkBerserk;
    const atkEdge  = edgeCombatMods(nsA);
    const defEdge   = edgeCombatMods(nsD);
    // ⚖️ Same stacked-bonus cap as Thrash (balance audit, 2026-07-16).
    const rawAtkBonus = (nsA.tempDrive ?? 0) + (nsA.moshDrive ?? 0) + atkEdge.drive;
    const atkBonus = Math.min(rawAtkBonus, ATK_BONUS_CAP);
    if (rawAtkBonus > atkBonus) addLog(`⚖️ The rig can only take so much — attack bonus capped at +${ATK_BONUS_CAP} (was +${rawAtkBonus}).`);
    const atkStat  = atkBase + atkBonus;
    const defBase  = defChordSustain - (skillMods.fogActive ? 1 : 0) - (nsD.swingExposed ? 1 : 0);
    const defBonus = (nsD.tempSustain ?? 0) - defEdge.sustainPenalty;
    const defStat  = defBase + defBonus;
    const defenderPosing = posing[targetId];

    // Every Spirit is wired (Main Amp) — "plugged in" universally.
    const defHex = HEX_BY_NUM[defender.num];

    // Is the target at range (not directly adjacent)?
    const atkHex    = HEX_BY_NUM[attacker.num];
    const isAtRange = atkHex && defHex
      ? axialDist(atkHex.q, atkHex.r, defHex.q, defHex.r) > 1
      : false;

    // Retaliation: both wired, so only blocked when defender is out of their own
    // rig range (baseline 1d6 can't project a counter-beam). Check defender's rig.
    const defRig = defRigLive;
    const retaliationBlocked = isAtRange && defRig.pool.length <= 1;

    // 🛡️ DEFENCE DIE — inside their own rig radius the rival braces against the
    // beam with their amp behind them (d6). Outside it there's no rig to answer
    // with, so they scramble a bare d4. Same rule that just blocked the riff-off.
    const defOutOfRig = !defRig.inRange;
    const defDieSonic = defOutOfRig ? SONIC_DEF_DIE_OUT_OF_RIG : SONIC_DEF_DIE;
    if (defOutOfRig) {
      addLog(`📡🛡️ ${defender.name} is outside their own amp range — no rig to brace with. They defend on a d${SONIC_DEF_DIE_OUT_OF_RIG} instead of a d${SONIC_DEF_DIE}.`);
    }

    // Roll — attacker's pool from sonicRig (computed at render).
    let   dicePool    = [...actingRig.pool];
    // ⚡ CHARGE ZONE charges — attacks only. Ceiling grows EVERY die in the pool
    // one size (d6→d8, d8→d10, capped d12); floor clamps every die's result to
    // at least 1+CHARGE_FLOOR_BONUS. The dormant dieFloorBoost (octave
    // resolution / Spinal Tap) wires in too — strongest floor wins, no stacking.
    const chargeFloorA = (nsA.chargeFloorTurns ?? 0) > 0;
    const chargeCeilA  = (nsA.chargeCeilTurns  ?? 0) > 0;
    if (chargeCeilA) dicePool = dicePool.map(s => Math.min(12, s + 2));
    const atkFloor    = Math.max(chargeFloorA ? CHARGE_FLOOR_BONUS : 0, nsA.dieFloorBoost ?? 0);
    if (chargeFloorA) addLog(`⚡ ${attacker.name}'s floor charge crackles — no die reads below ${1 + CHARGE_FLOOR_BONUS}!`);
    if (chargeCeilA)  addLog(`⚡ ${attacker.name}'s ceiling charge surges — every die in the pool grows a size!`);
    const diceLabel   = rigPoolLabel(dicePool);
    const dieSides    = Math.max(...dicePool); // fallback for single-die animation paths
    const rollState = dispatch(attackRolled('sonic', attacker.id, targetId, {
      atkStat, defStat,
      posing: defenderPosing,
      halveDef: skillMods.halveDef,
      dicePool, atkFloor,
      defDie: defDieSonic,   // d6 in rig range, d4 when the rival is stranded
    }));
    const {
      atkRoll, defRoll, atkTotal, defTotal, attackerWon, margin, diceVals, keptIdx,
    } = rollState.battle;
    let damage = rollState.battle.damage;
    recordBattleTotals(attacker.id, targetId, atkTotal, defTotal, attackerWon); // 📊 scoreboard
    // (Hydra log removed — Ronin rework)

    // 🛡️ Fray on the verdict — the defender's chord takes real damage only when
    // the beam lands (margin-scaled, +1 from the rear wedge; see applyChordFray).
    // A beam to the back of the head counts: the rear wedge is about which way
    // the DEFENDER is braced, not how far away the attacker was standing.
    if (attackerWon) applyChordFray(targetId, margin, isHitFromBehind(attacker, defender));

    if (nsA.instrumentDropped) addLog(`🎸💥 ${attacker.name} playing on dropped instrument — Drive -1!`);
    addLog(`🔊 ${attacker.name} launches SONIC ATTACK at ${defender.name}! (${diceLabel} keep best vs d${defDieSonic}${actingRig.inRange ? '' : ' · baseline'}${retaliationBlocked ? ' — TARGET OUT OF RIG RANGE, CANNOT RETALIATE!' : ''})`);
    // ⚡ A battle ensued — Charge Zone charges burn off for BOTH combatants.
    burnChargesAfterBattle([attacker.id, targetId], 'the Sonic battle spent it');
    // ☀️🔥 SUNBEAM — the beam scorches every hex it crosses into burning ground (reuses the
    // Disco Inferno flaming-hex hazard: entering one costs 1 Vibe). Area denial down the line.
    const hasSunbeam = attacker.id === 'intergalactic_0' && atkSkills.includes('sunbeam');
    if (hasSunbeam) {
      const scorched = [...getSonicBeam(attacker)];
      {
        const prev = engineRef.current.board.flamingHexes;
        const merged = [...new Set([...(prev.hexes ?? []), ...scorched])];
        dispatch(flamingHexesSet(merged, Math.max(prev.roundsLeft ?? 0, 2)));
      }
      addLog(`☀️🔥 SUNBEAM scorches the stage — ${scorched.length} hex${scorched.length !== 1 ? 'es' : ''} burn for 2 rounds!`);
    }

    playBattleMusic(battleSong, 0.7);
    dieSettledRef.current = { atk: false, def: false }; // fresh battle, fresh dice
    setBattleState({
      phase: 'enter_attacker',
      attackerId: acting.id, defenderId: targetId,
      atkStat, defStat, atkBase, atkBonus, defBase, defBonus,
      atkRoll, defRoll, atkTotal, defTotal,
      attackerWon, margin, damage,
      posing: defenderPosing,
      pickPos: 0,
      spinFaceAtk: 1, spinFaceDef: 1,
      atkDieReady: false, defDieReady: false,
      sonicAttack: true,
      ampCount: ampTier,
      dieSides,                  // = max(dicePool); fallback for single-die anim paths
      defDieSides: defDieSonic,  // Sonic: d6 in rig range, d4 stranded outside it
      defOutOfRig,               // 📡 drives the "no rig" tell on the battle overlay
      dicePool,                  // 🔊 keep-highest pool: die sizes, e.g. [6,6,8]
      diceVals,                  // rolled values (length === dicePool.length)
      diceSpin: diceVals,        // animated faces while spinning (seeded to the result)
      keptIdx,                   // index of the kept (max) die
      diceLabel,                 // "2d6" / "2d6+d8" / "3d8"
      // (hydra flag removed — Ronin rework)
      sunbeam: hasSunbeam,       // ☀️ extra-lit beam (Intergalactic 0 capstone)
      retaliationBlocked,
      skillMods,
      pedalBonus,
      powerBonus,
      sonicChordNotes, // 🔊 chord notes saved for playback at beam fire
    });
    setDiceDisplay({ atk: null, def: null, rolling: null });

    // ⏭ Auto-skip compresses the pre-die cinematic ~10× (slides still play in
    // order; only the die-click stays full-speed).
    const skipCine = skipBattleIntrosRef.current;
    battleTimersRef.current = [];
    const T = (fn, ms) => { const id = gt(fn, skipCine ? ms * 0.1 : ms); battleTimersRef.current.push(id); return id; };
    T(() => setBattleState(p => p ? { ...p, phase: 'flash_drive' }                                         : p), 700);
    T(() => setBattleState(p => p ? { ...p, phase: 'pick_drive_slide', pickPos: -atkStat }                 : p), 1400);
    T(() => setBattleState(p => p ? { ...p, phase: 'enter_defender' }                                      : p), 2800);
    T(() => setBattleState(p => p ? { ...p, phase: 'flash_sustain' }                                       : p), 3500);
    T(() => setBattleState(p => p ? { ...p, phase: 'pick_sustain_slide', pickPos: -atkStat + defStat }      : p), 4200);
    // ⚡ PERF: NeonDie self-animates its spin faces (incl. every pool die) —
    // no more 80 ms whole-app re-render interval during the spin.
    T(() => setBattleState(p => p ? { ...p, phase: 'atk_die_spin' } : p), 5600);
  }

  // ── (ACOUSTIC DUEL — REMOVED) ───────────────────────────────────────────────
  // Was the "unplugged" riff-off: adjacency only, no amps, smaller pot. Cut
  // because the fiction never supported it — this is a sci-fi stage and these
  // Spirits play electric instruments. Two of them twanging acoustically at
  // each other is not rock. The riff-off is now exclusively the plugged-in,
  // beam-crossed duel that escalates out of a Sonic Attack.

  // ── RIFF-OFF ENGINE ──────────────────────────────────────────────────────────
  // Sequential call-and-response on a shared keyboard: the attacker plays
  // their riff first, results are logged, the keyboard is passed, and the
  // defender answers with a transformed riff. Accuracy decides the winner;
  // average reaction time breaks ties.
  // (The 'acoustic' tier is GONE. It was conceived as an unplugged duel, which
  // doesn't survive contact with the setting: these Spirits are on a sci-fi
  // stage holding electric instruments. Two of them twanging acoustically at
  // each other isn't rock. Every riff-off is a plugged-in, beam-crossed duel.)
  function startRiffOff(attacker, defender) {
    // The engine generates both riffs + skill modifiers on its seeded rng and
    // stores them in engineState.battle — this client just renders that data.
    const atkNs = noteStates[attacker.id] ?? {};
    const slayer = false; // Riff Slayer removed — kept as false to avoid touching riffOffStarted signature
    const eRush  = false; // E-Rush removed — Ronin rework
    // Phase R1: pass the attacker's committed melody line so the engine builds
    // the riff from it (Rhythm Creation Device). hasRiff flags riffbook synergy.
    // The commit path stashes these in committedMelody/committedHasRiff since
    // melodyLine is cleared to [] after commit.
    const melodyLine = atkNs.committedMelody ?? null;
    const hasRiff    = !!atkNs.committedHasRiff;
    // Phase R2: difficulty tier caps riff length
    const activePreset = RIFF_FALL_DIFFICULTY[riffDifficultyRef.current] ?? RIFF_FALL_DIFFICULTY[RIFF_FALL_DEFAULT];
    const maxLen = activePreset.maxLen ?? RIFF_LEN;
    const eb = dispatch(riffOffStarted(attacker.id, defender.id, { slayer, eRush, melodyLine, hasRiff, maxLen })).battle;
    const atk = eb.atkRiff, def = eb.defRiff;
    const defGlitch = eb.defGlitch, defGhosts = eb.defGhosts;
    const defNotesArr = riffDegreesToNotes(def.degrees, def.sharps);
    // Log: show whether the riff came from the player's melody or was random
    if (eb.fromMelody) {
      addLog(`🎸🔥 RIFF-OFF! ${attacker.name} steps up with their OWN melody — ${defender.name} must answer!`);
      if (eb.hasRiff) addLog(`✨ Legendary riff woven into the call — the crowd leans in!`);
    } else {
      addLog(`🎸🔥 RIFF-OFF! ${attacker.name} and ${defender.name} lock eyes — both plugged in, beams crossed!`);
    }
    addLog(`🎶 ${attacker.name} calls a ${RIFF_CONTOUR_LABELS[atk.contour]} — ${defender.name} must answer with a ${RIFF_ANSWER_LABELS[def.kind].name}.`);

    // (Riff Slayer removed — glitch mechanics no longer active)

    // (E-Rush riff-off logic removed — Ronin rework)

    riffEngineRef.current = null;
    playBattleMusic(riffOffSong, 0.7);
    setBattleState({
      riffOff: true, sonicAttack: true,   // sonicAttack → sonic-scale knockback
      oneLiner: null,                    // Phase R5.2: { attacker: {line,dropped}, defender: {line,dropped} }
      phase: 'riff_intro',
      attackerId: attacker.id, defenderId: defender.id,
      atkRiff: { notes: riffDegreesToNotes(atk.degrees, atk.sharps),
                 freqs: atk.degrees.map((d, i) => riffDegreeFreq(d, atk.sharps[i])),
                 rhythm: atk.rhythm, contour: atk.contour,
                 voicing: voiceRiff(atk.degrees, atk.sharps, atk.rhythm) },
      defRiff: { notes: defNotesArr,
                 freqs: def.degrees.map((d, i) => riffDegreeFreq(d, def.sharps[i])),
                 rhythm: def.rhythm, kind: def.kind,
                 voicing: voiceRiff(def.degrees, def.sharps, def.rhythm) },
      defGlitch, glitchAt: null,
      defGhosts, ghostHit: null,
      turn: 'attacker', noteIdx: -1, countdown: 3, round: 1,
      atkResults: [], defResults: [], feedback: null,
    });
    setDiceDisplay(null);
  }

  function riffBeginTurn(turn) {
    getRiffAudio(); getAudioCtx(); // unlock both audio paths on this user gesture (SFX + amp)
    const round = battleStateRef.current?.round ?? 1;
    const cdStep = round >= 2 ? 520 : 800; // Round 2 counts in faster — less breathing room
    setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_countdown', turn, countdown: 3, noteIdx: -1, feedback: null } : p);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      if (!battleStateRef.current?.riffOff) { clearInterval(iv); return; }
      if (c > 0) setBattleState(p => p?.riffOff ? { ...p, countdown: c } : p);
      else { clearInterval(iv); riffStartRun(turn); }
    }, cdStep);
  }

  // ── FALLING-NOTES RUN ─────────────────────────────────────────────────────
  // The whole riff is scheduled up front: every note gets a hit-time on a
  // shared clock (t0), gems fall for `leadTime` ms and cross the strike line
  // exactly at their hit-time. Presses are judged by |press − hitTime|
  // (gradeRiffOffset); a note nobody catches becomes a MISS one ok-window past
  // its hit-time. Timing-critical bookkeeping lives on riffEngineRef (never
  // React state); the highway UI renders from a plain-data mirror on
  // battleState.riffRun. Timing/difficulty tuning: riff/fallingNotes.js.
  function riffStartRun(turn) {
    const bs = battleStateRef.current;
    if (!bs?.riffOff) return;
    const side   = turn === 'attacker' ? bs.atkRiff : bs.defRiff;
    const round  = bs.round ?? 1;
    // 🐢 The run restated at the player's chosen tempo: lead-in, note spacing
    // and grade windows all stretch together, so the riff keeps its groove and
    // only the clock moves. Build the timeline at the WRITTEN lead time and
    // scale after — hitAt[0] IS the lead time and later entries are lead +
    // cumulative gaps, so one uniform divide moves both. (Same helpers the
    // practice trainer uses; pinned by riff/neonNeck.test.mjs.)
    const written  = RIFF_FALL_DIFFICULTY[riffDifficultyRef.current] ?? RIFF_FALL_DIFFICULTY[RIFF_FALL_DEFAULT];
    const spd      = riffSpeedRef.current;
    const preset   = scalePresetForSpeed(written, spd);
    const timeline = scaleTimelineForSpeed(buildRiffTimeline(side.rhythm, round, written.leadTime), spd);
    const voicing = side.voicing;  // Guitar-neck voicing (computed once in startRiffOff)
    const eng = {
      turn, preset, t0: performance.now(), timers: [],
      notes: side.notes.map((k, i) => {
        const feel     = timeline[i]?.feel ?? 'steady';
        const ghostKey = (turn === 'defender' && bs.defGhosts) ? bs.defGhosts[i] : null;
        return {
          idx: i, key: k, feel, ghostKey,
          pos: voicing?.positions?.[i] ?? null,             // [string, fret] from voiceRiff
          hitAt: timeline[i]?.hitAt ?? (preset.leadTime + i * 1000),
          okWin: riffOkWindow(preset, feel, !!ghostKey),
          resolved: false, hitMain: false, hitGhost: false,
        };
      }),
      anchors: voicing?.anchors ?? null,                   // camera script for the guitar view
    };
    riffEngineRef.current = eng;

    // Per-note MISS timers — fire once the gem is past saving.
    eng.notes.forEach(n => {
      eng.timers.push(setTimeout(() => {
        if (riffEngineRef.current !== eng || n.resolved) return;
        n.resolved = true;
        playRiffMiss();
        riffRecordResult(turn, { hit: false, rt: null, grade: 'miss', noteIdx: n.idx });
        riffCheckRunEnd(eng);
      }, n.hitAt + n.okWin + 40));
    });

    // 🗡️ RIFF SLAYER — flagged answer notes LURCH mid-fall: the gem (and the
    // real target) swap to a different note partway down the highway, so the
    // rattled rival's read misfires.
    if (turn === 'defender' && (bs.defGlitch ?? []).length) {
      bs.defGlitch.forEach(idx => {
        const n = eng.notes[idx];
        if (!n) return;
        const swapAt = Math.max(80, n.hitAt - preset.leadTime * (0.35 + Math.random() * 0.25));
        eng.timers.push(setTimeout(() => {
          if (riffEngineRef.current !== eng || n.resolved) return;
          const cur = battleStateRef.current;
          if (!cur?.riffOff) return;
          const curNote = cur.defRiff?.notes?.[idx];
          const { letter, freq } = pickGlitchRiffNote(curNote);
          const oldPos = n.pos;
          const newPos = nearestPositionForKey(letter, oldPos ?? [2, 2]);
          n.key = letter;
          n.pos = newPos;
          setBattleState(p => {
            if (!p?.riffOff) return p;
            const notes2 = [...p.defRiff.notes]; notes2[idx] = letter;
            const freqs2 = [...(p.defRiff.freqs ?? [])]; freqs2[idx] = freq;
            const run2 = p.riffRun ? { ...p.riffRun,
              notes: p.riffRun.notes.map(g => g.idx === idx ? { ...g, key: letter, glitched: true, pos: newPos } : g) } : p.riffRun;
            return { ...p, defRiff: { ...p.defRiff, notes: notes2, freqs: freqs2 }, glitchAt: idx, riffRun: run2 };
          });
          playRiffWrong(curNote || 'a'); // a sour stab as the gem lurches
        }, swapAt));
      });
    }

    // Publish the run for the highway (plain data — gem positions derive from hitAt).
    setBattleState(p => p?.riffOff ? {
      ...p, phase: 'riff_play', turn, noteIdx: -1, glitchAt: null, ghostHit: null, feedback: null,
      riffRun: {
        turn, round, startedAt: eng.t0, leadTime: preset.leadTime, difficulty: riffDifficultyRef.current,
        notes: eng.notes.map(n => ({ idx: n.idx, key: n.key, hitAt: n.hitAt, feel: n.feel, ghostKey: n.ghostKey, okWin: n.okWin, pos: n.pos })),
        anchors: eng.anchors,  // Guitar-neck camera script (phrase windows)
      },
    } : p);
  }

  // Judge a note-key press (keyboard or strike-zone tap) against the falling run.
  function riffPressKey(key) {
    const eng = riffEngineRef.current;
    const bs  = battleStateRef.current;
    if (!eng?.notes || !bs?.riffOff || bs.phase !== 'riff_play' || bs.turn !== eng.turn) return;
    const now  = performance.now() - eng.t0;
    const side = eng.turn === 'attacker' ? bs.atkRiff : bs.defRiff;
    // Reachable notes right now, nearest to its hit-time first…
    const live = eng.notes
      .filter(n => !n.resolved && Math.abs(now - n.hitAt) <= n.okWin)
      .sort((a, b) => Math.abs(now - a.hitAt) - Math.abs(now - b.hitAt));
    if (!live.length) return; // nothing in reach — a press into empty air is ignored
    // …preferring one this key actually matches (two gems can crowd the line);
    // among matches take the EARLIEST hit-time, so a late catch of gem k can't
    // be stolen by a same-letter gem k+1 whose window just opened.
    const matches = live.filter(x => key === x.key || (x.ghostKey && key === x.ghostKey));
    const n = matches.length
      ? matches.reduce((a, b) => (a.hitAt <= b.hitAt ? a : b))
      : live[0];
    const offset = Math.round(now - n.hitAt);

    // 🎴 いいラッシュ / E-RUSH — this note carries a GHOST: both the real key and
    // the ghost key must land inside the window. Graded on the SECOND press.
    if (n.ghostKey) {
      if (key === n.key) n.hitMain = true;
      else if (key === n.ghostKey) n.hitGhost = true;
      else return; // wrong key — ignored, the window keeps running
      playNoteSound(null, { freq: side.freqs?.[n.idx], holdTime: 0.3, fadeTime: 0.35, volume: 0.16 });
      setBattleState(p => p?.riffOff ? { ...p, ghostHit: { idx: n.idx, main: n.hitMain, ghost: n.hitGhost } } : p);
      if (!(n.hitMain && n.hitGhost)) return; // need both — keep waiting
      n.resolved = true;
      const grade2 = gradeRiffOffset(offset, eng.preset, n.feel) ?? 'ok';
      riffRecordResult(eng.turn, { hit: true, rt: Math.abs(offset), grade: grade2, noteIdx: n.idx });
      riffCheckRunEnd(eng);
      return;
    }

    n.resolved = true;
    const hit   = key === n.key;
    const grade = hit ? (gradeRiffOffset(offset, eng.preset, n.feel) ?? 'ok') : 'wrong';
    // ── the note RINGS through the player's own amp — same distorted
    //    guitar voice (and 🎛️ knob settings) as the Melody Line. A wrong
    //    key plays the sour bent note they actually hit.
    if (hit) {
      const fr   = side.freqs?.[n.idx];
      const hold = grade === 'perfect' ? 0.5 : grade === 'good' ? 0.42 : 0.34;
      const vol  = grade === 'perfect' ? 0.22 : grade === 'good' ? 0.18 : 0.14;
      // 🤘 POWER CHORD — root + fifth on every landed gem, so hits SLAM
      playNoteSound(null, { freq: fr, holdTime: hold, fadeTime: 0.4, volume: vol });
      if (fr) playNoteSound(null, { freq: fr * 1.5, holdTime: hold, fadeTime: 0.4, volume: vol * 0.5 });
    }
    else playRiffWrong(key);
    riffRecordResult(eng.turn, { hit, rt: hit ? Math.abs(offset) : null, grade, noteIdx: n.idx, early: offset < 0 });
    riffCheckRunEnd(eng);
  }

  // Once every gem is judged, let the last flash breathe and hand the turn on.
  function riffCheckRunEnd(eng) {
    if (eng.notes.some(n => !n.resolved)) return;
    eng.timers.forEach(clearTimeout);
    setTimeout(() => {
      if (riffEngineRef.current !== eng) return;
      riffEndTurn(eng.turn);
    }, 700);
  }

  function riffRecordResult(turn, res) {
    setBattleState(p => {
      if (!p?.riffOff) return p;
      const key = turn === 'attacker' ? 'atkResults' : 'defResults';
      return { ...p, [key]: [...p[key], res], noteIdx: res.noteIdx ?? p.noteIdx,
               feedback: { ...res, noteIdx: res.noteIdx ?? p.noteIdx, turn } };
    });
  }

  function riffEndTurn(turn) {
    riffEngineRef.current?.timers?.forEach(clearTimeout);
    riffEngineRef.current = null;
    // N12: online riff-offs — each side dispatches their own results so the
    // relay carries them to the other client. The acting client resolves once
    // both sides are in; the defender's client just submits and waits.
    const net = netRef.current;
    if (net && !net.spectator) {
      const bs = battleStateRef.current;
      const results = turn === 'attacker' ? bs?.atkResults : bs?.defResults;
      if (results) dispatch(riffResultsSubmitted(turn, results));
    }
    if (turn === 'attacker') {
      setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_handoff', feedback: null } : p);
    } else {
      // Offline / hotseat: resolve immediately. Online acting client: resolve
      // too (we just dispatched results, engine has both sides now).
      // Online defender client: the acting client resolves; we just wait.
      const isDefenderClient = net && !net.spectator && net.mySpiritId === battleStateRef.current?.defenderId;
      if (isDefenderClient) {
        // Defender client waits — the attacker (acting client) will resolve
        // and the RIFF_RESOLVED action will arrive via the relay.
        setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_handoff', feedback: null, waitingForResolve: true } : p);
      } else {
        riffResolve();
      }
    }
  }

  // Replay a riff-off performance through the in-game amp — same voice the
  // player heard while striking, groove (gaps + rests) intact.
  function playRiffOffPlayback(freqs, rhythm) {
    if (!freqs) return;
    const t0 = getAudioCtx().currentTime + 0.06;   // audio-clock — jank-immune
    let tMs = 0;
    freqs.forEach((fr, i) => {
      tMs += i === 0 ? 0 : 280 + (rhythm?.[i]?.gapBefore ?? RIFF_GAP_NORMAL);
      const w = t0 + tMs / 1000;
      // 🤘 power-chord replay — root + fifth
      playNoteSound(null, { freq: fr, holdTime: 0.4, fadeTime: 0.38, volume: 0.17, when: w });
      playNoteSound(null, { freq: fr * 1.5, holdTime: 0.4, fadeTime: 0.38, volume: 0.085, when: w });
    });
  }

  function riffResolve() {
    const bs = battleStateRef.current;
    if (!bs?.riffOff) return;
    // Submit both performances to the engine and let it rule the duel — the
    // multiplayer seam: networked clients will each submit their own results
    // array and every peer computes the identical verdict.
    // N12: online — each side already dispatched their results in riffEndTurn;
    // the engine battle slice has them. Offline/hotseat: still dispatch here.
    if (!netRef.current) {
      dispatch(riffResultsSubmitted('attacker', bs.atkResults));
      dispatch(riffResultsSubmitted('defender', bs.defResults));
    }
    // 📊 scoreboard — bank each performer's note grades (fires per round)
    recordRiffResults(bs.attackerId, bs.atkResults);
    recordRiffResults(bs.defenderId, bs.defResults);
    const verdict = dispatch(riffResolved()).battle.verdict;
    // damage is decided in the engine verdict now (Phase 3e) — no client re-derive.
    const { round, attackerWon, margin, tie, decidedBy, damage } = verdict;
    const A = verdict.atkStats, D = verdict.defStats;
    const atkName = spirits.find(s => s.id === bs.attackerId)?.name;
    const defName = spirits.find(s => s.id === bs.defenderId)?.name;
    const atkLen = bs.atkRiff?.notes?.length ?? RIFF_LEN;
    const defLen = bs.defRiff?.notes?.length ?? RIFF_LEN;
    if (tie) addLog(`🎸 RIFF-OFF R${round}: dead heat — both nailed ${A.hits}/${atkLen} at the same quality. The crowd can't pick a winner!`);
    else addLog(`🎸 RIFF-OFF R${round}: ${attackerWon ? atkName : defName} takes it on ${decidedBy}! (${A.hits}/${atkLen}·${A.perfects}✦·${A.quality}%${A.avgRt != null ? ` · ${A.avgRt}ms` : ''} vs ${D.hits}/${defLen}·${D.perfects}✦·${D.quality}%${D.avgRt != null ? ` · ${D.avgRt}ms` : ''})`);
    // Every riff-off is plugged in, so every riff-off ends in the beam clash.
    setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_clash', round, clashStage: 'charge',
      clashWinner: null, attackerWon, margin, damage, tie, decidedBy, atkStats: A, defStats: D } : p);
  }

  // ── BEAM CLASH ("Kamehameha") — DBZ-style finale to the riff-off ──────────
  // Both Spirits fire a beam from their end; the beams collide in the middle.
  // The better-performed riff (already decided in riffResolve) owns the clash:
  // a decisive margin lets its beam overpower and sweep the loser off the stage.
  // If the duel is too close to break, the beams lock and SURGE into a higher-
  // stakes Round 2 (bigger beams, more damage). Capped at 2 rounds for now —
  // round 2 always resolves, even a dead-even one as a cancel-out dead heat.
  function fireBeamClash() {
    const bs = battleStateRef.current;
    if (!bs?.riffOff || bs.phase !== 'riff_clash' || bs.clashStage !== 'charge') return;
    const round = bs.round ?? 1;
    // N12: online — only the acting client dispatches engine actions + log lines.
    // The defender's client runs the presentational beam animation but waits for
    // the RIFF_ROUND2_STARTED relay (if Round 2 triggers) to update riff data.
    const net = netRef.current;
    const isActingClient = !net || net.spectator || net.mySpiritId === bs.attackerId;
    setBattleState(p => p?.riffOff ? { ...p, clashStage: 'clash' } : p); // beams shoot + collide
    playBeamClash(round >= 2);
    setTimeout(() => {
      const s = battleStateRef.current;
      if (!s?.riffOff || s.phase !== 'riff_clash') return;
      const decisive = !s.tie && s.margin >= 3;        // ≥2-note accuracy gap = total domination
      if (round >= 2 || decisive) {
        const winner = s.tie ? null : (s.attackerWon ? 'attacker' : 'defender');
        if (isActingClient) {
          const wName  = winner ? spirits.find(x => x.id === (winner === 'attacker' ? s.attackerId : s.defenderId))?.name : null;
          addLog(winner
            ? `🌟 BEAM CLASH${round >= 2 ? ' — FINAL ROUND' : ''}: ${wName}'s beam OVERPOWERS and sweeps the stage!`
            : `🌟 BEAM CLASH: the beams cancel out — neither Spirit breaks through!`);
        }
        playBeamBreak(round >= 2);
        setBattleState(p => p?.riffOff ? { ...p, clashStage: 'break', clashWinner: winner } : p);
        setTimeout(() => setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_result' } : p), 2000);
      } else {
        // Too close to break — beams lock, SURGE, and we play a real ROUND 2:
        // fresh riffs, faster and meaner, sudden death. The round-1 beams stay
        // locked in the background while the new riffs play out.
        if (isActingClient) addLog(`⚡ ROUND 1 TOO CLOSE — the beams LOCK and SURGE! Bring on ROUND 2!`);
        playBeamSurge();
        setBattleState(p => p?.riffOff ? { ...p, clashStage: 'escalate' } : p);
        // N12: only the acting client dispatches RIFF_ROUND2_STARTED and builds
        // the overlay's R2 data — the remote handler does it for the defender.
        if (isActingClient) {
          setTimeout(() => {
            const s2 = battleStateRef.current;
            if (!s2?.riffOff) return;
            // Engine: fresh riffs at 0.58× speed, skill mods rerolled on its rng
            const eb2 = dispatch(riffRound2Started()).battle;
            const atk = eb2.atkRiff, def = eb2.defRiff;
            const mk = (r, extra) => ({
              notes: riffDegreesToNotes(r.degrees, r.sharps),
              freqs: r.degrees.map((d, i) => riffDegreeFreq(d, r.sharps[i])),
              rhythm: r.rhythm, // already sped up by the engine
              voicing: voiceRiff(r.degrees, r.sharps, r.origRhythm ?? r.rhythm),
              ...extra,
            });
            addLog(`🎸🔥 ROUND 2! New riffs — faster, meaner, sudden death!`);
            const r2Glitch = eb2.defGlitch;
            if (r2Glitch.length > 0) {
              addLog(`🗡️ Still rattled — Riff Slayer lurches ${r2Glitch.length} of their Round 2 notes!`);
            }
            const r2Ghosts = eb2.defGhosts;
            if (r2Ghosts) {
              addLog(`🎴 The ghost barrage rages on — Round 2 answer notes still demand TWO keys!`);
            }
            setBattleState(p => p?.riffOff ? {
              ...p,
              round: 2,
              r1Won: s2.attackerWon, r1Tie: s2.tie, r1Margin: s2.margin,
              atkRiff: mk(atk, { contour: atk.contour }),
              defRiff: mk(def, { kind: def.kind }),
              defGlitch: r2Glitch, glitchAt: null,
              defGhosts: r2Ghosts, ghostHit: null,
              atkResults: [], defResults: [],
              turn: 'attacker', noteIdx: -1, feedback: null,
              clashStage: null, clashWinner: null,
              phase: 'riff_r2intro',
            } : p);
          }, 1700);
        }
        // Defender's client: the RIFF_ROUND2_STARTED relay will set phase to
        // 'riff_r2intro' with the new riff data — no local action needed.
      }
    }, 1600);
  }

  // Close the riff-off overlay and apply consequences through the normal
  // battle pipeline: knockback, Vibe damage, Fame. The duel is symmetric —
  // whoever loses takes the hit, attacker or defender alike.
  function closeRiffOff() {
    dispatch(riffClosed()); // engine: clear the battle slice
    const s = battleStateRef.current;
    if (!s?.riffOff) { setBattleState(null); setDiceDisplay(null); return; }
    const { attackerWon, margin, damage, tie, attackerId, defenderId } = s;
    if (!tie) {
      const winnerId = attackerWon ? attackerId : defenderId;
      const loserId  = attackerWon ? defenderId : attackerId;
      // Knockback uses Sonic push rules (stage presence matters).
      const loser = spirits.find(x => x.id === loserId);
      battleKnockback(winnerId, loserId, sonicKnockback(margin, loser?.vibe ?? 1, loser?.maxVibe ?? 1));
      // ── 🎤 ONE-LINER — smack talk is automatic, no risk/reward payout ──
      resolveWinDamage(winnerId, loserId, damage, spirits.find(x => x.id === winnerId)?.name);
      // Phase R6: dedicated riff-off FP engine (replaces awardSonicFame).
      awardRiffFame(winnerId, loserId, s);
      // 👑 HEADLINER — winner of any riff-off claims the title
      const prevHeadliner = engineRef.current.headliner;
      dispatch(headlinerChanged(winnerId));
      const winnerName = spirits.find(x => x.id === winnerId)?.name;
      if (prevHeadliner && prevHeadliner !== winnerId) {
        const prevName = spirits.find(x => x.id === prevHeadliner)?.name;
        addLog(`👑 ${winnerName} SEIZES the Headliner title from ${prevName}!`);
        triggerEffectFlash(winnerId, '👑', 'HEADLINER!', '#ffd700');
      } else if (!prevHeadliner) {
        addLog(`👑 ${winnerName} claims the Headliner title!`);
        triggerEffectFlash(winnerId, '👑', 'HEADLINER!', '#ffd700');
      }
      // (B5: consumeAttackCharges call removed — nothing left to consume.)
    }
    clearBattleBuffs(attackerId, defenderId);
    riffEngineRef.current?.timers?.forEach(clearTimeout);
    riffEngineRef.current = null;
    setBattleState(null);
    setDiceDisplay(null);
  }

  // ── 🎤 ONE-LINER — riff-off mic drop system (Phase R5.2) ─────────────────────
  // Before the riff, each side can drop a one-liner — a punny lyric reference
  // that says "I'm so confident I'll put my reputation on it." Back it up and
  // the crowd loves you (bonus fans). Talk big and lose → 1.5× Vibe damage +
  // casuals scatter. Pure swagger, pure risk, tied to each Spirit's music.
  const ONE_LINERS = {
    cosmic_ronin: [
      "Draw you pick!",
      "There can only be one solo",
      "Play with honor... If you can",
      "Your encore ends here",
      "My katana is tuned to D-E-A-D",
      "A missed note is a broken oath.",
      "Your fate is already in the key signature",
      "Hope you practiced your scales",
      "Try to keep up",
      "You're about to hear the impossible",
      "My arm just snapped, and I'm going to...",
      "If its too difficult, then just stop",
      "just put your guitar on ebay or something",
      "Here goes 5 million beats a minute",
      "Watch closely. You won't understand it.",
      "Lets see how fast regret sounds",
      "I'll autograph your broken strings",
      "Your metronome won't save you",
      "This won't take long",
      "The road is lonely because I leave no rivals.",
      "You're in treble now",
      "This duel has strings attached",
      "You're about to lose face... And tempo",
      "You'll B-flat on your back",
      "No hard feelings... Only hard riffs",
    ],
    intergalactic_0: [
      "Your planet ain't on my tour",
      "Gravity can't hold my flow",
      "I don't drop bars, I drop meteors",
      "I'm platinum on seven planets",
      "Hope you packed extra speakers",
      "Engaging maximum swagger",
      "Initializing beatdown protocol",
      "Your defeat has been calculated",
      "My processor spits hotter verses",
      "Downloading your defeat",
      "Error 404: Competition not found",
      "Time bends around my beat",
      "Your future remembers losing",
      "Don't hate the player. Upgrade. It might matter.",
      "Houston... You got problems",
      "You're out of your orbit",
      "Your whole galaxy's gonna hear this L",
    ],
    Metalness_Monster: [
      "Monster hungry. You first",
      "I'll chew through your solos",
      "Run while you still hear",
      "your bones make great drumsticks",
      "I smell fear... And cheap strings",
      "No ballads. Only carnage",
      "Fast! Loud! Die!",
      "Prepare for Maximum Distortion!!",
      "Metal never dies. You might.",
      "Tiny guitar. Tiny courage.",
      "Monster Strongest!",
      "Monster always gets encore.",
      "Monster SMASH. Then solo.",
      "Monster born heavy.",
      "No mercy. No clean tone",
    ],
    Glamarchy: [
      "Try not to ruin my entrance",
      "Watch and learn, sweetheart",
      "Welcome to the stage baby, you're gonna die!",
      "Mirror mirror... Still me.",
      "Great hair. Better solos",
      "I don't chase fame. Fame follows me!",
      "Rules are for opening acts. You!",
      "I don't follow trends - I start riots!",
      "I'm here for a good time. And your downfall.",
      "Turn it up and deal with it",
      "You're cute. For an opponent",
      "Don't blush",
      "One more for the fans *winks at the groupies*",
      "Too glam to give a damn",
      "Live loud. Die legendary.",
      "Break hearts. Break amps",
      "No rules. No regrets",
      "Lights up, game's over darling!",
      "I play dirty while looking fabulous!",
    ],
  };

  /** Pick a random one-liner for a spirit, avoiding the last one used. */
  function pickRandomOneLiner(spiritId) {
    const pool = ONE_LINERS[spiritId] ?? ONE_LINERS.cosmic_ronin;
    const last = (noteStates[spiritId] ?? {}).lastOneLiner ?? '';
    const filtered = pool.filter(l => l !== last);
    const line = filtered[Math.floor(Math.random() * filtered.length)] ?? pool[0];
    // Remember the last one used so we don't repeat
    setNoteStates(prev => ({ ...prev, [spiritId]: { ...prev[spiritId], lastOneLiner: line } }));
    return line;
  }

  function enterRiffAnte() {
    // ── AUTO SMACK TALK — both sides always drop a line, no decision/risk ──
    const bs = battleStateRef.current;
    if (!bs?.riffOff) return;
    const atkLine = pickRandomOneLiner(bs.attackerId);
    const defLine = pickRandomOneLiner(bs.defenderId);
    const atkName = spirits.find(s => s.id === bs.attackerId)?.name;
    const defName = spirits.find(s => s.id === bs.defenderId)?.name;
    addLog(`🎤 ${atkName}: "${atkLine}" 🎤🔥`);
    triggerEffectFlash(bs.attackerId, '🎤', 'MIC DROP!', '#ff6600');
    // 🎤 BIG BOLD TAUNT — attacker's line splashes across the screen
    const atkColor = spirits.find(s => s.id === bs.attackerId)?.color ?? '#ff6600';
    setTauntDisplay({ line: atkLine, name: atkName, color: atkColor, key: `taunt-atk-${Date.now()}` });
    setTimeout(() => setTauntDisplay(null), 2200);
    setTimeout(() => {
      addLog(`🎤 ${defName}: "${defLine}" 🎤🔥`);
      triggerEffectFlash(bs.defenderId, '🎤', 'FIRED BACK!', '#ff6600');
      // 🎤 BIG BOLD TAUNT — defender's line splashes across the screen
      const defColor = spirits.find(s => s.id === bs.defenderId)?.color ?? '#44aaff';
      setTauntDisplay({ line: defLine, name: defName, color: defColor, key: `taunt-def-${Date.now()}` });
      setTimeout(() => setTauntDisplay(null), 2200);
    }, 2400);
    setBattleState(p => p?.riffOff ? {
      ...p,
      oneLiner: {
        attacker: { line: atkLine, dropped: true },
        defender: { line: defLine, dropped: true },
      },
    } : p);
    // Skip directly to the riff countdown after a brief pause (extended for taunt display)
    setTimeout(() => riffBeginTurn('attacker'), 5000);
  }

  // Legacy stubs — no longer called (auto smack talk replaced the choice)
  function pickOneLiner(_drop) { enterRiffAnte(); }
  function respondOneLiner(_drop) {}

  // Zero out tempDrive/tempSustain for both combatants once a battle resolves.
  // Bonuses from melody line patterns last only for the turn they were built —
  // they should not compound across multiple battles.
  // ⚡ Also burns any active Dissonance Edge stance for BOTH combatants, win or
  // lose, attacker or defender — stepping into a fight spends the risk you were
  // carrying either way (DESIGN_AUDIT_v2.md §9 v2). No refund of the DB/fans
  // already paid and no collapse penalty either — the fight itself was the cost.
  function clearBattleBuffs(attackerId, defenderId) {
    setNoteStates(prev => {
      const next = { ...prev };
      if (attackerId && next[attackerId]) next[attackerId] = { ...next[attackerId], tempDrive: 0, edgeStage: 0 };
      if (defenderId && next[defenderId]) next[defenderId] = { ...next[defenderId], tempSustain: 0, edgeStage: 0 };
      return next;
    });
  }

  // Close the battle overlay and apply any pending effects immediately
  function closeBattleOverlay() {
    const s = battleStateRef.current;
    if (!s || s.phase !== 'result') { setBattleState(null); setDiceDisplay(null); return; }
    const { attackerWon, damage, margin, attackerId, defenderId, sonicAttack } = s;
    if (attackerWon) {
      // 🎸 Chord notes only burn on a HIT — whiffing keeps your drive stack intact.
      if (!sonicAttack && s.swingChordSpent?.length) {
        addLog(`🎸 ${spirits.find(sp => sp.id === attackerId)?.name} burns ${s.swingChordSpent.join('+')} from the drive stack — ${s.swingChordLeft?.length ? spiritChord(attackerId, s.swingChordLeft).name : 'drive exhausted (base stats until committed)'}.`);
        setNoteStates(prev => ({ ...prev, [attackerId]: { ...prev[attackerId], driveStack: s.swingChordLeft } }));
        showSpentNotes(attackerId, s.swingChordSpent, 'drive'); // 🎵 notes fly off the standee
      }
      // ── KNOCKBACK — route by attack kind ──
      if (sonicAttack) {
        const def = spirits.find(x => x.id === defenderId);
        battleKnockback(attackerId, defenderId, sonicKnockback(margin, def?.vibe ?? 1, def?.maxVibe ?? 1));
      } else {
        battleKnockback(attackerId, defenderId, thrashKnockback(margin));
      }
      resolveWinDamage(attackerId, defenderId, damage, spirits.find(s2 => s2.id === attackerId)?.name);
      // ── FP — Sonic is the Fame engine; Thrash earns a flat 1 ──
      if (sonicAttack) {
        const ring = hexRingFromCenter(spirits.find(x => x.id === attackerId)?.num ?? -1);
        const centerBonus = (ring === 'main' || ring === 'pit') ? SONIC_LIMELIGHT_FP : 0;
        awardSonicFame(attackerId, margin, defenderId, centerBonus);
      } else {
        awardThrashFame(attackerId, defenderId);
      }
      // ── Thrash impact knocks Lost Chords loose near the defender ──
      if (!sonicAttack) {
        const defSpirit = spirits.find(x => x.id === defenderId);
        if (defSpirit) {
          const tier = margin >= 6 ? 'heavy' : margin >= 3 ? 'medium' : 'light';
          const occupied = [
            ...spirits.filter(sp => !sp.knockedOut).map(sp => sp.num),
            ...boardCards.map(c => c.hexNum),
            ...chargeZones.map(z => z.num),
            ...eventHexes,
            ...boardTokens.map(t => t.num),
            spotlightHex, LIMELIGHT_HEX,
          ];
          dispatch(thrashTokensSpawned(defSpirit.num, occupied, tier, 1));
          const report = engineRef.current.board.lastThrashTokens;
          if (report) addLog(`🎵 ${report.added.length} Lost Chord${report.added.length !== 1 ? 's' : ''} knocked loose from the impact!`);
        }
      }
      // (B5: consumeAttackCharges call removed — nothing left to consume.)
      // 🧪 SLIME (Metalness Monster) — on Swing/Smash hit, spend 1 Db to halve
      // the rival's next turn note regen
      if (!sonicAttack && attackerId === 'Metalness_Monster') {
        const atkNs = noteStates[attackerId] ?? {};
        const hasSlime = (atkNs.unlockedSkills ?? []).includes('slime');
        const atkDb = atkNs.dbPoints ?? 0;
        if (hasSlime && atkDb >= 1) {
          setNoteStates(prev => ({
            ...prev,
            [attackerId]: { ...prev[attackerId], dbPoints: (prev[attackerId]?.dbPoints ?? 0) - 1 },
            [defenderId]: { ...prev[defenderId], halfRefillNextTurn: true },
          }));
          const defName = spirits.find(x => x.id === defenderId)?.name;
          addLog(`🧪 SLIMED! ${defName} is coated in toxic goo — note regen HALVED next turn! (−1 Db)`);
          setTimeout(() => triggerEffectFlash(defenderId, '🧪', 'SLIMED!', '#44ff44'), 250);
        }
      }
      clearBattleBuffs(attackerId, defenderId);
      setBattleState(null);
      setDiceDisplay(null);
    } else {
      // ── ATTACKER LOST — damage depends on attack kind ──
      // Thrash whiff = THRASH_WHIFF_DMG (1). Sonic whiff = old formula.
      const selfDmg = sonicAttack ? Math.max(1, Math.ceil(margin / 2)) : damage; // damage already = thrashDamage(margin, true) = 1
      resolveWinDamage(defenderId, attackerId, selfDmg, 'whiff');
      // Defender earns FP for successfully defending
      if (sonicAttack) {
        awardSonicFame(defenderId, margin, attackerId, 0);
      } else {
        awardThrashFame(defenderId, attackerId);
      }
      const defKB = sonicAttack ? 1 : thrashKnockback(margin);
      battleKnockback(defenderId, attackerId, defKB);
      clearBattleBuffs(attackerId, defenderId);
      setBattleState(null);
      setDiceDisplay(null);
    }
  }

  // Called when player clicks the spinning attacker die
  function handleAtkDieClick() {
    // ⛔ ONE settle chain per die per battle. A spam-click (or the fast-battles
    // auto-click timer racing a human click) used to start the whole decelerate
    // chain twice — and each chain slides the pick by the roll, so a 4 moved
    // the meter 8. The ref is set synchronously, so the loser of the race
    // bails here before scheduling anything.
    if (dieSettledRef.current.atk) return;
    dieSettledRef.current.atk = true;
    setBattleState(prev => {
      if (!prev || prev.phase !== 'atk_die_spin') return prev;
      return { ...prev, phase: 'atk_die_settling' };
    });
    // Decelerate: fast random faces → slow → land on pre-rolled d6 result
    let interval = 60;
    let steps = 0;
    const maxSteps = 10;
    function tick() {
      steps++;
      const progress = steps / maxSteps;
      interval = 60 + progress * 340; // 60ms → 400ms, done in ~10 steps
      setBattleState(p => {
        if (!p || p.phase !== 'atk_die_settling') return p;
        // Last 2 steps: show adjacent face then land
        const sides = p.dieSides ?? 6;
        const face = steps >= maxSteps ? p.atkRoll
          : steps >= maxSteps - 2
            ? ((p.atkRoll % sides) + 1)
            : (Math.floor(Math.random() * sides) + 1);
        return { ...p, spinFaceAtk: Math.max(1, Math.min(sides, face)), atkDieReady: steps >= maxSteps };
      });
      if (steps < maxSteps) {
        setTimeout(tick, interval);
      } else {
        // Die settled — slide pick left by atkRoll after a short beat
        setTimeout(() => {
          setBattleState(p => {
            if (!p) return p;
            return { ...p, phase: 'pick_atk_slide', pickPos: p.pickPos - p.atkRoll };
          });
          // Launch defender die after pick settles
          // ⚡ PERF: NeonDie self-animates its spin faces — no interval needed.
          setTimeout(() => {
            setBattleState(p => {
              if (!p) return p;
              if (p.posing) return { ...p, phase: 'result' };
              const dds = p.defDieSides ?? 6;
              return { ...p, phase: 'def_die_spin', spinFaceDef: randDie(dds) };
            });
          }, 1400);
        }, 500);
      }
    }
    setTimeout(tick, interval);
  }

  // Called when player clicks the spinning defender die
  function handleDefDieClick() {
    // ⛔ same one-chain guard as the attacker die (see handleAtkDieClick).
    if (dieSettledRef.current.def) return;
    dieSettledRef.current.def = true;
    setBattleState(prev => {
      if (!prev || prev.phase !== 'def_die_spin') return prev;
      return { ...prev, phase: 'def_die_settling' };
    });
    let interval = 60;
    let steps = 0;
    const maxSteps = 10;
    function tick() {
      steps++;
      const progress = steps / maxSteps;
      interval = 60 + progress * 340;
      setBattleState(p => {
        if (!p || p.phase !== 'def_die_settling') return p;
        const dds = p.defDieSides ?? 6;
        const face = steps >= maxSteps ? p.defRoll
          : steps >= maxSteps - 2
            ? ((p.defRoll % dds) + 1)
            : randDie(dds);
        return { ...p, spinFaceDef: Math.max(1,Math.min(dds,face)), defDieReady: steps >= maxSteps };
      });
      if (steps < maxSteps) {
        setTimeout(tick, interval);
      } else {
        // Die settled — slide pick right by defRoll
        setTimeout(() => {
          setBattleState(p => {
            if (!p) return p;
            return { ...p, phase: 'pick_def_slide', pickPos: p.pickPos + p.defRoll };
          });
          // Show result after pick settles
          setTimeout(() => {
            // Capture all values from the ref NOW, before any state updates
            const snap = battleStateRef.current;
            if (!snap) return;
            const { attackerWon, damage, margin, attackerId, defenderId, atkTotal, defTotal } = snap;
            const atk = spirits.find(s => s.id === attackerId);

            const isSonic = !!snap.sonicAttack;

            // Log result
            if (attackerWon) {
              addLog(`⚔️ ${atk?.name} HITS! (${atkTotal} vs ${defTotal}) — ${damage} Vibe dmg${isSonic ? ' + PUSHED' : (margin >= 3 ? ' + nudged' : '')}`);
            } else {
              const selfDmg = isSonic ? Math.max(1, Math.ceil(margin / 2)) : damage; // damage already = thrashDamage(m,true) = 1
              addLog(`💨 ${atk?.name} WHIFFS! (${atkTotal} vs ${defTotal}) — ${selfDmg} Vibe self-damage`);
            }
            setBattleState(p => p ? { ...p, phase: 'result' } : p);

            // 🔊 Battle sounds at the RESULT moment
            if (isSonic) {
              // Sonic: play the stored chord (clean hit) or whiff (twangy miss)
              const chordNotes = snap.sonicChordNotes;
              if (chordNotes?.length) {
                if (attackerWon) {
                  playChord(chordNotes);
                } else {
                  playWhiffChord(chordNotes);
                }
              }
            } else if (attackerWon) {
              // Thrash CQC hit: smash a burst of random notes like crashing on the strings
              playSmashChord();
            }

            // Apply effects after player reads — values captured in closure above, no ref needed
            setTimeout(() => {
              // Guard: if the player already clicked BACK TO GAME (closeBattleOverlay
              // applied everything and nulled the state), bail — otherwise damage,
              // Fame, and knockback would all be applied TWICE.
              const cur = battleStateRef.current;
              if (!cur || cur.phase !== 'result') return;
              if (attackerWon) {
                // 🎸 Chord notes only burn on a HIT — whiffing keeps drive stack intact
                if (!isSonic && snap.swingChordSpent?.length) {
                  addLog(`🎸 ${spirits.find(sp => sp.id === attackerId)?.name} burns ${snap.swingChordSpent.join('+')} from the drive stack — ${snap.swingChordLeft?.length ? spiritChord(attackerId, snap.swingChordLeft).name : 'drive exhausted (base stats until committed)'}.`);
                  setNoteStates(prev => ({ ...prev, [attackerId]: { ...prev[attackerId], driveStack: snap.swingChordLeft } }));
                  showSpentNotes(attackerId, snap.swingChordSpent, 'drive'); // 🎵 notes fly off the standee
                }
                // Stage Lighting: 33% chance heal on win (rolled at battle start, stored in skillMods)
                if (snap.skillMods?.stageLightActive) {
                  const heal = 1;
                  setSpirits(prev => prev.map(s => s.id === attackerId
                    ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + heal) } : s));
                  addLog(`💡 Stage Lighting pays off! ${spirits.find(s=>s.id===attackerId)?.name} +${heal} Vibe saved.`);
                }
                // ── KNOCKBACK — route by attack kind ──
                if (isSonic) {
                  const def = spirits.find(x => x.id === defenderId);
                  battleKnockback(attackerId, defenderId, sonicKnockback(margin, def?.vibe ?? 1, def?.maxVibe ?? 1));
                } else {
                  battleKnockback(attackerId, defenderId, thrashKnockback(margin));
                }
                resolveWinDamage(attackerId, defenderId, damage, spirits.find(s2 => s2.id === attackerId)?.name);
                // ── FP — route by attack kind ──
                if (isSonic) {
                  const ring = hexRingFromCenter(spirits.find(x => x.id === attackerId)?.num ?? -1);
                  const centerBonus = (ring === 'main' || ring === 'pit') ? SONIC_LIMELIGHT_FP : 0;
                  awardSonicFame(attackerId, margin, defenderId, centerBonus);
                } else {
                  awardThrashFame(attackerId, defenderId);
                }
                // (B5: consumeAttackCharges call removed — nothing left to consume.)
                clearBattleBuffs(attackerId, defenderId);
                setBattleState(null);
                setDiceDisplay(null);
              } else {
                const selfDmg = isSonic ? Math.max(1, Math.ceil(margin / 2)) : damage;
                resolveWinDamage(defenderId, attackerId, selfDmg, 'whiff');
                if (isSonic) {
                  awardSonicFame(defenderId, margin, attackerId, 0);
                } else {
                  awardThrashFame(defenderId, attackerId);
                }
                const defKB = isSonic ? 1 : thrashKnockback(margin);
                battleKnockback(defenderId, attackerId, defKB);
                clearBattleBuffs(attackerId, defenderId);
                setBattleState(null);
                setDiceDisplay(null);
              }
            }, 3000); // 3s on screen, then auto-close
          }, 1400);
        }, 500);
      }
    }
    setTimeout(tick, interval);
  }


  // ── COUNTER / RETALIATION — CUT (Stance rework, §3/§8) ──────────────────────
  // Retaliation is no longer a separate mechanic. It emerges naturally from
  // Thrash adjacency: after an exchange the attacker is still adjacent and the
  // defender still has a chord voiced — on their turn they Thrash back with
  // whatever survived the fray. No prompt, no timer, no separate dice.

  // ─── END TURN ────────────────────────────────────────────────────────────────
  function endTurn() {
    if (!canAct) return; // N4/N7: only the controlling client ends the turn
    const s = spirits.find(sp => sp.id === acting.id);

    // The engine resolves the turn end: limelight verdict, turn counter,
    // beat/token resets, queue advance. React then runs the not-yet-extracted
    // ticks below using the engine's report.
    const report = dispatch(turnEnded()).turn.lastReport;

    // ── 🌟 LIMELIGHT FAME FAUCET ───────────────────────────────────────────────
    // Hold the centre stage — start AND end your turn on the Limelight hex — and the
    // spotlight pays a little Fame (× crowd). No instant win; just a contested
    // objective that feeds the one goal. Camping it is risky: you're the most visible
    // target on the board and the centre carries demolition risk.
    if (report.limelightHeld) {
      addLog(`🌟 ${s.name} holds the Limelight — the spotlight pays out!`);
      setTimeout(() => grantFame(acting.id, LIMELIGHT_FAME, `🌟 held the Limelight`), 80);
    }

    setMovedThisTurn(false);
    setAction(null);
    setBattleState(null);
    setDiceDisplay(null);

    // ── END-OF-TURN DEBUFF TICK (Phase 6d — engine rule) ─────────────────────
    // Physical debuffs (tripped / dazed / dropped instrument) and timed effects
    // (Mojo Drain, Stagger) wear off at the END of your own turn — after you've
    // actually suffered them for a turn.
    dispatch(debuffsTicked(acting.id));

    // ── 🔥 BURN TICK (Phase 6d — engine rule) ────────────────────────────────
    // 50% coin on engine rng: heads → 1 Vibe damage. Always decrements turnsLeft.
    // The engine handles the coin + damage + countdown; the client reads the report.
    {
      const bns = engineRef.current.noteStates?.[acting.id] ?? {};
      if (bns.burn?.turnsLeft > 0) {
        const burnReport = dispatch(burnTicked(acting.id)).turn.lastBurnTick;
        if (burnReport) {
          const leftMsg = `${burnReport.turnsLeft} turn${burnReport.turnsLeft !== 1 ? 's' : ''} left`;
          if (burnReport.burnDamage > 0) {
            addLog(`🔥 ${s?.name} is BURNING — loses 1 Vibe! (${leftMsg})`);
            triggerEffectFlash(acting.id, '🔥', 'BURN! −1', '#ff5522');
            // Check knockdown: burn damage may have reduced Vibe to 0
            const postSpirit = engineRef.current.spirits.find(sp => sp.id === acting.id);
            if (postSpirit && postSpirit.vibe <= 0 && !postSpirit.knockedOut) {
              setTimeout(() => {
                dispatch(knockdownResolved(acting.id));
                const kd = engineRef.current.spirits.find(sp => sp.id === acting.id);
                if (kd?.knockedOut) {
                  dispatch(spiritEliminated(acting.id));
                  const w = decideWinner(engineRef.current.spirits, engineRef.current.rockGod);
                  if (w) dispatch(winnerDeclared(w));
                }
              }, 80);
            }
          } else {
            addLog(`🔥 ${s?.name}'s Burn crackles but does no damage this turn. (${leftMsg})`);
            triggerEffectFlash(acting.id, '🔥', 'BURN holds', '#ff8855');
          }
          if (burnReport.expired) addLog(`🔥 ${s?.name}'s Burn fizzles out.`);
        }
      }
    }

    // ── 🎇 STAGE EFFECTS TICK (per turn) ─────────────────────────────────────
    // Pyro arms→erupts on a per-turn cadence; animatronics take their step.
    tickStageFxTurn();

    // ── 🤘 THE GOD ANSWERS — telegraph resolves / new attack opens ───────────
    if (rockGodActive) rockGodAct();

    // ── 🎤 FAN ECONOMY TICK ──────────────────────────────────────────────────
    // Positional boredom: fans drift only after lingering on the outer edge; tick recovery lag.
    tickFans(acting.id, acting.num);

    // ── SPOTLIGHT HEAL CHECK (engine rule — Phase 6a) ──────────────────────────
    // Engine owns the +1 Vibe heal (applySpotlightHealed checks position + KO).
    {
      dispatch(spotlightHealed(acting.id));
      const healReport = engineRef.current.board.lastSpotlightHeal;
      if (healReport) addLog(`💡 ${s.name} steps into the spotlight — +1 Vibe!`);
    }

    // ── SPOTLIGHT MOVE: advance every full round (engine rng — Phase 6a) ─────
    if (report.roundCompleted) {
      {
        const occupied = [...spirits.map(sp => sp.num),
          ...(shadowHex != null ? [shadowHex] : [])]; // 👤 the double holds its tile
        dispatch(spotlightMoved(occupied));
        const moveReport = engineRef.current.board.lastSpotlightMove;
        if (moveReport) addLog(`💡 The spotlight shifts to hex #${moveReport.to}!`);
      }
      // ── BOARD TOKENS: scatter fresh Lost Chords each round (engine rng) ───
      // The stage resonates with overlapping frequencies — harmonic interference
      // crystallises stray notes. Fewer Spirits = thinner resonance = more fragments.
      {
        const aliveSpirits = spirits.filter(sp => !sp.knockedOut);
        const occupied = [
          ...aliveSpirits.map(sp => sp.num),
          ...boardCards.map(c => c.hexNum),
          ...chargeZones.map(z => z.num),
          ...eventHexes,
          ...boardTokens.map(t => t.num),
          ...(shadowHex != null ? [shadowHex] : []), // 👤 no Lost Chord under the double
          spotlightHex, LIMELIGHT_HEX,
        ];
        dispatch(tokensScattered(occupied, aliveSpirits.length, spirits.length));
        const scatterReport = engineRef.current.board.lastTokensScattered;
        if (scatterReport) addLog(`🎵 The stage resonates — ${scatterReport.added.length} Lost Chord${scatterReport.added.length !== 1 ? 's' : ''} crystallise from the harmonic interference!`);
      }
      // ── DISCO INFERNO: flames die down one round per full round (engine) ──
      {
        dispatch(flamingDecayed());
        const flReport = engineRef.current.board.lastFlamingDecay;
        if (flReport) {
          if (flReport.expired) {
            addLog(`🔥💿 The flaming discs finally burn out. The stage is clear!`);
          } else {
            addLog(`🔥💿 The discs still burn — ${flReport.roundsLeft} round${flReport.roundsLeft !== 1 ? 's' : ''} left.`);
          }
        }
      }
      // ── 🎇 STAGE EFFECTS (per round): smoke spreads, lasers re-pattern ────
      tickStageFxRound();
    }

    // 🧪 POISON SLIME decay — each slime tile loses 1 turn of life every spirit-turn
    decayPoisonSlime();

    // Advance queue first so we know who acts next, then replenish their used slots
    // B8: the flow now OPENS on the chord step — the pivot stage is gone, the mode
    // is derived from the Drive Stack at turn start and merely reported.
    setTurnStep('chord'); // reset HUD flow for next spirit's turn
    setTimeout(() => showTip('chord'), 500);
    {
      const nextId = report.nextId; // the engine already advanced the queue
      if (nextId) {
        startNewTurnNotes(nextId);
        // Pulse the next spirit's current hex briefly
        const nextSpirit = spirits.find(s => s.id === nextId);
        if (nextSpirit) {
          setPulsingHex(nextSpirit.num);
          setTimeout(() => setPulsingHex(null), 1800);
        }
      }
    }
    addLog(`⏭ ${s.name} ends turn`);

    // Event marquee respawn countdown (engine rule — Phase 6a)
    dispatch(eventRespawnTicked());
    if (engineRef.current.board.eventRespawnIn <= 0 && eventRespawnIn > 0) {
      // Counter just hit 0 — spawn a new marquee hex (engine rng)
      setTimeout(() => {
        const occupied = [
          ...engineRef.current.spirits.filter(sp => !sp.knockedOut).map(sp => sp.num),
          ...amps.map(a => a.hexNum),
          ...boardCards.map(c => c.hexNum),
          ...engineRef.current.board.chargeZones.map(z => z.num),
          ...engineRef.current.board.eventHexes,
          engineRef.current.board.spotlightHex,
        ];
        dispatch(eventHexSpawned(occupied));
        const evReport = engineRef.current.board.lastEventRespawn;
        if (evReport) addLog(`🎪 A new marquee hex lights up at #${evReport.hexNum}!`);
      }, 60);
    }

    // Board card respawn countdown
    setCardRespawnIn(prev => {
      const next = prev - 1;
      if (next <= 0) {
        // Respawn after a tick so spirits/amps state is settled
        setTimeout(() => {
          setBoardCards(cur => spawnBoardCards(cur, spirits, amps));
        }, 50);
        return 2; // reset timer
      }
      return next;
    });

    // ⚡ Charge zone cooldowns — engine rule (Phase 6a)
    dispatch(chargeZonesTicked());

    // 🎵 Lost Chord drift — uncollected tokens relocate after TOKEN_DRIFT_TURNS
    {
      const occ = spirits.filter(s => !s.knockedOut).map(s => s.num);
      dispatch(tokensDrifted(occ));
      const drifted = engineRef.current.board?.lastTokensDrifted;
      if (drifted?.moved?.length) {
        addLog(`🎵 ${drifted.moved.length} Lost Chord${drifted.moved.length > 1 ? 's' : ''} drifted to ${drifted.moved.length > 1 ? 'new positions' : 'a new position'} — the stage resonates.`);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 🤖 AI OPPONENT — PHASE 1
  // A deliberately simple, legible bot: build a clean track to its Speed, walk
  // toward the centre stage, and attack a rival if one is in reach. It drives the
  // SAME functions the buttons call, so its turns flow through the real rules.
  //
  // Architecture: a step-machine, not one long async function. A useEffect watches
  // game state and performs exactly ONE synchronous action per fire, then lets
  // React re-render so the next fire reads fresh state (no stale closures). A
  // botStepRef tracks where we are in the turn ('pending' = action in flight).
  // ════════════════════════════════════════════════════════════════════════════
  const botStepRef    = useRef('idle');   // idle → building → committed → moving → acting → ending
  const botLastTurnRef= useRef(null);     // which spirit id we last reset the step for
  const BOT_TICK      = 520;              // ms between bot actions (readable pacing)
  // 🤖 A self-tick. Some bot actions (setSkillTarget, the inter-step "beat") change
  // no value in the step-machine's dependency array, so the effect would never
  // re-fire to advance the turn. Bumping this after EVERY scheduled action gives
  // the effect a dependency that always changes — guaranteeing it re-evaluates
  // and the turn keeps flowing (build → commit → move → act → end).
  const [botNudge, setBotNudge] = useState(0);

  // ── 🤖 BOT PERSONALITIES (moved to engine/policies/bot.js) ─────────────────
  const botPersonaRef = useRef({});
  // Assign each CPU a distinct persona on first sight and announce it in the log.
  // Pure pick logic in engine/policies/bot.js; presentation + ref persist here.
  function botPersona(self) {
    const r = botPersonaRef.current;
    if (r[self.id]) return BOT_PERSONALITIES[r[self.id]];
    dispatch(randomBatchDrawn(1));
    const pick = botAssignPersona(Object.values(r), engineRef.current.lastRandomBatch[0]);
    r[self.id] = pick;
    const P = BOT_PERSONALITIES[pick];
    addLog(`🤖 ${self.name} takes the stage as ${P.emoji} ${P.name} — ${P.blurb}`);
    return P;
  }

  function isBot(sp) { return !!sp?.cpu; }

  // Thin wrapper → pure policy function (engine/policies/bot.js).
  // 🔪 `self.num` goes through so the policy can break ties toward a rival
  // whose back is turned (extra Sustain note on the fray).
  function botPickTarget(candidates, self) {
    return _botPickTarget(candidates, engineRef.current.noteStates, self?.num ?? null);
  }

  // Thin wrapper → pure policy function (engine/policies/bot.js)
  function botHexScore(self, h, ctx) { return _botHexScore(h, ctx); }

  // Thin wrapper → pure policy function (engine/policies/bot.js)
  function botPlanMove(self) {
    return _botPlanMove(engineRef.current, self, botPersona(self), amps);
  }

  // ── SKILL-TREE PLANNING (constants + pure logic in engine/policies/bot.js) ──
  function botSkillEligible(skillId, unlocked, selfId) {
    return _botSkillEligible(skillId, unlocked, selfId, SKILL_BY_ID);
  }
  function botPickSkillTarget(self) {
    const ns = engineRef.current.noteStates?.[self.id] ?? {};
    const unlocked = ns.unlockedSkills ?? [];
    const key = botPersonaRef.current[self.id] ?? (botPersona(self), botPersonaRef.current[self.id]);
    return _botPickSkillTarget(self.id, unlocked, key, SKILL_BY_ID);
  }

  // Of the 6 facing directions, find the one that lands the most/juiciest rivals
  // in the given attack shape ('beam' or 'cone'). Reuses the real geometry by
  // probing a synthetic copy of the spirit. Returns { angle, target } or null.
  function botBestFacing(self, kind) {
    const myHex = HEX_BY_NUM[self.num];
    if (!myHex) return null;
    let best = null;
    for (const nb of getFlatTopNeighborSlots(myHex)) {
      const angle = angleTo(myHex, nb);
      const probe = { ...self, facing: angle };
      const rivals = kind === 'beam' ? getRivalsInBeam(probe) : getRivalsInCone(probe);
      if (!rivals.length) continue;
      const t = botPickTarget(rivals, self);
      const score = rivals.length * 10 - (t?.vibe ?? 9);
      if (!best || score > best.score) best = { angle, target: t, score };
    }
    return best;
  }

  // Thin wrapper → pure policy function (engine/policies/bot.js)
  function botRivalsWithin(self, dist) {
    return _botRivalsWithin(engineRef.current.spirits, self.id, self.num, dist);
  }

  // Thin wrapper → pure policy function (engine/policies/bot.js)
  function botPlanNoteStep(self) {
    return _botPlanNoteStep(engineRef.current.noteStates?.[self.id], botPersona(self));
  }

  // Thin wrapper → pure policy function (engine/policies/bot.js)
  function botPlanRevoice(self) {
    return _botPlanRevoice(engineRef.current.noteStates?.[self.id], self.id, botPersona(self));
  }

  // Drive/Sustain split: plan + execute all stack commits for this bot's turn
  function botPlanStackCommit(self) {
    // Read from React state (noteStates) — driveStack/sustainStack/stackCommitsThisTurn
    // are written via setNoteField which only updates React state, not engineRef.
    const ns = noteStates[self.id] ?? engineRef.current.noteStates?.[self.id] ?? {};
    const sp = self;
    return _botPlanStackCommit(ns, self.id, botPersona(self), sp.vibe ?? 10, sp.maxVibe ?? 10, stackCapOf(self.id));
  }

  function botExecuteStackCommits(self, commits) {
    if (!commits || !commits.length) return;
    // Read initial state from React (noteStates), NOT engineRef — engineRef
    // doesn't reflect setNoteField writes and would cause stale reads + overwrites.
    const ns = noteStates[self.id] ?? engineRef.current.noteStates?.[self.id] ?? {};
    let dStack = [...(ns.driveStack ?? [])];
    let sStack = [...(ns.sustainStack ?? [])];
    let commitsUsed = ns.stackCommitsThisTurn ?? 0;

    const cap = stackCapFor(ns.unlockedSkills ?? []);
    for (const { note, dest } of commits) {
      const stack = dest === 'sustain' ? sStack : dStack;
      if (stack.length >= cap) continue;
      if (commitsUsed >= STACK_COMMIT_BUDGET) break;
      stack.push(note);
      commitsUsed++;
      const ch = botSpiritChord(self.id, stack);
      addLog(`🎸 ${self.name} voices ${note} into the ${dest === 'sustain' ? 'Sustain' : 'Drive'} Stack — ${ch.name} (${dest === 'sustain' ? '🛡️' : '⚔️'}${dest === 'sustain' ? ch.sustain : ch.drive}).`);
    }

    // Single write with final accumulated state — no overwrites
    setNoteField(self.id, { driveStack: dStack, sustainStack: sStack, stackCommitsThisTurn: commitsUsed });
  }

  // 🎸 SYNTHETIC RIFF-OFF — pure logic in engine/policies/bot.js; this wrapper
  // threads engine rng via RANDOM_BATCH_DRAWN for replay determinism.
  function botRiffResults(len) {
    dispatch(randomBatchDrawn(3 * len));
    const batch = engineRef.current.lastRandomBatch;
    let rC = 0;
    return _botRiffResults(len, () => batch[rC++]);
  }

  // Reset the bot step-machine whenever a new spirit takes the turn.
  useEffect(() => {
    if (acting?.id && botLastTurnRef.current !== acting.id) {
      botLastTurnRef.current = acting.id;
      botStepRef.current = 'idle';
    }
  }, [acting?.id]);

  // ── THE BOT TURN STEP-MACHINE ───────────────────────────────────────────────
  // Fires on every relevant state change; performs ONE action, then returns so
  // React can settle before the next step.
  useEffect(() => {
    const self = acting;
    if (!self || !isBot(self)) return;
    // N7: online — only the host runs bots; other clients just see relayed actions
    if (netRef.current && !amIBotController) return;
    // N8: frozen while resyncing — a bot driving a stale engine would fork reality
    if (netSyncRef.current) return;
    if (winner) return;                          // game's over
    if (noteStates[self.id]?.recovering) return; // recovery skip handled elsewhere
    // Never act in the middle of a battle/riff-off cinematic — those resolve via
    // their own bot hooks (auto-die-click / synthetic riff-off) below.
    if (battleState) return;

    const step = botStepRef.current;
    if (step === 'pending') return;              // an action is already scheduled
    const schedule = (fn) => {
      const prevStep = botStepRef.current;
      botStepRef.current = 'pending';
      setTimeout(() => {
        fn();
        // If fn() didn't advance the step itself, restore it so the effect
        // re-evaluates at the same phase (e.g. the empty "beat" between
        // move→act, or a skill-target pick, which change no dep-array value).
        if (botStepRef.current === 'pending') botStepRef.current = prevStep;
        setBotNudge(n => n + 1);
      }, Math.max(0, Math.round(BOT_TICK / (gameSpeedRef.current || 1))));
    };

    // Shared per-cycle reads (fresh every fire — the nudge re-runs this effect).
    const ns        = engineRef.current.noteStates?.[self.id] ?? {};
    // React state mirror — fields written via setNoteField (driveStack, sustainStack,
    // stackCommitsThisTurn) only land here, not in engineRef. Always prefer reactNs
    // for those fields to avoid stale reads / infinite loops.
    const reactNs   = noteStates[self.id] ?? {};
    const unlocked  = ns.unlockedSkills ?? [];
    const liveSelf  = engineRef.current.spirits.find(s => s.id === self.id) ?? self;
    const hasSkill    = (id) => unlocked.includes(id);
    const guard     = (fn) => () => { if (actingRef.current?.id === self.id) fn(); };

    // 1) BUILD — climb the skill tree, sharpen the stock, build a clean track.
    if (step === 'idle' || step === 'building') {
      botStepRef.current = 'building';

      // 1a) SKILL TREE — always be saving toward the next unlock. This is what
      //     turns the bot from a naked rookie into a real opponent over the game.
      if ((ns.upgradesPending ?? 0) > 0 && !ns.targetSkillId) {
        const wantId = botPickSkillTarget(self);
        if (wantId) { schedule(() => setSkillTarget(self.id, wantId)); return; }
      }

      // 1b) PIVOT — DELETED (B8). The bot used to declare Major/Minor here, leaning
      //     minor for Flair's defensive bonus. There is no pivot to declare any
      //     more: the mode is derived from the Drive Stack at turn start, so
      //     `ns.pivotPending` can never be true and this branch could never fire.
      //     Removed rather than left in — a bot branch that can't fire is a trap for
      //     the next reader.
      //     Flair's minor lean now belongs in botPlanStackCommit, if it belongs
      //     anywhere: a bot that wants minor should stack a minor third and earn it
      //     the way a player does.

      // 1b.5) STACK COMMITS — voice notes into Drive/Sustain stacks (up to 3/turn budget).
      // Budget check uses reactNs (React state) — see shared reads above.
      if ((reactNs.stackCommitsThisTurn ?? 0) < STACK_COMMIT_BUDGET) {
        const commits = botPlanStackCommit(self);
        if (commits.length) { schedule(guard(() => botExecuteStackCommits(self, commits))); return; }
      }

      const track = ns.melodyLine ?? [];
      const stock = ns.noteStock ?? [];
      const used  = ns.usedStockIdx ?? [];
      const scale = buildScale(ns.rootNote ?? 'C', ns.scaleMode ?? 'major');
      const isUsed = (i) => usedHas(used, i);

      // 1d/1e) MELODY LINE — plan-driven: clean notes ascending (Drive), all the way
      //        up to the 8-note cap (more notes = more DB), saving a 5th/4th for the
      //        final note (+5/+4), padding for movement only. See botPlanNoteStep.
      const plan = botPlanNoteStep(self);
      if (plan.commit) {
        schedule(guard(() => { confirmNoteTrack(); botStepRef.current = 'committed'; }));
        return;
      }
      schedule(guard(() => clickNoteStock(plan.slot)));
      return;
    }

    // 2) MOVE — fire free pre-combat gear, then walk toward a target (or retreat).
    if (step === 'committed' || step === 'moving') {
      botStepRef.current = 'moving';
      const steps = moveStepsLeftRef.current ?? 0;
      const myHex = HEX_BY_NUM[self.num];

      // 2a) FREE GEAR (no AP cost). Each condition self-disables after use, so the
      //     bot fires each at most once and then falls through to movement.
      // 💀 Ultimate — blanket Stagger + damage when rivals are clustered.
      if (hasSkill('ultimate') && !ns.ultimateUsed && botRivalsWithin(self, 4).length >= 2) {
        schedule(() => fireUltimate(self.id)); return;
      }
      // 2b) Keep moving, or stop. Standing on the spotlight while hurt is worth
      //     holding for — ending the turn there banks +1 Vibe (and we can still
      //     attack from it without moving off). Otherwise stop to take a shot.
      const hurt = (liveSelf.vibe ?? 9) <= Math.ceil((liveSelf.maxVibe ?? 5) * 0.4);
      const onHealHex = hurt && typeof spotlightHex === 'number' && self.num === spotlightHex;
      // 🤘 Boss fight: "in range" means the GOD is in reach (adjacent or beamed).
      const bossGod = engineRef.current.rockGod.god;
      const godHex = rockGodActive ? HEX_BY_NUM[bossGod?.num] : null;
      const godInReach = !!(godHex && myHex && (
        axialDist(myHex.q, myHex.r, godHex.q, godHex.r) <= 1
        || (ampsInRangeRef.current >= 1 && getSonicBeam(self).has(bossGod.num))
      ));
      const rivalInRange = godInReach || getRivalsInCone(self).length > 0
        || (ampsInRangeRef.current >= 1 && getRivalsInBeam(self).length > 0);
      const canAttackNow = rivalInRange && steps >= 2;
      if (steps < 1 || canAttackNow || (steps < 2 && rivalInRange) || onHealHex) {
        botStepRef.current = 'acting';
        schedule(() => {}); // brief beat, then re-enter at 'acting'
        return;
      }

      // 2c) Move where it actually pays off: the spotlight (heal), tokens, events,
      //     a central spot (fans don't get bored), or a rival worth fighting.
      const dest = botPlanMove(self);
      if (dest == null) { botStepRef.current = 'acting'; schedule(() => {}); return; }
      schedule(() => {
        if (actingRef.current?.id !== self.id) return;
        setAction('move');
        // move() reads the live render closure on the next tick; call it directly.
        setTimeout(() => { if (actingRef.current?.id === self.id) move(dest); }, 30);
      });
      return;
    }

    // 3) ACT — line up a shot (re-facing if needed) and attack, else end.
    if (step === 'acting') {
      const steps     = moveStepsLeftRef.current ?? 0;
      const usedToken = actionTokenUsedRef.current;
      // Spend 1 step to turn in place (mirrors the human "face" action) so the bot
      // can aim a beam/cone instead of only attacking whatever it stumbled into.
      const aimFace = (angle) => guard(() => {
        dispatch(spiritFaced(self.id, angle)); // reducer owns the facing write
        addLog(`🤖 ${self.name} takes aim.`);
      });

      // Fight whenever there's a shot — beating a rival steals their crowd, and
      // beating one ahead of us triggers the underdog comeback Fame. Attacking
      // doesn't move us, so a shot taken from the spotlight still banks the heal.
      if (!usedToken) {
        // 🤘 Boss fight — strike the God if lined up, re-aim if close, else march on.
        if (rockGodActive && engineRef.current.rockGod.god) {
          const god = engineRef.current.rockGod.god;
          const gh = HEX_BY_NUM[god.num], mh = HEX_BY_NUM[self.num];
          const adjacent = gh && mh && axialDist(mh.q, mh.r, gh.q, gh.r) <= 1;
          const inBeam = ampsInRangeRef.current >= 1 && getSonicBeam(self).has(god.num);
          if ((adjacent && steps >= 1) || (inBeam && steps >= 2)) {
            botStepRef.current = 'ending';
            schedule(guard(() => attackRockGod(self.id)));
            return;
          }
          // In beam-distance but not aimed? Spend a step to face the God.
          if (steps >= 3 && gh && mh && ampsInRangeRef.current >= 1
              && axialDist(mh.q, mh.r, gh.q, gh.r) <= 3) {
            schedule(aimFace(angleTo(mh, gh))); return;
          }
          // Out of reach — wrap up and close the gap next turn.
          botStepRef.current = 'ending';
          schedule(guard(() => { endTurn(); botStepRef.current = 'idle'; }));
          return;
        }
        // ── COMBAT DECISIONS ─────────────────────────────────────────────
        const selfHex   = HEX_BY_NUM[self.num];
        const usedSet   = ns.usedStockIdx;
        const unused    = (ns.noteStock ?? []).filter((_, i) => !usedHas(usedSet, i)).length;

        // Blaster of Ra replaces Smash for Intergalactic 0 when unlocked.
        const unlocked  = ns.unlockedSkills ?? [];
        const hasBlaster = self.id === 'intergalactic_0' && unlocked.includes('blaster_of_ra');
        const finTargets = hasBlaster ? getRivalsInBeam(self) : getRivalsInCone(self);

        // 1) 🎸💥 SMASH — turtle-buster: undefendable vs high-Sustain targets.
        // Needs 2 AP + ≥ 2 unused stock (leaves us Exposed).
        if (finTargets.length && unused >= 2 && steps >= 2) {
          const t = botPickTarget(finTargets, self);
          const tSustain = spiritChord(t.id, (noteStates[t.id] ?? engineRef.current.noteStates?.[t.id])?.sustainStack ?? []).sustain;
          if (tSustain >= 6) {
            botStepRef.current = 'ending';
            schedule(guard(() => hasBlaster ? resolveBlasterOfRa() : resolveSmash(t.id)));
            return;
          }
        }

        // 2) 📡 Regular Sonic (offline outside rig radius).
        const beamNow = rigInRangeRef.current ? getRivalsInBeam(self) : [];
        if (beamNow.length && steps >= 2) {
          const t = botPickTarget(beamNow, self);
          botStepRef.current = 'ending';
          schedule(guard(() => initiateSonicAttack(t.id)));
          return;
        }

        // 3) ⚔️ Regular Swing.
        const coneNow = getRivalsInCone(self);
        if (coneNow.length && steps >= 1) {
          const t = botPickTarget(coneNow, self);
          botStepRef.current = 'ending';
          schedule(guard(() => initiateSwing(t.id)));
          return;
        }

        // 4) 🎸💥 SMASH — closer: fire on Exposed or near-death targets when we
        // have surplus stock. Lower priority than the turtle-buster case above
        // since the Smash leaves us Exposed + wrecks our own notes.
        if (finTargets.length && unused >= 3 && steps >= 2) {
          const t = botPickTarget(finTargets, self);
          const tNs = engineRef.current.noteStates?.[t.id] ?? {};
          const finDamage = smashOutcome(unused).damage;
          if (tNs.smashExposed || (t.vibe ?? 10) <= finDamage + 1) {
            botStepRef.current = 'ending';
            schedule(guard(() => hasBlaster ? resolveBlasterOfRa() : resolveSmash(t.id)));
            return;
          }
        }
        // (The Acoustic Duel fallback that used to sit here is gone with the
        // duel itself. A bot with nothing lined up now goes straight to
        // re-facing for a real shot, below.)
        // Not lined up — re-face toward the best shot (1 step to turn + 2 to fire).
        if (steps >= 3) {
          const bf = rigInRangeRef.current ? botBestFacing(self, 'beam') : null;
          if (bf) { schedule(aimFace(bf.angle)); return; }
          const cf = botBestFacing(self, 'cone');
          if (cf) { schedule(aimFace(cf.angle)); return; }
        }
      }

      // ── 🔪 COVER YOUR BACK ────────────────────────────────────────────────
      // Nothing left to shoot, but a rival is sitting in our blind wedge and a
      // hit from there strips an extra Sustain note. Turning costs 1 AP, which
      // at this point is AP we were about to throw away on End Turn — so this
      // runs LAST, after every offensive option, and never outbids an attack.
      //
      // Gated on the persona's rearFear: the Mosh Lord (0.4) genuinely does not
      // care who's behind him, and leaving that in makes him read as reckless
      // rather than as a bot with a bug.
      {
        const persona = botPersona(self);
        const myHex = HEX_BY_NUM[self.num];
        if (myHex && steps >= 1 && (persona?.move?.rearFear ?? 1) >= 1) {
          const threat = engineRef.current.spirits
            .filter(r => !r.knockedOut && r.id !== self.id && HEX_BY_NUM[r.num])
            .map(r => ({ r, h: HEX_BY_NUM[r.num],
              d: axialDist(myHex.q, myHex.r, HEX_BY_NUM[r.num].q, HEX_BY_NUM[r.num].r) }))
            .filter(x => x.d <= REAR_INTEREST_DIST && botIsBehind(self, x.r.num))
            .sort((a, b) => a.d - b.d)[0];
          if (threat) {
            schedule(guard(() => {
              dispatch(spiritFaced(self.id, angleTo(myHex, threat.h)));
              addLog(`🔪 ${self.name} feels eyes on the back of their neck — and turns around.`);
            }));
            return;
          }
        }
      }

      // Nothing worth doing — wrap up.
      botStepRef.current = 'ending';
      schedule(guard(() => { endTurn(); botStepRef.current = 'idle'; }));
      return;
    }

    // 4) ENDING — battle (if any) is resolving via the battle hooks; once it's
    //    cleared and it's still our turn, end it.
    if (step === 'ending') {
      if (!battleState && actionTokenUsedRef.current) {
        schedule(() => { if (actingRef.current?.id === self.id) endTurn(); botStepRef.current = 'idle'; });
      }
      return;
    }
  }, [acting?.id, battleState?.phase, moveStepsLeft, actionTokenUsed,
      noteStates[acting?.id]?.melodyLine?.length, winner, botNudge]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── BOT WATCHDOG — a safety net. If a bot turn somehow stalls (an edge case the
  //    step-machine didn't anticipate), force it to end rather than freezing the
  //    game. Re-armed each time it becomes a bot's turn; cleared on turn change or
  //    when a battle is mid-flight (those have their own timers).
  useEffect(() => {
    if (!isBot(acting) || winner) return;
    if (battleState) return; // a battle is animating — don't trip mid-cinematic
    const myId = acting.id;
    const t = setTimeout(() => {
      // Still the same bot's turn, still no battle, still not resolved → bail it out.
      if (actingRef.current?.id === myId && !battleStateRef.current && !winnerRef.current) {
        addLog(`🤖 ${acting.name}'s turn timed out — wrapping up.`);
        botStepRef.current = 'idle';
        endTurn();
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [acting?.id, battleState?.phase, winner]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const bs = battleState;
    if (!bs || bs.riffOff) return;
    const atkBot = isBot(spirits.find(s => s.id === bs.attackerId));
    const defBot = isBot(spirits.find(s => s.id === bs.defenderId));
    // N12: online remote viewers auto-advance dice (they're watching, not acting)
    const net = netRef.current;
    const isRemoteViewer = net && !net.spectator && net.mySpiritId !== bs.attackerId;
    // Attacker die — auto if attacker is a bot OR this is a remote viewer
    if (bs.phase === 'atk_die_spin' && (atkBot || isRemoteViewer)) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'atk_die_spin') handleAtkDieClick(); }, 700);
      return () => clearTimeout(t);
    }
    // Defender die — auto if defender is a bot OR this is a remote viewer
    if (bs.phase === 'def_die_spin' && (defBot || isRemoteViewer)) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'def_die_spin') handleDefDieClick(); }, 700);
      return () => clearTimeout(t);
    }
    // Result card — if the active (acting) side is a bot, auto-close it so the
    // turn can wrap. closeBattleOverlay handles the win/whiff/retaliation branch.
    if (bs.phase === 'result' && isBot(acting)) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'result') closeBattleOverlay(); }, 1400);
      return () => clearTimeout(t);
    }
    // N12: online remote viewer — auto-dismiss the melee result card locally
    // (the acting client drives closeBattleOverlay which dispatches engine actions)
    if (bs.phase === 'result' && isRemoteViewer) {
      const t = setTimeout(() => {
        if (battleStateRef.current?.phase === 'result') {
          setBattleState(null);
          setDiceDisplay(null);
        }
      }, 3000);
      return () => clearTimeout(t);
    }
    // (Counter/retaliation prompt removed — pending redesign for Sonic/Thrash split.)
  }, [battleState?.phase, acting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── BOT RIFF-OFF HOOK — synthesize a bot side's performance ──────────────────
  // When a riff-off reaches a play turn whose performer is a bot, fill its results
  // instantly from the skill profile instead of running the live keyboard loop.
  useEffect(() => {
    const bs = battleState;
    if (!bs?.riffOff) return;
    const performerId = bs.turn === 'attacker' ? bs.attackerId : bs.defenderId;
    if (!isBot(spirits.find(s => s.id === performerId))) return;
    // Only act once the performer's notes are actually PLAYING. Intro/countdown/
    // handoff advancement is owned by the auto-advance hook below — this hook just
    // fills a bot performer's results the instant their play phase begins, then
    // hands the flow back (attacker → handoff, defender → resolve).
    if (bs.phase === 'riff_play' && bs.botAutoFilled !== bs.turn) {
      const t = setTimeout(() => {
        const cur = battleStateRef.current;
        if (!cur?.riffOff || cur.phase !== 'riff_play') return;
        const perfId = cur.turn === 'attacker' ? cur.attackerId : cur.defenderId;
        if (!isBot(spirits.find(s => s.id === perfId))) return;
        if (cur.botAutoFilled === cur.turn) return; // already filled this turn
        const side = cur.turn === 'attacker' ? cur.atkRiff : cur.defRiff;
        const len  = side?.notes?.length ?? RIFF_LEN;
        const results = botRiffResults(len);
        const key  = cur.turn === 'attacker' ? 'atkResults' : 'defResults';
        addLog(`🤖 ${spirits.find(s => s.id === perfId)?.name} rips through the ${cur.turn === 'attacker' ? 'call' : 'answer'}…`);
        // Halt the live falling-notes run (kill its miss/glitch timers) and mark filled.
        riffEngineRef.current?.timers?.forEach(clearTimeout);
        riffEngineRef.current = null;
        setBattleState(p => p?.riffOff ? { ...p, [key]: results, botAutoFilled: cur.turn, phase: 'riff_play', riffRun: null } : p);
        setTimeout(() => {
          if (!battleStateRef.current?.riffOff) return;
          if (cur.turn === 'attacker') riffEndTurn('attacker');
          else riffResolve();
        }, 420);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [battleState?.phase, battleState?.turn, battleState?.riffOff]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── BOT RIFF-OFF: auto-advance the non-interactive cards (intro/handoff/clash)
  //    when the ACTING spirit is a bot, so an all-bot or bot-initiated duel flows.
  useEffect(() => {
    const bs = battleState;
    if (!bs?.riffOff) return;
    const atkBot = isBot(spirits.find(s => s.id === bs.attackerId));
    const defBot = isBot(spirits.find(s => s.id === bs.defenderId));
    // N12: online defender's client must not run enterRiffAnte (produces different
    // one-liners and duplicate log lines) — the attacker drives the intro.
    const net = netRef.current;
    const isDefClient = net && net.mySpiritId === bs.defenderId;
    // Intro → enter one-liner phase, but only if the ATTACKER is a bot
    // (and we're not the online defender — that client waits for the relay)
    if ((bs.phase === 'riff_intro' || bs.phase === 'riff_r2intro') && atkBot && !isDefClient) {
      const t = setTimeout(() => {
        const cur = battleStateRef.current;
        if (cur?.phase === 'riff_intro') enterRiffAnte();
        else if (cur?.phase === 'riff_r2intro') riffBeginTurn('attacker');
      }, 800);
      return () => clearTimeout(t);
    }
    // One-liner phase: auto smack talk handles everything — no bot decision needed
    // Handoff → start the defender's answer, but only if the DEFENDER is a bot (a
    // human defender taps "DROP THE ANSWER" themselves — or the N12 coordination
    // effect auto-starts for online defenders).
    if (bs.phase === 'riff_handoff' && defBot) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'riff_handoff') riffBeginTurn('defender'); }, 800);
      return () => clearTimeout(t);
    }
    // Clash + result are non-interactive spectacle — advance them whenever either
    // combatant is a bot (so a bot-involved duel never waits on a tap nobody owns).
    // N12: online defender also auto-advances (they're watching, not driving).
    if (bs.phase === 'riff_clash' && bs.clashStage === 'charge' && (atkBot || defBot || isDefClient)) {
      const t = setTimeout(() => { if (battleStateRef.current?.clashStage === 'charge') fireBeamClash(); }, 900);
      return () => clearTimeout(t);
    }
    if (bs.phase === 'riff_result' && isBot(acting)) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'riff_result') closeRiffOff(); }, 1600);
      return () => clearTimeout(t);
    }
  }, [battleState?.phase, battleState?.clashStage, battleState?.riffOff, acting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── KNOCK OUT ────────────────────────────────────────────────────────────────
  function knockOut(tgtId, atkId, pushAngle) {
    const tgt = spirits.find(s => s.id === tgtId);
    const livesLeft = (tgt?.lives ?? 1) - 1;
    const willRespawn = livesLeft > 0;

    // Phase 5c slice 2c: the respawn/KO transform is now the engine's
    // KNOCKDOWN_RESOLVED action (runs the same resolveKnockdown kernel on the
    // engine spirits — the authoritative store). `spiritEliminated` (dispatched
    // above for a true KO) only touches turnQueue/acting, so the engine spirit
    // still carries the fields resolveKnockdown reads → identical to the old
    // captured-`tgt` transform, with no stale-closure risk.

    function checkWinner(updated) {
      // 🏆 The boss-aware decision now lives in the engine (Phase 3c kernel);
      // the client just runs the resulting timers.
      const { winnerId, godTriumphs: godWins } = decideWinner(updated, {
        godSummoned: engineRef.current.rockGod.summoned, hasWinner: !!winner, attackerId: atkId,
      });
      if (engineRef.current.rockGod.summoned && !winner) {
        if (godWins) setTimeout(() => godTriumphs(), 400);
        return;
      }
      // N5: engine winner slice → derived `winner` renders on all clients
      if (winnerId) setTimeout(() => { dispatch(winnerDeclared(winnerId)); }, 0);
    }

    if (tgt) {
      const tgtHex = HEX_BY_NUM[tgt.num];
      const centre = HEX_BY_NUM[56];
      if (tgtHex && centre) {
        focusOnHex(tgt.num, 1400, 0.5); // ride the knockback off the edge
        let flyDx, flyDy;
        if (pushAngle !== undefined) {
          flyDx = Math.cos(pushAngle);
          flyDy = Math.sin(pushAngle);
        } else {
          const rawDx = tgtHex.px - centre.px;
          const rawDy = tgtHex.py - centre.py;
          const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;
          flyDx = rawDx / dist;
          flyDy = rawDy / dist;
        }
        const slideAmount = HEX_SIZE * SCALE * 14;
        const dx = flyDx * slideAmount;
        const dy = flyDy * slideAmount;
        const cx2 = Math.round(tgtHex.px * SCALE);
        const cy2 = Math.round(tgtHex.py * SCALE);
        if (!willRespawn) dispatch(spiritEliminated(tgtId));
        setSlideOffAnimations(prev => ({
          ...prev,
          [tgtId]: { cx: cx2, cy: cy2, dx, dy, color: tgt.color, imageSrc: tgt.imageSrc, name: tgt.name, id: tgtId, corner: tgt.corner },
        }));
        setTimeout(() => {
          setSlideOffAnimations(prev => { const n = { ...prev }; delete n[tgtId]; return n; });
          if (willRespawn) addLog(`💥 ${tgt.name} KNOCKED DOWN! ${livesLeft} ${livesLeft === 1 ? "life" : "lives"} left — respawning!`);
          else addLog(`💀 ${tgt.name} is KO'd!`);
          const updated = dispatch(knockdownResolved(tgtId)).spirits;
          if (!willRespawn) checkWinner(updated);
          if (willRespawn) {
            // Same Knock Down penalty as a Vibe-loss knockdown: -1 FP, but they
            // pop straight back up in their home corner — no turn is skipped.
            dispatch(fameChanged(tgtId, -1)); // Knock Down penalty: −1 FP (engine floors at 0; no-op if no sheet)
            setNoteStates(nsPrev => nsPrev[tgtId]
              ? { ...nsPrev, [tgtId]: { ...nsPrev[tgtId], recovering: false } }
              : nsPrev);
            addLog(`💸 ${tgt.name} loses 1 FP and gets straight back up in their home corner!`);
            setRespawnFlashes(prev => ({ ...prev, [tgtId]: true }));
            setTimeout(() => setRespawnFlashes(prev => { const n = { ...prev }; delete n[tgtId]; return n; }), 1200);
          }
        }, 4000);
        return;
      }
    }
    if (!willRespawn) dispatch(spiritEliminated(tgtId));
    const updated = dispatch(knockdownResolved(tgtId)).spirits;
    if (!willRespawn) checkWinner(updated);
    if (willRespawn) addLog(`💫 ${tgt?.name} respawns with ${livesLeft} ${livesLeft === 1 ? "life" : "lives"} left!`);
  }

  // ─── HEX CLICK ───────────────────────────────────────────────────────────────
  function onHexClick(num) {
    if (!acting || !canAct) return; // N4/N7: gate — only the acting client drives moves
    // 🤘 ROCK GOD — clicking the God IS the attack (melee if adjacent, Sonic
    // beam if lined up). Overrides every other action; commit fast, hit hard.
    if (rockGodActive && rockGod && num === rockGod.num) {
      attackRockGod(acting.id);
      return;
    }
    if (action === "swing") {
      // 👤 Swinging at the double looks exactly like swinging at the Ronin —
      // right up until the blade meets nothing.
      if (isShadowTarget(num, 'cone')) { resolveShadowWhiff(acting, 'swing', 'swing'); return; }
      const rivals = acting ? getRivalsInCone(acting) : [];
      const target = rivals.find(r => r.num === num);
      if (target) { initiateSwing(target.id); setAction(null); }
      else addLog("⚔️ That spirit is not in your swing cone!");
      return;
    }
    if (action === "face") {
      if (!acting) return;
      const actingHex = HEX_BY_NUM[acting.num];
      if (!actingHex) return;
      const neighbors = getFlatTopNeighborSlots(actingHex);
      const isNeighbor = neighbors.some(n => n.num === num);
      if (!isNeighbor) { addLog("🔄 Click an adjacent hex to set your facing direction."); return; }
      const targetHex = HEX_BY_NUM[num];
      if (!targetHex) return;
      const newFacing = angleTo(actingHex, targetHex);
      dispatch(spiritFaced(acting.id, newFacing)); // reducer owns the facing write
      setAction(null);
      addLog(`🔄 ${acting.name} turns to face hex #${num} (costs 1 step)`);
      return;
    }
    if (action === "sonic") {
      if (isShadowTarget(num, 'beam')) { resolveShadowWhiff(acting, 'sonic', 'sonic beam'); return; }
      const rivals = acting ? getRivalsInBeam(acting) : [];
      const target = rivals.find(r => r.num === num);
      if (target) { initiateSonicAttack(target.id); setAction(null); }
      else addLog("🔊 That spirit is not in your sonic beam!");
      return;
    }
    if (action === "smash") {
      if (isShadowTarget(num, 'cone')) { resolveShadowWhiff(acting, 'smash', 'Smash'); return; }
      const rivals = acting ? getRivalsInCone(acting) : [];
      const target = rivals.find(r => r.num === num);
      if (target) { resolveSmash(target.id); setAction(null); }
      else addLog("🎸 That spirit is not in your melee range for the Smash!");
      return;
    }
    if (action === "blaster") {
      // 🌀 Ranged & piercing — clicking any rival in the beam fires at ALL of them.
      const rivals = acting ? getRivalsInBeam(acting) : [];
      if (rivals.some(r => r.num === num)) {
        resolveBlasterOfRa();
        setAction(null);
        // The beam pierces everything in the line — including the double, which
        // comes apart as the shot passes through it.
        if (shadowInRange('beam')) dismissShadowIllusion('the Blaster of Ra tore through it');
      }
      else if (isShadowTarget(num, 'beam')) { resolveShadowWhiff(acting, 'blaster', 'Blaster of Ra'); }
      else addLog("🌀 Click a rival in your beam to fire the Blaster of Ra!");
      return;
    }
    if (action === "displace") {
      if (acting && displaceTargets.has(num)) resolveDisplace(num);
      else addLog("🌌 Warp to an open hex beside you.");
      return;
    }
    if (action === "psycho_bushido") {
      const targets = getPsychoBushidoTargets();
      if (targets.has(num)) {
        const rival = spirits.find(s => s.num === num && s.id !== acting?.id && !s.knockedOut);
        if (rival) { resolvePsychoBushido(rival.id); setAction(null); }
      } else addLog("🌀 Click a rival in your straight line of sight!");
      return;
    }
    if (action === "move_shadow") {
      if (shadowReachable.has(num)) moveShadow(num);
      else addLog("👤 The shadow can only step to an open adjacent hex.");
      return;
    }
    if (action === "move") {
      if (reachable.has(num)) move(num);
      else addLog("❌ Can't reach that hex!");
      return;
    }
    const s = spiritByNum[num];
    if (s) addLog(`ℹ️ ${s.name} — ${s.vibe}/${s.maxVibe} Vibe · Hex #${num}`);
    // 👤 Inspecting the double reports the real Ronin's stat line, verbatim.
    // A rival poking at it learns nothing they wouldn't learn poking the real one.
    else if (shadowDecoy && num === shadowDecoy.num) {
      addLog(`ℹ️ ${shadowDecoy.name} — ${shadowDecoy.vibe}/${shadowDecoy.maxVibe} Vibe · Hex #${num}`);
    }
  }

  // ─── HEX VISUAL HELPERS ───────────────────────────────────────────────────────
  const HS = Math.round(HEX_SIZE * SCALE * 0.88);

  // 🌌 Valid warp landing hexes while aiming Displace (open neighbor hexes).
  const displaceTargets = useMemo(() => {
    if (action !== 'displace' || !acting) return new Set();
    const spHex = HEX_BY_NUM[acting.num];
    if (!spHex) return new Set();
    const occupied = new Set(spirits.filter(s => !s.knockedOut).map(s => s.num));
    if (shadowHex != null) occupied.add(shadowHex); // 👤 can't warp into the double
    const out = new Set();
    getFlatTopNeighborSlots(spHex).forEach(n => { if (!occupied.has(n.num)) out.add(n.num); });
    return out;
  }, [action, acting, spirits, shadowHex]);

  function hexFill(hex) {
    // hovering a HUD attack button previews its range like the live mode
    const previewAction = action ?? hoverPreview;
    if (hex.num === LIMELIGHT_HEX) return "#ff44ff18";
    if (hex.num === spotlightHex)  return "#ffffff14";
    const sp = spiritByNum[hex.num];
    // 💨 Smoke-hidden spirits are invisible — don't colour their hex
    if (sp && !isHiddenBySmoke(sp)) return sp.color + "44";
    // 👤 The double's hex is tinted with the Ronin's own colour, exactly as if
    // he were standing on it. This runs BEFORE every targeting highlight so the
    // decoy never lights up differently from the real body.
    if (shadowDecoy && hex.num === shadowDecoy.num) return shadowDecoy.color + "44";
    if (action === 'displace' && displaceTargets.has(hex.num)) return "#aa55ff33";
    if (action === 'move_shadow' && shadowReachable.has(hex.num)) return "#ffffff18";
    if (action === 'psycho_bushido' && getPsychoBushidoTargets().has(hex.num)) return "#4488ff33";
    // 🎸 Cursed Shamisen — its hex plus the concentric rings of its melody.
    // Each ring is shaded a step darker than the last, so you can count how many
    // rings out you are at a glance instead of guessing where the edge is.
    {
      const sham = noteStates['cosmic_ronin']?.cursedShamisen;
      if (sham) {
        if (hex.num === sham.hex) return sham.hunting ? '#ff440055' : '#4488ff55';
        const shamHex = HEX_BY_NUM[sham.hex];
        if (shamHex) {
          const dist = axialDist(shamHex.q, shamHex.r, hex.q, hex.r);
          if (dist <= (sham.range ?? 0)) {
            const fade = ['22', '18', '12', '0c'][Math.min(dist - 1, 3)];
            return (sham.hunting ? '#ff2200' : '#4488ff') + fade;
          }
        }
      }
    }
    if (reachable.has(hex.num)) return "#ffffff18";
    // Swing / Smash cone highlight
    if ((previewAction === 'swing' || previewAction === 'smash') && acting) {
      const cone = getSwingCone(acting);
      if (cone.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num && !isHiddenBySmoke(s));
        return isRival ? '#ff333344' : '#ff111122';
      }
    }
    // Sonic beam highlight
    if ((previewAction === 'sonic' || previewAction === 'blaster') && acting) {
      const beam = getSonicBeam(acting);
      if (beam.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num && !isHiddenBySmoke(s));
        return isRival ? '#0066ff44' : '#0033ff18';
      }
    }
    // Face mode: highlight adjacent hexes
    if (action === 'face' && acting) {
      const actingHex = HEX_BY_NUM[acting.num];
      if (actingHex) {
        const neighbors = getFlatTopNeighborSlots(actingHex);
        if (neighbors.some(n => n.num === hex.num)) return '#00ccff22';
      }
    }
    // 🧪 Poison slime tint
    if (poisonSlime[hex.num]) return '#44ff4412';
    return "transparent";
  }

  function hexStroke(hex) {
    const previewAction = action ?? hoverPreview;
    if (hex.num === LIMELIGHT_HEX) return "#ff44ff";
    if (hex.num === spotlightHex)  return "#ffffaacc";
    const sp = spiritByNum[hex.num];
    // 💨 Smoke-hidden spirits are invisible — don't stroke their hex
    if (sp && !isHiddenBySmoke(sp) && acting?.id === sp.id) return sp.color;
    if (sp && !isHiddenBySmoke(sp)) return sp.color;
    // 👤 Decoy hex is outlined in the Ronin's colour, same as a real standee.
    if (shadowDecoy && hex.num === shadowDecoy.num) return shadowDecoy.color;
    if (action === 'move_shadow' && shadowReachable.has(hex.num)) return "#ffffff88";
    if (action === 'displace' && displaceTargets.has(hex.num)) return "#cc88ffcc";
    if (action === 'psycho_bushido' && getPsychoBushidoTargets().has(hex.num)) return "#4488ffcc";
    if (reachable.has(hex.num)) return "#ffffff88";
    // Swing / Smash cone stroke
    if ((previewAction === 'swing' || previewAction === 'smash') && acting) {
      const cone = getSwingCone(acting);
      if (cone.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num && !isHiddenBySmoke(s));
        return isRival ? '#ff4444ee' : '#ff222244';
      }
    }
    // Sonic beam stroke
    if ((previewAction === 'sonic' || previewAction === 'blaster') && acting) {
      const beam = getSonicBeam(acting);
      if (beam.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num && !isHiddenBySmoke(s));
        return isRival ? '#44aaffee' : '#2244ff44';
      }
    }
    // Face mode: adjacent hex stroke
    if (action === 'face' && acting) {
      const actingHex = HEX_BY_NUM[acting.num];
      if (actingHex && getFlatTopNeighborSlots(actingHex).some(n => n.num === hex.num)) {
        return '#00ccffcc';
      }
    }
    if (hovered === hex.num && action) return "#ffffffaa";
    if (hex.stage) return "#ff44ff88";
    return "transparent";
  }

  function hexStrokeW(hex) {
    if (hex.num === LIMELIGHT_HEX) return 2;
    const sp = spiritByNum[hex.num];
    // 💨 Smoke-hidden spirits don't thicken their hex stroke
    const spVisible = sp && !isHiddenBySmoke(sp);
    if (spVisible && acting?.id === sp.id) return Math.round(3 / SCALE * 0.13);
    // 👤 When the Ronin is the acting Spirit, BOTH his standees get the thick
    // "it's my turn" outline — otherwise the ring thickness alone would out him.
    if (shadowDecoy && hex.num === shadowDecoy.num) {
      return acting?.id === 'cosmic_ronin' ? Math.round(3 / SCALE * 0.13) : 1.5;
    }
    if (spVisible || reachable.has(hex.num) || shadowReachable.has(hex.num) || hex.stage) return 1.5;
    if (action === 'displace' && displaceTargets.has(hex.num)) return 2;
    if (action === 'psycho_bushido' && getPsychoBushidoTargets().has(hex.num)) return 2;
    return 0.8;
  }

  // ─── RUMBLE & DAMAGE FLOAT ────────────────────────────────────────────────────
  function triggerRumble(spiritId, durationMs = 500) {
    setRumblingIds(prev => new Set([...prev, spiritId]));
    gt(() => setRumblingIds(prev => {
      const next = new Set(prev); next.delete(spiritId); return next;
    }), durationMs);
  }

  function showDamageFloat(spiritId, amount) {
    if (!amount || amount <= 0) return;
    const key = `${spiritId}-${Date.now()}-${Math.random()}`;
    setFloatingDmg(prev => [...prev, { spiritId, amount, key }]);
    gt(() => setFloatingDmg(prev => prev.filter(f => f.key !== key)), 1200);
  }

  // 🎵 SPENT NOTES ─────────────────────────────────────────────────────────────
  // The stacks are ammunition, and ammunition running out should be VISIBLE.
  // Every note that leaves a Spirit — Drive notes burned to power an attack,
  // Sustain notes frayed off by a hit that landed — gets a glyph that tears
  // away from the standee and fades to nothing. Two flavours:
  //   'drive'   (⚔️ red)  — you spent it; it flies up and forward.
  //   'sustain' (🛡️ blue) — it was knocked out of you; it scatters sideways.
  // Notes fan out and stagger so a 2-note burn reads as two distinct losses.
  const SPENT_NOTE_MS = 1500;
  function showSpentNotes(spiritId, notes, kind = 'drive') {
    const list = (notes ?? []).filter(Boolean);
    if (!spiritId || list.length === 0) return;
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const burst = list.map((note, i) => ({
      key: `sn-${spiritId}-${stamp}-${i}`,
      spiritId, note, kind, i, n: list.length,
    }));
    setSpentNotes(prev => [...prev, ...burst]);
    const keys = new Set(burst.map(b => b.key));
    // Last glyph leaves ~180 ms after the first (the stagger), so hold for both.
    gt(() => setSpentNotes(prev => prev.filter(s => !keys.has(s.key))),
      SPENT_NOTE_MS + list.length * 180);
  }

  // 💥 STATUS-EFFECT BOARD VFX ─────────────────────────────────────────────────
  // Pulsing shockwave rings + a floating neon label around a spirit's standee —
  // fired the moment an ability lands so it's unmistakable WHO got hit by WHAT.
  function triggerEffectFlash(spiritId, icon, label, color, durationMs = 2800) {
    const key = `fx-${spiritId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setEffectFlashes(prev => [...prev, { key, spiritId, icon, label, color }]);
    triggerRumble(spiritId, 350);
    gt(() => setEffectFlashes(prev => prev.filter(f => f.key !== key)), durationMs);
  }

  // 🎥 Brief cinematic push-in on a board hex, easing back out after a hold.
  // Reuses the existing cameraView → animated-viewBox machinery (zoomReset clears it).
  // rumbleAtEnd → shake the spirit on that hex the instant the zoom settles (impact hits).
  const focusTimerRef = useRef(null);
  const zoomRumbleRef = useRef(null);
  function focusOnHex(hexNum, holdMs = 950, frac = 0.42, rumbleAtEnd = false) {
    if (isPanningRef.current) return;            // never yank a hand-pan
    const h = HEX_BY_NUM[hexNum];
    if (!h) return;
    setCameraView({ cx: h.px, cy: h.py, padW: (SVG_W / SCALE) * frac, padH: (SVG_H / SCALE) * frac });
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = gt(() => setCameraView(null), holdMs);
    if (rumbleAtEnd) {
      if (zoomRumbleRef.current) clearTimeout(zoomRumbleRef.current);
      zoomRumbleRef.current = gt(() => {
        const sp = spirits.find(s => s.num === hexNum && !s.knockedOut);
        if (sp) triggerRumble(sp.id, 560);
      }, CAMERA_ZOOM_MS);
    }
  }

  // 💥 Float a combat number (e.g. "−2 ❤️") up over a hex, then clear it.
  function triggerDamageNumber(hexNum, text, color = '#ff4455') {
    if (hexNum == null) return;
    const key = `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setDamageFx(prev => [...prev, { key, hexNum, text, color }]);
    gt(() => setDamageFx(prev => prev.filter(d => d.key !== key)), 1300);
  }

  // ─── CAMERA ZOOM ──────────────────────────────────────────────────────────────
  const animatedVBRef = useRef(null);
  const vbAnimRef     = useRef(null);

  useEffect(() => {
    const W = SVG_W, H = SVG_H;
    const fullVB = `0 0 ${W} ${H}`;
    if (!animatedVBRef.current) {
      animatedVBRef.current = fullVB;
      if (svgRef.current) svgRef.current.setAttribute("viewBox", fullVB);
    }
    let targetVB = fullVB;
    if (cameraView) {
      const { cx, cy, padW, padH } = cameraView;
      const sx = cx * SCALE, sy = cy * SCALE;
      const sw = padW * SCALE, sh = padH * SCALE;
      const aspect = W / H;
      const wFromH = sh * aspect;
      const hFromW = sw / aspect;
      const fw = Math.max(sw, wFromH);
      const fh = Math.max(sh, hFromW);
      targetVB = `${sx - fw/2} ${sy - fh/2} ${fw} ${fh}`;
    }
    const parse = s => s.split(" ").map(Number);
    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpVB = (from, to, t) => from.map((v, i) => lerp(v, to[i], t));
    const format = v => v.map(n => n.toFixed(2)).join(" ");
    if (vbAnimRef.current) cancelAnimationFrame(vbAnimRef.current);
    const start = performance.now();
    const duration = CAMERA_ZOOM_MS / (gameSpeedRef.current || 1);
    const fromVB = parse(animatedVBRef.current);
    const toVB = parse(targetVB);
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
      const current = lerpVB(fromVB, toVB, ease);
      const vbStr = format(current);
      animatedVBRef.current = vbStr;
      if (svgRef.current) svgRef.current.setAttribute("viewBox", vbStr);
      if (t < 1) vbAnimRef.current = requestAnimationFrame(tick);
    }
    vbAnimRef.current = requestAnimationFrame(tick);
    return () => { if (vbAnimRef.current) cancelAnimationFrame(vbAnimRef.current); };
  }, [cameraView]); // eslint-disable-line

  useEffect(() => {
    if (!cameraView && manualVBRef.current) {
      const str = manualVBRef.current.map(n => n.toFixed(2)).join(" ");
      animatedVBRef.current = str;
      if (svgRef.current) svgRef.current.setAttribute("viewBox", str);
    }
  }, [cameraView]);

  function zoomReset(delay = 0) {
    gt(() => setCameraView(null), delay);
  }

  // ─── MANUAL ZOOM/PAN ─────────────────────────────────────────────────────────
  function clientToSVG(evt) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vbParts = animatedVBRef.current?.split(" ").map(Number) ?? [0, 0, SVG_W, SVG_H];
    const [vx, vy, vw, vh] = vbParts;
    const scaleX = vw / rect.width;
    const scaleY = vh / rect.height;
    return {
      x: vx + (evt.clientX - rect.left) * scaleX,
      y: vy + (evt.clientY - rect.top)  * scaleY,
    };
  }

  function applyManualVB(vb) {
    manualVBRef.current = vb;
    const str = vb.map(n => n.toFixed(2)).join(" ");
    animatedVBRef.current = str;
    if (svgRef.current) svgRef.current.setAttribute("viewBox", str);
    setManualZoomActive(true);
  }

  function resetManualZoom() {
    manualVBRef.current = null;
    setManualZoomActive(false);
    const fullVB = `0 0 ${SVG_W} ${SVG_H}`;
    animatedVBRef.current = fullVB;
    if (svgRef.current) svgRef.current.setAttribute("viewBox", fullVB);
  }

  function handleBoardWheel(evt) {
    evt.preventDefault();
    const vbParts = animatedVBRef.current?.split(" ").map(Number) ?? [0, 0, SVG_W, SVG_H];
    let [vx, vy, vw, vh] = vbParts;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = vx + (evt.clientX - rect.left) * (vw / rect.width);
    const my = vy + (evt.clientY - rect.top)  * (vh / rect.height);
    const factor = evt.deltaY < 0 ? 0.85 : 1 / 0.85;
    const newW = Math.min(SVG_W, Math.max(SVG_W * 0.15, vw * factor));
    const newH = Math.min(SVG_H, Math.max(SVG_H * 0.15, vh * factor));
    if (newW >= SVG_W || newH >= SVG_H) {
      applyManualVB([0, 0, SVG_W, SVG_H]);
      return;
    }
    const newX = mx - (mx - vx) * (newW / vw);
    const newY = my - (my - vy) * (newH / vh);
    const clampedX = Math.max(0, Math.min(SVG_W - newW, newX));
    const clampedY = Math.max(0, Math.min(SVG_H - newH, newY));
    applyManualVB([clampedX, clampedY, newW, newH]);
  }

  function handleBoardMouseDown(evt) {
    if (evt.button === 1 || evt.button === 2 || (evt.button === 0 && !action)) {
      const vbParts = animatedVBRef.current?.split(" ").map(Number) ?? [0, 0, SVG_W, SVG_H];
      isPanningRef.current = true;
      panStartRef.current = { clientX: evt.clientX, clientY: evt.clientY, vb: vbParts };
      evt.preventDefault();
    }
  }

  function handleBoardMouseMove(evt) {
    if (!isPanningRef.current || !panStartRef.current) return;
    const { clientX: sx, clientY: sy, vb } = panStartRef.current;
    const [vx, vy, vw, vh] = vb;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (sx - evt.clientX) * (vw / rect.width);
    const dy = (sy - evt.clientY) * (vh / rect.height);
    const newX = Math.max(0, Math.min(SVG_W - vw, vx + dx));
    const newY = Math.max(0, Math.min(SVG_H - vh, vy + dy));
    applyManualVB([newX, newY, vw, vh]);
  }

  function handleBoardMouseUp() {
    isPanningRef.current = false;
    panStartRef.current = null;
  }

  // ─── CSS KEYFRAMES ────────────────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes rumble {
        0%   { transform: translate(0px, 0px); }
        15%  { transform: translate(-3px, 2px); }
        30%  { transform: translate(3px, -2px); }
        45%  { transform: translate(-2px, -3px); }
        60%  { transform: translate(2px, 3px); }
        75%  { transform: translate(-3px, 1px); }
        90%  { transform: translate(3px, -1px); }
        100% { transform: translate(0px, 0px); }
      }
      @keyframes floatUp {
        0%   { transform: translateY(0px);    opacity: 1; }
        60%  { transform: translateY(-18px);  opacity: 1; }
        100% { transform: translateY(-32px);  opacity: 0; }
      }
      @keyframes slideOff {
        0%   { opacity: 1; }
        30%  { opacity: 0.9; }
        100% { opacity: 0; }
      }
      /* ⭐ FAME BAR — the win condition should never sit still. */
      @keyframes fame-sheen {
        0%   { transform: translateX(-120%); }
        100% { transform: translateX(320%); }
      }
      @keyframes fame-danger {
        0%,100% { box-shadow: 0 0 6px #ff2200aa, inset 0 0 8px #ff440055; border-color: #ff4422; }
        50%     { box-shadow: 0 0 16px #ff4400ee, inset 0 0 14px #ff660088; border-color: #ff8844; }
      }
      @keyframes fame-crown {
        0%,100% { text-shadow: 0 0 4px #ffd70088; }
        50%     { text-shadow: 0 0 10px #fff3c4, 0 0 18px #ffd700aa; }
      }
      @keyframes fame-pip-pop {
        0%   { transform: scale(0.4); opacity: 0.2; }
        60%  { transform: scale(1.35); opacity: 1; }
        100% { transform: scale(1);   opacity: 1; }
      }
      /* 🔁 Editable track note — lift + red cast on hover so it reads as
         "pull this out", not "click to inspect". */
      .track-note-edit { transition: transform .12s ease, filter .12s ease; }
      .track-note-edit:hover {
        transform: translateY(-3px) scale(1.06);
        filter: drop-shadow(0 0 8px #ff5566cc) saturate(1.25);
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className={beginnerEnabled ? 'beginner-glow' : ''} style={{ fontFamily:"'Share Tech Mono','Courier New',monospace",
      background:"radial-gradient(ellipse at 50% -10%, #0a1226 0%, #050810 55%)",
      color:"#e2e8f0", minHeight:"100vh", display:"flex", flexDirection:"column", padding:10, boxSizing:"border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>

      {/* ── GAME OVER OVERLAY ── */}
      <GameOverOverlay
        winner={winner}
        spirits={spirits}
        noteStates={noteStates}
        limelightScores={limelightScores}
        headliner={engineRef.current?.headliner ?? null}
        matchStats={matchStatsRef.current}
        onReturnToLobby={onReturnToLobby}
        fameToWin={fameToWin}
        LIMELIGHT_TO_WIN={LIMELIGHT_TO_WIN}
      />
      {/* 🤘 Total wipe — the Rock God keeps the crown */}
      <GodVictoryOverlay god={rockGod} bossOutcome={bossOutcome} spirits={spirits}
        noteStates={noteStates} onReturnToLobby={onReturnToLobby} />

      <GameStyles />

      {/* 🎓 BEGINNER TIP POPUP — paged walkthroughs with HUD-pointing arrows
          (ui/BeginnerTipOverlay.jsx; anchors = data-tip-anchor attributes) */}
      {activeTip && (
        <BeginnerTipOverlay
          tip={activeTip}
          gates={tipGates}
          onClose={() => setActiveTip(null)}
          onDisable={() => { setBeginnerEnabled(false); setActiveTip(null); }}
        />
      )}

      {/* 🎵 LOST CHORD PICKUP — bank it vs weave it into the Chord Stack */}
      {pendingLostChordPickup && (() => {
        const sp = spirits.find(s => s.id === pendingLostChordPickup.spiritId);
        const ns = noteStates[pendingLostChordPickup.spiritId] ?? {};
        const pickupCap = stackCapFor(ns.unlockedSkills ?? []);
        const driveFull = (ns.driveStack?.length ?? 0) >= pickupCap;
        const sustainFull = (ns.sustainStack?.length ?? 0) >= pickupCap;
        const budgetSpent = (ns.stackCommitsThisTurn ?? 0) >= STACK_COMMIT_BUDGET;
        // Compute benefit advice: compare chord stats with the note added to each stack
        const theNote = pendingLostChordPickup.note;
        const curDrive   = spiritChord(pendingLostChordPickup.spiritId, ns.driveStack ?? []);
        const curSustain = spiritChord(pendingLostChordPickup.spiritId, ns.sustainStack ?? []);
        const withDrive  = !driveFull ? spiritChord(pendingLostChordPickup.spiritId, [...(ns.driveStack ?? []), theNote]) : curDrive;
        const withSustain = !sustainFull ? spiritChord(pendingLostChordPickup.spiritId, [...(ns.sustainStack ?? []), theNote]) : curSustain;
        const driveGain   = withDrive.drive - curDrive.drive;
        const sustainGain = withSustain.sustain - curSustain.sustain;
        const advice = (driveFull && sustainFull) ? null
          : (driveFull) ? '🛡️ Drive is full — Sustain is the play.'
          : (sustainFull) ? '⚔️ Sustain is full — Drive is the play.'
          : (driveGain > sustainGain) ? `⚔️ Better for Drive (+${driveGain} Drive vs +${sustainGain} Sustain)`
          : (sustainGain > driveGain) ? `🛡️ Better for Sustain (+${sustainGain} Sustain vs +${driveGain} Drive)`
          : `⚖️ Equal benefit (+${driveGain} to either stack)`;
        return (
          <div style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',
            background:'#000000aa',backdropFilter:'blur(3px)'}}>
            <div style={{width:360,maxWidth:'90vw',background:'linear-gradient(180deg,#0e1828,#080f1e)',
              border:'1.5px solid #7fe0ff',borderRadius:12,padding:'22px 20px 18px',
              boxShadow:'0 0 40px #7fe0ff33, 0 8px 32px #00000088',
              fontFamily:"'Share Tech Mono',monospace",textAlign:'center'}}>
              <div style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:12,color:'#7fe0ff',letterSpacing:1,marginBottom:10,
                textShadow:'0 0 10px #7fe0ff55'}}>🎵 LOST CHORD FOUND</div>
              <div style={{fontSize:26,fontWeight:900,color:'#fff',marginBottom:4,
                textShadow:'0 0 12px #7fe0ff'}}>{pendingLostChordPickup.note}</div>
              <div style={{fontSize:9,color:'#8aa5c5',marginBottom:8,lineHeight:1.5}}>
                {sp?.name} can bank it into the Note Stock, or weave it into a stack
                — costs 1 of your {STACK_COMMIT_BUDGET} stack commits this turn.
              </div>
              {advice && (
                <div style={{fontSize:9,color:'#ffcc44',marginBottom:12,padding:'5px 10px',
                  background:'#1a1400',border:'1px solid #ffcc4433',borderRadius:5,
                  fontWeight:700,letterSpacing:0.5}}>
                  {advice}
                </div>
              )}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <button onClick={() => resolveLostChordPickup('drive')} disabled={driveFull || budgetSpent}
                  style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,cursor: (driveFull||budgetSpent)?'not-allowed':'pointer',
                    opacity: (driveFull||budgetSpent) ? 0.4 : 1,
                    background:'#1a0c1a',border:'1.5px solid #ff6644',borderRadius:5,
                    color:'#ff9966',padding:'8px 16px',letterSpacing:1}}>
                  ⚔️ Add to Drive Stack {driveFull ? '(full)' : budgetSpent ? '(budget spent)' : `(${curDrive.drive} → ${withDrive.drive})`}
                </button>
                <button onClick={() => resolveLostChordPickup('sustain')} disabled={sustainFull || budgetSpent}
                  style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,cursor: (sustainFull||budgetSpent)?'not-allowed':'pointer',
                    opacity: (sustainFull||budgetSpent) ? 0.4 : 1,
                    background:'#0a1828',border:'1.5px solid #44aaff',borderRadius:5,
                    color:'#88ccff',padding:'8px 16px',letterSpacing:1}}>
                  🛡️ Add to Sustain Stack {sustainFull ? '(full)' : budgetSpent ? '(budget spent)' : `(${curSustain.sustain} → ${withSustain.sustain})`}
                </button>
                <button onClick={() => resolveLostChordPickup('bank')}
                  style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,cursor:'pointer',
                    background:'#0a1828',border:'1.5px solid #7fe0ff',borderRadius:5,
                    color:'#7fe0ff',padding:'8px 16px',letterSpacing:1}}>
                  🎵 Bank it (Note Stock)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ⚡ CHARGE ZONE — OVERCHARGE CHOICE — dice charge vs chord assist */}
      {chargeChoicePending && (() => {
        const sp = spirits.find(s => s.id === chargeChoicePending.spiritId);
        return (
          <div style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',
            background:'#000000aa',backdropFilter:'blur(3px)'}}>
            <div style={{width:380,maxWidth:'90vw',background:'linear-gradient(180deg,#0e1828,#080f1e)',
              border:'1.5px solid #44aaff',borderRadius:12,padding:'22px 20px 18px',
              boxShadow:'0 0 40px #44aaff33, 0 8px 32px #00000088',
              fontFamily:"'Share Tech Mono',monospace",textAlign:'center'}}>
              <div style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:12,color:'#44aaff',letterSpacing:1,marginBottom:10,
                textShadow:'0 0 10px #44aaff55'}}>⚡ CHARGE ZONE — OVERCHARGE</div>
              <div style={{fontSize:9,color:'#8aa5c5',marginBottom:16,lineHeight:1.5}}>
                {sp?.name} taps into the rig. Pick the payoff:
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <button onClick={() => resolveChargeChoice('boost')}
                  style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,cursor:'pointer',
                    background:'#0a1828',border:'1.5px solid #44aaff',borderRadius:5,
                    color:'#88ccff',padding:'8px 16px',letterSpacing:1,textAlign:'left'}}>
                  ⚡ Dice Charge — random Floor +{CHARGE_FLOOR_BONUS} or die-size up ({CHARGE_ZONE_BOOST_TURNS} rounds / until battle)
                </button>
                <button onClick={() => resolveChargeChoice('chord')}
                  style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:10,cursor:'pointer',
                    background:'#1a0c1a',border:'1.5px solid #ff66cc',borderRadius:5,
                    color:'#ff99dd',padding:'8px 16px',letterSpacing:1,textAlign:'left'}}>
                  🎸 Chord Assist — 1 curated Chord Stack note + a bonus revoice
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── HEADER ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,paddingBottom:7,borderBottom:"1px solid #1a2a40"}}>
        <span style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:17,color:"#f6ad55",letterSpacing:3,
          textShadow:"0 0 12px #f6ad5566, 0 0 28px #f6ad5522"}}>⚡ RLSW</span>
        <span style={{fontSize:10,color:"#3a5a7a"}}>v3.6</span>
        <button onClick={() => setShowRiffbook(true)} data-tip-anchor="riffbook" title="The Riffbook — legendary riffs hidden in the note system"
          style={{fontFamily:'inherit', fontSize:9, padding:'2px 9px', cursor:'pointer',
            background:'#14110a', border:'1px solid #ffd70066', borderRadius:10, color:'#ffd700'}}>
          📖 RIFFBOOK {Object.keys(riffBook).length}/{RIFF_LIBRARY.length}
        </button>
        {(() => {
          // Show only when the acting Spirit has an exclusive (spiritOnly) route.
          const sigRoute = acting ? SKILL_TREE.routes.find(r => r.spiritOnly === acting.id) : null;
          if (!sigRoute) return null;
          return (
            <button onClick={() => setSignatureSpirit(acting.id)}
              title={`${acting.name}'s signature abilities`}
              style={{fontFamily:'inherit', fontSize:9, padding:'2px 9px', cursor:'pointer',
                background:'#0a1424', border:`1px solid ${sigRoute.color}88`, borderRadius:10, color:sigRoute.color}}>
              {sigRoute.icon} {acting.name?.split(' ')[0]?.toUpperCase()} ABILITIES
            </button>
          );
        })()}
        <span style={{fontSize:9, padding:'2px 9px', background:'#0a1020', border:'1px solid #1e3a5f',
          borderRadius:10, color:'#6a8aaa'}} title="First spirit to reach the Fame target wins">
          🏆 first to ⭐{fameToWin} FP wins
        </span>
        {flamingHexes.roundsLeft > 0 && (
          <span style={{fontSize:9,padding:"2px 8px",background:"#1a0800",border:"1px solid #ff6622",borderRadius:10,color:"#ff8844",
            animation:"marqueeBlink 1.4s ease-in-out infinite"}}>
            🔥💿 DISCO INFERNO — {flamingHexes.roundsLeft} round{flamingHexes.roundsLeft!==1?"s":""} left
          </span>
        )}
        {Object.keys(poisonSlime).length > 0 && (
          <span style={{fontSize:9,padding:"2px 8px",background:"#0a1a0a",border:"1px solid #44ff44",borderRadius:10,color:"#66ff66",
            animation:"marqueeBlink 1.4s ease-in-out infinite"}}>
            🧪 POISON SLIME — {Object.keys(poisonSlime).length} hex{Object.keys(poisonSlime).length!==1?"es":""}
          </span>
        )}
        {stageFxBanner && (() => {
          const m = STAGE_FX_META[stageFxBanner.id];
          return m && (
            <span style={{fontSize:9,padding:"2px 8px",background:"#130f22",border:`1px solid ${m.color}`,borderRadius:10,color:m.color,
              animation:"marqueeBlink 1.4s ease-in-out infinite"}}>
              🎇 {m.icon} {m.name.toUpperCase()} @ ⭐{stageFxBanner.threshold}
            </span>
          );
        })()}
        {mode === "team" && (
          <span style={{fontSize:9,padding:"2px 8px",background:"#1a0a30",border:"1px solid #aa55ff",borderRadius:10,color:"#cc99ff"}}>
            🤝 {spirits.filter(s=>teams.a.includes(s.corner)).map(s=>s.name.split(" ")[0]).join("+")} vs {spirits.filter(s=>teams.b.includes(s.corner)).map(s=>s.name.split(" ")[0]).join("+")}
          </span>
        )}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {action === "move" && (
            <span style={{fontSize:10,padding:"2px 8px",background:"#1a2a00",border:"1px solid #aacc00",borderRadius:10,color:"#ccff44"}}>
              👆 Click a lit hex to move ({moveStepsLeft} step{moveStepsLeft !== 1 ? "s" : ""} left)
            </span>
          )}
          <span style={{fontSize:10,padding:"2px 10px",background:"#0a1020",border:"1px solid #f6ad55",borderRadius:10,color:"#f6ad55"}}>
            ▶ {acting?.name}
          </span>
          {/* 🎤 CROWD blip — relocated from the old right panel: Fame multiplier + fan counts */}
          {acting && (() => {
            const ns = noteStates[acting.id] ?? {};
            const D = ns.diehards ?? FAN_DIEHARD_START, C = ns.casuals ?? 0;
            const A = (ns.assignments ?? []).length;
            const m = crowdMultiplier(D, C, A);
            return (
              <span title="Crowd — Fame multiplier · ♥ diehards · 👥 casuals"
                style={{fontSize:9,padding:"2px 9px",background:"#160a12",border:"1px solid #ff66aa66",borderRadius:10,
                  color:"#ff66aa",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
                🎤 ×{m.toFixed(2)} <span style={{color:'#ffcc44'}}>♥{D}</span> <span style={{color:'#66ccff'}}>👥{C}</span>
              </span>
            );
          })()}
          {/* BGM Controls — disabled (custom music only) */}
          {/* ⏩ FAST-FORWARD — cycle 1× / 2× / 4× presentation speed (rules
              untouched). Lives IN the HUD row — it used to be position:fixed
              at top-right, where it sat on top of the ↩ Lobby button. */}
          <button onClick={cycleGameSpeed}
            title="Fast-forward: cycle game speed 1× → 2× → 4×"
            style={{fontFamily:"inherit",fontSize:9,padding:"3px 8px",borderRadius:4,cursor:"pointer",fontWeight:700,
              background: gameSpeed === 1 ? "#0a1020" : "linear-gradient(180deg,#2d6cdf,#1b3f8f)",
              border:`1px solid ${gameSpeed === 1 ? "#1e3a5f" : "#7db0ff"}`,
              color: gameSpeed === 1 ? "#3a5a7a" : "#e2e8f0",
              boxShadow: gameSpeed === 1 ? "none" : "0 0 10px #2d6cdf88"}}>
            ⏩ {gameSpeed}×
          </button>
          {/* ⏭ Skip-cinematics toggle — reachable from any game, governs swings,
              sonics & riff-off intros. Same state the riff-off countdown card uses. */}
          <button onClick={() => setSkipBattleIntros(v => !v)}
            title="Compress the pre-die battle animations (swings, sonics & riff-off intros). The die-click itself is never skipped."
            style={{fontFamily:"inherit",fontSize:9,padding:"3px 8px",borderRadius:4,cursor:"pointer",
              background: skipBattleIntros ? "#1a2a00" : "#0a1020",
              border:`1px solid ${skipBattleIntros ? "#aacc00" : "#1e3a5f"}`,
              color: skipBattleIntros ? "#ccff44" : "#3a5a7a"}}>
            ⏭ {skipBattleIntros ? "fast battles: ON" : "fast battles"}
          </button>
          <button onClick={() => setLiteFx(v => !v)}
            title="Reduce GPU-heavy visual effects in battles (filters, shadows, blend modes). Helps if battles stutter or freeze."
            style={{fontFamily:"inherit",fontSize:9,padding:"3px 8px",borderRadius:4,cursor:"pointer",
              background: liteFx ? "#2a1a00" : "#0a1020",
              border:`1px solid ${liteFx ? "#cc8800" : "#1e3a5f"}`,
              color: liteFx ? "#ffaa22" : "#3a5a7a"}}>
            🎨 {liteFx ? "lite FX: ON" : "lite FX"}
          </button>
          <button onClick={() => { setBeginnerEnabled(b => !b); if (!beginnerEnabled) setBeginnerTipsSeen(new Set()); }}
            title={beginnerEnabled ? "Beginner tips are ON — click to turn off" : "Beginner tips are OFF — click to turn on (resets seen tips)"}
            style={{fontFamily:"inherit",fontSize:9,padding:"3px 8px",background: beginnerEnabled ? "#1a2a10" : "#0a1020",
              border:`1px solid ${beginnerEnabled ? "#44cc66" : "#1e3a5f"}`,borderRadius:4,
              color: beginnerEnabled ? "#44ff88" : "#3a5a7a",cursor:"pointer"}}>
            🎓 {beginnerEnabled ? 'tips ON' : 'tips OFF'}
          </button>
          <button onClick={onReturnToLobby}
            style={{fontFamily:"inherit",fontSize:9,padding:"3px 8px",background:"#0a1020",border:"1px solid #1e3a5f",borderRadius:4,color:"#3a5a7a",cursor:"pointer"}}>
            ↩ Lobby
          </button>
          {/* N6: spectator badge */}
          {netRef.current?.spectator && (
            <span style={{fontFamily:"'Saira Stencil One',sans-serif",fontSize:9,padding:"3px 10px",background:"#301520",
              border:"1px solid #ff4488",borderRadius:4,color:"#ff88bb",letterSpacing:2}}>
              SPECTATING
            </span>
          )}
        </div>
      </div>

      {/* ── THREE-COLUMN LAYOUT ── */}
      {/* HUD column: min 430px guarantees the spirit card's loadout + portrait
          columns always sit side-by-side (never wrap onto the portrait); max
          620px lets it stretch toward full-screen on wide monitors. The board
          column flexes and the board SVG scales to whatever remains. */}
      <div style={{display:"grid",gridTemplateColumns:"minmax(430px,480px) minmax(0,1fr)",gap:12,alignItems:"start",flex:1,minWidth:0}}>

      {/* ── N8: NET STATUS BANNERS — desync, own socket, rival disconnects ── */}
      {netRef.current && (() => {
        const gone = (netSeatsLive ?? []).filter(s => !s.isBot && s.connected === false);
        if (!gone.length && selfConn === "ok" && !netSync) return null;
        const pill = (bg, border, color) => ({
          fontFamily:"'Saira Stencil One',sans-serif", fontSize:10, letterSpacing:1.5,
          padding:"6px 16px", borderRadius:6, background:bg,
          border:`1px solid ${border}`, color, boxShadow:`0 0 14px ${border}55`,
        });
        return (
          <div style={{position:"fixed", top:8, left:"50%", transform:"translateX(-50%)",
            zIndex:9500, display:"flex", flexDirection:"column", gap:6,
            alignItems:"center", pointerEvents:"none"}}>
            {netSync && (
              <div style={pill("#301500", "#ffaa00", "#ffcc44")}>
                ⚠️ OUT OF SYNC — resyncing with the room…
              </div>
            )}
            {selfConn !== "ok" && (
              <div style={pill("#300a15", "#ff4488", "#ff88bb")}>
                📡 CONNECTION LOST — reconnecting…
              </div>
            )}
            {gone.map(s => (
              <div key={s.seatId} style={pill("#0a1530", "#4488ff", "#88bbff")}>
                🔌 {s.name} disconnected (reconnecting…)
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── BATTLE METER OVERLAY ── */}
      <BattleMeterOverlay
        RIFF_ANSWER_LABELS={RIFF_ANSWER_LABELS}
        RIFF_CONTOUR_LABELS={RIFF_CONTOUR_LABELS}
        RIFF_LEN={RIFF_LEN}
        SKILL_BY_ID={SKILL_BY_ID}
        battleMeterImg={battleMeterImg}
        battlePickImg={battlePickImg}
        battleState={battleState}
        closeBattleOverlay={closeBattleOverlay}
        closeRiffOff={closeRiffOff}
        enterRiffAnte={enterRiffAnte}
        isOnlineRiff={!!(netRef.current && battleState?.riffOff)}
        myBattleRole={netRef.current ? (netRef.current.mySpiritId === battleState?.attackerId ? 'attacker' : netRef.current.mySpiritId === battleState?.defenderId ? 'defender' : 'spectator') : null}
        pickOneLiner={pickOneLiner}
        respondOneLiner={respondOneLiner}
        crowdBlueImg={crowdBlueImg}
        crowdPinkImg={crowdPinkImg}
        fameFromMargin={fameFromMargin}
        fireBeamClash={fireBeamClash}
        handleAtkDieClick={handleAtkDieClick}
        handleDefDieClick={handleDefDieClick}
        // (hydraImg prop removed — Ronin rework)
        knockbackSpaces={knockbackSpaces}
        liteFx={liteFx}
        sonicKnockback={sonicKnockback}
        thrashKnockback={thrashKnockback}
        sonicFame={sonicFame}
        thrashFame={thrashFame}
        noteStates={noteStates}
        playRiffOffPlayback={playRiffOffPlayback}
        renderInstrument={renderInstrument}
        riffBeginTurn={riffBeginTurn}
        riffDifficulty={riffDifficulty}
        riffPressKey={riffPressKey}
        riffStats={riffStats}
        riffView={riffView}
        riffMicOn={riffMicOn}
        riffMicHeard={riffMicHeard}
        riffMicErr={riffMicErr}
        toggleRiffMic={toggleRiffMic}
        setBattleState={setBattleState}
        setDiceDisplay={setDiceDisplay}
        setRiffDifficulty={setRiffDifficulty}
        setRiffView={setRiffView}
        setSkipBattleIntros={setSkipBattleIntros}
        skipBattleIntro={skipBattleIntro}
        skipBattleIntros={skipBattleIntros}
        spirits={spirits}
      />





      {/* ── 🎤 RIFF-OFF TAUNT OVERLAY — big bold one-liners across the screen ── */}
      {tauntDisplay && (
        <div key={tauntDisplay.key} style={{
          position:'fixed', inset:0, zIndex:99998, pointerEvents:'none',
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          animation:'taunt-slam 2.2s ease-out forwards',
        }}>
          <div style={{
            fontSize:'clamp(28px, 6vw, 72px)', fontWeight:900,
            fontFamily:"'Saira Stencil One','Impact',sans-serif",
            color: tauntDisplay.color ?? '#ff6600',
            textShadow:`0 0 40px ${tauntDisplay.color ?? '#ff6600'}, 0 0 80px ${tauntDisplay.color ?? '#ff6600'}66, 0 4px 12px #000`,
            textAlign:'center', padding:'0 24px', lineHeight:1.2,
            letterSpacing:3,
            textTransform:'uppercase',
            animation:'taunt-text-pop 0.4s cubic-bezier(.3,1.6,.6,1) both',
          }}>
            "{tauntDisplay.line}"
          </div>
          <div style={{
            fontSize:'clamp(12px, 2vw, 22px)', fontWeight:700,
            fontFamily:"'Share Tech Mono',monospace",
            color:'#ffffff', marginTop:12, letterSpacing:2,
            textShadow:`0 0 16px ${tauntDisplay.color ?? '#ff6600'}88`,
            animation:'taunt-text-pop 0.4s cubic-bezier(.3,1.6,.6,1) 0.15s both',
          }}>
            — {tauntDisplay.name} 🎤
          </div>
        </div>
      )}

      {/* ── 🤘 MOSHPIT CINEMATIC BANNER — title card + Skip while the song runs ── */}
      {moshCine && moshCine.phase !== 'out' && (
        <div style={{position:"fixed", left:0, right:0, bottom:26, zIndex:9000,
          display:"flex", flexDirection:"column", alignItems:"center", gap:8,
          pointerEvents:"none"}}>
          <div style={{fontFamily:"'Saira Stencil One',sans-serif", fontSize:26, letterSpacing:2,
            color:"#ffcc00", textShadow:"0 0 12px #ffcc00, 0 0 30px #aa6600",
            animation:"moshpit-shudder 0.28s steps(2) infinite"}}>
            🤘 MASTER OF MOSHPITS 🤘
          </div>
          <div style={{fontSize:11, color:"#ffe9a0", opacity:0.85}}>
            {moshCine.phase === 'walk'
              ? `${MOSH_FAN_COST} fans are coming over the barricade…`
              : `The pit is raging — +${MOSH_DRIVE} DRIVE when the song lands`}
          </div>
          <button className="btn" style={{pointerEvents:"auto", borderColor:"#ffcc00", color:"#ffcc00"}}
            title="Skip the mosh pit — the fans are spent either way and the Drive lands now."
            onClick={skipMoshCinematic}>⏭ Skip</button>
        </div>
      )}

      {/* ── RIFF BANNER — legendary riff toast ── */}
      <RiffBanner riffBanner={riffBanner} spirits={spirits} setRiffBanner={setRiffBanner} />

      {/* ── CADENCE TOAST — objective resolved ── */}
      <CadenceToast cadenceToast={cadenceToast} spirits={spirits} setCadenceToast={setCadenceToast} riffBanner={riffBanner} />

      {/* ── RIFFBOOK — discovery codex ── */}
      <Riffbook
        CADENCE_OBJECTIVES={CADENCE_OBJECTIVES}
        PC_PLAY_NAMES={PC_PLAY_NAMES}
        RIFF_GENRE={RIFF_GENRE}
        RIFF_GENRE_META={RIFF_GENRE_META}
        RIFF_LIBRARY={RIFF_LIBRARY}
        acting={acting}
        legacyPlayingId={legacyPlayingId}
        noteStates={noteStates}
        playRiffSequence={playRiffSequence}
        riffBook={riffBook}
        riffbookTab={riffbookTab}
        setLegacyPlayingId={setLegacyPlayingId}
        setRiffbookTab={setRiffbookTab}
        setShowRiffbook={setShowRiffbook}
        showRiffbook={showRiffbook}
        spirits={spirits}
      />
      {/* ── EVENT MODAL — marquee ticket ── */}
      <EventModal
        activeEvent={activeEvent}
        answerTrivia={answerTrivia}
        setActiveEvent={setActiveEvent}
        spirits={spirits}
      />
      {/* ── 🧪 TESTING GROUNDS — in-game dev panel ── */}
      <TestingGrounds
        SIGNATURE_TESTS={SIGNATURE_TESTS}
        STAGE_FX_META={STAGE_FX_META}
        devCurrentSpiritId={devCurrentSpiritId}
        devFireStageFx={devFireStageFx}
        devFireSignature={devFireSignature}
        devGrant={devGrant}
        devExportLog={devExportLog}
        devDamage={devDamage}
        devOpen={devOpen}
        devUnlockSkill={devUnlockSkill}
        noteStates={noteStates}
        setDevOpen={setDevOpen}
        spiritById={spiritById}
        spirits={spirits}
        testMode={testMode}
        devSummonGod={devSummonGod}
        devHurtGod={devHurtGod}
        devGodAct={devGodAct}
        rockGod={rockGod}
        bossOutcome={bossOutcome}
      />
      {/* ── 🗡️ SIGNATURE ABILITIES — per-spirit exclusive-route reference ── */}
      <SignatureAbilities
        SKILL_BY_ID={SKILL_BY_ID}
        SKILL_TREE={SKILL_TREE}
        SPIRIT_DEFS={SPIRIT_DEFS}
        noteStates={noteStates}
        setSignatureSpirit={setSignatureSpirit}
        signatureSpirit={signatureSpirit}
        spirits={spirits}
      />
      {/* ── UPGRADE MODAL — blocks all action until resolved ──
          OWNERSHIP: rendered ONLY on the client that controls the acting
          spirit (canAct). Remote players/spectators must never see — let
          alone drive — another player's skill tree; its buttons write
          noteStates, which would relay duplicate actions and desync. */}
      {canAct && <UpgradeModal
        SKILL_BY_ID={SKILL_BY_ID}
        SKILL_TREE={SKILL_TREE}
        acting={acting}
        noteStates={noteStates}
        setNoteStates={setNoteStates}
        setSkillTarget={setSkillTarget}
        upgradesPending={upgradesPending}
      />}
      {/* ── LEFT PANEL ── */}
        <div style={{display:"flex",flexDirection:"column",gap:0}}>

          {/* ── ACTIVE SPIRIT — full portrait card ── */}
          {acting && (() => {
            const s = acting;
            const ns = noteStates[s.id] ?? {};
            return (
              <div className="card" style={{
                borderLeft:`3px solid ${s.color}`,
                background:"#0d1528",
                boxShadow:`0 0 14px ${s.color}33, inset 0 0 20px ${s.color}0a`,
                marginBottom:6, padding:0, overflow:"hidden",
              }}>
                <NeonStrikeFX color={s.color}/>
                {/* Two-column card: loadout (left) · portrait + stats (right).
                    DOM order keeps portrait first; CSS `order` renders it on the
                    right. flexWrap lets the columns stack on very narrow panels. */}
                <div style={{display:"flex", flexWrap:"wrap", alignItems:"stretch"}}>
                {/* ── RIGHT COLUMN — stats OVER a faded portrait ──
                    The Spirit fills the whole column as a dimmed backdrop;
                    name header and stat bars float on top. A vertical wash
                    keeps text readable (dark top/bottom) while the middle
                    band stays clear so the Spirit shows through. */}
                <div style={{width:238, flexShrink:0, order:2, marginLeft:"auto",
                  position:"relative", overflow:"hidden", minHeight:174}}>

                {/* Faded portrait backdrop */}
                <img src={s.imageSrc} alt={s.name}
                  style={{position:"absolute", inset:0, width:"100%", height:"100%",
                    objectFit:"cover", objectPosition:"top center", display:"block",
                    opacity:0.42}}/>
                {/* readability wash + spirit-color tint */}
                <div style={{position:"absolute", inset:0, pointerEvents:"none",
                  background:"linear-gradient(180deg, #0d1528e6 0%, #0d152880 24%, #0d152840 50%, #0d1528a8 72%, #0d1528f0 100%)"}}/>
                <div style={{position:"absolute", inset:0, pointerEvents:"none",
                  background:`radial-gradient(130% 100% at 50% 100%, transparent 55%, ${s.color}10 100%)`,
                  borderLeft:`1px solid ${s.color}22`}}/>

                {/* CONTENT — floats over the art */}
                <div style={{position:"relative", display:"flex", flexDirection:"column", height:"100%"}}>
                {/* Header: name / style · NOW / Fame */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
                  gap:6, padding:"6px 8px 5px"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:s.color,lineHeight:1.2}}>
                      {s.name}
                      {engineRef.current.headliner === s.id ? " 👑" : ""}
                      {s.knockedOut ? " 💀" : s.vibe===0 ? " ⚠️" : ""}
                    </div>
                    <div style={{fontSize:7,color:"#3a5a7a",marginTop:1,letterSpacing:1}}>{s.style}</div>
                    <div style={{fontSize:7,color:"#3a5a7a",marginTop:2}}>
                      Hex <span style={{color:HEX_BY_NUM[s.num]?.edge?"#ff4444":"#c0d0e0"}}>
                        #{s.num}{HEX_BY_NUM[s.num]?.edge?" ⚠":""}
                      </span>
                      {mode==="team" && <span style={{marginLeft:5}}>· Team {teams?.a.includes(s.corner)?"A":"B"}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                    <span style={{fontSize:7,color:"#f6ad55",fontWeight:700}}>▶ NOW</span>
                  </div>
                </div>

                {/* clear window — the Spirit shows through here */}
                <div style={{flex:1, minHeight:44}}/>

                {/* Stats — overlaid at the bottom, over the faded art */}
                <div style={{padding:"6px 8px 7px", textShadow:"0 1px 3px #000c"}}>
                  {/* Vibe bar removed — shown on board standee + purple maxVibe bar below */}
                  {/* ⭐ Fame — the win condition, front and centre.
                      This is NOT a stat line. It's the scoreboard, so it gets
                      its own block: marquee readout, a thick track with the
                      Stage-FX thresholds notched in, and the per-turn cap pips
                      underneath. Goes white-hot as you close on the crown and
                      red when you're in Rock God territory without the lead. */}
                  {(() => {
                    const fp        = ns.fame ?? 0;
                    const pct       = Math.min(100, (fp / fameToWin) * 100);
                    // Banked this turn window — lives on a ref, but every grant
                    // dispatches FAME_CHANGED in the same tick, so the re-render
                    // that follows always reads a fresh value.
                    const banked    = fameThisTurnRef.current?.[s.id] ?? 0;
                    const rivalBest = Math.max(0, ...spirits.filter(o => o.id !== s.id)
                                        .map(o => noteStates?.[o.id]?.fame ?? 0));
                    const lead      = fp - rivalBest;
                    // In striking distance of the crown but WITHOUT the runaway
                    // lead — reaching the target here summons the boss instead
                    // of ending the game. The bar should feel like a warning.
                    const danger    = fp >= fameToWin - 4 && lead < ROCK_GOD_RUNAWAY_LEAD;
                    const hot       = pct >= 75;
                    const fill      = danger
                      ? "linear-gradient(90deg,#7a1500,#ff4400,#ff9955)"
                      : hot
                        ? "linear-gradient(90deg,#cc9900,#ffd700 55%,#fff6d0)"
                        : "linear-gradient(90deg,#aa7700,#ffd700)";
                    const accent    = danger ? "#ff8855" : "#ffd700";
                    return (
                      <div data-tip-anchor="fame-bar" style={{marginTop:6, marginBottom:2}}
                        title={danger
                          ? `⭐${fp} / ${fameToWin} — lead of ${lead} (needs ${ROCK_GOD_RUNAWAY_LEAD} to win outright). Hit the target now and the ROCK GOD descends!`
                          : `Fame Points — first to ${fameToWin} wins the game!`}>

                        {/* Marquee readout */}
                        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:8,letterSpacing:1.6,fontWeight:800,color:accent,
                            animation: hot && !danger ? "fame-crown 1.8s ease-in-out infinite" : undefined,
                            textShadow:"0 0 6px #ffd70055"}}>
                            ⭐ FAME
                          </span>
                          <span style={{display:"flex",alignItems:"baseline",gap:1}}>
                            <span style={{fontSize:17,fontWeight:900,lineHeight:1,color:accent,
                              textShadow:`0 0 9px ${danger ? "#ff440099" : "#ffd70099"}, 0 1px 2px #000`}}>{fp}</span>
                            <span style={{fontSize:9,fontWeight:700,color:"#7d6a3a"}}>/{fameToWin}</span>
                          </span>
                        </div>

                        {/* Track */}
                        <div style={{position:"relative",height:11,borderRadius:6,overflow:"hidden",
                          background:"#0a0f1c",
                          border:`1px solid ${danger ? "#ff4422" : "#5a4410"}`,
                          boxShadow: danger ? undefined : "inset 0 1px 3px #000a, 0 0 8px #ffd70022",
                          animation: danger ? "fame-danger 1.1s ease-in-out infinite" : undefined}}>

                          {/* Fill */}
                          <div style={{position:"absolute",inset:0,width:`${pct}%`,background:fill,
                            borderRadius:"5px 3px 3px 5px",
                            boxShadow:`0 0 10px ${danger ? "#ff5500cc" : "#ffd700aa"}`,
                            transition:"width .45s cubic-bezier(.2,.9,.3,1)"}}>
                            {/* travelling sheen — the stage lights sweeping the bar */}
                            {pct > 4 && (
                              <div style={{position:"absolute",top:0,bottom:0,width:"28%",
                                background:"linear-gradient(90deg,transparent,#ffffff66,transparent)",
                                animation:"fame-sheen 2.6s linear infinite"}}/>
                            )}
                          </div>

                          {/* 🎇 Stage Effect thresholds notched into the track */}
                          {stageFxThresholds.filter(t => t < fameToWin).map(t => (
                            <div key={t} style={{position:"absolute",top:0,bottom:0,
                              left:`${(t / fameToWin) * 100}%`, width:1.5,
                              background: fp >= t ? "#fff6d0cc" : "#ffffff26",
                              boxShadow: fp >= t ? "0 0 5px #fff6d0" : undefined}}/>
                          ))}
                        </div>

                        {/* ⛔ Per-turn cap pips — how much more the crowd will take */}
                        <div style={{display:"flex",alignItems:"center",gap:3,marginTop:4}}>
                          <span style={{fontSize:6,letterSpacing:.8,color:"#5a6a7a",fontWeight:700}}>THIS TURN</span>
                          <div style={{display:"flex",gap:2.5}}>
                            {Array.from({length: FAME_PER_TURN_CAP}, (_, i) => {
                              const lit = i < banked;
                              return (
                                <span key={i} style={{fontSize:7,lineHeight:1,
                                  color: lit ? "#ffd700" : "#2b3444",
                                  textShadow: lit ? "0 0 6px #ffd700cc" : undefined,
                                  animation: lit ? "fame-pip-pop .32s ease-out" : undefined}}>★</span>
                              );
                            })}
                          </div>
                          {banked >= FAME_PER_TURN_CAP && (
                            <span style={{fontSize:6,fontWeight:700,color:"#ff7755",letterSpacing:.5}}>
                              ⛔ CAPPED
                            </span>
                          )}
                          {danger && (
                            <span style={{marginLeft:"auto",fontSize:6,fontWeight:800,letterSpacing:.6,
                              color:"#ff8855",textShadow:"0 0 6px #ff440088"}}>
                              🤘 ROCK GOD WATCH
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* 🎛️ Drive & Sustain come from the player's Chord Stack now (not a static sheet) */}
                  <div data-tip-anchor="stat-knobs" style={{display:"flex",gap:9,marginTop:5,alignItems:"center"}}>
                    {/* boost = every live modifier on this stat, summed — pattern-boost tempDrive/
                        tempSustain PLUS the Dissonance Edge stage delta (edgeCombatMods), so the
                        dial always reflects the stat you'd actually fight with right now. */}
                    <StatKnob label="DRIVE" value={spiritChord(s.id, ns.driveStack ?? []).drive}
                      boost={(ns.tempDrive ?? 0) + (ns.moshDrive ?? 0) + edgeCombatMods(ns).drive} color="#ff6644"/>
                    <StatKnob label="SUSTAIN" value={spiritChord(s.id, ns.sustainStack ?? []).sustain} boost={(ns.tempSustain ?? 0) - edgeCombatMods(ns).sustainPenalty} color="#44aaff"/>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                      <div data-tip-anchor="vibe-bar">
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                          <span style={{fontSize:7,color:"#cc66ff"}}>💗 VIBE</span>
                          <span style={{fontSize:7,color:"#cc66ff"}}>{s.vibe}/{s.maxVibe ?? 5}</span>
                        </div>
                        <div className="bar"><div className="bar-f" style={{width:`${((s.maxVibe??5)/8)*100}%`,background:"#8844cc"}}/></div>
                      </div>
                      <div>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                          <span style={{fontSize:7,color:"#44cc88"}}>⚡ SPD</span>
                          <span style={{fontSize:7,color:"#44cc88"}}>{Math.min(5, s.speed ?? 5)}</span>
                        </div>
                        <div className="bar"><div className="bar-f" style={{width:`${(Math.min(5,s.speed??5)/5)*100}%`,background:"#22aa66"}}/></div>
                      </div>
                    </div>
                  </div>
                </div>
                </div>{/* end overlay content */}
                </div>{/* end right column */}

                {/* ── LEFT COLUMN — loadout: badges · crew & gear · DB · skills ── */}
                <div style={{flex:1, minWidth:170, order:1, display:"flex", flexDirection:"column",
                  borderRight:`1px solid ${s.color}22`}}>
                {/* Status badges */}
                {((ns.tempSustain??0)>0||(ns.mojoDrain??0)>0||ns.stagger||(ns.burn?.turnsLeft??0)>0||respawnFlashes[s.id]||ns.instrumentDropped||ns.tripped||ns.dazed||(ns.elevenTurns??0)>0) && (
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",padding:"4px 8px",borderTop:`1px solid ${s.color}22`}}>
                    {(ns.elevenTurns??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a1400",border:"1px solid #ffcc44",color:"#ffcc44"}}>
                        🎚️ GOES TO 11 — {ns.elevenTurns}t
                      </span>)}
                    {/* ⚡ EDGE display — REMOVED (system cut) */}
                    {/* (bonus revoice badge removed — stack commit system) */}
                    {/* +atk removed — already shown on Drive knob boost */}
                    {(ns.tempSustain??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#001a2a",border:"1px solid #44aaff",color:"#88ccff"}}>
                        🛡️ +{ns.tempSustain} def
                      </span>)}
                    {(ns.mojoDrain??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#05101a",border:"1px solid #1155ff66",color:"#4499ff"}}>
                        💧 MOJO {ns.mojoDrain}t
                      </span>)}
                    {ns.stagger&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0e00",border:"1px solid #ff880066",color:"#ff8800"}}>
                        ⚡ STAGGER {ns.stagger.turnsLeft}t
                      </span>)}
                    {(ns.burn?.turnsLeft??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#2a0800",border:"1px solid #ff552288",color:"#ff7744"}}>
                        🔥 BURNING {ns.burn.turnsLeft}t
                      </span>)}
                    {/* B1 — SHIELDED and BURN ARMED badges removed with their triggers */}
                    {ns.tripped&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#0a1a0a",border:"1px solid #88ff8866",color:"#aaffaa"}}>
                        🌀 TRIPPED — half move
                      </span>)}
                    {ns.dazed&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0a1a",border:"1px solid #ff88ff66",color:"#ffaaff"}}>
                        😵 DAZED — move misdirected
                      </span>)}
                    {ns.instrumentDropped&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0808",border:"1px solid #ff444466",color:"#ff6666"}}>
                        🎸💥 DROPPED — Drive -1
                      </span>)}
                    {respawnFlashes[s.id]&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#0a2a10",border:"1px solid #44ff8866",color:"#44ff88"}}>
                        ✨ RESPAWN
                      </span>)}
                  </div>
                )}
                {/* ── 🎴 MOD CARDS — relocated from the old right panel; a banner of
                    ability-like chips alongside Crew & Gear. Still played via playModCard. ── */}
                {(() => {
                  const cards = ns.modCards ?? [];
                  if (!cards.length) return null;
                  const MDEF = {
                    transpose:       { icon:'🔄', name:'Transpose',       color:'#ffcc44', desc:'Pick any stock note as your new Root (before you build) — one shot' },
                  };
                  return (
                    <div data-tip-anchor="mod-cards" style={{padding:'5px 8px',borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
                        <span style={{fontSize:7,color:'#3a5a7a',letterSpacing:2}}>MOD CARDS</span>
                        <span style={{flex:1,height:1,background:`linear-gradient(90deg, ${s.color}33, transparent)`}}/>
                      </div>
                      <div style={{display:'flex',gap:3,flexWrap:'wrap'}}>
                        {cards.map(card => {
                          const d = MDEF[card.type] ?? { icon:'🎴', name:card.type, color:'#8899aa', desc:'' };
                          const pend = ns.transposeCardPending === card.id;
                          return (
                            <button key={card.id} disabled={card.exhausted} title={d.desc}
                              onClick={() => !card.exhausted && playModCard(card.id)}
                              style={{display:'flex',alignItems:'center',gap:5,fontFamily:'inherit',
                                cursor:card.exhausted?'default':'pointer',textAlign:'left',
                                background:card.exhausted?'#0a0e16':`${d.color}14`,borderRadius:4,padding:'3px 7px',
                                border:`1px solid ${card.exhausted?'#26303f':d.color+'88'}`,
                                color:card.exhausted?'#3a4658':d.color,opacity:card.exhausted?0.6:1}}>
                              <span style={{fontSize:12,lineHeight:1}}>{d.icon}</span>
                              <span style={{display:'flex',flexDirection:'column',alignItems:'flex-start',lineHeight:1.15}}>
                                <span style={{fontSize:8,fontWeight:700}}>{d.name}</span>
                                <span style={{fontSize:6.5,color:card.exhausted?'#33415a':(pend?'#ffcc44':'#7090a0')}}>
                                  {card.exhausted?'used · back next turn':pend?'◂ pick a note':'▶ tap to play'}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                {/* ── ✨ STYLE — how this Spirit earns Db (STYLE_SYSTEM_HANDOFF.md §5) ── */}
                {(() => {
                  const curStyle = s.style ?? styleOf(s.id);
                  const curDef = STYLE_DEFS[curStyle];
                  const chip = {
                    fontFamily:'inherit', borderRadius:4, padding:'3px 7px',
                    fontSize:8, lineHeight:1.3, whiteSpace:'nowrap',
                  };
                  return (
                    <div style={{padding:'5px 8px', borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
                        <span style={{fontSize:7,color:'#3a5a7a',letterSpacing:2}}>STYLE</span>
                        <span style={{flex:1,height:1,background:`linear-gradient(90deg, ${s.color}33, transparent)`}}/>
                      </div>
                      <div style={{display:'flex',gap:3,flexWrap:'wrap',alignItems:'center'}}>
                        <span title={curDef?.tagline ?? ''}
                          style={{...chip, cursor:'default', fontWeight:700,
                            background:`${curDef?.color}22`, border:`1.5px solid ${curDef?.color}`,
                            color:curDef?.color}}>
                          {curDef?.icon} {curDef?.label?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  );
                })()}
                {/* ── ULTIMATE — once-per-game ability ── */}
                {(() => {
                  const unlocked = ns.unlockedSkills ?? [];
                  const hasUlt   = unlocked.includes('ultimate');
                  if (!hasUlt) return null;
                  const chipBase = {
                    fontFamily:'inherit', cursor:'pointer', borderRadius:4,
                    padding:'3px 7px', fontSize:8, lineHeight:1.3, whiteSpace:'nowrap',
                  };
                  return (
                    <div style={{padding:'5px 8px', borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:2,alignItems:'center'}}>
                        <span style={{fontSize:7,color:'#ff44aa88',width:34}}>ULT</span>
                        {ns.ultimateUsed ? (
                          <span style={{...chipBase, cursor:'default',
                            background:'#0a0e16', border:'1px solid #333344', color:'#444455'}}>
                            💀 Encore spent
                          </span>
                        ) : (
                          <button title="Once per game: 2 Vibe damage + Stagger to all rivals within 4 hexes"
                            onClick={() => fireUltimate(s.id)}
                            style={{...chipBase, color:'#ff44aa', fontWeight:700,
                              background:'linear-gradient(135deg,#1a0014,#0a0010)',
                              border:'1px solid #ff44aa',
                              animation:'crew-ready-glow 1.6s ease-in-out infinite'}}>
                            💀 ENCORE APOCALYPSE
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ── DB PROGRESS BAR ── */}
                {(() => {
                  const targetId  = ns.targetSkillId;
                  const targetDef = targetId ? SKILL_BY_ID[targetId] : null;
                  const dbPts     = ns.dbPoints ?? 0;
                  const targetCost = targetDef?.dbCost ?? 8;
                  const pct       = Math.min(1, dbPts / targetCost);
                  const routeDef  = targetDef ? SKILL_TREE.routes.find(r => r.id === targetDef.routeId) : null;
                  const barColor  = routeDef?.color ?? '#ffcc44';
                  return (
                    <div data-tip-anchor="db-bar" style={{padding:"5px 8px 6px", borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3}}>
                        <span style={{fontSize:7, color:"#3a5a7a", letterSpacing:1}}>DB PROGRESS</span>
                        {targetDef
                          ? <span style={{fontSize:7, color:barColor, fontWeight:700}}>
                              {targetDef.icon} {targetDef.label}
                            </span>
                          : <span style={{fontSize:7, color:"#2a3a50", fontStyle:"italic"}}>no target set</span>
                        }
                      </div>
                      <div style={{display:"flex", alignItems:"center", gap:6}}>
                        <div style={{flex:1, height:6, background:"#0a1020", borderRadius:3, overflow:"hidden",
                          border:"1px solid #1a2a40"}}>
                          <div style={{
                            height:"100%", borderRadius:3,
                            width:`${pct*100}%`,
                            background: pct >= 1
                              ? `linear-gradient(90deg, ${barColor}, #ffffff88)`
                              : `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                            transition:"width 0.4s ease",
                            boxShadow: pct >= 1 ? `0 0 8px ${barColor}` : "none",
                          }}/>
                        </div>
                        <span style={{fontSize:8, color: pct>=1 ? barColor : "#4a6a7a",
                          fontWeight: pct>=1 ? 700 : 400, whiteSpace:"nowrap"}}>
                          {dbPts} / {targetCost}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── OWNED SKILLS (collapsible) ── */}
                {(ns.unlockedSkills?.length ?? 0) > 0 && (() => {
                  return (
                    <div style={{padding:"4px 8px 6px", borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:"flex", alignItems:"center", gap:5, marginBottom: skillsCollapsed ? 0 : 4, cursor:"pointer"}}
                        onClick={() => setSkillsCollapsed(p => !p)}>
                        <span style={{fontSize:7, color:"#3a5a7a", letterSpacing:1}}>SKILLS ({ns.unlockedSkills.length})</span>
                        <span style={{flex:1,height:1,background:`linear-gradient(90deg, ${s.color}33, transparent)`}}/>
                        <span style={{fontSize:8, color:"#3a5a7a"}}>{skillsCollapsed ? '▸' : '▾'}</span>
                      </div>
                      {!skillsCollapsed && (
                        <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
                          {ns.unlockedSkills.map(skillId => {
                            const sk       = SKILL_BY_ID[skillId];
                            if (!sk) return null;
                            const routeDef = SKILL_TREE.routes.find(r => r.id === sk.routeId);
                            const col      = routeDef?.color ?? '#88aabb';
                            return (
                              <div key={skillId} title={`${sk.label}: ${sk.desc}`} style={{
                                display:"flex", alignItems:"center", gap:3,
                                background:`${col}18`, border:`1px solid ${col}55`,
                                borderRadius:4, padding:"2px 6px",
                                cursor:"default",
                              }}>
                                <span style={{fontSize:11}}>{sk.icon}</span>
                                <span style={{fontSize:7, color:col, fontWeight:700, lineHeight:1.2}}>
                                  {sk.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{flex:1}}/>{/* push loadout content to top */}
                </div>{/* end left column */}
                </div>{/* end two-column row */}
              </div>
            );
          })()}

          {/* ── ⭐ THE RACE — shared Fame meter ──────────────────────────────
              Takes over this slot whenever the player isn't committing notes.
              Steps 1–2 belong to the Chord Stack / Melody build; the moment
              that work is done (Step 3, or nobody acting) the panel becomes
              the scoreboard, so the question "am I actually winning?" is
              always on screen during the part of the turn where you decide
              what to DO about it. Lanes are sorted by Fame — leader on top. */}
          {(!acting || turnStep === 'move_act') && (() => {
            const board = spirits.map(sp => ({
              sp,
              fp: noteStates?.[sp.id]?.fame ?? 0,
            })).sort((a, b) => b.fp - a.fp);
            const leadFp = board[0]?.fp ?? 0;
            const runner = board[1]?.fp ?? 0;
            // Same rule grantFame uses: hitting the target without this much
            // daylight summons the Rock God instead of ending the game.
            const contested = leadFp >= fameToWin - 4 && (leadFp - runner) < ROCK_GOD_RUNAWAY_LEAD;
            return (
              <div className="card" style={{
                borderLeft:`2px solid ${contested ? '#ff4422' : '#ffd700'}`,
                padding:"6px 8px", marginBottom:4, position:"relative",
                background: contested ? "#170a06" : undefined}}>
                <NeonStrikeFX color={contested ? '#ff4422' : '#ffd700'}/>

                {/* Header */}
                <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:5}}>
                  <span className="stitle" style={{marginBottom:0,
                    color: contested ? "#ff8855" : "#ffd700", letterSpacing:1.4}}>
                    ⭐ THE RACE TO {fameToWin}
                  </span>
                  {contested && (
                    <span style={{fontSize:6,fontWeight:800,letterSpacing:.6,color:"#ff8855",
                      textShadow:"0 0 6px #ff440088",
                      animation:"fame-crown 1.4s ease-in-out infinite"}}>
                      🤘 FINALE PENDING
                    </span>
                  )}
                </div>

                {/* Lanes */}
                <div style={{display:"flex",flexDirection:"column",gap:3}}>
                  {board.map(({ sp, fp }, i) => {
                    const pct     = Math.min(100, (fp / fameToWin) * 100);
                    const out     = sp.knockedOut;
                    const isLead  = i === 0 && fp > 0;
                    const gap     = fp - leadFp;   // 0 for the leader, negative behind
                    const isYou   = acting?.id === sp.id;
                    return (
                      <div key={sp.id} style={{display:"flex",alignItems:"center",gap:4,
                        opacity: out ? 0.32 : 1}}>
                        {/* Who */}
                        <span style={{width:11,fontSize:8,textAlign:"center",flexShrink:0}}>
                          {out ? "💀" : isLead ? "👑" : ""}
                        </span>
                        <span style={{width:40,flexShrink:0,fontSize:7,fontWeight:700,
                          color: sp.color, whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
                          textShadow: isYou ? `0 0 7px ${sp.color}aa` : undefined}}>
                          {sp.name.split(" ")[0]}{isYou ? " ◂" : ""}
                        </span>

                        {/* Lane track */}
                        <div style={{position:"relative",flex:1,height:8,borderRadius:4,
                          background:"#0a0f1c",overflow:"hidden",
                          border:`1px solid ${isLead ? "#5a4410" : "#16202f"}`,
                          boxShadow:"inset 0 1px 2px #000a"}}>
                          <div style={{position:"absolute",inset:0,width:`${pct}%`,
                            borderRadius:"3px 2px 2px 3px",
                            background:`linear-gradient(90deg,${sp.color}55,${sp.color})`,
                            boxShadow:`0 0 8px ${sp.color}99`,
                            transition:"width .5s cubic-bezier(.2,.9,.3,1)"}}/>
                          {/* 🎇 Stage Effect thresholds — same notches as the card bar */}
                          {stageFxThresholds.filter(t => t < fameToWin).map(t => (
                            <div key={t} style={{position:"absolute",top:0,bottom:0,
                              left:`${(t / fameToWin) * 100}%`, width:1,
                              background: fp >= t ? "#fff6d0aa" : "#ffffff1f"}}/>
                          ))}
                        </div>

                        {/* Score + gap to leader */}
                        <span style={{width:15,flexShrink:0,textAlign:"right",fontSize:9,fontWeight:900,
                          color: isLead ? "#ffd700" : "#c0d0e0",
                          textShadow: isLead ? "0 0 7px #ffd70088" : undefined}}>{fp}</span>
                        <span style={{width:17,flexShrink:0,fontSize:6,fontWeight:700,
                          color: gap < 0 ? "#5a6a7a" : "#7d6a3a"}}>
                          {gap < 0 ? gap : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── NOTE STOCK PANEL ── */}
          {acting && (
            <div data-tip-anchor="note-stock"
              className={`card${turnStep === 'melody' ? ' step-active' : turnStep === 'move_act' ? ' step-collapsed' : ''}`}
              style={{'--step-glow-color': turnStep === 'chord' ? '#ff66cc' : '#4488ff',
                borderLeft:`2px solid ${turnStep === 'melody' ? '#4488ff' : '#4488ff66'}`,padding:"6px 8px",marginBottom:4,
                ...(turnStep === 'move_act'
                  ? {maxHeight:36,overflow:'hidden',transition:'max-height 0.4s ease, opacity 0.3s'}
                  : {overflow:'visible',flexShrink:0,minHeight:'fit-content'})}}>
              <NeonStrikeFX color={'#4488ff'}/>
              {/* Header: big Root Note badge + title + interval legend */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                {/* 🎵 ROOT NOTE — big mode-colored badge */}
                <div data-tip-anchor="root-note" title={modeLocked
                    ? `Root Note is ${rootNote}. Your Drive Stack spells a minor chord, but Minor Tonality is locked — the song holds ${rootNote} major.`
                    : `Root Note — your scale is ${rootNote} ${scaleMode}, set by your Drive Stack. The LAST note of your committed track becomes next turn's Root!`}
                  style={{
                    width:48,height:48,borderRadius:9,flexShrink:0,
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    background: modeLocked ? "linear-gradient(135deg,#241a00,#120d00)"
                      : scaleMode==='major' ? "linear-gradient(135deg,#0d2050,#0a1228)"
                      : "linear-gradient(135deg,#240d45,#12091e)",
                    border:`2px solid ${modeLocked ? "#ffcc44" : scaleMode==='major' ? "#4488ff" : "#aa55ff"}`,
                    boxShadow:`0 0 14px ${modeLocked ? "#ffcc4466" : scaleMode==='major' ? "#4488ff66" : "#aa55ff66"}, inset 0 0 10px ${modeLocked ? "#ffcc4422" : scaleMode==='major' ? "#4488ff22" : "#aa55ff22"}`,
                  }}>
                  <span style={{fontSize:5.5,letterSpacing:1.5,color:"#7a90aa",fontWeight:700}}>ROOT</span>
                  <span style={{fontSize:18,fontWeight:900,color:"#ffffff",lineHeight:1,
                    textShadow:`0 0 10px ${modeLocked ? "#ffcc44" : scaleMode==='major' ? "#4488ff" : "#aa55ff"}`}}>
                    {rootNote}
                  </span>
                  <span style={{fontSize:6,letterSpacing:1,marginTop:1,fontWeight:700,
                    color: modeLocked ? "#ffcc44" : scaleMode==='major' ? "#88bbff" : "#cc99ff"}}>
                    {modeLocked ? "🔒 MAJOR" : scaleMode === 'major' ? "☀️ MAJOR" : "🌑 MINOR"}
                  </span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                    <div className="stitle" style={{marginBottom:0,color:"#4488ff"}}>
                      {turnStep === 'chord' ? 'Step 1 — Chord Stack' : turnStep === 'melody' ? 'Step 2 — Build Melody' : 'Note Stock'}
                    </div>
                    {/* 🎤 MIC — only offered during the step it can actually act on */}
                    {turnStep === 'melody' && !hasConfirmed && (
                      <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:"auto"}}>
                        {micOn && micHeard && (
                          <span style={{fontSize:7,fontWeight:700,letterSpacing:.5,
                            color: micHeard.ok ? "#44ff88" : "#ff7755"}}>
                            {micHeard.ok ? `♪ ${micHeard.note}` : `✕ ${micHeard.note} not in stock`}
                          </span>
                        )}
                        {micErr && <span style={{fontSize:7,color:"#ff7755"}}>🎤 {micErr}</span>}
                        <button onClick={toggleMic}
                          title={micOn
                            ? 'Mic ON — play a note and it lands in your track. Click a placed note to undo.'
                            : 'Mic OFF — click to play notes on your instrument instead of clicking them.'}
                          style={{
                            fontSize:8, fontWeight:800, letterSpacing:.6, cursor:'pointer',
                            padding:"2px 7px", borderRadius:4,
                            background: micOn ? "#0d2510" : "#0a1020",
                            border:`1px solid ${micOn ? "#44ff88" : "#2a3a50"}`,
                            color: micOn ? "#44ff88" : "#6a8098",
                            boxShadow: micOn ? "0 0 9px #44ff8855" : "none",
                            animation: micOn ? "fame-crown 1.9s ease-in-out infinite" : undefined,
                          }}>
                          🎤 {micOn ? 'LIVE' : 'MIC'}
                        </button>
                      </div>
                    )}
                  </div>
                  {turnStep !== 'move_act' && (
                  <div data-tip-anchor="interval-legend" style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:7,color:"#cc55ff"}}>4th={fourthNote}</span>
                    <span style={{fontSize:7,color:"#ff55aa"}}>5th={fifthNote}</span>
                    {/* One colour for all three unlock-gated discords — they behave
                        identically now, and red/blue belong to the stacks. */}
                    <span style={{fontSize:7,color:UNLOCKED_DISCORD.text}} title="Discords your unlocks made clean — each adds +1 Performance Score as a track ending">
                      tri={tritoneNote} M3={majorThirdNote} m7={minorSeventhNote}
                    </span>
                    {/* The legend the player actually needs during Step 2. */}
                    {turnStep === 'melody' && (
                      <span style={{fontSize:7,color:"#66708a",display:"flex",gap:4,alignItems:"center"}}
                        title="A lit note is a Discord your chord stack pardoned. Its colour is the stack that gets paid for it.">
                        <span style={{color:"#3a4055"}}>│</span>
                        <span style={{color:DRIVE_C}}>⚔️pays Drive</span>
                        <span style={{color:SUSTAIN_C}}>🛡️pays Sustain</span>
                      </span>
                    )}
                  </div>
                  )}
                </div>
              </div>
              {/* ✨ STYLE — "how you earn" hint, visible while building the melody
                  (STYLE_SYSTEM_HANDOFF.md §5 — the intuitiveness fix: never guess your lane). */}
              {turnStep === 'melody' && acting && (() => {
                const sDef = styleDef(acting.id);
                if (!sDef) return null;
                return (
                  <div title={sDef.tagline}
                    style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,
                      padding:"3px 7px",borderRadius:4,
                      background:`${sDef.color}14`,border:`1px solid ${sDef.color}44`}}>
                    <span style={{fontSize:11}}>{sDef.icon}</span>
                    <span style={{fontSize:7,fontWeight:700,color:sDef.color,letterSpacing:1}}>{sDef.label.toUpperCase()}</span>
                    <span style={{fontSize:7,color:"#7090a0",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {sDef.tagline}
                    </span>
                  </div>
                );
              })()}
              {/* ⚡ DISSONANCE EDGE — REMOVED (system cut) */}
              {/* 🎛️ AMP TONE PANEL relocated → now flanks the Commit Track above the board. */}
              {/* Active effect badges — only show during melody step */}
              {(turnStep === 'melody' || turnStep === 'move_act') && (dieFloorBoost > 0 || statusEffects.length > 0
                || (actingNoteState?.chargeFloorTurns ?? 0) > 0 || (actingNoteState?.chargeCeilTurns ?? 0) > 0
                || (actingNoteState?.finalsTrail?.length ?? 0) > 0
                || ((actingNoteState?.unlockedSkills ?? []).includes('mixer') && !actingNoteState?.mixerUsedThisTurn && !hasConfirmed && !pivotPending)) && (
                <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:4}}>
                  {(actingNoteState?.finalsTrail?.length ?? 0) > 0 && (() => {
                    const trail = actingNoteState.finalsTrail;
                    const hints = cadenceHints(trail, actingNoteState?.cadenceCooldowns ?? {}).slice(0, 2);
                    return (
                      <div title="Cadence run — the pitch of each turn's FINAL track note. String the right finals across turns (any key) for Fame! See 📖 Riffbook → Cadences."
                        style={{flexBasis:"100%",padding:"4px 7px",borderRadius:4,
                        background:"#081a14",border:"1px solid #44ffaa66"}}>
                        <div style={{fontSize:7,color:"#44ffaa",fontWeight:700,marginBottom: hints.length ? 3 : 0}}>
                          🎯 finals: {trail.slice(-4).map(pc => PC_PLAY_NAMES[pc]).join(' → ')} → ?
                        </div>
                        {hints.map(h => (
                          <div key={h.cadence.id} style={{
                            fontSize:7, lineHeight:1.5, display:"flex", alignItems:"center", gap:4,
                            color: h.resolves ? "#ffd700" : "#7ab89a",
                          }}>
                            <span>{h.cadence.icon}</span>
                            <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {h.cadence.name} <span style={{opacity:0.7}}>{h.matched}/{h.total}</span>
                              {' — end on '}
                              <span style={{fontWeight:900, color: h.resolves ? "#ffd700" : "#aaffcc",
                                textShadow: h.resolves ? "0 0 6px #ffd70088" : "none"}}>{h.nextNote}</span>
                              {h.resolves
                                ? <span style={{fontWeight:700}}> to RESOLVE! 🎤 +{h.cadence.fp} Fans</span>
                                : <span style={{opacity:0.6}}> next ({h.cadence.formula})</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {(actingNoteState?.unlockedSkills ?? []).includes('mixer') && !actingNoteState?.mixerUsedThisTurn && !hasConfirmed && !pivotPending && (
                    <span title="Mixer — tap one dimmed (already played) note to layer it a second time"
                      style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#0a141a",border:"1px solid #44ddff",color:"#44ddff",
                      animation:"crew-ready-glow 2.4s ease-in-out infinite"}}>
                      🎚️ MIXER READY — tap a played note to double it
                    </span>
                  )}{/* B5: the 🔥 Damage ×2 badge is gone. It was the only reader of
                       feedbackBoost, and nothing in the damage path ever consulted it. */}
                  {dieFloorBoost > 0 && (
                    <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#0a1a2a",border:"1px solid #44aaff",color:"#44aaff"}}>
                      🎶 Floor +{dieFloorBoost}
                    </span>
                  )}
                  {(actingNoteState?.chargeFloorTurns ?? 0) > 0 && (
                    <span title={`Charge Zone floor charge — attack dice can't roll below ${1 + CHARGE_FLOOR_BONUS}. Lasts ${actingNoteState.chargeFloorTurns} more round${actingNoteState.chargeFloorTurns !== 1 ? 's' : ''} or until a battle.`}
                      style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#1a1408",border:"1px solid #ffcc44",color:"#ffcc44",
                      animation:"crew-ready-glow 2.4s ease-in-out infinite"}}>
                      ⚡ FLOOR +{CHARGE_FLOOR_BONUS} ({actingNoteState.chargeFloorTurns})
                    </span>
                  )}
                  {(actingNoteState?.chargeCeilTurns ?? 0) > 0 && (
                    <span title={`Charge Zone ceiling charge — attack dice grow a size (d6→d8). Lasts ${actingNoteState.chargeCeilTurns} more round${actingNoteState.chargeCeilTurns !== 1 ? 's' : ''} or until a battle.`}
                      style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#0a141f",border:"1px solid #44aaff",color:"#88ccff",
                      animation:"crew-ready-glow 2.4s ease-in-out infinite"}}>
                      ⚡ DIE SIZE ▲ ({actingNoteState.chargeCeilTurns})
                    </span>
                  )}
                  {statusEffects.map((fx,i) => (
                    <span key={i} style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#1a0a2a",border:"1px solid #aa55ff",color:"#aa55ff"}}>
                      {fx}
                    </span>
                  ))}
                </div>
              )}
              {/* ── COLLAPSED SUMMARIES for completed steps ── */}
              {/* ── 🎸 B8: THE MODE, DERIVED ────────────────────────────────────
                  Was two buttons plus a two-column stock preview, asking "Major or
                  Minor?" every single turn. The stack answers that question now, so
                  this reports the answer and CITES THE CHORD that gave it — the line
                  has to teach what the buttons used to teach. The stock preview isn't
                  replaced so much as made redundant: the note chips already speak the
                  one highlight language every other B3 pardon uses.

                  The ↻ hint matters more than it looks. Mode is derived at turn start
                  ONLY (deriving mid-turn would respell the stock under notes already
                  placed), so a player who stacks a ♭3 right now sees nothing change
                  and reasonably concludes the mechanic is broken. This tells them
                  when it lands. */}
              {acting && (() => {
                const reason  = actingNoteState?.modeReason ?? 'ambiguous';
                const chord   = actingNoteState?.modeChordName ?? 'your stack';
                const isMajor = scaleMode === 'major';
                const locked  = reason === 'locked';
                const col = locked ? "#ffcc44"   : isMajor ? "#88bbff"   : "#cc99ff";
                const bg  = locked ? "#181200"   : isMajor ? "#0a1228"   : "#12091e";
                const bd  = locked ? "#ffcc4455" : isMajor ? "#4488ff33" : "#aa55ff33";
                const why = reason === 'quality'   ? `${chord} sets the key`
                          : reason === 'ambiguous' ? `${chord} — no third to read, mode held`
                          : `${chord} wants minor — 🔒 unlock Minor Tonality`;
                // What the stack AS IT STANDS NOW would give at the next turn start.
                const next  = modeFromStack(actingNoteState?.driveStack ?? [],
                                            actingNoteState?.unlockedSkills ?? [], scaleMode);
                const flips = next.mode !== scaleMode;
                return (
                  <div data-tip-anchor="derived-mode" style={{fontSize:8,color:col,marginBottom:4,
                    padding:"3px 7px",background:bg,border:`1px solid ${bd}`,borderRadius:4}}>
                    <span style={{fontWeight:700}}>
                      {locked ? '🔒' : isMajor ? '☀️' : '🌑'} {rootNote} {isMajor ? 'MAJOR' : 'MINOR'}
                    </span>
                    <span style={{opacity:0.75}}> — {why}</span>
                    {flips && (
                      <div style={{marginTop:2,color:"#ff99dd"}}>
                        ↻ next turn: {next.mode === 'major' ? '☀️ Major' : '🌑 Minor'} — your Drive Stack changed
                      </div>
                    )}
                  </div>
                );
              })()}
              {turnStep !== 'chord' && !hasConfirmed && (() => {
                const dStack = actingNoteState?.driveStack ?? [];
                const sStack = actingNoteState?.sustainStack ?? [];
                const dCh = spiritChord(acting?.id, dStack);
                const sCh = spiritChord(acting?.id, sStack);
                return (
                  <div className="step-collapsed" style={{fontSize:8,color:"#ff99dd",marginBottom:4,
                    padding:"3px 7px",background:"#0c0a18",border:"1px solid #ff66cc33",borderRadius:4}}>
                    ✓ Drive: {dStack.join(' ')} · ⚔️{dCh.drive} | Sustain: {sStack.join(' ')} · 🛡️{sCh.sustain}
                  </div>
                );
              })()}

              {/* ── 🎸 B8: the Major/Minor prompt used to live here ──────────────
                  Two buttons and a side-by-side "how would your stock look in each
                  mode?" preview, ~140 lines of it. All gone: the mode is derived from
                  the Drive Stack at turn start and reported by the read-only line
                  above. The preview's job — showing which notes go grey — is now done
                  continuously by the note stock itself, in the same highlight language
                  B3 uses for every other pardon, instead of only at a modal moment.

                  ⚠️ `pivotPending` is never set true any more, but its ~30 read sites
                  are deliberately LEFT IN PLACE (they all read false and gate nothing)
                  rather than ripped out at the same time as this. Nothing can deadlock
                  a turn on a flag no one raises; a half-finished surgery on 30 call
                  sites very much could. */}
              {hasConfirmed ? (
                <div style={{fontSize:8,color:"#44ff88",marginBottom:5,padding:"6px 8px",background:"#0d1f10",border:"1px solid #44ff8844",borderRadius:4}}>
                  ✓ Notes committed — move and use actions below.
                </div>
              ) : turnStep === 'chord' ? (
                /* ── STEP 2: STACK COMMIT ── shown prominently after scale choice.
                   Commit notes to Drive or Sustain stacks (up to 3/turn budget). */
                (() => {
                  const dStack = actingNoteState?.driveStack ?? [];
                  const sStack = actingNoteState?.sustainStack ?? [];
                  const dCh = spiritChord(acting?.id, dStack);
                  const sCh = spiritChord(acting?.id, sStack);
                  const commitsUsed = actingNoteState?.stackCommitsThisTurn ?? 0;
                  const budgetLeft = STACK_COMMIT_BUDGET - commitsUsed;
                  const dFull = dStack.length >= actingStackCap;
                  const sFull = sStack.length >= actingStackCap;
                  return (
                    <div style={{marginBottom:5}}>
                      <div className="step-active" style={{'--step-glow-color':'#ff66cc',background:"#0c0a18",border:"1.5px solid #ff66cc",borderRadius:6,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:"#ff99dd",fontWeight:700,marginBottom:4,letterSpacing:1}}>
                          🎸 STACK COMMIT — shape your combat stacks
                        </div>
                        <div style={{fontSize:7,color:"#6a8a9a",marginBottom:6}}>
                          {budgetLeft <= 0 ? `✓ budget spent (${STACK_COMMIT_BUDGET}/${STACK_COMMIT_BUDGET}) — continue below`
                           : `${budgetLeft} commit${budgetLeft !== 1 ? 's' : ''} left — pick a stack then tap a note`}
                        </div>
                        {/* Drive stack display */}
                        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
                          <button className="btn" data-tip-anchor="drive-btn" onClick={()=>setStackCommitDest('drive')} disabled={dFull || budgetLeft <= 0}
                            style={{fontSize:10,padding:"4px 10px",fontWeight:700,borderColor: stackCommitDest === 'drive' ? '#ff6644' : '#aa4422',
                              color: stackCommitDest === 'drive' ? '#ff6644' : '#aa6644',
                              background: stackCommitDest === 'drive' ? '#2a0c08' : 'transparent',
                              opacity: (dFull || budgetLeft <= 0) ? 0.4 : 1,
                              ...(engineState.turn.count <= 8 && !(dFull || budgetLeft <= 0) ? {'--glow-color':'#ff6644', animation:'stack-btn-glow 1.5s ease-in-out infinite'} : {})}}>
                            {stackCommitDest === 'drive' ? '⚔️ DRIVE' : '⚔️ Drive'}
                          </button>
                          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                            {dStack.map((n,i)=>(
                              <span key={i}
                                style={{fontSize:11,fontWeight:700,color:"#ff9966",background:"#1a0c08",border:"1px solid #ff664466",borderRadius:4,padding:"2px 7px"}}>{n}</span>
                            ))}
                          </div>
                          <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,color:"#ff6644"}}>⚔️{dCh.drive}</span>
                        </div>
                        {/* Sustain stack display */}
                        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6}}>
                          <button className="btn" data-tip-anchor="sustain-btn" onClick={()=>setStackCommitDest('sustain')} disabled={sFull || budgetLeft <= 0}
                            style={{fontSize:10,padding:"4px 10px",fontWeight:700,borderColor: stackCommitDest === 'sustain' ? '#44aaff' : '#2266aa',
                              color: stackCommitDest === 'sustain' ? '#44aaff' : '#4488aa',
                              background: stackCommitDest === 'sustain' ? '#0a1828' : 'transparent',
                              opacity: (sFull || budgetLeft <= 0) ? 0.4 : 1,
                              ...(engineState.turn.count <= 8 && !(sFull || budgetLeft <= 0) ? {'--glow-color':'#44aaff', animation:'stack-btn-glow 1.5s ease-in-out infinite'} : {})}}>
                            {stackCommitDest === 'sustain' ? '🛡️ SUSTAIN' : '🛡️ Sustain'}
                          </button>
                          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                            {sStack.map((n,i)=>(
                              <span key={i}
                                style={{fontSize:11,fontWeight:700,color:"#88ccff",background:"#081828",border:"1px solid #44aaff66",borderRadius:4,padding:"2px 7px"}}>{n}</span>
                            ))}
                          </div>
                          <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,color:"#44aaff"}}>🛡️{sCh.sustain}</span>
                        </div>
                        {/* Note stock for stack editing — visible when a dest is selected and budget remains */}
                        {stackCommitDest && budgetLeft > 0 && (
                          <div data-tip-anchor="stack-note-grid"
                            style={{marginBottom:6,padding:"4px 7px",background:"#140a18",border:"1px solid #ff66cc33",borderRadius:4}}>
                            <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                              {noteStock.map((note,idx)=>{
                                const used = usedHas(usedStockIdx, idx);
                                /* Interval-based colors — same as melody step */
                                const notePC         = pitchIndex(note);
                                const isTritone      = notePC === pitchIndex(tritoneNote);
                                const isMajorThird   = notePC === pitchIndex(majorThirdNote);
                                const isMinorSeventh = notePC === pitchIndex(minorSeventhNote);
                                const isFourth       = notePC === pitchIndex(fourthNote);
                                const isFifth        = notePC === pitchIndex(fifthNote);
                                const intervalKey    = isTritone ? 'tritone' : isMajorThird ? 'majorThird' : isMinorSeventh ? 'minorSeventh' : isFourth ? 'fourth' : isFifth ? 'fifth' : null;
                                const isIntervalNote = intervalKey !== null;
                                const isUnlocked     = isIntervalNote && unlockedIntervalKeys.has(intervalKey);
                                const inScaleNote    = currentScale.includes(note);
                                const showTritoneColor      = isTritone      && discordUnlocks.includes('discord_3');
                                const showMinorSeventhColor = isMinorSeventh && discordUnlocks.includes('discord_1') && scaleMode === 'major';
                                const showMajorThirdColor   = isMajorThird   && discordUnlocks.includes('discord_2') && scaleMode === 'minor';
                                const showAsDiscord  = isIntervalNote && !isUnlocked && !inScaleNote;
                                /* Same demotion as the melody-step stock (see UNLOCKED_DISCORD).
                                   No context colouring here on purpose: this grid is for BUILDING
                                   the stacks, so "which stack pays this note" isn't a question yet
                                   — the answer changes with the very click you're about to make. */
                                const showUnlockedD = showTritoneColor || showMinorSeventhColor || showMajorThirdColor;
                                const hexBorder = showAsDiscord ? "#444455" : showUnlockedD ? UNLOCKED_DISCORD.border : isFifth ? "#ff55aa" : isFourth ? "#cc55ff" : inScaleNote ? "#c0c8d8" : "#444455";
                                const hexText   = showAsDiscord ? "#555566" : showUnlockedD ? UNLOCKED_DISCORD.text   : isFifth ? "#ff55aa" : isFourth ? "#cc55ff" : inScaleNote ? "#e8eef8" : "#555566";
                                const hexBg     = showAsDiscord ? "#111118" : showUnlockedD ? UNLOCKED_DISCORD.bg     : isFifth ? "#2a0f1a" : isFourth ? "#1a0a2a" : inScaleNote ? "#1a2035" : "#111118";
                                /* Benefit preview for the targeted stack */
                                const targetStack = stackCommitDest === 'sustain' ? sStack : dStack;
                                const targetCh = stackCommitDest === 'sustain' ? sCh : dCh;
                                const targetFull = stackCommitDest === 'sustain' ? sFull : dFull;
                                const previewChord = !used && !targetFull ? spiritChord(acting?.id, [...targetStack, note]) : null;
                                const dDrive   = previewChord ? previewChord.drive   - targetCh.drive   : 0;
                                const dSustain = previewChord ? previewChord.sustain - targetCh.sustain : 0;
                                return (
                                  <div key={idx} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:0}}
                                    onMouseEnter={(e)=>{ if (!used) { const x=e.clientX, y=e.clientY; clearTimeout(hoverScaleTimerRef.current); hoverScaleTimerRef.current=setTimeout(()=>setHoverScale({note,x,y}),1500); }}}
                                    onMouseLeave={()=>{ clearTimeout(hoverScaleTimerRef.current); setHoverScale(cur=>cur?.note===note?null:cur); }}>
                                    <div onClick={()=>{ if (!used) clickNoteStock(idx, undefined, true); }}
                                      className="hexw" style={{width:26,height:29,cursor:used?"default":"pointer",
                                        background:used?"#232b3a":hexBorder,transition:"all .1s"}}>
                                      <div className="hexi" style={{fontSize:8,fontWeight:700,color:hexText,background:used?"#141a24":hexBg}}>{used?"":note}</div>
                                    </div>
                                    {previewChord && (dDrive > 0 || dSustain > 0) && (
                                      <div style={{display:"flex",gap:1,marginTop:1}}>
                                        {dDrive > 0 && <span style={{fontSize:6,color:"#ff6644",fontWeight:700,lineHeight:1}}>▲</span>}
                                        {dSustain > 0 && <span style={{fontSize:6,color:"#44aaff",fontWeight:700,lineHeight:1}}>▲</span>}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <button className="btn" onClick={()=>{ setStackCommitDest(null); setTurnStep('melody'); setTimeout(() => showTip('melody'), 300); }}
                          style={{width:"100%",fontSize:9,padding:"6px 0",borderColor:"#44ff88",color:"#44ff88",fontWeight:700,
                            background:"#0a1a10",boxShadow:"0 0 8px #44ff8833"}}>
                          {budgetLeft <= 0 ? '✓ Stacks set — Continue to Melody ->' : 'Continue to Melody ->'}
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : turnStep === 'melody' || turnStep === 'move_act' ? (
                <>
                {/* Note stock grid — STEP 3: MELODY BUILDING */}
                {(() => {
                  // 🎯 Pitch classes that would RESOLVE a cadence if they end this track
                  const resolvePcs = new Set(
                    cadenceHints(actingNoteState?.finalsTrail ?? [], actingNoteState?.cadenceCooldowns ?? {})
                      .filter(h => h.resolves).map(h => h.nextPc)
                  );
                  return (
                <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:5}}>
                  {noteStock.map((note,idx)=>{
                    const notePC         = pitchIndex(note);
                    const isTritone      = notePC === pitchIndex(tritoneNote);
                    const isMajorThird   = notePC === pitchIndex(majorThirdNote);
                    const isMinorSeventh = notePC === pitchIndex(minorSeventhNote);
                    const isFourth       = notePC === pitchIndex(fourthNote);
                    const isFifth        = notePC === pitchIndex(fifthNote);
                    const intervalKey    = isTritone      ? 'tritone'
                                        : isMajorThird   ? 'majorThird'
                                        : isMinorSeventh ? 'minorSeventh'
                                        : isFourth       ? 'fourth'
                                        : isFifth        ? 'fifth' : null;
                    const isIntervalNote = intervalKey !== null;
                    const isUnlocked     = isIntervalNote && unlockedIntervalKeys.has(intervalKey);
                    const inScaleNote    = currentScale.includes(note);
                    const inScale        = inScaleNote;
                    const used           = usedHas(usedStockIdx, idx);
                    const isStaggered    = staggeredSlots.includes(idx);
                    // Unlock gates, unchanged — only what they PAINT changed. All three
                    // now share `UNLOCKED_DISCORD` (see its definition): the effects that
                    // once justified three separate colours were deleted in B1 and B5, and
                    // red and blue are spoken for now.
                    // - tritone: needs discord_3 (out-of-scale until then → grey)
                    // - minorSeventh: needs discord_1 (in Major it's out-of-scale without
                    //   it; in Minor it's naturally in-scale → plain white)
                    // - majorThird: needs discord_2 (in Minor it's out-of-scale without it;
                    //   in Major it's naturally in-scale → plain white)
                    // - fourth/fifth: always diatonic, still pay Db ending bonuses → keep
                    //   their own colours
                    const showTritoneColor      = isTritone      && discordUnlocks.includes('discord_3');
                    const showMinorSeventhColor = isMinorSeventh && discordUnlocks.includes('discord_1') && scaleMode === 'major';
                    const showMajorThirdColor   = isMajorThird   && discordUnlocks.includes('discord_2') && scaleMode === 'minor';
                    const showUnlockedDiscord   = showTritoneColor || showMinorSeventhColor || showMajorThirdColor;
                    // 🎸 B3 — CHORD CONTEXT HIGHLIGHT. A note the key calls wrong that your
                    // stacks have made legal lights up the moment the stack qualifies it.
                    // This highlight IS the teaching: the player never learns a note table,
                    // they learn "lit notes are notes that pay me right now."
                    //
                    // It used to light gold — one colour for "some stack pardoned this,"
                    // which answered the wrong half of the question. The player already
                    // knows the note is clean; what they're deciding is whether to feed the
                    // riff or the shield. So the highlight now names the payee: Drive red,
                    // Sustain blue, and an alternating red↔blue pulse when both stacks
                    // legalize it independently and the choice is genuinely theirs (they
                    // make it at commit — see the payout router under the Commit Track).
                    //
                    // Gold is now exclusively the cadence-resolve signal, which is a strict
                    // improvement: two unrelated mechanics were wearing the same colour on
                    // the same grid.
                    const ctxClaim     = noteContextClaim(note);
                    const litByContext = ctxClaim !== null;
                    const ctxDual      = ctxClaim?.both === true;
                    const ctxC         = ctxClaim?.stack === 'sustain' ? SUSTAIN_C : DRIVE_C;
                    const ctxBg        = ctxClaim?.stack === 'sustain' ? SUSTAIN_BG : DRIVE_BG;
                    // Out-of-scale interval notes that haven't been unlocked → gray discord
                    const showAsDiscord  = isIntervalNote && !isUnlocked && !inScaleNote && !litByContext;
                    // ⚠️ Context wins over the interval colours, as gold did — a pardoned
                    // note is emphatically not a wrong note, and "which stack pays me" is
                    // live information while "you own this unlock" is not.
                    const borderC = litByContext         ? ctxC
                                  : showAsDiscord        ? "#444455"
                                  : showUnlockedDiscord  ? UNLOCKED_DISCORD.border
                                  : isFifth              ? "#ff55aa"
                                  : isFourth             ? "#cc55ff"
                                  : inScaleNote          ? "#c0c8d8"
                                  : "#444455";
                    const textC   = litByContext         ? ctxC
                                  : showAsDiscord        ? "#555566"
                                  : showUnlockedDiscord  ? UNLOCKED_DISCORD.text
                                  : isFifth              ? "#ff55aa"
                                  : isFourth             ? "#cc55ff"
                                  : inScaleNote          ? "#e8eef8"
                                  : "#555566";
                    const bgC     = litByContext         ? ctxBg
                                  : showAsDiscord        ? "#111118"
                                  : showUnlockedDiscord  ? UNLOCKED_DISCORD.bg
                                  : isFifth              ? "#2a0f1a"
                                  : isFourth             ? "#1a0a2a"
                                  : inScaleNote          ? "#1a2035"
                                  : "#111118";
                    const shadow  = litByContext         ? `0 0 7px ${ctxC}88`
                                  : showAsDiscord        ? "none"
                                  : showUnlockedDiscord  ? UNLOCKED_DISCORD.shadow
                                  : isFifth              ? "0 0 5px #ff55aa66"
                                  : isFourth             ? "0 0 5px #cc55ff66"
                                  : inScaleNote          ? "0 0 4px #c0c8d844"
                                  : "none";
                    const lockTip = ctxDual
                                  ? ` 🎸 BOTH stacks make this legal — you pick who gets paid at commit`
                                  : litByContext
                                  ? ` 🎸 Your ${ctxClaim.stack === 'sustain' ? '🛡️ Sustain' : '⚔️ Drive'} chord makes this legal — it pays ${ctxClaim.stack === 'sustain' ? 'Sustain' : 'Drive'}`
                                  : isIntervalNote && !isUnlocked && !inScaleNote
                                  ? ` 🔒 Locked — upgrade Discord path to unlock` : '';
                    // 🎚️ Mixer — used slots stay tappable for one layered repeat per turn
                    const mixerReady = used && !isStaggered
                      && (actingNoteState?.unlockedSkills ?? []).includes('mixer')
                      && !actingNoteState?.mixerUsedThisTurn
                      && !hasConfirmed && !pivotPending && melodyLine.length < 8;
                    // 🎯 This note's pitch would resolve a cadence if it ends the track
                    const resolvesCadence = resolvePcs.has(notePC) && !used && !isStaggered;
                    // 🕳️ A used, non-Mixer, non-staggered slot is genuinely EMPTY — no note
                    // color, no letter — so it never reads as a (still-full-opacity) discord note.
                    const isEmpty = used && !mixerReady && !isStaggered;
                    // 🎵 Just refilled this turn — pop in instead of silently appearing.
                    const isFresh = freshNoteIdx?.spiritId === acting?.id && freshNoteIdx.indices.has(idx);
                    // ⚔️↔🛡️ Dual-legal: alternate the hex between the two stack colours so
                    // "either of these will take it" is legible without a legend. The pulse
                    // is deliberately slow (2.2s) — this is an invitation to choose, not an
                    // alarm, and a fast strobe on up to eight hexes at once is unreadable.
                    // Cadence gold still outranks it: resolving the track is the bigger
                    // decision, and a hex can only say one thing at a time.
                    const dualPulse = ctxDual && !used && !isStaggered && !resolvesCadence;
                    return (
                      <div key={idx} onClick={(e)=>{ if (isStaggered) return; if (!used || mixerReady) clickNoteStock(idx, e); }}
                        onMouseEnter={(e)=>{ const x=e.clientX, y=e.clientY; clearTimeout(hoverScaleTimerRef.current); hoverScaleTimerRef.current=setTimeout(()=>setHoverScale({note,x,y}),1500); }}
                        onMouseLeave={()=>{ clearTimeout(hoverScaleTimerRef.current); setHoverScale(cur=>cur?.note===note?null:cur); }}
                        title={isStaggered ? "⚡ Staggered — unavailable"
                             : mixerReady ? "🎚️ Mixer — tap to layer this note again"
                             : resolvesCadence ? `🎯 End your track on this note to RESOLVE a cadence — the crowd swells (+Fans)!${lockTip}`
                             : lockTip || undefined}
                        className="hexw"
                        style={{
                          width:29,height:32,
                          cursor:(used&&!mixerReady)||isStaggered?"default":"pointer",
                          opacity: mixerReady ? 0.55 : isStaggered ? 0.3 : 1,
                          background: isStaggered ? "#ff880066" : mixerReady ? "#44ddff" : resolvesCadence ? "#ffd700" : isEmpty ? "#232b3a" : borderC,
                          filter: resolvesCadence ? "drop-shadow(0 0 5px #ffd700cc)"
                                : (isStaggered || isEmpty || shadow === "none") ? "none" : `drop-shadow(${shadow})`,
                          animation: resolvesCadence ? "cadence-gold-pulse 1.6s ease-in-out infinite"
                                   : dualPulse ? `stack-dual-hex 2.2s ease-in-out infinite${isFresh ? ", note-pop-in .5s ease-out" : ""}`
                                   : isFresh ? "note-pop-in .5s ease-out" : undefined,
                          transition:"all .1s",
                        }}>
                        <div className="hexi" style={{
                          fontSize:9,fontWeight:700,
                          color: isStaggered ? "#ff8800" : mixerReady ? "#44ddff" : resolvesCadence ? "#ffd700" : isEmpty ? "transparent" : textC,
                          background: isStaggered ? "#1a0e00" : isEmpty ? "#141a24" : bgC,
                          animation: dualPulse && !isEmpty ? "stack-dual-ink 2.2s ease-in-out infinite" : undefined,
                        }}>{isStaggered ? "⚡" : isEmpty ? "" : note}</div>
                      </div>
                    );
                  })}
                </div>
                  );
                })()}
                {/* 🎸 STACK COMMIT PREVIEW — hover-a-note guidance (inline, instant via hoverScale) */}
                {!hasConfirmed && stackCommitDest && (() => {
                  const stack = stackCommitDest === 'sustain' ? (actingNoteState?.sustainStack ?? []) : (actingNoteState?.driveStack ?? []);
                  const full  = stack.length >= actingStackCap;
                  const hn    = hoverScale?.note;
                  const next  = hn ? spiritChord(acting?.id, [...stack, hn]) : null;
                  const label = stackCommitDest === 'sustain' ? 'Sustain' : 'Drive';
                  return (
                    <div style={{marginBottom:5,minHeight:34,background:"#140a18",border:"1px solid #ff66cc44",borderRadius:4,padding:"4px 7px"}}>
                      {hn && next ? (
                        <>
                          <div style={{fontSize:8,color:"#ff99dd",fontWeight:700,marginBottom:2}}>🎸 Add {hn} to {label} → {next.name}</div>
                          <div style={{fontSize:8}}>
                            <span style={{color:"#ff6644",fontWeight:700}}>⚔️{next.drive}</span>{'   '}
                            <span style={{color:"#44aaff",fontWeight:700}}>🛡️{next.sustain}</span>
                            {full && <span style={{color:"#ff6666",marginLeft:8}}>{label} stack full</span>}
                          </div>
                        </>
                      ) : (
                        <span style={{fontSize:7.5,color:"#aa6688"}}>🎸 Committing to {label} — hover a note to preview</span>
                      )}
                    </div>
                  );
                })()}
                {/* 🎼 SCALE PEEK — fixed popup, 1.5s hover delay (no longer inline to avoid HUD jitter) */}
                {hoverScale && !stackCommitDest && (() => {
                  const maj = buildScale(hoverScale.note, 'major');
                  const min = buildScale(hoverScale.note, 'minor');
                  return (
                    <div style={{position:'fixed', left:hoverScale.x+14, top:hoverScale.y-8, zIndex:9999, pointerEvents:'none',
                      background:'#0a1424', border:'1px solid #44aaff', borderRadius:6, padding:'7px 10px',
                      boxShadow:'0 6px 20px #000a, 0 0 10px #44aaff44', fontFamily:"'Share Tech Mono',monospace", maxWidth:250}}>
                      <div style={{fontSize:9, color:'#ffcc44', fontWeight:700, marginBottom:4, letterSpacing:1}}>🎼 {hoverScale.note} — its scales</div>
                      <div style={{fontSize:8, color:'#9fc8ff', marginBottom:2}}><span style={{color:'#4488ff', fontWeight:700}}>Major:</span> {maj.join(' · ')}</div>
                      <div style={{fontSize:8, color:'#c79bff'}}><span style={{color:'#aa55ff', fontWeight:700}}>Minor:</span> {min.join(' · ')}</div>
                    </div>
                  );
                })()}
                {/* 🎸 CHORD STACK — now lives on the left side of the board (see board overlay section) */}
                {/* Transpose card — pick-a-note banner */}
                {actingNoteState?.transposeCardPending && (
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,
                    background:'#1a1400',border:'1.5px solid #ffcc44',borderRadius:4,padding:'5px 8px',
                    animation:'hex-turn-pulse 1s ease-in-out infinite'}}>
                    <span style={{fontSize:11}}>🔄</span>
                    <span style={{fontSize:8,color:'#ffcc44',fontWeight:700}}>
                      Transpose: click any stock note to set it as your new Root
                    </span>
                  </div>
                )}
                {/* Bank note UI */}
                {bankedNote && !hasConfirmed && (
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4,
                    background:"#0d1a10",border:"1px solid #44aa6644",borderRadius:4,padding:"4px 7px"}}>
                    <span style={{fontSize:8,color:"#44aa66"}}>💾 Banked:</span>
                    <span style={{fontSize:10,fontWeight:700,color:"#44ff88",background:"#0d2010",
                      border:"1px solid #44ff8866",borderRadius:3,padding:"1px 6px"}}>{bankedNote.note}</span>
                    <button className="btn" style={{fontSize:7,padding:"1px 6px",borderColor:"#44aa66",color:"#44ff88",marginLeft:"auto"}}
                      onClick={useBankedNote}>▶ Use</button>
                  </div>
                )}
                {discordCount>0 && <div style={{fontSize:8,color:"#ff6600",marginBottom:3}}>⚡ {discordCount} Dischord note{discordCount!==1?"s":""}</div>}
                <div style={{display:"flex",gap:3}}>
                  <button className="btn" style={{flex:1,borderColor:"#44ff88",color:"#44ff88",fontSize:8}}
                    onClick={confirmNoteTrack}
                    disabled={melodyLine.length===0}>
                    ✓ Commit ({melodyLine.length} notes → {Math.min(melodyLine.length, actingSpeed)} hex · SPD {actingSpeed})
                  </button>
                  <button className="btn" style={{borderColor:"#ff4444",color:"#ff4444",fontSize:8}}
                    onClick={clearNoteTrack}>✕</button>
                </div>
                </>
              ) : null}
            </div>
          )}

          {/* ── RIVAL SPIRITS — collapsed rows ── */}
          {spirits.filter(s => !s.knockedOut && acting?.id !== s.id).map(s => {
            // 💨 SMOKE — completely erase any sign of this spirit
            if (isHiddenBySmoke(s)) return (
              <div key={s.id} className="card" style={{
                padding:"4px 7px", marginBottom:3,
                borderLeft:"2px solid #33445566",
                opacity:0.4, background:"#080f1e",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:8,color:"#334455"}}>💨 Lost in the smoke…</span>
                </div>
              </div>
            );
            const ns = noteStates[s.id] ?? {};
            // Same combined-modifier total as the acting spirit's own dial (tempSustain +
            // Edge stage delta) — this row is exactly the "rivals can read the stance" surface.
            const rivalSustainDelta = (ns.tempSustain ?? 0) - edgeCombatMods(ns).sustainPenalty;
            return (
              <div key={s.id} className="card" style={{
                padding:"4px 7px", marginBottom:3,
                borderLeft:`2px solid ${s.color}66`,
                opacity: s.knockedOut ? 0.25 : 0.75,
                background:"#080f1e",
              }}>
                <NeonStrikeFX color={s.color} calm/>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:18,height:18,borderRadius:2,overflow:"hidden",flexShrink:0,
                    border:`1px solid ${s.color}44`}}>
                    <img src={s.imageSrc} alt={s.name} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:8,fontWeight:700,color:s.color,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {s.name.split(" ")[0]}
                    </div>
                    <div className="bar" style={{marginTop:2}}>
                      <div className="bar-f" style={{
                        width:`${(s.vibe/s.maxVibe)*100}%`,
                        background:s.vibe>s.maxVibe*.4?"#44cc66":"#ff4444"}}/>
                    </div>
                  </div>
                  <span style={{fontSize:7,color:"#3a5a7a",whiteSpace:"nowrap"}}>
                    {s.vibe}/{s.maxVibe}
                  </span>
                  <span style={{fontSize:7,color:"#ffd700",whiteSpace:"nowrap",marginLeft:2}} title="Fame Points">
                    ⭐{ns.fame ?? 0}
                  </span>
                  <span style={{fontSize:7,color:"#44aaff",whiteSpace:"nowrap",marginLeft:2}} title="Sustain">
                    🛡️{spiritChord(s.id, ns.sustainStack ?? []).sustain}
                    {rivalSustainDelta !== 0 && (
                      <span style={{color: rivalSustainDelta > 0 ? "#88ccff" : "#ff5566"}}>
                        {rivalSustainDelta > 0 ? '+' : ''}{rivalSustainDelta}
                      </span>
                    )}
                  </span>
                  {(ns.mojoDrain??0)>0&&<span style={{fontSize:7,color:"#4499ff"}}>💧</span>}
                  {ns.stagger&&<span style={{fontSize:7,color:"#ff8800"}}>⚡</span>}
                  {ns.tripped&&<span style={{fontSize:7,color:"#aaffaa"}} title="Tripped — movement halved">🌀</span>}
                  {ns.dazed&&<span style={{fontSize:7,color:"#ffaaff"}} title="Dazed — next move misdirected">😵</span>}
                  {ns.instrumentDropped&&<span style={{fontSize:7,color:"#ff4444"}} title="Dropped instrument — -1 Drive">🎸💥</span>}
                </div>
                {/* Owned skills + DB target row */}
                {(() => {
                  const owned     = ns.unlockedSkills ?? [];
                  const targetDef = ns.targetSkillId ? SKILL_BY_ID[ns.targetSkillId] : null;
                  const targetRoute = targetDef ? SKILL_TREE.routes.find(r => r.id === targetDef.routeId) : null;
                  const dbPts     = ns.dbPoints ?? 0;
                  const targetCost = targetDef?.dbCost ?? 8;
                  const pct       = Math.min(1, dbPts / targetCost);
                  if (owned.length === 0 && !targetDef) return null;
                  return (
                    <div style={{marginTop:4, display:"flex", flexDirection:"column", gap:3}}>
                      {/* Owned skill icons */}
                      {owned.length > 0 && (
                        <div style={{display:"flex", gap:3, flexWrap:"wrap"}}>
                          {owned.map(skillId => {
                            const sk = SKILL_BY_ID[skillId];
                            if (!sk) return null;
                            const rd = SKILL_TREE.routes.find(r => r.id === sk.routeId);
                            return (
                              <span key={skillId} title={`${sk.label}: ${sk.desc}`} style={{
                                fontSize:10, cursor:"default",
                                background:`${rd?.color ?? '#888'}18`,
                                border:`1px solid ${rd?.color ?? '#888'}44`,
                                borderRadius:3, padding:"1px 3px",
                              }}>{sk.icon}</span>
                            );
                          })}
                        </div>
                      )}
                      {/* DB target mini-bar */}
                      {targetDef && (
                        <div style={{display:"flex", alignItems:"center", gap:5}}>
                          <span style={{fontSize:9}}>{targetDef.icon}</span>
                          <div style={{flex:1, height:3, background:"#0a1020", borderRadius:2, overflow:"hidden"}}>
                            <div style={{
                              height:"100%", borderRadius:2,
                              width:`${pct*100}%`,
                              background: targetRoute?.color ?? '#ffcc44',
                              transition:"width 0.4s",
                            }}/>
                          </div>
                          <span style={{fontSize:6, color:"#3a5a7a", whiteSpace:"nowrap"}}>
                            {dbPts}/{targetCost}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {spirits.filter(s=>s.knockedOut).map(s=>(
            <div key={s.id} className="card" style={{padding:"3px 7px",marginBottom:3,opacity:0.2,borderLeft:`2px solid ${s.color}44`}}>
              <span style={{fontSize:8,color:s.color}}>💀 {s.name.split(" ")[0]}</span>
            </div>
          ))}

          {/* ACTIONS — only show during move_act step (or always for End Turn) */}
          <div className={turnStep === 'move_act' ? 'step-active' : ''} style={{'--step-glow-color':'#44ff88',
            borderRadius:6, padding: turnStep === 'move_act' ? '4px 0' : 0, transition:'all 0.3s'}}>
          <div className="stitle" style={{marginTop:4}}>
            {turnStep === 'move_act' ? 'Step 3 — Move & Act' : 'Actions'}
          </div>
          {/* (bonus revoice UI removed — stack commit budget replaces it) */}
          {turnStep !== 'move_act' && (
            <div style={{marginBottom:3}}>
              <button className="btn end" data-tip-anchor="end-turn" onClick={endTurn} style={{width:'100%',fontSize:9,padding:'5px 0'}}>End Turn ⏭</button>
            </div>
          )}
          <div data-tip-anchor="actions-bar" style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:5,
            ...((turnStep !== 'move_act') ? {display:'none'} : {})}}>
            <button className={`btn${action==="move"?" on":""}`}
              onClick={() => {
                if (action === "move") { setAction(null); }
                else if (moveStepsLeft > 0) { setAction("move"); addLog(`🚶 ${acting?.name} enters move mode — ${moveStepsLeft} hex${moveStepsLeft!==1?"es":""} available`); }
                else addLog(`🎵 Build and confirm your Melody Line first.`);
              }}
              disabled={!acting}>Move {moveStepsLeft>0?`(${moveStepsLeft} hex)`:""}</button>
            {action === "move" && (
              <button className="btn" style={{borderColor:"#44cc88",color:"#44cc88"}}
                onClick={() => { if (!canAct) return; setAction(null); dispatch(beatsSpent(0, false, { all: true })); addLog(`🚶 ${acting.name} stops moving.`); }}>
                ✓ End Move</button>
            )}
            {/* 👤 MOVE SHADOW — the double walks on its OWN legs: same range as
                the Ronin, separate pool, so it never eats his AP. Only the
                Ronin ever sees this button. */}
            {acting?.id === 'cosmic_ronin' && shadowIllusion && (
              <>
                <button className={`btn${action === "move_shadow" ? " on" : ""}`}
                  style={{borderColor: action === "move_shadow" ? "#88bbff" : "#1a2840",
                    color: action === "move_shadow" ? "#88bbff" : "#4a6a90"}}
                  disabled={shadowSteps < 1}
                  title="Move Shadow — your double moves on its own steps, refreshed each turn to match your own movement range. It costs you no Action Points."
                  onClick={() => {
                    if (action === "move_shadow") { setAction(null); }
                    else if (shadowSteps > 0) {
                      setAction("move_shadow");
                      addLog(`👤 Moving the SHADOW — ${shadowSteps} step${shadowSteps!==1?"s":""} of its own (your AP is untouched).`);
                    }
                  }}>
                  👤 Move Shadow{shadowSteps > 0 ? ` (${shadowSteps} hex)` : " (spent)"}
                </button>
                {action === "move_shadow" && (
                  <button className="btn" style={{borderColor:"#888",color:"#888"}}
                    onClick={() => setAction(null)}>Cancel</button>
                )}
              </>
            )}
            {/* FACE TURN — costs 1 move step */}
            {acting && moveStepsLeft > 0 && (
              <button className={`btn${action === "face" ? " on" : ""}`}
                style={{borderColor: action === "face" ? "#44ccff" : "#0a3044",
                  color: action === "face" ? "#44ccff" : "#1a5066"}}
                onClick={() => {
                  if (action === "face") { setAction(null); }
                  else {
                    setAction("face");
                    addLog(`🔄 ${acting.name} — click any adjacent hex to face that direction (costs 1 step)`);
                  }
                }}>
                🔄 Face{action === "face" ? "…" : ""}
              </button>
            )}
            {action === "face" && (
              <button className="btn" style={{borderColor:"#888",color:"#888"}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* Pose button — needs Hero Pose unlocked, Limelight hex, and a confirmed turn */}
            {acting?.num === LIMELIGHT_HEX && hasConfirmed
              && (noteStates[acting?.id]?.unlockedSkills ?? []).includes('hero_pose') && (
              <button className={`btn${posing[acting?.id] ? " on" : ""}`}
                style={{borderColor:"#ff88ff",color: posing[acting?.id] ? "#ff88ff" : "#aa55cc"}}
                onClick={togglePose}>
                {posing[acting?.id] ? "✨ Posing!" : "✨ Pose"}
              </button>
            )}
            {/* 🤘 STRIKE THE GOD — the ONLY attack while the Rock God stands.
                Clicking his hex also works; this button makes the affordance
                impossible to miss (bugfix 2026-07-16: players couldn't find
                the attack — PvP buttons had no targets and went dark). */}
            {rockGodActive && rockGod && !actionTokenUsed && (() => {
              const def = ROCK_GODS[rockGod.id] ?? {};
              const spHex = acting ? HEX_BY_NUM[acting.num] : null;
              const godHex = HEX_BY_NUM[rockGod.num];
              const adjacent = spHex && godHex && axialDist(spHex.q, spHex.r, godHex.q, godHex.r) <= 1;
              const hasAmp1 = (actingNoteState?.unlockedSkills ?? []).includes('amp_1');
              const inBeam = hasAmp1 && acting && getSonicBeam(acting).has(rockGod.num);
              const canMelee = adjacent && moveStepsLeft >= 1;
              const canBeam  = inBeam && moveStepsLeft >= 2;
              const canStrike = canMelee || canBeam;
              const why = canStrike ? ''
                : (adjacent || inBeam) ? ` (${adjacent ? '1AP' : '2AP'})`
                : ' — get adjacent or line up your beam';
              return (
                <button className={canStrike ? 'btn active' : 'btn'}
                  style={{borderColor: canStrike ? (def.color ?? '#ffcc22') : '#443300',
                    color: canStrike ? (def.color ?? '#ffcc22') : '#443300',
                    fontWeight: 700,
                    ...(canStrike ? { animation:'crew-ready-glow 1.6s ease-in-out infinite' } : {})}}
                  disabled={!canStrike}
                  title={`Strike ${def.name ?? 'the God'} — your chord's Drive lands straight as damage AND Fame (no dice). Melee adjacent (1 AP) or Sonic beam (2 AP, needs Amp I). Clicking his hex works too.`}
                  onClick={() => canStrike && attackRockGod(acting.id)}>
                  🤘 STRIKE {def.name ? def.name.toUpperCase() : 'THE GOD'}{canStrike ? ` (${canMelee ? '⚔️ 1AP' : '🔊 2AP'})` : why}
                </button>
              );
            })()}
            {/* SWING — baseline attack, always visible & lit (PvP is off during the God fight).
                Hover previews the cone. GRAYED = no AP / token spent; FADED = no rival in range. */}
            {!rockGodActive && (() => {
              const cone = acting ? getSwingCone(acting) : new Set();
              const rivals = acting ? getRivalsInCone(acting) : [];
              // 👤 The double counts as a target here. If the button read "(0)"
              // while a Ronin standee sat in the cone, the count would be the
              // tell — so it's tallied exactly like a real rival.
              const shadowCounts = shadowInRange('cone') ? 1 : 0;
              const targetCount = rivals.length + shadowCounts;
              const grayed = !hasConfirmed || actionTokenUsed || moveStepsLeft < 1;
              const canSwing = !grayed && targetCount > 0;
              return (
                <div style={{position:'relative',display:'inline-block'}}
                  onMouseEnter={() => setHoverPreview('swing')}
                  onMouseLeave={() => setHoverPreview(p => p === 'swing' ? null : p)}>
                  <button className={canSwing ? 'btn active' : 'btn'}
                    style={grayed
                      ? {borderColor:'#555560', color:'#8a8a95', opacity:0.6, position:'relative'}
                      : {borderColor:'#ff4444', color:'#ff6666',
                          opacity: canSwing ? 1 : 0.4, position:'relative'}}
                    disabled={!canSwing}
                    title={grayed
                      ? "The jab (1 AP) — grayed out: needs a confirmed turn, your Action Token, and at least 1 AP."
                      : canSwing
                      ? "The jab — cheap (1 AP) & defended. Drives your chord into them and can land Thrash statuses."
                      : "The jab (1 AP) — no rival in your cone. Hover to see the swing range."}
                    onClick={() => {
                      if (action === 'swing') { setAction(null); }
                      else if (canSwing) {
                        setAction('swing');
                        addLog('⚔️ SWING — click a rival in your cone to attack! (1 AP)');
                      }
                    }}>
                    ⚔️ Swing{targetCount > 0 ? ` (${targetCount})` : ''} {!canSwing && moveStepsLeft < 1 ? '(1AP)' : ''}
                  </button>
                </div>
              );
            })()}
            {action === 'swing' && (
              <button className="btn" style={{borderColor:'#888',color:'#888'}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* 🎸 THE SMASH (melee) — or 🌀 BLASTER OF RA (ranged, piercing) for Intergalactic 0 */}
            {!rockGodActive && (() => {
              const ns = actingNoteState ?? {};
              // 🌀 Once Blaster of Ra is unlocked, it REPLACES the Smash: ranged beam, pierces all.
              const hasBlaster = acting?.id === 'intergalactic_0' && (ns.unlockedSkills ?? []).includes('blaster_of_ra');
              const rivals = acting ? (hasBlaster ? getRivalsInBeam(acting) : getRivalsInCone(acting)) : [];
              // 👤 The Shadow Illusion is a legal target here too — it has to be,
              // or the button greying out would reveal it as a fake.
              const shadowSeen = shadowInRange(hasBlaster ? 'beam' : 'cone');
              const unused = (ns.noteStock ?? []).filter((_, i) => !usedHas(ns.usedStockIdx, i)).length;
              const grayed  = !hasConfirmed || actionTokenUsed || moveStepsLeft < 2;
              const canFire = !grayed && (rivals.length > 0 || shadowSeen) && unused >= 2;
              const mode    = hasBlaster ? 'blaster' : 'smash';
              const baseTitle = hasBlaster
                ? "Blaster of Ra (2 AP) — a ranged, piercing bass-drop down the beam: undefendable, scatters & knocks back EVERY rival in line. Ends your movement, leaves you Exposed. Hurls your unused stock."
                : "The haymaker (2 AP) — primal & undefendable: ignores their Sustain, scatters their notes. But it ends all your movement this turn and leaves you Exposed. Hurls your unused stock.";
              return (
                <div style={{position:'relative',display:'inline-block'}}
                  onMouseEnter={() => setHoverPreview(mode)}
                  onMouseLeave={() => setHoverPreview(p => p === mode ? null : p)}>
                  <button className={canFire ? 'btn active' : 'btn'}
                    style={grayed
                      ? {borderColor:'#555560', color:'#8a8a95', opacity:0.6}
                      : {borderColor:'#ff33aa', color:'#ff66cc', opacity: canFire ? 1 : 0.4}}
                    disabled={!canFire}
                    title={grayed
                      ? `${baseTitle} — grayed out: needs a confirmed turn, your Action Token, and 2 AP.`
                      : canFire ? baseTitle
                      : unused < 2
                      ? `${baseTitle} — faded: you need at least 2 unused stock notes to hurl.`
                      : `${baseTitle} — no rival in range. Hover to see the ${hasBlaster ? 'beam' : 'melee'} range.`}
                    onClick={() => {
                      if (action === mode) { setAction(null); }
                      else if (canFire) {
                        setAction(mode);
                        addLog(hasBlaster
                          ? `🌀💥 BLASTER OF RA — click a rival in your beam to fire down the line! (${unused} notes to hurl)`
                          : `🎸💥 THE SMASH — click an adjacent rival to bring it down! (${unused} notes to hurl)`);
                      }
                    }}>
                    {hasBlaster ? '🌀 Blaster of Ra' : '🎸 Smash'}{(rivals.length > 0 || shadowSeen) ? ` (${unused})` : ''} {!canFire && moveStepsLeft < 2 ? '(2AP)' : ''}
                  </button>
                </div>
              );
            })()}
            {(action === 'smash' || action === 'blaster') && (
              <button className="btn" style={{borderColor:'#888',color:'#888'}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* SONIC ATTACK — always wired (Main Amp); hover previews beam + rig range ring */}
            {!rockGodActive && (() => {
              const beam    = acting ? getSonicBeam(acting) : new Set();
              const targets = acting ? getRivalsInBeam(acting) : [];
              const poolNow = actingRig.pool;
              const poolDisplay = poolNow;
              const diceLabel = rigPoolLabel(poolDisplay);
              // 📡 Sonic is OFFLINE outside the rig's radius — the button fades.
              // GRAYED = no AP / token spent (mechanical); FADED = out of amp
              // range or no rival in the beam (positional). Hover shows both
              // the beam and the rig's radius ring so the player sees why.
              const outOfRange = !actingRig.inRange;
              // 👤 The double reads as a beam target like any other standee.
              const shadowSeen = shadowInRange('beam');
              const beamCount  = targets.length + (shadowSeen ? 1 : 0);
              const grayed   = !hasConfirmed || actionTokenUsed || moveStepsLeft < 2;
              const canSonic = !grayed && !outOfRange && beamCount > 0;
              return (
                <div style={{position:'relative',display:'inline-block'}}
                  onMouseEnter={() => setHoverPreview('sonic')}
                  onMouseLeave={() => setHoverPreview(p => p === 'sonic' ? null : p)}>
                  <button className={canSonic ? 'btn active' : 'btn'}
                    style={grayed
                      ? {borderColor:'#555560', color:'#8a8a95', opacity:0.6}
                      : {borderColor:'#44aaff', color:'#66ccff',
                          opacity: canSonic ? 1 : (outOfRange ? 0.35 : 0.4)}}
                    disabled={!canSonic}
                    title={grayed
                      ? "Sonic Attack (2 AP) — grayed out: needs a confirmed turn, your Action Token, and 2 AP."
                      : outOfRange
                      ? "📡 Out of your amp's range — the Sonic is offline out here. Hover to see your rig's radius ring; move back inside it or buy Range tiers."
                      : canSonic
                      ? `Sonic Attack (2 AP) — the ranged beam. ${diceLabel}, keep the highest. If your target is facing back down the beam AND inside their own amp range, it escalates into a RIFF-OFF; if they're stranded outside theirs, no duel — they defend on a d${SONIC_DEF_DIE_OUT_OF_RIG}.`
                      : "Sonic Attack (2 AP) — no rival in your beam. Hover to see the beam and your rig's range ring."}
                    onClick={() => {
                      if (action === 'sonic') { setAction(null); }
                      else if (canSonic) {
                        setAction('sonic');
                        addLog(`🔊 SONIC ATTACK — click a target in your beam! (${diceLabel} keep best)`);
                      }
                    }}>
                    🔊 Sonic{outOfRange ? ' 📡' : beamCount > 0 ? ` (${beamCount})` : ''} {diceLabel}
                    {grayed && moveStepsLeft < 2 ? ' (2AP)' : ''}
                  </button>
                </div>
              );
            })()}
            {action === 'sonic' && (
              <button className="btn" style={{borderColor:'#888',color:'#888'}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* (🎸 ACOUSTIC DUEL button REMOVED — the unplugged duel was cut.
                A riff-off is now earned by aiming a Sonic down a shared beam
                with both rigs live, not picked from the action bar.) */}
            {/* 🤘 MASTER OF MOSHPITS — Metalness Monster sacrifices 3 fans for +2 standing Drive.
                Fan counts come from ns.casuals / ns.diehards (the fan economy's real
                fields) — reading the non-existent casualFans/diehardFans is what kept
                this button dead at "(0/3 fans)". */}
            {hasConfirmed && acting?.id === 'Metalness_Monster'
              && (actingNoteState?.unlockedSkills ?? []).includes('master_moshpits') && (() => {
              const pool = moshableFans(actingNoteState);
              const used = actingNoteState?.moshpitUsedThisTurn;
              const running = !!moshCine;
              const canMosh = !used && !running && pool.total >= MOSH_FAN_COST;
              const standing = actingNoteState?.moshDrive ?? 0;
              return (
                <button className={canMosh ? 'btn active' : 'btn'}
                  style={{borderColor: canMosh ? '#ffcc00' : '#3a3000', color: canMosh ? '#ffcc00' : '#3a3000'}}
                  disabled={!canMosh}
                  title={used
                    ? "Master of Moshpits — already moshed this turn."
                    : pool.total < MOSH_FAN_COST
                    ? `Master of Moshpits — needs ${MOSH_FAN_COST} fans in the stands (you have ${pool.total}). Diehards away on crew assignments can't mosh.`
                    : `Master of Moshpits — pull ${MOSH_FAN_COST} fans onto the board for a pit. +${MOSH_DRIVE} Drive that STANDS until you call the next pit. Once per turn.`}
                  onClick={() => { if (canMosh) resolveMasterOfMoshpits(); }}>
                  🤘 Moshpit{used ? ' (used)' : pool.total < MOSH_FAN_COST ? ` (${pool.total}/${MOSH_FAN_COST} fans)` : ''}
                  {standing > 0 ? ` ⚔️+${standing}` : ''}
                </button>
              );
            })()}
            {/* 6️⃣ NUMBER OF THE BEAST — BERSERK. Free, but only when he's dying. */}
            {hasConfirmed && acting?.id === 'Metalness_Monster'
              && (actingNoteState?.unlockedSkills ?? []).includes('number_of_the_beast') && (() => {
              const raging = !!actingNoteState?.berserk;
              const vibe   = acting?.vibe ?? 0;
              const db     = actingNoteState?.dbPoints ?? 0;
              const lowEnough = vibe <= BEAST_VIBE_GATE;
              const canBeast  = !raging && lowEnough && db >= BEAST_DB_COST;
              return (
                <button className={canBeast || raging ? 'btn active' : 'btn'}
                  style={raging
                    ? {borderColor:'#ff2200', color:'#ff6644',
                       animation:'moshpit-shudder 0.3s steps(2) infinite',
                       filter:'drop-shadow(0 0 6px #ff2200)'}
                    : {borderColor: canBeast ? '#cc0000' : '#330000', color: canBeast ? '#ff4444' : '#330000'}}
                  disabled={!canBeast}
                  title={raging
                    ? `BERSERK — +${BEAST_DRIVE} Drive (uncapped), immune to knockback, 1 Vibe per attack. Ends when someone hits the floor.`
                    : canBeast
                    ? `Number of the Beast (${BEAST_DB_COST} Db) — go BERSERK. +${BEAST_DRIVE} Drive with no ceiling, immune to knockback, but every attack costs 1 Vibe. It ends when you put a rival down, when you go down, or if you heal back above ${BEAST_VIBE_GATE} Vibe.`
                    : !lowEnough
                    ? `Number of the Beast — the Beast only answers the dying. Needs ${BEAST_VIBE_GATE} Vibe or less (you're on ${vibe}).`
                    : `Number of the Beast — needs ${BEAST_DB_COST} Db to call (you have ${db}).`}
                  onClick={() => { if (canBeast) resolveNumberOfTheBeast(); }}>
                  {raging
                    ? `6️⃣ BERSERK ⚔️+${BEAST_DRIVE}`
                    : `6️⃣ Beast${!lowEnough ? ` (❤️${vibe}/${BEAST_VIBE_GATE})` : db < BEAST_DB_COST ? ` (${db}/${BEAST_DB_COST} Db)` : ''}`}
                </button>
              );
            })()}
            {/* 🌌 DISPLACE — Intergalactic 0 warps to his amp rig (3 AP, 2-turn cooldown) */}
            {hasConfirmed && acting?.id === 'intergalactic_0'
              && (actingNoteState?.unlockedSkills ?? []).includes('displace') && (() => {
              const cd      = actingNoteState?.displaceCd ?? 0;
              const canWarp = cd <= 0 && moveStepsLeft >= DISPLACE_AP;
              return (
                <>
                  <button className={canWarp ? 'btn active' : 'btn'}
                    style={{borderColor: canWarp ? '#aa55ff' : '#2a1840', color: canWarp ? '#cc88ff' : '#2a1840'}}
                    disabled={!canWarp}
                    title="Displace — warp to an open hex beside your amp rig (3 AP, 2-turn cooldown). He doesn't run; he transcends space."
                    onClick={() => {
                      if (action === 'displace') { setAction(null); }
                      else if (canWarp) { setAction('displace'); addLog('🌌 DISPLACE — click an open hex beside your rig to warp there.'); }
                    }}>
                    🌌 Displace{cd > 0 ? ` (${cd})` : ''}{!hasRig ? ' — need amp' : (moveStepsLeft < DISPLACE_AP && cd <= 0 ? ` (${DISPLACE_AP}AP)` : '')}
                  </button>
                  {action === 'displace' && (
                    <button className="btn" style={{borderColor:'#888',color:'#888'}}
                      onClick={() => setAction(null)}>Cancel</button>
                  )}
                </>
              );
            })()}
            {/* 🌀 PSYCHO BUSHIDO — Shredding Ronin dash attack */}
            {hasConfirmed && acting?.id === 'cosmic_ronin'
              && (actingNoteState?.unlockedSkills ?? []).includes('psycho_bushido') && (() => {
              const cd = actingNoteState?.psychoBushidoCd ?? 0;
              const canDash = cd <= 0 && moveStepsLeft >= 1 && !actionTokenUsed;
              return (
                <>
                  <button className={canDash ? 'btn active' : 'btn'}
                    style={{borderColor: canDash ? '#4488ff' : '#1a2840', color: canDash ? '#88bbff' : '#1a2840'}}
                    disabled={!canDash}
                    title="Psycho Bushido — dash in a straight line from your facing. Remaining AP converts to bonus Drive. 2-round cooldown."
                    onClick={() => {
                      if (action === 'psycho_bushido') { setAction(null); }
                      else if (canDash) { setAction('psycho_bushido'); addLog('🌀 PSYCHO BUSHIDO — click a rival in your line of sight to dash-strike!'); }
                    }}>
                    🌀 Bushido{cd > 0 ? ` (${cd})` : ''}
                  </button>
                  {action === 'psycho_bushido' && (
                    <button className="btn" style={{borderColor:'#888',color:'#888'}}
                      onClick={() => setAction(null)}>Cancel</button>
                  )}
                </>
              );
            })()}
            {/* 👤 SHADOW ILLUSION — Shredding Ronin decoy */}
            {hasConfirmed && acting?.id === 'cosmic_ronin'
              && (actingNoteState?.unlockedSkills ?? []).includes('shadow_illusion') && (() => {
              const hasShadow = !!(actingNoteState?.shadowIllusion);
              const hasDrive = (actingNoteState?.driveStack ?? []).length >= 1;
              const canSummon = !hasShadow && hasDrive;
              // No hex to pick any more — the double is born on top of the
              // Ronin, so this is a single-click action.
              return (
                <button className={canSummon ? 'btn active' : 'btn'}
                  style={{borderColor: canSummon ? '#4488ff' : '#1a2840', color: canSummon ? '#88bbff' : '#1a2840'}}
                  disabled={!canSummon}
                  title="Shadow Illusion — split into a second, identical Ronin right where you stand (costs 1 Drive token). You start stacked, so nobody sees which one appeared; walk them apart on separate legs and let rivals waste a turn on the wrong body."
                  onClick={() => { if (canSummon) resolveShadowIllusion(); }}>
                  👤 Shadow{hasShadow ? ` (${actingNoteState?.shadowIllusion?.turnsLeft ?? 0}t)` : (!hasDrive ? ' (no Drive)' : '')}
                </button>
              );
            })()}
            {/* 🎸 CURSED SHAMISEN — Shredding Ronin area denial */}
            {hasConfirmed && acting?.id === 'cosmic_ronin'
              && (actingNoteState?.unlockedSkills ?? []).includes('cursed_shamisen') && (() => {
              const hasSham = !!(actingNoteState?.cursedShamisen);
              const hasDb = (actingNoteState?.dbPoints ?? 0) >= 2;
              const canDrop = !hasSham && hasDb;
              return (
                <button className={canDrop ? 'btn active' : 'btn'}
                  style={{borderColor: canDrop ? '#4488ff' : '#1a2840', color: canDrop ? '#88bbff' : '#1a2840'}}
                  disabled={!canDrop}
                  title="Cursed Shamisen — set it down on your hex (2 Db). It plays a haunting melody every turn: 2 rings, then 3, then it starts hunting the nearest Spirit — you included. Walking onto its hex calms it."
                  onClick={() => { if (canDrop) resolveCursedShamisen(); }}>
                  🎸 Shamisen{hasSham
                    ? (actingNoteState?.cursedShamisen?.hunting
                        ? ' 💀 hunting'
                        : ` (${actingNoteState?.cursedShamisen?.range ?? 0}◎)`)
                    : (!hasDb ? ' (2 Db)' : '')}
                </button>
              );
            })()}
            <button className="btn end" data-tip-anchor="end-turn" onClick={endTurn}>End ⏭</button>
          </div>
          {/* Limelight scores */}
          {Object.keys(limelightScores).length > 0 && (
            <div style={{background:"#1a0a2a",border:"1px solid #ff44ff44",borderRadius:4,
              padding:"4px 8px",marginBottom:4,fontSize:8}}>
              <span style={{color:"#ff88ff",letterSpacing:1}}>✨ LIMELIGHT</span>
              <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                {spirits.map(s => {
                  const score = limelightScores[s.id] ?? 0;
                  if (score === 0) return null;
                  return (
                    <span key={s.id} style={{color:s.color,fontSize:9}}>
                      {s.name}: {score}/{LIMELIGHT_TO_WIN}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          </div>{/* end step-active wrapper for actions */}

        </div>

        {/* ── CENTER: BOARD ── */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>

          {/* ── POINTS FLASH OVERLAY ── */}
          <style>{`
            @keyframes flashFadeUp {
              0%   { opacity: 0; transform: translateY(10px) scale(0.95); }
              10%  { opacity: 1; transform: translateY(0px)  scale(1.05); }
              75%  { opacity: 1; transform: translateY(0px)  scale(1); }
              100% { opacity: 0; transform: translateY(-18px) scale(0.95); }
            }
            .points-flash-line {
              animation: flashFadeUp 4.5s ease forwards;
              text-shadow: 0 0 12px currentColor, 0 0 24px currentColor;
              white-space: nowrap;
            }
            @keyframes spotlight-pulse {
              from { opacity: 0.6; }
              to   { opacity: 1.0; }
            }
            @keyframes disco-spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `}</style>
          {pointsFlash && (
            <div key={pointsFlash.key} style={{
              position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
              zIndex:999, pointerEvents:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
              paddingTop:8,
            }}>
              {pointsFlash.lines.map((line, i) => {
                const isMainPts = i === 0 && line.startsWith('+');
                const isTierUp  = line.includes('TIER UP');
                const isTritone = line.includes('Tritone');
                const isMojo    = line.includes('Mojo');
                const isStagger = line.includes('Stagger');
                const isOctave  = line.includes('Octave');
                const isCleanse = line.includes('Cleanse') || line.includes('Major 3rd');
                const isDrive   = line.includes('Drive');
                const isSustain = line.includes('Sustain');
                const color = isTierUp  ? '#ffcc00'
                            : isTritone ? '#ff3300'
                            : isMojo    ? '#4499ff'
                            : isStagger ? '#ff8800'
                            : isOctave  ? '#44aaff'
                            : isCleanse ? '#44ffaa'
                            : isDrive   ? '#ffaa44'
                            : isSustain ? '#88ccff'
                            : isMainPts ? '#ffffff'
                            : '#aaccff';
                const size = isMainPts ? 28 : isTierUp ? 20 : 13;
                return (
                  <div key={i} className="points-flash-line"
                    style={{
                      fontSize: size,
                      fontWeight: 700,
                      fontFamily: "'Saira Stencil One', sans-serif",
                      color,
                      animationDelay: `${i * 0.12}s`,
                      opacity: 0,
                    }}>
                    {line}
                  </div>
                );
              })}
            </div>
          )}

          {/* 🎤 Mic voice roll — animated d6 that spins then settles */}
          {voiceRollFx && <VoiceRollDie key={voiceRollFx.key} fx={voiceRollFx} />}

          <div
            ref={boardDivRef}
            style={{position:"relative",width:"100%",maxWidth:1040,overflow:"visible",borderRadius:8,border:"1px solid #1a2a40",cursor:isPanningRef.current?"grabbing":"default",
              ...(boardDiveBomb ? {animation:'board-divebomb 1.1s cubic-bezier(0.22,1,0.36,1) forwards', transformOrigin:'center center'} : {}),
            }}
            onMouseDown={handleBoardMouseDown}
            onMouseMove={handleBoardMouseMove}
            onMouseUp={handleBoardMouseUp}
            onMouseLeave={handleBoardMouseUp}
            onContextMenu={e => e.preventDefault()}
          >
            {/* ── COMMIT TRACK — overlaid on the board SVG ── */}
            <div ref={commitTrackRef} data-tip-anchor="commit-track" className={turnStep === 'melody' ? 'step-active' : ''}
              style={{'--step-glow-color':'#aa88ff',
                position:"absolute",top:4,left:"50%",transform:"translateX(-50%)",
                width:"auto",maxWidth:"95%",background:"#060a10dd",
                border:`1px solid ${turnStep === 'melody' ? '#aa88ff66' : '#1a2a4044'}`,
                padding:"3px 10px",display:"flex",gap:4,justifyContent:"center",alignItems:"center",
                borderRadius:6,zIndex:5,backdropFilter:"blur(4px)",
                boxShadow:"0 2px 12px #00000088"}}>
              <div className="stitle" style={{marginBottom:0,color:"#aa88ff",flexShrink:0,fontSize:7,
                display:"flex",flexDirection:"column",lineHeight:1.15}}>
                <span>TRACK</span>
                {/* The draft state is only obvious if you say so. */}
                {!hasConfirmed && melodyLine.length > 0 && (
                  <span style={{fontSize:5.5,letterSpacing:.4,color:"#6a5a8a",fontWeight:400}}>
                    click to undo
                  </span>
                )}
              </div>
              {Array.from({length:8}).map((_,i)=>{
                const note = melodyLine[i];
                const isRoot   = i === 0 && note;
                const isTritone      = note && note === tritoneNote;
                const isMajorThird   = note && note === majorThirdNote;
                const isMinorSeventh = note && note === minorSeventhNote;
                const isFourth       = note && note === fourthNote;
                const isFifth        = note && note === fifthNote;
                const inScale        = note && currentScale.includes(note);
                // 🎸 The placed note's settled payee, read straight off the live
                // classification the commit will use — so a hex in the track is the
                // same colour as the hex in the stock it came from, and both match
                // the Db it will actually earn. Root green still outranks everything:
                // the first note is next turn's Root, which is a bigger fact about it.
                const cls       = liveClassified[i];
                const paidBy    = note && !cls?.inScale && cls?.pardonedBy ? cls.stack : null;
                const isDual    = !!(paidBy && cls?.both);
                const paidC     = paidBy === 'sustain' ? SUSTAIN_C  : DRIVE_C;
                const paidBgC   = paidBy === 'sustain' ? SUSTAIN_BG : DRIVE_BG;
                // Same demotion as the note stock — one look for all three
                // unlock-gated discords. See UNLOCKED_DISCORD.
                const showUnlocked = (isTritone || isMinorSeventh || isMajorThird) && !paidBy;
                const borderC = !note          ? "#2a1a5060"
                  : isRoot         ? "#44ff88"
                  : paidBy         ? paidC
                  : showUnlocked   ? UNLOCKED_DISCORD.border
                  : isFifth        ? "#ff55aa"
                  : isFourth       ? "#cc55ff"
                  : inScale        ? "#c0c8d8"
                  : "#444455";
                const textC = !note            ? "#2a1a5040"
                  : isRoot         ? "#44ff88"
                  : paidBy         ? paidC
                  : showUnlocked   ? UNLOCKED_DISCORD.text
                  : isFifth        ? "#ff55aa"
                  : isFourth       ? "#cc55ff"
                  : inScale        ? "#e8eef8"
                  : "#555566";
                const bgC = !note              ? "transparent"
                  : isRoot         ? "#0d2510"
                  : paidBy         ? paidBgC
                  : showUnlocked   ? UNLOCKED_DISCORD.bg
                  : isFifth        ? "#2a0f1a"
                  : isFourth       ? "#1a0a2a"
                  : inScale        ? "#1a2035"
                  : "#111118";
                const glow = paidBy         ? `drop-shadow(0 0 7px ${paidC}77)`
                           : showUnlocked   ? `drop-shadow(${UNLOCKED_DISCORD.shadow})`
                           : isFifth        ? "drop-shadow(0 0 6px #ff55aa55)"
                           : isFourth       ? "drop-shadow(0 0 6px #cc55ff55)"
                           : "none";
                // 🔁 The track is a draft until it's confirmed — a placed note
                // can be clicked to lift it back out and reclaim its slot.
                const editable = !!note && !hasConfirmed && canAct;
                return (
                  <div key={i} className={`hexw${editable ? ' track-note-edit' : ''}`}
                    title={[
                      paidBy
                        ? `${note} — pardoned by your ${paidBy === 'sustain' ? '🛡️ Sustain' : '⚔️ Drive'} chord${isDual ? ' (both qualify — reroute below)' : ''}`
                        : null,
                      editable ? '🔁 Click to pull this note back out' : null,
                    ].filter(Boolean).join(' · ') || undefined}
                    onClick={editable ? () => removeMelodyNote(i) : undefined}
                    onMouseEnter={note ? (e) => { const x = e.clientX, y = e.clientY; clearTimeout(noteTipTimerRef.current); noteTipTimerRef.current = setTimeout(() => setNoteScaleTip({ note, x, y }), 900); } : undefined}
                    onMouseLeave={() => { clearTimeout(noteTipTimerRef.current); setNoteScaleTip(null); }}
                    style={{
                    width:33,height:37,
                    cursor: editable ? 'pointer' : 'default',
                    opacity: note ? 1 : 0.35,
                    background: note ? borderC : "#2a1a5055",
                    filter: glow,
                    transition:"all .15s",
                  }}>
                    <div className="hexi" style={{
                      fontSize:10,fontWeight:700,
                      color:textC,
                      background: note ? bgC : "#07091466",
                    }}>{note || ""}</div>
                  </div>
                );
              })}
              {hasConfirmed && moveStepsLeft > 0 && (
                <span style={{fontSize:7,color:"#44ff88",marginLeft:4,flexShrink:0}}>✓ {moveStepsLeft} hex</span>
              )}
              {/* Zoom controls — tucked to the right */}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
                {manualZoomActive && (
                  <button className="btn" style={{fontSize:7,padding:"1px 5px",borderColor:"#3a5a7a",color:"#7090b0"}}
                    onClick={resetManualZoom}>⌖</button>
                )}
              </div>
            </div>
            {/* ── ⚔️↔🛡️ PAYOUT ROUTER ────────────────────────────────────────────
                Notes both stacks legalized independently. The tie-break (higher
                chord rank, tie to Drive) picks a default so the player can ignore
                this entirely and still be scored sanely; this row exists to let
                them override it, per note, once they can see the whole track.

                Deliberately at COMMIT rather than at placement. The question "do I
                feed the riff or the shield" is a read of the board — how much
                pressure you're under, what you're setting up next turn — and none
                of that is settled while you're still choosing note four of eight.
                Asking mid-build would interrupt the melody with a tactics question
                eight times a turn; asking here asks it once, with the answer
                visible. The row simply doesn't render when nothing is dual-legal,
                which is most turns early on.                                   */}
            {turnStep === 'melody' && !hasConfirmed && (() => {
              const dual = liveClassified
                .map((c, i) => ({ ...c, i }))
                .filter(c => c.both && c.pardonedBy && !c.inScale);
              if (!dual.length) return null;
              return (
                <div style={{position:"absolute",top:52,left:"50%",transform:"translateX(-50%)",
                  zIndex:5,display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",justifyContent:"center",
                  maxWidth:"95%",background:"#060a10ee",border:"1px solid #7a5aa066",borderRadius:6,
                  padding:"3px 9px",backdropFilter:"blur(4px)",boxShadow:"0 2px 12px #00000088"}}>
                  <span style={{fontSize:7,color:"#b09ad0",fontWeight:700,letterSpacing:0.5,flexShrink:0}}>
                    ⚔️↔🛡️ BOTH QUALIFY — WHO GETS PAID?
                  </span>
                  {dual.map(c => (
                    <div key={c.i} style={{display:"flex",alignItems:"center",gap:2}}>
                      <span style={{fontSize:8,fontWeight:700,color:"#e8eef8",minWidth:14,textAlign:"right"}}>{c.note}</span>
                      {[['drive','⚔️',DRIVE_C],['sustain','🛡️',SUSTAIN_C]].map(([dest,icon,col]) => (
                        <button key={dest} className="btn"
                          title={`${c.note} (note ${c.i + 1}) pays ${dest === 'drive' ? 'Drive' : 'Sustain'}`}
                          onClick={() => setPayoutRoute(c.i, dest)}
                          style={{fontSize:7,padding:"0 4px",lineHeight:"14px",
                            borderColor: c.stack === dest ? col : "#33384a",
                            color:       c.stack === dest ? col : "#5a6070",
                            background:  c.stack === dest ? `${col}22` : "transparent",
                            boxShadow:   c.stack === dest ? `0 0 5px ${col}55` : "none"}}>{icon}</button>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })()}
            {noteScaleTip && (() => {
              const maj = buildScale(canonicalRoot(noteScaleTip.note, 'major'), 'major');
              const min = buildScale(canonicalRoot(noteScaleTip.note, 'minor'), 'minor');
              return (
                <div style={{position:'fixed', left: noteScaleTip.x + 14, top: noteScaleTip.y - 8, zIndex:9999, pointerEvents:'none',
                  background:'#0a1424', border:'1px solid #44aaff', borderRadius:6, padding:'7px 10px',
                  boxShadow:'0 6px 20px #000a, 0 0 10px #44aaff44', fontFamily:"'Share Tech Mono',monospace", maxWidth:250}}>
                  <div style={{fontSize:9, color:'#ffcc44', fontWeight:700, marginBottom:4, letterSpacing:1}}>🎼 {noteScaleTip.note} — its scales</div>
                  <div style={{fontSize:8, color:'#9fc8ff', marginBottom:2}}><span style={{color:'#4488ff', fontWeight:700}}>Major:</span> {maj.join(' · ')}</div>
                  <div style={{fontSize:8, color:'#c79bff'}}><span style={{color:'#aa55ff', fontWeight:700}}>Minor:</span> {min.join(' · ')}</div>
                </div>
              );
            })()}
            {/* 🎵 FLY NOTE — animated chip from Note Stock to commit track */}
            {flyNote && (
              <div key={flyNote.key} className="note-fly-chip hexw"
                style={{left:flyNote.x - 16, top:flyNote.y - 18, width:33, height:37,
                  '--fly-dx': `${flyNote.dx}px`, '--fly-dy': `${flyNote.dy}px`,
                  background:"#aa88ff"}}>
                <div className="hexi" style={{fontSize:10,fontWeight:700,color:"#e8eef8",background:"#1a2035"}}>{flyNote.note}</div>
              </div>
            )}
            {/* 🎸 FLY CHORD NOTE — animated chip from Note Stock to chord stack */}
            {flyChordNote && (
              <div key={flyChordNote.key} className="note-fly-chip hexw"
                style={{left:flyChordNote.x - 16, top:flyChordNote.y - 18, width:33, height:37,
                  '--fly-dx': `${flyChordNote.dx}px`, '--fly-dy': `${flyChordNote.dy}px`,
                  background:"#ff66cc"}}>
                <div className="hexi" style={{fontSize:10,fontWeight:700,color:"#ffe0f0",background:"#1a0c1a"}}>{flyChordNote.note}</div>
              </div>
            )}
            {/* 🎸 DRIVE / SUSTAIN STACKS — vertical bars on the left side of the board */}
            {acting && !hasConfirmed && !pivotPending && (() => {
              const dStack = actingNoteState?.driveStack ?? [];
              const sStack = actingNoteState?.sustainStack ?? [];
              const dCh = spiritChord(acting?.id, dStack);
              const sCh = spiritChord(acting?.id, sStack);
              const commitsUsed = actingNoteState?.stackCommitsThisTurn ?? 0;
              const budgetLeft = STACK_COMMIT_BUDGET - commitsUsed;
              const isChordStep = turnStep === 'chord';
              return (
                <div ref={chordStackRef} data-tip-anchor="chord-stack"
                  className={isChordStep ? 'step-active' : ''}
                  style={{'--step-glow-color':'#ff66cc',
                    position:"absolute",left:4,top:50,zIndex:10,
                    display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                    background:"#060a10dd",
                    border:`1px solid ${isChordStep ? '#ff66cc66' : stackCommitDest ? '#ff66cc44' : '#1a2a4044'}`,
                    borderRadius:6,padding:"6px 5px",
                    backdropFilter:"blur(4px)",
                    boxShadow:"0 2px 12px #00000088",
                    minWidth:44}}>
                  {/* Drive Stack */}
                  <div className="stitle" style={{marginBottom:0,color:"#ff6644",fontSize:6,letterSpacing:1.5}}>DRIVE</div>
                  {/* B0b: every slot renders, but slots past the earned cap show as
                      LOCKED (🔒) so the gate reads as progression rather than as a
                      missing feature. Slot 4 = theory_dom7, slot 5 = theory_modes. */}
                  {Array.from({length:STACK_CAP_MAX}).map((_,i) => {
                    const note = dStack[i];
                    const locked = i >= actingStackCap;
                    return (
                      <div key={`d${i}`}
                        className="hexw"
                        title={locked ? (i === 3 ? '🔒 Slot 4 — unlock with Blues / Dominant 7th' : '🔒 Slot 5 — unlock with Modes') : undefined}
                        style={{
                          width:33,height:37,
                          opacity: locked ? 0.14 : note ? 1 : 0.25,
                          background: locked ? "#14141a" : note ? "#ff6644" : "#2a1a1055",
                          filter: locked ? 'grayscale(1)' : undefined,
                          cursor: 'default',
                          transition:"all .15s",
                        }}>
                        <div className="hexi" style={{
                          fontSize:locked ? 9 : 10,fontWeight:700,
                          color: locked ? "#8a8a9a" : note ? "#ffe0d0" : "#2a1a1040",
                          background: locked ? "#0a0a1088" : note ? "#1a0c08" : "#07091466",
                        }}>{locked ? "🔒" : (note || "")}</div>
                      </div>
                    );
                  })}
                  <span style={{fontSize:7,fontWeight:700,color:"#ff6644"}}>⚔️{dCh.drive}</span>
                  {/* Sustain Stack */}
                  <div className="stitle" style={{marginBottom:0,marginTop:4,color:"#44aaff",fontSize:6,letterSpacing:1.5}}>SUSTAIN</div>
                  {Array.from({length:STACK_CAP_MAX}).map((_,i) => {
                    const note = sStack[i];
                    const locked = i >= actingStackCap;
                    return (
                      <div key={`s${i}`}
                        className="hexw"
                        title={locked ? (i === 3 ? '🔒 Slot 4 — unlock with Blues / Dominant 7th' : '🔒 Slot 5 — unlock with Modes') : undefined}
                        style={{
                          width:33,height:37,
                          opacity: locked ? 0.14 : note ? 1 : 0.25,
                          background: locked ? "#14141a" : note ? "#44aaff" : "#0a1a3055",
                          filter: locked ? 'grayscale(1)' : undefined,
                          cursor: 'default',
                          transition:"all .15s",
                        }}>
                        <div className="hexi" style={{
                          fontSize:locked ? 9 : 10,fontWeight:700,
                          color: locked ? "#8a8a9a" : note ? "#d0e8ff" : "#0a1a3040",
                          background: locked ? "#0a0a1088" : note ? "#081828" : "#07091466",
                        }}>{locked ? "🔒" : (note || "")}</div>
                      </div>
                    );
                  })}
                  <span style={{fontSize:7,fontWeight:700,color:"#4499ff"}}>🛡️{sCh.sustain}</span>
                  {/* Stack commit buttons */}
                  <button className="btn"
                    style={{fontSize:8,padding:"3px 7px",fontWeight:700,
                      borderColor: stackCommitDest === 'drive' ? '#ff6644' : '#aa5533',
                      color: stackCommitDest === 'drive' ? '#ff6644' : '#aa5533',
                      background: stackCommitDest === 'drive' ? '#2a0c08' : 'transparent',whiteSpace:"nowrap",
                      opacity: budgetLeft <= 0 || dStack.length >= actingStackCap ? 0.4 : 1,
                      ...(engineState.turn.count <= 8 && !(budgetLeft <= 0 || dStack.length >= actingStackCap) ? {'--glow-color':'#ff6644', animation:'stack-btn-glow 1.5s ease-in-out infinite'} : {})}}
                    disabled={budgetLeft <= 0 || dStack.length >= actingStackCap}
                    onClick={()=>setStackCommitDest(d => d === 'drive' ? null : 'drive')}>
                    {stackCommitDest === 'drive' ? '⚔️ DRIVE' : '⚔️ Drive'}
                  </button>
                  <button className="btn"
                    style={{fontSize:8,padding:"3px 7px",fontWeight:700,
                      borderColor: stackCommitDest === 'sustain' ? '#44aaff' : '#2266aa',
                      color: stackCommitDest === 'sustain' ? '#44aaff' : '#2266aa',
                      background: stackCommitDest === 'sustain' ? '#0a1828' : 'transparent',whiteSpace:"nowrap",
                      opacity: budgetLeft <= 0 || sStack.length >= actingStackCap ? 0.4 : 1,
                      ...(engineState.turn.count <= 8 && !(budgetLeft <= 0 || sStack.length >= actingStackCap) ? {'--glow-color':'#44aaff', animation:'stack-btn-glow 1.5s ease-in-out infinite'} : {})}}
                    disabled={budgetLeft <= 0 || sStack.length >= actingStackCap}
                    onClick={()=>setStackCommitDest(d => d === 'sustain' ? null : 'sustain')}>
                    {stackCommitDest === 'sustain' ? '🛡️ SUSTAIN' : '🛡️ Sustain'}
                  </button>
                  {/* Status hint */}
                  <div style={{fontSize:5,color:"#6a8a9a",textAlign:"center",maxWidth:48,lineHeight:1.3}}>
                    {budgetLeft <= 0 ? '✓ done' : `${budgetLeft}/${STACK_COMMIT_BUDGET} left`}
                  </div>
                </div>
              );
            })()}
            {/* 🎛️ FLOATING VOICING PANEL — toggle button + collapsible tone controls */}
            {acting && (
              <button className="btn" onClick={()=>setVoicingOpen(v=>!v)}
                style={{position:"absolute",left:4,bottom:8,zIndex:20,fontSize:7,padding:"2px 6px",
                  borderColor:voicingOpen?"#aa66ff":"#3a5a7a",color:voicingOpen?"#aa66ff":"#7090b0",
                  background:voicingOpen?"#1a0c2aee":"#0a1020cc"}}>
                🎛️ {voicingOpen ? 'Hide' : 'Tone'}
              </button>
            )}
            {voicingOpen && acting && (
              <div style={{position:"absolute",left:4,bottom:28,zIndex:15,
                display:"flex",alignItems:"flex-end",gap:5,
                background:"linear-gradient(180deg,#161d30ee,#0a0e1cee)",border:"1px solid #aa66ff55",
                borderRadius:6,padding:"6px 7px 4px 7px",boxShadow:"0 4px 16px #000000aa, 0 0 12px #aa66ff22",
                backdropFilter:"blur(6px)"}}>
                {(() => {
                  const cur = toneKnobs.voice ?? 'saw';
                  const V = TONE_VOICES[cur] ?? TONE_VOICES.saw;
                  const cycle = () => {
                    const i = TONE_VOICE_ORDER.indexOf(cur);
                    const next = TONE_VOICE_ORDER[(i + 1) % TONE_VOICE_ORDER.length];
                    setToneKnobs(k => ({ ...k, voice: next }));
                    const aid = acting?.id;
                    if (aid) toneBySpiritRef.current = { ...toneBySpiritRef.current, [aid]: { ...(toneBySpiritRef.current[aid] ?? TONE_KNOB_DEFAULTS), voice: next } };
                    playNoteSound(rootNote, { holdTime: 0.3, fadeTime: 0.35, volume: 0.16 });
                  };
                  return (
                    <button onClick={cycle}
                      title="VOICE — wave/character: LEAD (saw), BUZZ (square), MELLOW (triangle), CLEAN (sine), FUZZ. Click to cycle."
                      style={{fontFamily:"'Saira Stencil One',sans-serif", cursor:"pointer",
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                        width:36, height:46, borderRadius:6, flexShrink:0,
                        background:"linear-gradient(135deg,#1c1230,#0e0a1e)", border:"2px solid #aa66ff",
                        boxShadow:"0 0 8px #aa66ff44, inset 0 0 4px #aa66ff22"}}>
                      <span style={{fontSize:5,letterSpacing:1,color:"#b98aff",fontWeight:700}}>VOICE</span>
                      <span style={{fontSize:8,fontWeight:900,color:"#fff",lineHeight:1.1,marginTop:1,textShadow:"0 0 6px #aa66ff"}}>{V.label}</span>
                    </button>
                  );
                })()}
                <ToneFader label="GAIN" color="#ff6644" value={toneKnobs.drive} defaultValue={TONE_KNOB_DEFAULTS.drive}
                  onChange={v=>setToneKnobs(k=>({...k,drive:v}))}
                  onCommit={()=>playNoteSound(rootNote,{holdTime:0.3,fadeTime:0.35,volume:0.16})}
                  title="GAIN — distortion. Double-click resets."/>
                <ToneFader label="TONE" color="#ffcc44" value={toneKnobs.tone} defaultValue={TONE_KNOB_DEFAULTS.tone}
                  onChange={v=>setToneKnobs(k=>({...k,tone:v}))}
                  onCommit={()=>playNoteSound(rootNote,{holdTime:0.3,fadeTime:0.35,volume:0.16})}
                  title="TONE — brightness. Double-click resets."/>
                <ToneFader label="ECHO" color="#44ddff" value={toneKnobs.echo} defaultValue={TONE_KNOB_DEFAULTS.echo}
                  onChange={v=>setToneKnobs(k=>({...k,echo:v}))}
                  onCommit={()=>playNoteSound(rootNote,{holdTime:0.3,fadeTime:0.35,volume:0.16})}
                  title="ECHO — slapback. Double-click resets."/>
                <ToneFader label="VERB" color="#aa88ff" value={toneKnobs.verb} defaultValue={TONE_KNOB_DEFAULTS.verb}
                  onChange={v=>setToneKnobs(k=>({...k,verb:v}))}
                  onCommit={()=>playNoteSound(rootNote,{holdTime:0.3,fadeTime:0.35,volume:0.16})}
                  title="VERB — reverb. Double-click resets."/>
              </div>
            )}
            <svg
              ref={svgRef}
              width={SVG_W}
              height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{display:"block",borderRadius:8,width:"100%",height:"auto"}}
            >
              <image href={boardImg} x={0} y={0} width={SVG_W} height={SVG_H} preserveAspectRatio="xMidYMid slice"/>
              <BoardFX />
              <defs>
                <filter id="outline-crush" color-interpolation-filters="sRGB">
                  <feComponentTransfer>
                    <feFuncR type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                    <feFuncG type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                    <feFuncB type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                    <feFuncA type="linear" slope="1" intercept="0"/>
                  </feComponentTransfer>
                </filter>
              </defs>
              {/* Soft bloom layer */}
              <image
                href={boardOutlineImg}
                className="board-outline-glow"
                x={0} y={0} width={SVG_W} height={SVG_H}
                preserveAspectRatio="xMidYMid slice"
                style={{ mixBlendMode:"screen", filter:"url(#outline-crush) blur(4px)" }}
              />
              {/* Crisp outline */}
              <image
                href={boardOutlineImg}
                className="board-outline-img"
                x={0} y={0} width={SVG_W} height={SVG_H}
                preserveAspectRatio="xMidYMid slice"
                style={{ mixBlendMode:"screen", filter:"url(#outline-crush)" }}
              />

              {/* ── ROAMING SEARCHLIGHT ── a proper followspot: swaying volumetric beam,
                  dust motes caught in the light, hot pool with ripples, drawn lamp rig ── */}
              {(() => {
                const sh = HEX_BY_NUM[spotlightHex];
                if (!sh) return null;
                const cx  = Math.round(sh.px * SCALE);
                const cy  = Math.round(sh.py * SCALE);
                const r   = HS * 1.1;
                // Beam origin: top of the rig, offset for a raking angle
                const bx  = cx + HS * 1.2;
                const by  = 0;
                // Beam geometry — unit vectors along / across the beam
                const len = Math.hypot(cx - bx, cy - by) || 1;
                const ux  = (cx - bx) / len, uy = (cy - by) / len;
                const pxv = -uy, pyv = ux;
                const bw     = r * 1.6;   // haze half-width at the pool
                const bwCore = r * 0.85;  // hot-core half-width at the pool
                const cone = (hw, srcW) =>
                  `${bx - srcW},${by} ${bx + srcW},${by} ${cx + hw},${cy} ${cx - hw},${cy}`;
                // Dust motes drifting through the beam
                const motes = [0.26, 0.38, 0.52, 0.63, 0.77, 0.88].map((t, i) => {
                  const k = (i % 2 ? 1 : -1) * bw * t * (0.22 + (i % 3) * 0.16);
                  return {
                    x: bx + ux * len * t + pxv * k,
                    y: by + uy * len * t + pyv * k,
                    r: 0.9 + (i % 3) * 0.6, d: 2.6 + (i % 4) * 0.9, delay: i * 0.53,
                  };
                });
                const healingSpirit = spirits.find(s => s.num === spotlightHex && !s.knockedOut);
                return (
                  <g style={{pointerEvents:"none"}}>
                    <defs>
                      <linearGradient id="srch-beam-haze" x1={bx} y1={by} x2={cx} y2={cy} gradientUnits="userSpaceOnUse">
                        <stop offset="0%"   stopColor="#fff6d8" stopOpacity={0.02}/>
                        <stop offset="55%"  stopColor="#fff2c4" stopOpacity={0.10}/>
                        <stop offset="100%" stopColor="#ffefb8" stopOpacity={0.20}/>
                      </linearGradient>
                      <linearGradient id="srch-beam-core" x1={bx} y1={by} x2={cx} y2={cy} gradientUnits="userSpaceOnUse">
                        <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.10}/>
                        <stop offset="60%"  stopColor="#fffbe6" stopOpacity={0.16}/>
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.30}/>
                      </linearGradient>
                      <radialGradient id="srch-pool" cx="50%" cy="50%" r="50%">
                        <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.65}/>
                        <stop offset="30%"  stopColor="#fff7c8" stopOpacity={0.34}/>
                        <stop offset="70%"  stopColor="#ffe98a" stopOpacity={0.12}/>
                        <stop offset="100%" stopColor="#ffe98a" stopOpacity={0}/>
                      </radialGradient>
                      <filter id="srch-soft" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation={HS * 0.18}/>
                      </filter>
                    </defs>
                    <style>{`
                      @keyframes srch-sway    { 0%,100%{transform:rotate(-2.2deg)} 50%{transform:rotate(2.2deg)} }
                      @keyframes srch-flick   { 0%,100%{opacity:1} 47%{opacity:.82} 53%{opacity:.95} 71%{opacity:.88} }
                      @keyframes srch-shimmer { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
                      @keyframes srch-mote    { 0%,100%{opacity:.05} 40%{opacity:.75} 60%{opacity:.55} }
                      @keyframes srch-ripple  { 0%{transform:scale(.55); opacity:.5} 100%{transform:scale(1.45); opacity:0} }
                    `}</style>

                    {/* Volumetric beam — swaying gently from the rig */}
                    <g style={{animation:"srch-sway 7.5s ease-in-out infinite",
                        transformOrigin:`${bx}px ${by}px`}}>
                      <g style={{animation:"srch-flick 3.1s linear infinite"}}>
                        <polygon points={cone(bw, 9)} fill="url(#srch-beam-haze)" filter="url(#srch-soft)"/>
                        <polygon points={cone(bwCore, 4)} fill="url(#srch-beam-core)"/>
                        {/* crisp beam edges */}
                        <line x1={bx - 4} y1={by} x2={cx - bwCore} y2={cy}
                          stroke="#fffbe6" strokeWidth={0.8} opacity={0.28}/>
                        <line x1={bx + 4} y1={by} x2={cx + bwCore} y2={cy}
                          stroke="#fffbe6" strokeWidth={0.8} opacity={0.28}/>
                      </g>
                      {/* Dust motes caught in the light */}
                      {motes.map((m, i) => (
                        <circle key={i} cx={m.x} cy={m.y} r={m.r} fill="#fffdf0"
                          style={{animation:`srch-mote ${m.d}s ease-in-out ${m.delay}s infinite`}}/>
                      ))}
                    </g>

                    {/* Light pool — layered hot centre, soft skirt, expanding ripples */}
                    <ellipse cx={cx} cy={cy} rx={r * 1.7} ry={r * 1.05}
                      fill="url(#srch-pool)" filter="url(#srch-soft)"
                      style={{animation:"srch-shimmer 2.8s ease-in-out infinite",
                        transformOrigin:`${cx}px ${cy}px`}}/>
                    <ellipse cx={cx} cy={cy} rx={r * 0.8} ry={r * 0.5}
                      fill="url(#srch-pool)"
                      style={{animation:"srch-shimmer 1.9s ease-in-out 0.4s infinite",
                        transformOrigin:`${cx}px ${cy}px`}}/>
                    {[0, 1].map(i => (
                      <polygon key={`rip-${i}`} points={pointyCorners(cx, cy, HS * 1.05)}
                        fill="none" stroke="#ffedaa" strokeWidth={1}
                        style={{animation:`srch-ripple 2.6s ease-out ${i * 1.3}s infinite`,
                          transformOrigin:`${cx}px ${cy}px`}}/>
                    ))}
                    {/* Hex border ring */}
                    <polygon points={pointyCorners(cx, cy, HS * 1.08)}
                      fill="none" stroke="#ffe98a" strokeWidth={1.3} opacity={0.6}
                      style={{animation:"spotlight-pulse 1.8s ease-in-out infinite alternate",
                        filter:"drop-shadow(0 0 4px #ffe98a88)"}}/>

                    {/* The rig — lamp housing, hot lens, cross flare */}
                    <g>
                      <rect x={bx - 8} y={by} width={16} height={7} rx={2.5}
                        fill="#1a1626" stroke="#443d5e" strokeWidth={1}/>
                      <circle cx={bx} cy={by + 7} r={4.4} fill="#fffef2" opacity={0.95}
                        style={{filter:"blur(1px) drop-shadow(0 0 8px #fff7c8)"}}/>
                      <line x1={bx - 13} y1={by + 7} x2={bx + 13} y2={by + 7}
                        stroke="#fffdf0" strokeWidth={0.9} opacity={0.5}
                        style={{animation:"srch-flick 2.3s linear infinite"}}/>
                      <line x1={bx} y1={by} x2={bx} y2={by + 18}
                        stroke="#fffdf0" strokeWidth={0.9} opacity={0.4}
                        style={{animation:"srch-flick 2.9s linear infinite"}}/>
                    </g>

                    {/* Heal label */}
                    <text x={cx} y={cy - HS * 1.25}
                      textAnchor="middle" fontSize={HS * 0.42}
                      fontWeight="bold" fill="#fff3b8"
                      stroke="#000" strokeWidth={0.3}
                      style={{pointerEvents:"none",
                        filter:"drop-shadow(0 0 3px #ffe066)",
                        animation:"spotlight-pulse 1.4s ease-in-out infinite alternate"}}>
                      💡 +1 Vibe
                    </text>
                    {/* Flash when a spirit is standing in it */}
                    {healingSpirit && (
                      <polygon points={pointyCorners(cx, cy, HS * 1.22)}
                        fill="none" stroke={healingSpirit.color} strokeWidth={2}
                        opacity={0.7}
                        style={{animation:"spotlight-pulse 0.7s ease-in-out infinite alternate",
                          filter:`drop-shadow(0 0 6px ${healingSpirit.color})`}}/>
                    )}
                  </g>
                );
              })()}

              {/* ── 🎤 CENTRE STAGE ENERGY ── the dark middle lights up as the arena fills ── */}
              {(() => {
                const hub = HEX_BY_NUM[LIMELIGHT_HEX]; if (!hub) return null;
                const cx = hub.px * SCALE, cy = hub.py * SCALE;
                const energy = Math.min(1, arenaFans() / 50);   // 0..1 as the crowd swells
                const glowO  = 0.10 + 0.42 * energy;
                const ringO  = 0.28 + 0.55 * energy;
                const pit = ALL_HEXES.filter(h => hexRingFromCenter(h.num) === 'pit');
                return (
                  <g style={{pointerEvents:"none"}}>
                    <defs>
                      <radialGradient id="stage-glow-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%"   stopColor="#ff66cc" stopOpacity={glowO}/>
                        <stop offset="45%"  stopColor="#ff3399" stopOpacity={glowO * 0.5}/>
                        <stop offset="100%" stopColor="#ff3399" stopOpacity={0}/>
                      </radialGradient>
                    </defs>
                    <style>{`
                      @keyframes stage-breathe   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
                      @keyframes stage-rays-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                      @keyframes stage-halo-spin { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
                    `}</style>
                    {/* Breathing bloom — two layers pulsing out of phase (intensity = energy) */}
                    <ellipse cx={cx} cy={cy} rx={HS * 3.4} ry={HS * 3.0} fill="url(#stage-glow-grad)"
                      style={{animation:"stage-breathe 4.2s ease-in-out infinite",
                        transformOrigin:`${cx}px ${cy}px`}}/>
                    <ellipse cx={cx} cy={cy} rx={HS * 1.9} ry={HS * 1.65} fill="url(#stage-glow-grad)"
                      style={{animation:"stage-breathe 2.7s ease-in-out 0.6s infinite",
                        transformOrigin:`${cx}px ${cy}px`}}/>
                    {/* Rotating light rays — the house rig wakes up as the crowd swells */}
                    <g opacity={0.10 + 0.30 * energy}
                      style={{animation:"stage-rays-spin 26s linear infinite",
                        transformOrigin:`${cx}px ${cy}px`}}>
                      {[0, 1, 2, 3, 4, 5].map(k => {
                        const a  = (Math.PI * 2 * k) / 6;
                        const rx = Math.cos(a), ry = Math.sin(a);
                        const R1 = HS * 1.1, R2 = HS * 3.6, W = HS * 0.5;
                        const qx = -ry, qy = rx;
                        return (
                          <polygon key={k}
                            points={`${cx + rx * R1},${cy + ry * R1} ${cx + rx * R2 + qx * W},${cy + ry * R2 + qy * W} ${cx + rx * R2 - qx * W},${cy + ry * R2 - qy * W}`}
                            fill="#ff66cc" opacity={0.35} style={{mixBlendMode:"screen"}}/>
                        );
                      })}
                    </g>
                    {/* The Pit — contested apron around the stage */}
                    {pit.map(h => (
                      <polygon key={`pit-${h.num}`}
                        points={pointyCorners(h.px * SCALE, h.py * SCALE, HS * 0.98)}
                        fill="none" stroke="#ff66cc" strokeWidth={1.1} opacity={ringO * 0.7}
                        style={{animation:`stage-throb ${3.0 + (h.num % 3) * 0.4}s ease-in-out infinite`}}/>
                    ))}
                    {/* The Mainstage hex itself — neon ring + counter-rotating dashed halo */}
                    <polygon points={pointyCorners(cx, cy, HS * 1.02)}
                      fill="none" stroke="#ff99dd" strokeWidth={1.6} opacity={ringO}
                      style={{animation:"stage-throb 2.4s ease-in-out infinite",
                        filter:"drop-shadow(0 0 5px #ff66cc)"}}/>
                    <g style={{animation:"stage-halo-spin 14s linear infinite",
                        transformOrigin:`${cx}px ${cy}px`}}>
                      <circle cx={cx} cy={cy} r={HS * 1.35} fill="none" stroke="#ff99dd"
                        strokeWidth={1} strokeDasharray="10 14" opacity={ringO * 0.55}/>
                    </g>
                  </g>
                );
              })()}

              {/* ── 🤘 MASTER OF MOSHPITS — the walk-on ──────────────────────────
                  Three fans have left their seats (the grandstand count already
                  dropped) and are crossing the board to the Monster's hex. Each
                  mover is drawn AT its destination and animated in from its old
                  seat via --mosh-dx/--mosh-dy, so the pit geometry stays exact
                  no matter where the Monster is standing. */}
              {moshCine && (() => {
                const { phase, movers, hexNum, spiritId } = moshCine;
                const hex = HEX_BY_NUM[hexNum];
                const mm  = spirits.find(s => s.id === spiritId);
                if (!hex) return null;
                const px = hex.px * SCALE, py = hex.py * SCALE;
                const sc = CORNER_LABELS[mm?.corner]?.color ?? mm?.color ?? '#ffcc00';
                const r  = HS * 0.30;
                return (
                  <g style={{pointerEvents:"none"}}>
                    {/* the pit opens up under them once they've arrived */}
                    {phase !== 'walk' && (
                      <ellipse cx={px} cy={py} rx={HS * 1.5} ry={HS * 1.0}
                        fill="#ffcc0033" stroke="#ffcc00aa" strokeWidth={2}
                        style={{transformOrigin:`${px}px ${py}px`,
                          animation:"mosh-pit-glow 0.5s ease-in-out infinite",
                          filter:"drop-shadow(0 0 10px #ffcc00)"}}/>
                    )}
                    {movers.map((f, i) => {
                      const dx = (f.sx - f.tx).toFixed(1), dy = (f.sy - f.ty).toFixed(1);
                      const anim = phase === 'walk'
                        ? `mosh-walk-in ${MOSH_WALK_MS}ms ease-in-out both`
                        : phase === 'pit'
                        ? `mosh-stomp ${(0.34 + i * 0.05).toFixed(2)}s ease-in-out ${(i * 0.06).toFixed(2)}s infinite`
                        : `mosh-spend 0.8s ease-out both`;
                      return (
                        <g key={`mosh-${f.seed}`}
                          style={{
                            ['--mosh-dx']: `${dx}px`,
                            ['--mosh-dy']: `${dy}px`,
                            ['--mosh-tilt']: `${i % 2 === 0 ? 7 : -7}deg`,
                            transformOrigin: `${f.tx}px ${f.ty}px`,
                            animation: anim,
                          }}>
                          {fanPawnShape(f.tx, f.ty, r, f.isDie ? sc : '#cfe0ff', f.isDie,
                            1.3, 1, f.seed, false, 'fist')}
                        </g>
                      );
                    })}
                    {/* 🤘 over the pit once it's raging */}
                    {phase === 'pit' && (
                      <text x={px} y={py - HS * 1.5} textAnchor="middle" fontSize={HS * 0.9}
                        style={{animation:"moshpit-bob 0.4s ease-in-out infinite",
                          filter:"drop-shadow(0 0 8px #ffcc00)"}}>🤘</text>
                    )}
                  </g>
                );
              })()}

              {/* ── 🎤 FAN CROWDS ── each Spirit's following gathers at its home turf, outside the field ── */}
              {spirits.map(s => {
                if (!s.corner) return null;
                const home = HEX_BY_NUM[CORNERS[s.corner]?.homeNum];
                const hub  = HEX_BY_NUM[LIMELIGHT_HEX];
                if (!home || !hub) return null;
                const ns = noteStates[s.id] ?? {};
                const D = ns.diehards ?? 0, C = ns.casuals ?? 0;
                const total = D + C;
                const sc = CORNER_LABELS[s.corner]?.color ?? s.color;
                const hx = home.px * SCALE, hy = home.py * SCALE;
                const cxC = hub.px * SCALE, cyC = hub.py * SCALE;
                // Unit vector pointing from board centre outward through the home corner.
                let ox = hx - cxC, oy = hy - cyC;
                const L = Math.hypot(ox, oy) || 1; ox /= L; oy /= L;
                // Cluster anchor: pushed well past the coloured home pocket into the dark margin.
                const FAN_OUT = HS * 3.5;
                const anchorX = hx + ox * FAN_OUT;
                const anchorY = hy + oy * FAN_OUT;
                const dot = HS * 0.25;
                const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
                // Hard floor: no fan may sit closer to the hub than the home hex (plus a
                // margin), so the crowd gathers OUT in the dark margin instead of spilling
                // back over the coloured field.
                const homeR = Math.hypot(hx - cxC, hy - cyC);
                const MIN_R = homeR + HS * 1.7;
                const fanEvt = fanFx[s.id];
                // While a GAIN burst is mid-flight, hold the new arrivals out of the
                // steady cluster so they read as a distinct pop-in (rendered below).
                const popN = (fanEvt?.kind === 'gain') ? Math.min(fanEvt.n, 12) : 0;
                const visibleTotal = Math.max(0, total - popN);
                // ── 🏟️ GRANDSTAND — an amphitheater wedge curved AROUND THE HUB, so the
                // front rail keeps a constant gap from the board edge; the square window
                // corner is handled by taper (rows shrink 6·5·5·4 into the dead wedge).
                // The caps become visible capacity: diehards fill the front arc exactly.
                const CAPACITY = FAN_DIEHARD_CAP + FAN_CASUAL_CAP;      // 20 = 6+5+5+4
                const seatGap = HS * 0.68, rowGap = HS * 0.78;
                const frontR = homeR + FAN_OUT;      // front row rides where the anchor sits
                const midA = Math.atan2(oy, ox);     // the stand's centreline angle
                const fans = [];
                for (let i = 0; i < Math.min(visibleTotal, CAPACITY); i++) {
                  const isDie = i < D;                 // diehards fill the seat sequence first → front rail
                  const seat = grandstandSeat(i, cxC, cyC, ox, oy, frontR, seatGap, rowGap);
                  fans.push({ i, isDie,
                    fx: clamp(seat.x, 4, SVG_W - 4),
                    fy: clamp(seat.y, 4, SVG_H - 4) });
                }
                return (
                  <g key={`fans-${s.id}`} data-tip-anchor={s.id === acting?.id ? 'fan-crowd' : undefined}
                     style={{pointerEvents:"none"}}>
                    {/* tiers — curved platform bands, back to front, tapering into the corner */}
                    {[3, 2, 1, 0].map(rw => (
                      <path key={`tier-${rw}`}
                        d={grandstandArc(cxC, cyC, frontR + rw * rowGap, midA, grandstandRowSpan(rw, frontR, seatGap, rowGap))}
                        fill="none" stroke={rw % 2 ? '#101d3a' : '#0d1830'} strokeWidth={rowGap * 0.8}/>
                    ))}
                    {/* tier lips — a thin bright edge along each platform's outer rim */}
                    {[3, 2, 1, 0].map(rw => (
                      <path key={`tedge-${rw}`}
                        d={grandstandArc(cxC, cyC, frontR + rw * rowGap + rowGap * 0.4, midA, grandstandRowSpan(rw, frontR, seatGap, rowGap))}
                        fill="none" stroke="#24406a" strokeWidth={1}/>
                    ))}
                    {/* empty seats — dashed capacity markers (static + cheap: 1 node each) */}
                    {Array.from({ length: Math.max(0, CAPACITY - visibleTotal) }, (_, k) => {
                      const seat = grandstandSeat(visibleTotal + k, cxC, cyC, ox, oy, frontR, seatGap, rowGap);
                      return <circle key={`seat-${k}`} cx={clamp(seat.x, 4, SVG_W - 4)} cy={clamp(seat.y, 4, SVG_H - 4)}
                        r={dot * 0.5} fill="none" stroke="#1e3a5f" strokeWidth={1}
                        strokeDasharray="2 2" opacity={0.4}/>;
                    })}
                    {/* fans, deepest row first so front-row pawns overlap the row behind */}
                    {[...fans].reverse().map(({ i, isDie, fx: px, fy: py }) => {
                      const r   = isDie ? dot * 1.6 : dot * 1.25;   // pawns sized to read cleanly
                      const col = isDie ? sc : '#cfe0ff';
                      const sww = isDie ? 1.3 : 0.9;
                      const op  = isDie ? 0.95 : 0.6;
                      const dur = 3.4 + (i % 5) * 0.35;
                      const delay = -(((i * 0.37) % dur)).toFixed(2);
                      const bang = i % 5 === 2;   // ~20% of the crowd headbangs instead of bobbing
                      return (
                        <g key={i} style={{
                          animation: bang
                            ? `fan-headbang ${(0.62 + (i % 3) * 0.07).toFixed(2)}s ease-in-out infinite`
                            : `fan-bob ${dur}s ease-in-out infinite`,
                          animationDelay: `${delay}s`,
                          transformBox: 'fill-box', transformOrigin: '50% 85%'}}>
                          {/* soft glow — the crowd reads as a sea of lights */}
                          <circle cx={px} cy={py} r={r * 1.5} fill={sc}
                            opacity={isDie ? 0.26 : 0.10} style={{filter:`blur(${r * 0.9}px)`}}/>
                          {fanPawnShape(px, py, r, col, isDie, sww, op, i, false, null)}
                        </g>
                      );
                    })}
                    {/* 🚧 barricade rail — owner colour, a curved arc tracking the board
                        edge at a constant gap, in front of the front row */}
                    {(() => {
                      const railR = frontR - rowGap * 0.6;
                      const span = grandstandRowSpan(0, frontR, seatGap, rowGap);
                      return (
                        <g stroke={sc} strokeWidth={1.6} opacity={0.85}
                           style={{filter:`drop-shadow(0 0 3px ${sc})`}}>
                          <path d={grandstandArc(cxC, cyC, railR, midA, span)} fill="none"/>
                          {[-0.76, -0.4, 0, 0.4, 0.76].map(t => {
                            const a = midA + t * span;
                            const px2 = cxC + railR * Math.cos(a), py2 = cyC + railR * Math.sin(a);
                            return <line key={t} x1={px2} y1={py2}
                              x2={px2 + Math.cos(a) * dot * 0.9} y2={py2 + Math.sin(a) * dot * 0.9}/>;
                          })}
                        </g>
                      );
                    })()}
                    {/* Crowd-size tag — seats filled / capacity, tucked in the corner tip
                        past the back row along the diagonal */}
                    {total > 0 && (
                      <text x={clamp(cxC + ox * (frontR + rowGap * 3.9), 30, SVG_W - 30)}
                        y={clamp(cyC + oy * (frontR + rowGap * 3.9), 14, SVG_H - 8)}
                        textAnchor="middle" fontSize={HS * 0.4} fontWeight="bold"
                        fill={sc} opacity={0.85} stroke="#000" strokeWidth={0.3}
                        style={{filter:`drop-shadow(0 0 3px ${sc})`}}>
                        🎤 {total} / {CAPACITY}
                      </text>
                    )}
                    {/* Transient reaction burst */}
                    {fanEvt && fanEvt.kind === 'gain' && (
                      <text key={fanEvt.key} x={anchorX} y={anchorY - HS * 0.7} textAnchor="middle"
                        fontSize={HS * 0.6} fontWeight="bold" fill={sc} stroke="#000" strokeWidth={0.4}
                        style={{animation:"floatUp 1.2s ease-out forwards", filter:`drop-shadow(0 0 4px ${sc})`}}>
                        +{fanEvt.n} 🎤
                      </text>
                    )}
                    {/* 🎆 FIREWORKS — a bright bloom of light + radiating sparks so a new
                        haul of fans lights up the home corner and can't slip by unnoticed.
                        Geometry is deterministic (index-keyed) so it doesn't jitter on re-render. */}
                    {fanEvt && fanEvt.kind === 'gain' && (() => {
                      const burstN = Math.min(18, 9 + fanEvt.n * 2);
                      const reach  = HS * (1.5 + Math.min(1.1, fanEvt.n * 0.12));
                      const palette = [sc, '#fff0a0', '#ff7ad0', '#7af0ff', '#ffd24a'];
                      const sparks = [];
                      for (let i = 0; i < burstN; i++) {
                        const a   = (i / burstN) * Math.PI * 2 + (fanEvt.n % 2 ? 0.22 : 0);
                        const len = reach * (0.72 + 0.30 * (((i * 13) % 7) / 6));
                        const fx  = Math.cos(a) * len, fy = Math.sin(a) * len;
                        const col = palette[i % palette.length];
                        sparks.push(
                          <circle key={i} cx={anchorX} cy={anchorY} r={HS * 0.12} fill={col}
                            style={{animation:'fw-spark 1.0s ease-out forwards',
                              animationDelay:`${((i % 3) * 0.045).toFixed(3)}s`,
                              ['--fx']:`${fx.toFixed(1)}px`, ['--fy']:`${fy.toFixed(1)}px`,
                              filter:`drop-shadow(0 0 3px ${col})`}}/>
                        );
                      }
                      return (
                        <g key={`fw-${fanEvt.key}`} style={{pointerEvents:'none'}}>
                          <circle cx={anchorX} cy={anchorY} r={reach} fill="none" stroke={sc} strokeWidth={2}
                            style={{animation:'fw-ring 0.9s ease-out forwards',
                              transformBox:'fill-box', transformOrigin:'center',
                              filter:`drop-shadow(0 0 4px ${sc})`}}/>
                          <circle cx={anchorX} cy={anchorY} r={HS * 0.75} fill="#fff6cc"
                            style={{animation:'fw-flash 0.7s ease-out forwards',
                              transformBox:'fill-box', transformOrigin:'center',
                              filter:`drop-shadow(0 0 9px ${sc})`, mixBlendMode:'screen'}}/>
                          {sparks}
                        </g>
                      );
                    })()}
                    {fanEvt && fanEvt.kind === 'scatter' && (
                      <g key={fanEvt.key}>
                        <g transform={`translate(${anchorX} ${anchorY})`}>
                          <circle cx={0} cy={0} r={HS * 1.6} fill="none" stroke="#ff5544" strokeWidth={2}
                            style={{animation:"fx-ring 1s ease-out forwards"}}/>
                        </g>
                        <text x={anchorX} y={anchorY - HS * 0.7} textAnchor="middle"
                          fontSize={HS * 0.6} fontWeight="bold" fill="#ff6655" stroke="#000" strokeWidth={0.4}
                          style={{animation:"floatUp 1.2s ease-out forwards", filter:"drop-shadow(0 0 4px #ff3333)"}}>
                          −{fanEvt.n} 💔
                        </text>
                      </g>
                    )}

                    {/* 🎤 POP-IN — fresh fans burst into the crowd, one after another */}
                    {fanEvt && fanEvt.kind === 'gain' && popN > 0 && (() => {
                      const items = [];
                      for (let i = visibleTotal; i < Math.min(total, CAPACITY); i++) {
                        const seat = grandstandSeat(i, cxC, cyC, ox, oy, frontR, seatGap, rowGap);
                        const px = clamp(seat.x, 4, SVG_W - 4);
                        const py = clamp(seat.y, 4, SVG_H - 4);
                        const r = dot * 1.35;
                        items.push(
                          <g key={`pi-${i}`} style={{animation:"fan-pop-in 0.6s cubic-bezier(.5,1.6,.6,1) both",
                            animationDelay:`${((i - visibleTotal) * 0.07).toFixed(2)}s`,
                            transformBox:'fill-box', transformOrigin:'center'}}>
                            {fanPawnShape(px, py, r, sc, true, 1.25, 1, i, false, 'wave')}
                          </g>
                        );
                      }
                      return <g key={`popin-${fanEvt.key}`}>{items}</g>;
                    })()}

                    {/* 🎤 WALK-OFF — departing fans trudge away from the board, then vanish */}
                    {fanEvt && fanEvt.kind === 'scatter' && fanEvt.n > 0 && (() => {
                      const n = Math.min(fanEvt.n, 12);
                      const items = [];
                      for (let k = 0; k < n; k++) {
                        const i = total + k;
                        const ang = i * 2.39996;
                        const rad = Math.sqrt(i + 0.6) * dot * 1.4;
                        let px = anchorX + Math.cos(ang) * rad        + ox * rad * 0.15;
                        let py = anchorY + Math.sin(ang) * rad * 0.85 + oy * rad * 0.15;
                        let dx = px - cxC, dy = py - cyC; const dist = Math.hypot(dx, dy) || 1;
                        if (dist < MIN_R) { px = cxC + (dx / dist) * MIN_R; py = cyC + (dy / dist) * MIN_R; }
                        px = clamp(px, 4, SVG_W - 4); py = clamp(py, 4, SVG_H - 4);
                        // trudge further out — away from the board centre
                        const wx = (ox + (dx / dist) * 0.4) * HS * 2.4;
                        const wy = (oy + (dy / dist) * 0.4) * HS * 2.4;
                        const r = dot * 1.2;
                        items.push(
                          <g key={`wo-${k}`} style={{animation:"fan-walk-off 1.25s ease-in both",
                            animationDelay:`${(k * 0.06).toFixed(2)}s`,
                            transformBox:'fill-box', transformOrigin:'center',
                            ['--wx']:`${wx.toFixed(1)}px`, ['--wy']:`${wy.toFixed(1)}px`}}>
                            {fanPawnShape(px, py, r, "#ff8899", false, 1.0)}
                          </g>
                        );
                      }
                      return <g key={`walkoff-${fanEvt.key}`}>{items}</g>;
                    })()}
                  </g>
                );
              })}

              {/* ── 🔊 AMP DECKS ── each Spirit's rig grows at their home corner;
                  radius ring pulses out while the acting Spirit aims a Sonic Attack ── */}
              <AmpDecks spirits={spirits} noteStates={noteStates} actingId={acting?.id}
                aiming={action === 'sonic' || hoverPreview === 'sonic'} thumpFx={deckThump}/>


              {/* Hexes */}
              {ALL_HEXES.map(hex => {
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const sp = spiritByNum[hex.num];

                return (
                  <g key={hex.num} className="hex-g"
                    onClick={() => onHexClick(hex.num)}
                    onMouseEnter={() => setHovered(hex.num)}
                    onMouseLeave={() => setHovered(null)}>
                    <polygon
                      points={pointyCorners(cx, cy, HS)}
                      fill={hexFill(hex)}
                      stroke={hexStroke(hex)}
                      strokeWidth={hexStrokeW(hex)}
                    />
                    {/* 🔪 REAR-WEDGE TELL — while you're aiming, any rival whose
                        unguarded back is turned to you gets a blade badge. The
                        bonus is worth nothing if the player only learns about
                        it in the combat log AFTER spending the AP, so it has to
                        be legible at aim time. Mirrors isHitFromBehind exactly;
                        if that rule moves, this moves with it. */}
                    {(() => {
                      const previewAction = action ?? hoverPreview;
                      if (!acting || !sp || sp.id === acting.id || sp.knockedOut) return null;
                      if (!['swing', 'smash', 'sonic', 'blaster'].includes(previewAction)) return null;
                      if (isHiddenBySmoke(sp)) return null;
                      const reach = (previewAction === 'sonic' || previewAction === 'blaster')
                        ? getSonicBeam(acting) : getSwingCone(acting);
                      if (!reach.has(hex.num) || !isHitFromBehind(acting, sp)) return null;
                      return (
                        <g style={{ pointerEvents: 'none' }}>
                          <circle cx={cx + HS * 0.62} cy={cy - HS * 0.62} r={HS * 0.3}
                            fill="#1a0510" stroke="#ff3366" strokeWidth={1.5}
                            style={{ filter: 'drop-shadow(0 0 6px #ff3366)' }}/>
                          <text x={cx + HS * 0.62} y={cy - HS * 0.62 + HS * 0.13}
                            textAnchor="middle" fontSize={HS * 0.36} fill="#ff87a8">🔪</text>
                        </g>
                      );
                    })()}

                    {/* Turn-start hex pulse. 👤 When the Ronin's turn opens, the
                        double pulses in lockstep with him — a single pulsing
                        standee would point straight at the real body. */}
                    {(() => {
                      const pulseSp = (pulsingHex === hex.num && sp) ? sp
                        : (shadowDecoy && hex.num === shadowDecoy.num
                            && pulsingHex != null && spiritByNum[pulsingHex]?.id === 'cosmic_ronin')
                          ? shadowDecoy : null;
                      if (!pulseSp) return null;
                      return (
                        <polygon
                          points={pointyCorners(cx, cy, HS * 1.18)}
                          fill="none"
                          stroke={pulseSp.color}
                          strokeWidth={3}
                          style={{
                            pointerEvents: "none",
                            animation: "hex-turn-pulse 1.8s ease-out forwards",
                            filter: `drop-shadow(0 0 8px ${pulseSp.color}) drop-shadow(0 0 16px ${pulseSp.color})`,
                          }}
                        />
                      );
                    })()}

                    {/* 🎸 CURSED SHAMISEN — its own board token. Sits on the
                        boards playing itself while it waits; once it wakes it
                        turns red, tilts, and drags itself after whoever is
                        closest. Swap SHAMISEN_ART for a PNG to replace the
                        vector placeholder. */}
                    {(() => {
                      const sham = noteStates['cosmic_ronin']?.cursedShamisen;
                      if (!sham || sham.hex !== hex.num) return null;
                      const hunting = !!sham.hunting;
                      const tint = hunting ? '#ff4422' : '#66aaff';
                      const glow = hunting ? '#ff2200' : '#4488ff';
                      const size = HS * 1.55;
                      return (
                        <g style={{pointerEvents:"none"}}>
                          <title>
                            {hunting
                              ? 'Cursed Shamisen — HUNTING. 3 rings, stalks the nearest Spirit, spares nobody. Walk onto its hex to calm it.'
                              : `Cursed Shamisen — ${sham.range} ring${sham.range !== 1 ? 's' : ''}. Walk onto its hex to calm it and take a bonus note.`}
                          </title>
                          {/* the sound itself: rings pulsing out of the body */}
                          <circle cx={cx} cy={cy} r={HS * 0.85} fill="none"
                            stroke={glow} strokeWidth={1.6} opacity={0.5}
                            style={{animation:`fx-ring ${hunting ? '1.1s' : '1.9s'} ease-out infinite`,
                              transformOrigin:`${cx}px ${cy}px`}}/>
                          <circle cx={cx} cy={cy} r={HS * 0.85} fill="none"
                            stroke={glow} strokeWidth={1.1} opacity={0.35}
                            style={{animation:`fx-ring ${hunting ? '1.1s' : '1.9s'} ease-out infinite`,
                              animationDelay: hunting ? '0.45s' : '0.8s',
                              transformOrigin:`${cx}px ${cy}px`}}/>
                          {/* shadow pooled under it */}
                          <ellipse cx={cx} cy={cy + HS * 0.34} rx={HS * 0.34} ry={HS * 0.12}
                            fill="#000" opacity={0.4}/>
                          {/* the instrument — hovers and sways; leans into its
                              stride once it's hunting */}
                          <g transform={`translate(${cx} ${cy - HS * 0.18}) scale(${size}) rotate(${hunting ? -13 : 0})`}
                            style={{animation: hunting
                              ? 'shamisen-stalk 0.9s ease-in-out infinite'
                              : 'shamisen-sway 3.4s ease-in-out infinite',
                              transformOrigin:`${cx}px ${cy}px`}}>
                            {SHAMISEN_ART
                              ? <image href={SHAMISEN_ART} x={-0.5} y={-1.4} width={1} height={2}
                                  preserveAspectRatio="xMidYMid meet"/>
                              : shamisenPlaceholder(tint, glow)}
                          </g>
                          {/* stage readout so nobody has to count rings */}
                          <text x={cx} y={cy + HS * 0.72} textAnchor="middle"
                            fontSize={HS * 0.32} fontWeight="900" fill={tint}
                            stroke="#000" strokeWidth={0.5} paintOrder="stroke"
                            style={{fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:0.5,
                              filter:`drop-shadow(0 0 4px ${glow})`}}>
                            {hunting ? '💀 HUNTING' : `${sham.range}◎`}
                          </text>
                        </g>
                      );
                    })()}

                    {/* 👤 SHADOW ILLUSION STANDEE — the body double.
                        This is a deliberate mirror of the real Spirit standee
                        below: same base-plate shadow, same glow ring, same
                        acting-turn drop-shadow, same sprite (mirrored on the
                        same facing rule), same Charge Zone and affliction auras
                        copied off the real Ronin. If you change the standee
                        below, change this too — any divergence becomes a tell
                        that lets rivals pick the real Ronin out instantly. */}
                    {shadowDecoy && hex.num === shadowDecoy.num && (() => {
                      const dsp = shadowDecoy;
                      const isActing = acting?.id === 'cosmic_ronin';
                      const isRumbling = rumblingIds.has('cosmic_ronin');
                      const sc = dsp.corner ? (CORNER_LABELS[dsp.corner]?.color ?? dsp.color) : dsp.color;
                      const baseR = HS * 0.62;
                      const cardW = HS * 3;
                      const cardH = HS * 3;
                      const cardX = cx - cardW / 2;
                      const cardY = cy - baseR - cardH + HS * 1;
                      const useMirror = isMirrorFacing(dsp.facing ?? 0);
                      const spriteSrc = useMirror
                        ? (MIRROR_SPRITES[dsp.id] ?? dsp.imageSrc)
                        : dsp.imageSrc;
                      const imgOffset = dsp.imageOffset ?? { x: 0, y: 0 };
                      const imgOffX = useMirror ? -imgOffset.x : imgOffset.x;
                      const nsR = noteStates['cosmic_ronin'] ?? {};
                      return (
                        <g key="shadow-token"
                          style={{ ...(isRumbling ? {animation:"rumble 0.08s linear infinite"} : {}) }}>
                          {/* Base plate shadow */}
                          <ellipse cx={cx+2} cy={cy+3} rx={baseR} ry={baseR*0.32}
                            fill="#000" opacity={0.35} style={{pointerEvents:"none"}}/>
                          {/* Base plate glow ring */}
                          <circle cx={cx} cy={cy} r={baseR}
                            fill={sc+"18"} stroke={sc}
                            strokeWidth={isActing ? 2.2 : 1.4}
                            style={{pointerEvents:"none"}}
                            filter={isActing ? `drop-shadow(0 0 4px ${sc})` : undefined}/>
                          {/* ⚡ Charge Zone aura — copied from the real Ronin */}
                          {(() => {
                            const qF = (nsR.chargeFloorTurns ?? 0) > 0;
                            const qC = (nsR.chargeCeilTurns  ?? 0) > 0;
                            if (!qF && !qC) return null;
                            const qCol = qF && qC ? '#cceeff' : qF ? '#ffcc44' : '#44aaff';
                            return (
                              <g style={{pointerEvents:'none'}}>
                                <circle cx={cx} cy={cy} r={baseR * 1.5} fill={qCol + '1c'}
                                  style={{animation:'charge-aura-pulse 1.5s ease-in-out infinite'}}/>
                                <circle cx={cx} cy={cy} r={baseR * 1.22} fill="none"
                                  stroke={qCol} strokeWidth={2.2}
                                  style={{animation:'charge-aura-pulse 1.5s ease-in-out infinite',
                                    filter:`drop-shadow(0 0 5px ${qCol}) drop-shadow(0 0 12px ${qCol})`}}/>
                                <text x={cx + baseR * 1.05} y={cy - baseR * 0.95}
                                  fontSize={HS * 0.52} textAnchor="middle"
                                  style={{animation:'charge-aura-pulse 1.5s ease-in-out infinite',
                                    filter:`drop-shadow(0 0 4px ${qCol})`}}>⚡</text>
                              </g>
                            );
                          })()}
                          {/* 🌀 Affliction aura — copied from the real Ronin */}
                          {(() => {
                            const afflictions = [
                              (nsR.mojoDrain ?? 0) > 0  && { icon:'💧', color:'#4499ff' },
                              nsR.stagger               && { icon:'⚡', color:'#ff8800' },
                              nsR.tripped               && { icon:'🌀', color:'#44ddff' },
                              nsR.dazed                 && { icon:'😵', color:'#ff66ff' },
                              nsR.instrumentDropped     && { icon:'🎸', color:'#ff4444' },
                            ].filter(Boolean);
                            if (afflictions.length === 0) return null;
                            const iconSize = HS * 0.42;
                            const rowW = afflictions.length * iconSize;
                            return (
                              <g style={{pointerEvents:"none"}}>
                                <circle cx={cx} cy={cy} r={baseR * 1.3}
                                  fill="none" stroke={afflictions[0].color} strokeWidth={2}
                                  strokeDasharray="5 6"
                                  style={{animation:"affliction-pulse 1.8s ease-in-out infinite",
                                    filter:`drop-shadow(0 0 5px ${afflictions[0].color})`}}/>
                                {afflictions.map((a, i) => (
                                  <text key={i}
                                    x={cx - rowW / 2 + iconSize * (i + 0.5)}
                                    y={cardY - HS * 0.78}
                                    textAnchor="middle" fontSize={iconSize}
                                    style={{animation:"affliction-pulse 1.8s ease-in-out infinite",
                                      filter:`drop-shadow(0 0 3px ${a.color})`}}>
                                    {a.icon}
                                  </text>
                                ))}
                              </g>
                            );
                          })()}
                          {/* Standee sprite — byte-identical to the real one */}
                          <image
                            href={spriteSrc}
                            x={cardX + imgOffX}
                            y={cardY + imgOffset.y}
                            width={cardW}
                            height={cardH}
                            preserveAspectRatio="xMidYMid meet"
                            style={{pointerEvents:"none"}}
                          />
                          {/* The ONLY difference, and only on the Ronin player's
                              own screen: a small dim pip so they don't lose
                              track of which body they actually control. */}
                          {seesShadowTell && (
                            <g style={{pointerEvents:"none"}}>
                              <title>Your Shadow Illusion — rivals see this as you.</title>
                              <circle cx={cx} cy={cy + baseR * 0.05} r={baseR * 0.30}
                                fill="#00000088" stroke={sc} strokeWidth={0.8} opacity={0.55}/>
                              <text x={cx} y={cy + baseR * 0.30} textAnchor="middle"
                                fontSize={HS * 0.34} opacity={0.75}>👤</text>
                            </g>
                          )}
                        </g>
                      );
                    })()}

                    {/* Spirit standee */}
                    {sp && !slideOffAnimations[sp.id] && (() => {
                      const isActing = acting?.id === sp.id;
                      const isRumbling = rumblingIds.has(sp.id);
                      const cornerColor = sp.corner ? (CORNER_LABELS[sp.corner]?.color ?? sp.color) : sp.color;
                      const sc = cornerColor;
                      const baseR = HS * 0.62;
                      const cardW = HS * 3;
                      const cardH = HS * 3;
                      const cardX = cx - cardW / 2;
                      const cardY = cy - baseR - cardH + HS * 1;
                      const useMirror = isMirrorFacing(sp.facing ?? 0);
                      const spriteSrc = useMirror
                        ? (MIRROR_SPRITES[sp.id] ?? sp.imageSrc)
                        : sp.imageSrc;
                      const imgOffset = sp.imageOffset ?? { x: 0, y: 0 };
                      // The mirror sprite flips the artwork horizontally, so any
                      // x-correction for off-centre art must flip with it — otherwise
                      // the standee drifts off its hex when facing left (the
                      // Metalness Monster bug).
                      const imgOffX = useMirror ? -imgOffset.x : imgOffset.x;
                      // 💨 SMOKE MACHINE — Spirits in the cloud are COMPLETELY hidden
                      // from view (visual only; never hides the acting Spirit).
                      const smokeHidden = isHiddenBySmoke(sp);
                      if (smokeHidden) return null; // completely erase any sign
                      // 6️⃣ BERSERK — the Beast is loose. While raging, the whole
                      // standee burns red: the art itself is tinted and haloed,
                      // not just ringed, so it's unmistakable across the board.
                      const berserking = !!noteStates[sp.id]?.berserk;
                      return (
                        <g key="spirit-token"
                          style={{
                            ...(isRumbling ? {animation:"rumble 0.08s linear infinite"} : {}),
                          }}>
                          {/* 6️⃣ BERSERK — rage aura under the standee */}
                          {berserking && (
                            <g style={{pointerEvents:'none'}}>
                              <title>BERSERK — the Beast is loose. +Drive uncapped, immune to knockback, 1 Vibe per attack.</title>
                              <circle cx={cx} cy={cy} r={baseR * 2.1} fill="#cc000022"
                                style={{animation:'berserk-glow 0.75s ease-in-out infinite'}}/>
                              <circle cx={cx} cy={cy} r={baseR * 1.55} fill="#ff000030"
                                stroke="#ff2200" strokeWidth={2.6}
                                style={{animation:'berserk-glow 0.75s ease-in-out infinite',
                                  filter:'drop-shadow(0 0 8px #ff0000) drop-shadow(0 0 20px #cc0000)'}}/>
                              <circle cx={cx} cy={cy} r={baseR * 1.15} fill="none"
                                stroke="#ff5522" strokeWidth={1.6} strokeDasharray="4 5"
                                style={{animation:'berserk-spin 2.4s linear infinite',
                                  transformOrigin:`${cx}px ${cy}px`}}/>
                            </g>
                          )}
                          {/* Base plate shadow */}
                          <ellipse cx={cx+2} cy={cy+3} rx={baseR} ry={baseR*0.32}
                            fill="#000" opacity={0.35} style={{pointerEvents:"none"}}/>
                          {/* Base plate glow ring */}
                          <circle cx={cx} cy={cy} r={baseR}
                            fill={sc+"18"} stroke={sc}
                            strokeWidth={isActing ? 2.2 : 1.4}
                            style={{pointerEvents:"none"}}
                            filter={isActing ? `drop-shadow(0 0 4px ${sc})` : undefined}/>
                          {/* 🎶 CURSED BY THE MELODY — this Spirit was inside the
                              Shamisen's rings when it last played. The mark sits
                              on them until the next time it plays, so you can see
                              at a glance exactly who the melody is eating. */}
                          {(noteStates['cosmic_ronin']?.cursedShamisen?.touched ?? []).includes(sp.id) && (
                            <g style={{pointerEvents:"none"}}>
                              <title>Caught in the Cursed Shamisen's melody — losing 1 a turn until it's calmed or you leave the rings.</title>
                              <circle cx={cx} cy={cy} r={baseR * 1.42} fill="none"
                                stroke="#cc88ff" strokeWidth={1.8} strokeDasharray="3 7"
                                style={{animation:"cursed-by-melody 1.6s ease-in-out infinite",
                                  transformOrigin:`${cx}px ${cy}px`,
                                  filter:"drop-shadow(0 0 6px #aa55ff)"}}/>
                              <text x={cx - baseR * 1.15} y={cy - baseR * 0.85}
                                textAnchor="middle" fontSize={HS * 0.44}
                                style={{animation:"cursed-by-melody 1.6s ease-in-out infinite",
                                  filter:"drop-shadow(0 0 4px #aa55ff)"}}>🎶</text>
                            </g>
                          )}
                          {/* ⚡ CHARGED — Charge Zone aura: floor=amber, ceiling=blue, both=white-hot */}
                          {(() => {
                            const nsQ = noteStates[sp.id] ?? {};
                            const qF = (nsQ.chargeFloorTurns ?? 0) > 0;
                            const qC = (nsQ.chargeCeilTurns  ?? 0) > 0;
                            if (!qF && !qC) return null;
                            const qCol = qF && qC ? '#cceeff' : qF ? '#ffcc44' : '#44aaff';
                            const qTip = qF && qC ? 'Fully charged — floor +2 AND dice up a size'
                              : qF ? `Floor charged — attack dice can't roll below ${1 + CHARGE_FLOOR_BONUS}`
                              : 'Ceiling charged — attack dice grow a size (d6→d8)';
                            return (
                              <g style={{pointerEvents:'none'}}>
                                <title>{qTip}</title>
                                <circle cx={cx} cy={cy} r={baseR * 1.5} fill={qCol + '1c'}
                                  style={{animation:'charge-aura-pulse 1.5s ease-in-out infinite'}}/>
                                <circle cx={cx} cy={cy} r={baseR * 1.22} fill="none"
                                  stroke={qCol} strokeWidth={2.2}
                                  style={{animation:'charge-aura-pulse 1.5s ease-in-out infinite',
                                    filter:`drop-shadow(0 0 5px ${qCol}) drop-shadow(0 0 12px ${qCol})`}}/>
                                <text x={cx + baseR * 1.05} y={cy - baseR * 0.95}
                                  fontSize={HS * 0.52} textAnchor="middle"
                                  style={{animation:'charge-aura-pulse 1.5s ease-in-out infinite',
                                    filter:`drop-shadow(0 0 4px ${qCol})`}}>⚡</text>
                              </g>
                            );
                          })()}
                          {/* Facing arrow now rendered as a top-layer hover overlay — see below */}
                          {/* 🌀 Persistent affliction aura — while ANY debuff is active,
                              a slow-pulsing dashed ring + status icons mark the victim */}
                          {(() => {
                            const nsB = noteStates[sp.id] ?? {};
                            const afflictions = [
                              (nsB.mojoDrain ?? 0) > 0  && { icon:'💧', color:'#4499ff', tip:'Mojo Drained' },
                              nsB.stagger               && { icon:'⚡', color:'#ff8800', tip:'Staggered' },
                              nsB.tripped               && { icon:'🌀', color:'#44ddff', tip:'Tripped' },
                              nsB.dazed                 && { icon:'😵', color:'#ff66ff', tip:'Dazed' },
                              nsB.instrumentDropped     && { icon:'🎸', color:'#ff4444', tip:'Dropped instrument' },
                            ].filter(Boolean);
                            if (afflictions.length === 0) return null;
                            const iconSize = HS * 0.42;
                            const rowW = afflictions.length * iconSize;
                            return (
                              <g style={{pointerEvents:"none"}}>
                                <circle cx={cx} cy={cy} r={baseR * 1.3}
                                  fill="none" stroke={afflictions[0].color} strokeWidth={2}
                                  strokeDasharray="5 6"
                                  style={{animation:"affliction-pulse 1.8s ease-in-out infinite",
                                    filter:`drop-shadow(0 0 5px ${afflictions[0].color})`}}/>
                                {afflictions.map((a, i) => (
                                  <text key={i}
                                    x={cx - rowW / 2 + iconSize * (i + 0.5)}
                                    y={cardY - HS * 0.78 /* one row up — the ✨ style tag owns the above-bar slot now */}
                                    textAnchor="middle" fontSize={iconSize}
                                    style={{animation:"affliction-pulse 1.8s ease-in-out infinite",
                                      filter:`drop-shadow(0 0 3px ${a.color})`}}>
                                    {a.icon}
                                  </text>
                                ))}
                              </g>
                            );
                          })()}
                          {/* Standee sprite — 6️⃣ BERSERK washes the art red and
                              makes it glow, so a raging Spirit is readable at a
                              glance without hunting for a badge. */}
                          <image
                            href={spriteSrc}
                            x={cardX + imgOffX}
                            y={cardY + imgOffset.y}
                            width={cardW}
                            height={cardH}
                            preserveAspectRatio="xMidYMid meet"
                            style={berserking
                              ? {pointerEvents:"none", animation:"berserk-standee 0.75s ease-in-out infinite"}
                              : {pointerEvents:"none"}}
                          />
                          {/* 6️⃣ BERSERK — flaming red overlay + tag above the head */}
                          {berserking && (
                            <g style={{pointerEvents:'none'}}>
                              <image
                                href={spriteSrc}
                                x={cardX + imgOffX}
                                y={cardY + imgOffset.y}
                                width={cardW}
                                height={cardH}
                                preserveAspectRatio="xMidYMid meet"
                                style={{mixBlendMode:'screen',
                                  filter:'brightness(0) drop-shadow(0 0 0 #ff0000) sepia(1) saturate(14) hue-rotate(-24deg)',
                                  animation:'berserk-wash 0.75s ease-in-out infinite'}}
                              />
                              <text x={cx} y={cardY - HS * 0.16} textAnchor="middle"
                                fontSize={HS * 0.46} fontWeight="900"
                                fill="#ff2200" stroke="#000" strokeWidth={1} paintOrder="stroke"
                                fontFamily="'Saira Stencil One',sans-serif"
                                style={{letterSpacing:1.5,
                                  animation:'berserk-glow 0.75s ease-in-out infinite',
                                  filter:'drop-shadow(0 0 6px #ff0000)'}}>
                                6️⃣ BERSERK
                              </text>
                            </g>
                          )}
                          {/* Respawn flash */}
                          {respawnFlashes[sp.id] && (
                            <circle cx={cx} cy={cy} r={baseR * 1.8}
                              fill={sc+"33"} stroke={sc} strokeWidth={2}
                              style={{pointerEvents:"none", animation:"life-pulse 0.3s ease-in-out infinite"}}/>
                          )}
                          {/* 🤘 MASTER OF MOSHPITS — fans flood in and rock the battered rival */}
                          {moshpitTargets[sp.id] && (() => {
                            const ring = baseR * 1.7;     // how far out the fans circle the rival
                            const fanW = HS * 1.5;        // crowd cluster size
                            // Six clusters ringed around the hex, alternating pink/blue fan art
                            const fans = [0,1,2,3,4,5].map(i => {
                              const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                              return {
                                i,
                                fx: cx + Math.cos(ang) * ring,
                                fy: cy + Math.sin(ang) * ring * 0.62, // squashed = pseudo-perspective
                                src: i % 2 === 0 ? crowdPinkImg : crowdBlueImg,
                                tilt: (i % 2 === 0 ? 4 : -4),
                                delay: (i * 0.07).toFixed(2),
                              };
                            });
                            return (
                              <g style={{pointerEvents:"none"}}>
                                {/* pulsing pit glow under the rival */}
                                <ellipse cx={cx} cy={cy} rx={ring*1.15} ry={ring*0.8}
                                  fill="#ffcc0022" stroke="#ffcc0066" strokeWidth={1.5}
                                  style={{animation:"life-pulse 0.5s ease-in-out infinite"}}/>
                                {fans.sort((a,b)=>a.fy-b.fy).map(f => (
                                  <image key={f.i} href={f.src}
                                    x={f.fx - fanW/2} y={f.fy - fanW/2}
                                    width={fanW} height={fanW}
                                    preserveAspectRatio="xMidYMid meet"
                                    style={{
                                      mixBlendMode:"screen",
                                      transformOrigin:`${f.fx}px ${f.fy}px`,
                                      ['--mosh-tilt']: `${f.tilt}deg`,
                                      animation:`moshpit-pop 0.22s ease-out ${f.delay}s both, moshpit-bob 0.5s ease-in-out ${f.delay}s infinite`,
                                    }}/>
                                ))}
                                {/* the rival is jostled — a little 🤘 over their head */}
                                <text x={cx} y={cardY - HS * 0.5} textAnchor="middle" fontSize={HS * 0.6}
                                  style={{animation:"moshpit-bob 0.4s ease-in-out infinite",
                                    filter:"drop-shadow(0 0 6px #ffcc00)"}}>🤘</text>
                              </g>
                            );
                          })()}
                          {/* 💥 Status-effect flash — shockwave rings + floating neon label */}
                          {effectFlashes.filter(f => f.spiritId === sp.id).map((f, fi) => (
                            <g key={f.key} style={{pointerEvents:"none"}}>
                              {/* expanding shockwave rings */}
                              <circle cx={cx} cy={cy} r={baseR * 1.1}
                                fill="none" stroke={f.color} strokeWidth={3}
                                style={{animation:"fx-ring 1.3s ease-out infinite",
                                  transformOrigin:`${cx}px ${cy}px`,
                                  filter:`drop-shadow(0 0 6px ${f.color})`}}/>
                              <circle cx={cx} cy={cy} r={baseR * 1.1}
                                fill="none" stroke={f.color} strokeWidth={2}
                                style={{animation:"fx-ring 1.3s ease-out infinite",
                                  animationDelay:"0.43s",
                                  transformOrigin:`${cx}px ${cy}px`}}/>
                              {/* hot core glow on the base plate */}
                              <circle cx={cx} cy={cy} r={baseR}
                                fill={f.color + "30"} stroke={f.color} strokeWidth={1.5}
                                style={{animation:"life-pulse 0.55s ease-in-out infinite",
                                  filter:`drop-shadow(0 0 8px ${f.color})`}}/>
                              {/* floating label */}
                              <g style={{animation:"fx-label 2.7s ease-out forwards"}}>
                                <text x={cx} y={cardY - HS * 0.62 - fi * HS * 0.58}
                                  textAnchor="middle" fontSize={HS * 0.5} fontWeight="900"
                                  fill={f.color} stroke="#000000" strokeWidth={1} paintOrder="stroke"
                                  style={{fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:1,
                                    filter:`drop-shadow(0 0 7px ${f.color})`}}>
                                  {f.icon} {f.label}
                                </text>
                              </g>
                            </g>
                          ))}
                          {/* 🎵 SPENT NOTES — notes literally leaving the Spirit.
                              Drive notes burned on an attack tear upward and
                              forward; Sustain notes knocked loose by a hit
                              scatter sideways. Both spin, shrink and fade out
                              to nothing, so "the stack just got shorter" is
                              something you SEE, not something you read in a log. */}
                          {spentNotes.filter(f => f.spiritId === sp.id).map(f => {
                            const isDrive = f.kind === 'drive';
                            const col     = isDrive ? '#ff6644' : '#44aaff';
                            // Fan the burst out: single note flies straight, a
                            // pair splits left/right, three spread wider still.
                            const spread  = f.n > 1 ? (f.i / (f.n - 1)) * 2 - 1 : 0;
                            const driftX  = spread * HS * 1.15 + (isDrive ? 0 : (f.i % 2 ? HS * 0.5 : -HS * 0.5));
                            const driftY  = isDrive ? -HS * 2.1 : -HS * 1.1;
                            const spin    = (isDrive ? 1 : -1) * (25 + spread * 45);
                            return (
                              <g key={f.key} style={{pointerEvents:'none'}}>
                                <g style={{
                                  transformOrigin: `${cx}px ${cy - baseR * 0.4}px`,
                                  animation: `spent-note-fly ${SPENT_NOTE_MS}ms cubic-bezier(.22,.7,.3,1) ${f.i * 0.18}s both`,
                                  ['--spent-dx']: `${driftX}px`,
                                  ['--spent-dy']: `${driftY}px`,
                                  ['--spent-rot']: `${spin}deg`,
                                }}>
                                  {/* the note glyph itself, ripped off the stack */}
                                  <text x={cx} y={cy - baseR * 0.4}
                                    textAnchor="middle" dominantBaseline="central"
                                    fontSize={HS * 0.62} fontWeight="900"
                                    fill={col} stroke="#000" strokeWidth={1.1} paintOrder="stroke"
                                    fontFamily="'Saira Stencil One',sans-serif"
                                    style={{filter:`drop-shadow(0 0 6px ${col}) drop-shadow(0 0 14px ${col}88)`}}>
                                    {String(f.note).toUpperCase()}
                                  </text>
                                  {/* trailing ♪ so it reads as a NOTE leaving, not a number */}
                                  <text x={cx + HS * 0.42} y={cy - baseR * 0.4 - HS * 0.26}
                                    textAnchor="middle" dominantBaseline="central"
                                    fontSize={HS * 0.34} fill={col} opacity={0.85}
                                    style={{filter:`drop-shadow(0 0 4px ${col})`}}>♪</text>
                                </g>
                              </g>
                            );
                          })}
                          {/* Floating damage numbers */}
                          {floatingDmg.filter(f => f.spiritId === sp.id).map(f => (
                            <text key={f.key}
                              x={cx} y={cardY}
                              textAnchor="middle"
                              fontSize={HS * 0.7}
                              fontWeight="bold"
                              fill="#ff4444"
                              stroke="#000" strokeWidth={0.5}
                              style={{pointerEvents:"none", animation:"floatUp 1.2s ease-out forwards"}}>
                              -{f.amount}
                            </text>
                          ))}
                          {/* Vibe health bar above standee */}
                          {(() => {
                            const barW = HS * 1.8;
                            const barH = HS * 0.18;
                            const barX = cx - barW / 2;
                            const barY = cardY - barH - 1;
                            const pct  = sp.vibe / sp.maxVibe;
                            const barColor = pct > 0.5 ? "#44cc66" : pct > 0.25 ? "#ffaa22" : "#ff4444";
                            // ✨ STYLE TAG — icon + tiny label in the Style's colour,
                            // sitting right above the Vibe bar.
                            const stDef = STYLE_DEFS[sp.style ?? styleOf(sp.id)];
                            const tagLabel = stDef?.label?.toUpperCase() ?? '';
                            return (
                              <g style={{pointerEvents:"none"}}>
                                {/* Style tag (above the bar) */}
                                <text x={cx} y={barY - HS * 0.09} textAnchor="middle"
                                  fontSize={HS * 0.30} fontFamily="'Saira Stencil One',sans-serif"
                                  fontWeight={700} letterSpacing={HS * 0.03}
                                  fill={stDef?.color ?? '#ffffff'}
                                  stroke="#000000cc" strokeWidth={HS * 0.05}
                                  paintOrder="stroke"
                                  style={{filter:`drop-shadow(0 0 2px ${stDef?.color ?? '#fff'}66)`}}>
                                  {stDef?.icon} {tagLabel}
                                </text>
                                {/* Track */}
                                <rect x={barX} y={barY} width={barW} height={barH}
                                  rx={barH/2} fill="#00000055"/>
                                {/* Fill */}
                                <rect x={barX} y={barY} width={barW * pct} height={barH}
                                  rx={barH/2} fill={barColor}
                                  style={{filter:`drop-shadow(0 0 2px ${barColor}88)`}}/>
                                {/* Border */}
                                <rect x={barX} y={barY} width={barW} height={barH}
                                  rx={barH/2} fill="none"
                                  stroke={sp.color+"66"} strokeWidth={0.4}/>
                              </g>
                            );
                          })()}
                        </g>
                      );
                    })()}
                  </g>
                );
              })}

              {/* Slide-off animations */}
              {Object.values(slideOffAnimations).map(anim => {
                const cornerColor = anim.corner ? (CORNER_LABELS[anim.corner]?.color ?? anim.color) : anim.color;
                return (
                  <g key={anim.id} style={{
                    transform: `translate(${anim.dx}px, ${anim.dy}px)`,
                    transition: "transform 4s cubic-bezier(0.3, 0, 1, 0.7)",
                    animation: "slideOff 4s ease-in forwards",
                  }}>
                    <image
                      href={anim.imageSrc}
                      x={anim.cx - HS * 1.5}
                      y={anim.cy - HS * 2.5}
                      width={HS * 3}
                      height={HS * 3}
                      preserveAspectRatio="xMidYMid meet"
                      style={{pointerEvents:"none"}}
                    />
                  </g>
                );
              })}

              {/* ── 🎲 SONIC DIE POOL CHIP — the acting Spirit's pool at their feet ── */}
              {acting && (() => {
                const spiritHex = HEX_BY_NUM[acting.num];
                if (!spiritHex) return null;
                const sc = acting.corner ? (CORNER_LABELS[acting.corner]?.color ?? acting.color) : acting.color;
                const sx = Math.round(spiritHex.px * SCALE);
                const sy = Math.round(spiritHex.py * SCALE);
                return (
                  <g style={{pointerEvents:'none'}}>
                    {/* 🎲 Die pool chip — the active Spirit's Sonic pool at their feet */}
                    {(() => {
                      const bw = HS * 1.25, bh = HS * 0.6;
                      const bx = sx - bw / 2, by = sy + HS * 0.5;
                      const inRig = actingRig.inRange;
                      const col = inRig ? sc : '#5a6a7a';
                      return (
                        <g>
                          <rect x={bx} y={by} width={bw} height={bh} rx={bh * 0.28}
                            fill="#070d18ee" stroke={col} strokeWidth={1.2}
                            style={inRig ? {filter:`drop-shadow(0 0 4px ${col}88)`} : undefined}/>
                          <text x={sx} y={by + bh * 0.56} textAnchor="middle" dominantBaseline="central"
                            fontSize={inRig ? bh * 0.56 : bh * 0.42} fontWeight="bold" fill={col}
                            fontFamily="'Saira Stencil One',sans-serif">
                            {inRig ? diceTier : 'OFF AIR'}
                          </text>
                          {!inRig && (
                            <text x={bx + bw - HS * 0.04} y={by + HS * 0.03} textAnchor="end" dominantBaseline="hanging"
                              fontSize={bh * 0.4} fill="#ff8844" fontFamily="monospace">📡</text>
                          )}
                        </g>
                      );
                    })()}
                  </g>
                );
              })()}

              {/* ── EVENT HEXES — neon marquee stars ── */}
              {eventHexes.map(num => {
                const hex = HEX_BY_NUM[num];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.52;
                // 4-point sparkle star path
                const star = `M ${cx} ${cy - r} Q ${cx + r*0.18} ${cy - r*0.18} ${cx + r} ${cy} ` +
                             `Q ${cx + r*0.18} ${cy + r*0.18} ${cx} ${cy + r} ` +
                             `Q ${cx - r*0.18} ${cy + r*0.18} ${cx - r} ${cy} ` +
                             `Q ${cx - r*0.18} ${cy - r*0.18} ${cx} ${cy - r} Z`;
                return (
                  <g key={`ev-${num}`} style={{pointerEvents:'none', color:'#ff44dd',
                    animation:'event-hex-pulse 1.8s ease-in-out infinite',
                    animationDelay:`${(num % 5) * 0.25}s`}}>
                    {/* Hex ring */}
                    <polygon
                      points={pointyCorners(cx, cy, HS * 0.96)}
                      fill="#ff44dd14" stroke="#ff44dd" strokeWidth={1.4}
                      strokeDasharray="5 3"/>
                    {/* Sparkle star */}
                    <path d={star} fill="#ff88ee" stroke="#ffffff" strokeWidth={0.6} opacity={0.95}/>
                    {/* EVENT label */}
                    <text x={cx} y={cy + HS * 0.78} textAnchor="middle"
                      fontSize={6.5} fill="#ff88ee" letterSpacing={1.5}
                      fontFamily="'Saira Stencil One',sans-serif" fontWeight={700}>EVENT</text>
                  </g>
                );
              })}

              {/* ── FLAMING DISCS — Disco Inferno hazard ── */}
              {flamingHexes.roundsLeft > 0 && flamingHexes.hexes.map(num => {
                const hex = HEX_BY_NUM[num];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.46;
                return (
                  <g key={`fd-${num}`} style={{pointerEvents:'none'}}>
                    {/* Scorch glow on the hex */}
                    <polygon
                      points={pointyCorners(cx, cy, HS * 0.96)}
                      fill="#ff440018" stroke="#ff6622" strokeWidth={1}
                      style={{filter:'drop-shadow(0 0 5px #ff662288)'}}/>
                    {/* Vinyl disc */}
                    <circle cx={cx} cy={cy + r*0.18} r={r*0.62} fill="#120a08" stroke="#ff8844" strokeWidth={1}/>
                    <circle cx={cx} cy={cy + r*0.18} r={r*0.36} fill="none" stroke="#ff884466" strokeWidth={0.7}/>
                    <circle cx={cx} cy={cy + r*0.18} r={r*0.12} fill="#ffaa55"/>
                    {/* Flames */}
                    <g style={{animation:'flame-flicker 0.55s ease-in-out infinite',
                      animationDelay:`${(num % 4) * 0.13}s`, transformOrigin:`${cx}px ${cy}px`}}>
                      <text x={cx} y={cy - r*0.12} textAnchor="middle" fontSize={r*1.05}
                        style={{filter:'drop-shadow(0 0 4px #ff6622)'}}>🔥</text>
                    </g>
                  </g>
                );
              })}

              {/* ── POISON SLIME — Metalness Monster passive hazard.
                  The trail now lives a full round, so each tile fades as its
                  turns run out: a bright pool is fresh, a faint one is about to
                  dry up. Rivals can read how long they have to detour. ── */}
              {(() => {
                const slimeLife = Math.max(1, spirits.filter(s => !s.knockedOut).length);
                return Object.entries(poisonSlime).map(([num, turns]) => {
                  if (turns <= 0) return null;
                  const hex = HEX_BY_NUM[Number(num)];
                  if (!hex) return null;
                  const cx = Math.round(hex.px * SCALE);
                  const cy = Math.round(hex.py * SCALE);
                  // 0.35 → 1 as freshness goes from "one turn left" to "just laid"
                  const fresh = Math.min(1, turns / slimeLife);
                  const op = 0.35 + fresh * 0.65;
                  return (
                    <g key={`slime-${num}`} style={{pointerEvents:'none', opacity: op}}>
                      <title>Poison Slime — 1 Vibe to anyone who enters. {turns} turn{turns !== 1 ? 's' : ''} left.</title>
                      <polygon
                        points={pointyCorners(cx, cy, HS * 0.92)}
                        fill="#44ff4418" stroke="#44ff44" strokeWidth={0.8}
                        style={{filter:'drop-shadow(0 0 6px #44ff4466)',
                          animation:'slimePulse 1.8s ease-in-out infinite',
                          animationDelay:`${(Number(num) % 5) * 0.2}s`}}/>
                      <text x={cx} y={cy + HS*0.12} textAnchor="middle" fontSize={HS*0.5}
                        style={{opacity:0.7, filter:'drop-shadow(0 0 3px #44ff44)'}}>🧪</text>
                    </g>
                  );
                });
              })()}

              {/* ── BOARD TOKENS — Lost Chords (free notes into your stock) ── */}
              {boardTokens.map(tok => {
                const hex = HEX_BY_NUM[tok.num];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.32;
                return (
                  <g key={`tok-${tok.num}`} style={{pointerEvents:'none',
                    animation:'event-hex-pulse 1.6s ease-in-out infinite',
                    animationDelay:`${(tok.num % 7) * 0.18}s`}}>
                    <circle cx={cx} cy={cy} r={r} fill="#0a1828" stroke="#44ccff" strokeWidth={1} opacity={0.96}/>
                    <text x={cx} y={cy + r*0.34} textAnchor="middle" fontSize={r*1.05}
                      fontFamily="'Share Tech Mono',monospace" fontWeight="700" fill="#7fe0ff">{tok.note}</text>
                  </g>
                );
              })}

              {/* ── CHARGE ZONES — fixed lightning hexes (⚡ die-tier boost / Overcharge) ── */}
              {chargeZones.map(zone => {
                const hex = HEX_BY_NUM[zone.num];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.5;
                const ready = (zone.cooldown ?? 0) <= 0;
                const col = ready ? '#44aaff' : '#284866';
                return (
                  <g key={`charge-${zone.num}`} style={{pointerEvents:'none',
                    animation: ready ? 'event-hex-pulse 1.5s ease-in-out infinite' : undefined,
                    animationDelay:`${(zone.num % 6) * 0.2}s`, opacity: ready ? 1 : 0.55}}>
                    <polygon points={pointyCorners(cx, cy, HS * 0.9)}
                      fill={ready ? '#0a1830' : '#0a1220'} stroke={col} strokeWidth={ready ? 1.4 : 1}
                      strokeDasharray={ready ? undefined : '4 3'}
                      style={ready ? {filter:'drop-shadow(0 0 6px #2266ff88)'} : undefined}/>
                    <text x={cx} y={cy + r*0.32} textAnchor="middle" fontSize={r*1.05}
                      style={ready ? {filter:'drop-shadow(0 0 4px #44aaff)'} : undefined}>⚡</text>
                    {!ready && (
                      <text x={cx} y={cy + HS*0.72} textAnchor="middle" fontSize={6.5} fill="#3a5a7a"
                        fontFamily="'Saira Stencil One',sans-serif">{zone.cooldown}t</text>
                    )}
                  </g>
                );
              })}

              {/* ── BOARD CARDS — floating face-down card icons ── */}
              {boardCards.map(bc => {
                const hex = HEX_BY_NUM[bc.hexNum];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.42;
                return (
                  <g key={bc.id} style={{pointerEvents:'none',
                    animation:`card-float 2.4s ease-in-out infinite`,
                    animationDelay:`${(bc.hexNum % 7) * 0.3}s`}}>
                    {/* Card body */}
                    <rect x={cx - r*0.62} y={cy - r*0.9} width={r*1.24} height={r*1.7}
                      rx={r*0.16} ry={r*0.16}
                      fill="#0d1530" stroke="#aa88ff" strokeWidth={1.2}
                      style={{filter:'drop-shadow(0 0 4px #aa88ff88)'}}/>
                    {/* Card back pattern — subtle cross */}
                    <line x1={cx - r*0.4} y1={cy - r*0.7} x2={cx + r*0.4} y2={cy + r*0.7}
                      stroke="#aa88ff33" strokeWidth={0.8}/>
                    <line x1={cx + r*0.4} y1={cy - r*0.7} x2={cx - r*0.4} y2={cy + r*0.7}
                      stroke="#aa88ff33" strokeWidth={0.8}/>
                    {/* Question mark */}
                    <text x={cx} y={cy + r*0.18} textAnchor="middle"
                      fontSize={r*0.82} fill="#aa88ff" style={{pointerEvents:'none',fontWeight:700}}>?</text>
                    {/* Subtle glow ring */}
                    <ellipse cx={cx} cy={cy + r*0.9} rx={r*0.55} ry={r*0.12}
                      fill="#aa88ff22"/>
                  </g>
                );
              })}

              {/* 💥 Floating combat numbers — drift up over the affected hex */}
              {damageFx.map(d => {
                const h = HEX_BY_NUM[d.hexNum];
                if (!h) return null;
                const cx = Math.round(h.px * SCALE);
                const cy = Math.round(h.py * SCALE);
                return (
                  <text key={d.key} x={cx} y={cy - HS * 1.5} textAnchor="middle"
                    fontSize={HS * 0.7} fontWeight="bold" fill={d.color}
                    stroke="#000" strokeWidth={0.6}
                    style={{pointerEvents:'none', animation:'floatUp 1.2s ease-out forwards',
                      filter:`drop-shadow(0 0 5px ${d.color})`, fontFamily:"'Saira Stencil One',sans-serif"}}>
                    {d.text}
                  </text>
                );
              })}

              <ScoreTrackOverlay spirits={spirits} startingLives={startingLives} />

              {/* ── NEON FACING ARROW — top layer, hover only ── */}
              {(() => {
                if (hovered === null) return null;
                const hovHex = HEX_BY_NUM[hovered];
                if (!hovHex) return null;
                // 👤 The decoy gets a facing arrow too — a standee that doesn't
                // answer the hover would be the loudest tell on the board.
                const sp = spirits.find(s => s.num === hovered && !s.knockedOut)
                  ?? (shadowDecoy && shadowDecoy.num === hovered ? shadowDecoy : null);
                if (!sp || isHiddenBySmoke(sp)) return null; // 💨 no arrow for smoke-hidden spirits
                const cx  = Math.round(hovHex.px * SCALE);
                const cy  = Math.round(hovHex.py * SCALE);
                const f   = sp.facing ?? 0;
                const sc  = sp.corner ? (CORNER_LABELS[sp.corner]?.color ?? sp.color) : sp.color;
                // Arrow starts at edge of hex, tip reaches ~1.6 hexes out
                const tailR = HS * 0.72;
                const tipR  = HS * 2.6;
                const x1 = cx + Math.cos(f) * tailR;
                const y1 = cy + Math.sin(f) * tailR;
                const x2 = cx + Math.cos(f) * tipR;
                const y2 = cy + Math.sin(f) * tipR;
                // Arrowhead
                const wingAngle = 0.45;
                const wingLen   = HS * 0.55;
                const wx1 = x2 + Math.cos(f + Math.PI - wingAngle) * wingLen;
                const wy1 = y2 + Math.sin(f + Math.PI - wingAngle) * wingLen;
                const wx2 = x2 + Math.cos(f + Math.PI + wingAngle) * wingLen;
                const wy2 = y2 + Math.sin(f + Math.PI + wingAngle) * wingLen;
                const filterId = `neon-arrow-${sp.id}`;
                return (
                  <g style={{pointerEvents:"none"}}>
                    <defs>
                      <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="2.8" result="blur"/>
                        <feMerge>
                          <feMergeNode in="blur"/>
                          <feMergeNode in="blur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Glow layer */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={sc} strokeWidth={7} strokeLinecap="round" opacity={0.35}
                      filter={`url(#${filterId})`}/>
                    {/* Shaft */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={sc} strokeWidth={2.8} strokeLinecap="round"
                      filter={`url(#${filterId})`}/>
                    {/* Bright core */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="#ffffff" strokeWidth={1.0} strokeLinecap="round" opacity={0.75}/>
                    {/* Arrowhead wings — glow */}
                    <line x1={x2} y1={y2} x2={wx1} y2={wy1}
                      stroke={sc} strokeWidth={7} strokeLinecap="round" opacity={0.35}
                      filter={`url(#${filterId})`}/>
                    <line x1={x2} y1={y2} x2={wx2} y2={wy2}
                      stroke={sc} strokeWidth={7} strokeLinecap="round" opacity={0.35}
                      filter={`url(#${filterId})`}/>
                    {/* Arrowhead wings — solid */}
                    <line x1={x2} y1={y2} x2={wx1} y2={wy1}
                      stroke={sc} strokeWidth={2.8} strokeLinecap="round"
                      filter={`url(#${filterId})`}/>
                    <line x1={x2} y1={y2} x2={wx2} y2={wy2}
                      stroke={sc} strokeWidth={2.8} strokeLinecap="round"
                      filter={`url(#${filterId})`}/>
                    {/* Arrowhead wings — bright core */}
                    <line x1={x2} y1={y2} x2={wx1} y2={wy1}
                      stroke="#ffffff" strokeWidth={1.0} strokeLinecap="round" opacity={0.75}/>
                    <line x1={x2} y1={y2} x2={wx2} y2={wy2}
                      stroke="#ffffff" strokeWidth={1.0} strokeLinecap="round" opacity={0.75}/>
                  </g>
                );
              })()}

              {/* ── 🤘 ROCK GOD — telegraphs + the God's standee + HP bar ── */}
              <RockGodBoardLayer god={rockGod} HS={HS} SCALE={SCALE} />

              {/* ── 🎇 STAGE EFFECTS — smoke cloud / lasers / pyro / animatronics.
                  Mounted late so the smoke draws OVER the standees. ── */}
              <StageFXBoardLayer smokeFx={smokeFx} laserFx={laserFx} pyroFx={pyroFx}
                animatronics={animatronics} HS={HS} SCALE={SCALE} />

              {/* ── ❓ THE UNSURE CROWD — a neutral audience watching from the foreground, below
                  the stage. When a Spirit wins them over they light up, cheer, and stream home. ── */}
              {(() => {
                const shown = Math.min(unsurePool, 18);
                if (shown <= 0 && !unsureFx) return null;
                const centerX = SVG_W / 2;
                const baseY   = SVG_H - HS * 0.95;     // sit at the very front, below the octagon
                const colGap  = HS * 0.62;
                const perRow  = 9;
                const u       = HS * 0.48;             // bigger than home fans → reads as foreground
                const winning = !!unsureFx;
                const neutral = '#9a86c0';
                const winColor = unsureFx?.color ?? neutral;

                // one audience pawn (hollow when undecided, fills with colour once won over)
                const member = (x, y, scale, col, excited, i) => {
                  const r = u * scale * 1.3;
                  const dur = (3.0 + (i % 4) * 0.35).toFixed(2);
                  const delay = ((i % 7) * 0.12).toFixed(2);
                  return (
                    <g key={`uns-${i}`} style={{transformBox:'fill-box', transformOrigin:'center',
                      animation: excited ? 'unsure-excited 0.45s ease-in-out infinite'
                                         : `fan-bob ${dur}s ease-in-out infinite`,
                      animationDelay: `${delay}s`}}>
                      {fanPawnShape(x, y, r, col, excited, 1.2, 1, i, false, excited ? 'wave' : null)}
                    </g>
                  );
                };

                const members = [];
                for (let i = 0; i < shown; i++) {
                  const row = Math.floor(i / perRow);
                  const rowN = Math.min(perRow, shown - row * perRow);
                  const col = i % perRow;
                  const x = centerX + (col - (rowN - 1) / 2) * colGap + (row % 2 ? colGap * 0.4 : 0);
                  const y = baseY - row * (u * 1.45);
                  const scale = 1 - row * 0.16;        // back rows smaller → depth
                  members.push(member(x, y, scale, winning ? winColor : neutral, winning, i));
                }

                // won-over defectors streaming up to the Spirit's home corner
                let flyers = null;
                if (unsureFx) {
                  const homeHex = HEX_BY_NUM[CORNERS[spirits.find(s => s.id === unsureFx.spiritId)?.corner]?.homeNum];
                  if (homeHex) {
                    const hx = homeHex.px * SCALE, hy = homeHex.py * SCALE;
                    const nFly = Math.min(unsureFx.n, 10);
                    const arr = [];
                    for (let k = 0; k < nFly; k++) {
                      const sxk = centerX + (k - (nFly - 1) / 2) * colGap * 0.7;
                      const syk = baseY - u * 0.4;
                      const dx = hx - sxk, dy = hy - syk;
                      arr.push(
                        <g key={`fly-${unsureFx.key}-${k}`}
                           style={{animation:'unsure-fly 1.5s ease-in-out both',
                             animationDelay:`${(k * 0.05).toFixed(2)}s`,
                             ['--tx']:`${dx.toFixed(1)}px`, ['--ty']:`${dy.toFixed(1)}px`}}>
                          <g style={{transform:`translate(${sxk}px, ${syk}px)`}}>
                            <g style={{transformBox:'fill-box', transformOrigin:'center',
                              animation:'unsure-excited 0.4s ease-in-out infinite'}}>
                                                            {fanPawnShape(0, 0, u * 1.3, winColor, true, 1.0, 1, 0, false, 'wave')}
                            </g>
                          </g>
                        </g>
                      );
                    }
                    flyers = <g>{arr}</g>;
                  }
                }

                return (
                  <g style={{pointerEvents:'none'}}>
                    <defs>
                      <linearGradient id="unsure-floor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#140b26" stopOpacity={0}/>
                        <stop offset="100%" stopColor="#140b26" stopOpacity={0.85}/>
                      </linearGradient>
                    </defs>
                    {/* a soft floor so the row reads as a front-row audience */}
                    <rect x={0} y={baseY - u * 2.4} width={SVG_W} height={u * 3.6} fill="url(#unsure-floor)"/>
                    {members}
                    {flyers}
                    {shown > 0 && !unsureFx && (
                      <text x={centerX} y={baseY + u * 1.0} textAnchor="middle" fontSize={HS * 0.32}
                        fill={neutral} opacity={0.85} fontFamily="monospace"
                        style={{filter:'drop-shadow(0 0 2px #000)'}}>
                        ❓ {unsurePool} UNSURE — win them over centre-stage
                      </text>
                    )}
                    {unsureFx && (
                      <text x={centerX} y={baseY + u * 1.0} textAnchor="middle" fontSize={HS * 0.4} fontWeight="bold"
                        fill={winColor} fontFamily="'Saira Stencil One',sans-serif"
                        style={{filter:`drop-shadow(0 0 5px ${winColor})`}}>
                        🎉 WON OVER!
                      </text>
                    )}
                  </g>
                );
              })()}
            </svg>
            {/* 🎇 Stage Effect activation marquee + active-effect status pills */}
            <StageFXBanner banner={stageFxBanner} smokeFx={smokeFx} laserFx={laserFx}
              pyroFx={pyroFx} animatronics={animatronics} />
            {/* 🤘 Rock God descent marquee + HP / clock / telegraph warnings */}
            <RockGodHUD god={rockGod} banner={godBanner} timer={bossTimer}
              bossOutcome={bossOutcome} />
          </div>
        </div>

        {/* Right panel removed — Crowd → header blip · Mod Cards → spirit card banner · Turn Order/Log dropped. */}
      </div>
    </div>
  );
}
