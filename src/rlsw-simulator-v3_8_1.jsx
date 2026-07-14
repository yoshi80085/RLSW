import boardImg from "./board.png";
import boardOutlineImg from "./board_outline.png";
import battleMeterImg from "./Battle_Meter.png";
import battlePickImg from "./battle_pick.png";
import crowdPinkImg from "./crowd_pink.png";   // fan-fare — attacker (left) cheering section
import crowdBlueImg from "./crowd_blue.png";   // fan-fare — defender (right) cheering section
import groupieFansImg from "./groupie_fans.png"; // 3×3 sheet of neon rock-fan silhouettes → groupie icons
import hydraImg from "./hydra.PNG";            // 🐉 Shredding Ronin — Hydra ability backdrop (3 heads / 3 beams)
import { SPIRIT_DEFS, SPIRIT_OPTIONS } from "./data/spirits.js";
import { CORNERS, CORNER_LABELS, CORNERS_ORDER } from "./data/corners.js";
import { HEX_SIZE, SCALE, SVG_W, SVG_H } from "./board/constants.js";
import { HEX_BY_NUM, HEX_BY_QR, ALL_HEXES } from "./board/hexMap.js";
import { pointyCorners, fanGesture, axialDist, axialNeighbors, getFlatTopNeighborSlots, angleTo, angleDiff, neighborInDirection, grandstandSeat, grandstandArc, grandstandRowSpan } from "./board/hexGeometry.js";
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
import { ampLinked, ampMstEdges, computeAmpRigs } from "./board/ampRigs.js";
import { hexRingFromCenter, crowdMultiplier, advanceHC, SPOTLIGHT_POOL } from "./board/boardHelpers.js";
import { getRiffAudio, riffDegreeFreq, playRiffWrong, pickGlitchRiffNote, playRiffMiss, playBeamClash, playBeamSurge, playBeamBreak, playFanPop } from "./audio/riffSfx.js";
import { RIFF_CONTOUR_LABELS, RIFF_ANSWER_LABELS, riffDegreesToNotes } from "./riff/riffGeneration.js";
import { RIFF_FALL_DIFFICULTY, RIFF_FALL_DEFAULT, buildRiffTimeline, riffOkWindow, gradeRiffOffset } from "./riff/fallingNotes.js";
import { Lobby } from "./ui/Lobby.jsx";
import OpeningMovie from "./ui/OpeningMovie.jsx";
import { BeginnerTipOverlay } from "./ui/BeginnerTipOverlay.jsx";
import { isMirrorFacing, MIRROR_SPRITES, mobileColorStyle, GameErrorBoundary } from "./ui/GameErrorBoundary.jsx";
import { useStageEffects } from "./hooks/useStageEffects.js";
import { useRockGod } from "./hooks/useRockGod.js";
import { ROCK_GODS, ROCK_GOD_RUNAWAY_LEAD, ROCK_GOD_TIMER_SECONDS, ROCK_GOD_VENGEANCE_DMG, ROCK_GOD_KILL_BLOW_FP, pickRockGod, godTauntLine } from "./data/rockGods.js"; // HP scaling moved into the engine (Phase 6c)
import { freeNeighborHex } from "./board/rockGodFx.js"; // AoE/slide/shove geometry moved into the engine (Phase 6c)
import { RockGodBoardLayer, RockGodHUD, GodVictoryOverlay } from "./ui/RockGodLayer.jsx";
import { STAGE_FX_THRESHOLDS, STAGE_FX_META, SMOKE_ROUNDS, LASER_ROUNDS, LASER_DAMAGE, PYRO_WAVES, PYRO_DAMAGE, PYRO_BURN_TURNS, ANIMATRONIC_TURNS, ANIMATRONIC_DAMAGE } from "./data/stageEffects.js"; // tuning the engine consumes directly (counts/radii/waves) moved with the 6b flip
import { hexInSmoke, hexInBeams } from "./board/stageFx.js"; // pattern/spawn rolls moved into the engine (Phase 6b)
import { StageFXBoardLayer, StageFXBanner } from "./ui/StageFXLayer.jsx";
import { makeInitialState } from "./engine/state.js";
import { applyAction } from "./engine/reduce.js";
import { turnStarted, turnEnded, turnSkipped, moveBudgetSet, moveStep as engineMoveStep, beatsSpent, spiritWarped, spiritFaced, spiritEliminated, spiritsSynced, spiritPatched, riffOffStarted, riffResultsSubmitted, riffResolved, riffRound2Started, riffClosed, attackRolled, damageApplied, knockdownResolved, winnerDeclared, noteStatesSynced, fameChanged, fansChanged, noteSheetPatched, fansTicked, debuffsTicked, burnTicked, stageFxDrawn, stageFxActivated, stageFxTurnTicked, stageFxRoundTicked, godSummoned as godSummonedAction, godDamaged as godDamagedAction, godActed as godActedAction, godDefeated as godDefeatedAction, godTriumphed as godTriumphedAction, godTimerExpired as godTimerExpiredAction, spotlightHealed, spotlightMoved, tokensScattered, flamingDecayed, eventRespawnTicked, eventHexSpawned, chargeZonesTicked, eventHexTriggered, thrashTokensSpawned, tokenPickedUp, chargeZoneUsed, flamingHexesSet, randomBatchDrawn } from "./engine/actions.js";
import { riffStats } from "./engine/systems/riffOff.js";
import { marginToDamage, fameFromMargin, knockbackSpaces, underdogBonus as engineUnderdogBonus, smashOutcome, decideWinner, counterOutcome, thrashDamage, thrashKnockback, thrashFame, sonicDamage, sonicKnockback, sonicFame } from "./engine/systems/combat.js";
import { usedHas, usedList, usedAdd, performanceScore, makeInitialNoteState } from "./engine/systems/economy.js";
import { skillEligibility, THEORY_DISCORD_GRANTS, CQC_SWING_MAP } from "./engine/systems/skills.js";
import {
  BOT_PERSONALITIES, BOT_PERSONA_KEYS, BOT_SKILL_PRIORITY_BASE, BOT_SPIRIT_SKILLS,
  SPIRIT_ONLY_ROUTE, BOT_RIFF_PROFILE,
  botAssignPersona, botPickTarget as _botPickTarget, botHexScore as _botHexScore,
  botSkillEligible as _botSkillEligible, botPickSkillTarget as _botPickSkillTarget,
  botRiffResults as _botRiffResults,
  botPlanNoteStep as _botPlanNoteStep, botSpiritChord,
  botPlanRevoice as _botPlanRevoice,
  botPlanMove as _botPlanMove, botRivalsWithin as _botRivalsWithin,
} from "./engine/policies/bot.js";


// 🎟️ A fan = a sleek "pawn": a detached round head above a rounded-triangle body.
// Deliberately plain — fans are the crowd, not characters. `filled` marks a diehard
// (solid, owner colour) vs a casual (hollow outline). Centred vertically on (x, y).
// `face` (0..5, or null) picks an animated expression so the crowd reads as a sea
// of cheering, singing-along faces rather than blank pawns.
// `bodyFlip` mirrors the body silhouette upside-down (broad shoulders → tapered) so
// the crowd isn't all the same outline. `hands` adds floating circle hands (no arm
// lines — they read cleanly at crowd scale): 'rest' | 'wave' | 'fist' (devil horns) |
// 'lighter' | 'phone'. NO Math.random() in here, or the crowd reshuffles on re-render.
function fanPawnShape(x, y, r, color, filled, sw = 1.2, op = 1, face = null, bodyFlip = false, hands = null) {
  r = r * 1.15; // a tad bigger — the crowd earns its presence
  const headR = r * 0.42, headCy = y - r * 0.86;
  const apexY = y - r * 0.30, baseY = y + r * 0.74, halfW = r * 0.66;
  const detail = headR > 2.4;                 // tiny fans stay simple — the perf valve

  // ── BODY — the classic rounded triangle ──
  const body =
    `M ${x} ${apexY}` +
    ` C ${x - halfW * 0.5} ${apexY + r * 0.16}, ${x - halfW} ${baseY - r * 0.42}, ${x - halfW} ${baseY - r * 0.12}` +
    ` Q ${x - halfW} ${baseY}, ${x - halfW * 0.55} ${baseY}` +
    ` L ${x + halfW * 0.55} ${baseY}` +
    ` Q ${x + halfW} ${baseY}, ${x + halfW} ${baseY - r * 0.12}` +
    ` C ${x + halfW} ${baseY - r * 0.42}, ${x + halfW * 0.5} ${apexY + r * 0.16}, ${x} ${apexY} Z`;

  // ── FACE — only drawn when a variant is requested and the head is big enough
  // to carry detail. Features sit in a contrasting ink so they read on solid
  // (diehard) and hollow (casual) heads alike. Six variants now — twice the moods.
  let faceEls = null;
  if (face !== null && headR > 2.4) {
    const ink     = filled ? '#0a0e18' : color;   // dark ink on solid heads, glow on hollow
    const v       = ((face % 6) + 6) % 6;
    const eyeY    = headCy - headR * 0.10;
    const eyeDX   = headR * 0.42;
    const eyeR    = headR * 0.20;
    const mouthY  = headCy + headR * 0.34;
    const fsw     = Math.max(0.45, headR * 0.16);
    // Stagger the mouth/blink loops by face index so the crowd never moves in lockstep.
    const singDur = (0.9 + v * 0.18).toFixed(2);
    const singDelay = (v * 0.21).toFixed(2);
    const blinkDur = (4.2 + v * 0.7).toFixed(2);
    const blinkDelay = (v * 0.9).toFixed(2);

    // Eyes: dot eyes for most, happy "^ ^" arcs for the stoked variant (2).
    const dotEyes = (
      <g style={{animation:`fan-blink ${blinkDur}s ease-in-out infinite`, animationDelay:`${blinkDelay}s`,
        transformBox:'fill-box', transformOrigin:'center'}}>
        <circle cx={x - eyeDX} cy={eyeY} r={eyeR} fill={ink}/>
        <circle cx={x + eyeDX} cy={eyeY} r={eyeR} fill={ink}/>
      </g>
    );
    const happyEyes = (
      <g>
        <path d={`M ${x - eyeDX - headR*0.24} ${eyeY + headR*0.08} Q ${x - eyeDX} ${eyeY - headR*0.26} ${x - eyeDX + headR*0.24} ${eyeY + headR*0.08}`}
          fill="none" stroke={ink} strokeWidth={fsw} strokeLinecap="round"/>
        <path d={`M ${x + eyeDX - headR*0.24} ${eyeY + headR*0.08} Q ${x + eyeDX} ${eyeY - headR*0.26} ${x + eyeDX + headR*0.24} ${eyeY + headR*0.08}`}
          fill="none" stroke={ink} strokeWidth={fsw} strokeLinecap="round"/>
      </g>
    );
    // Blissed-out closed eyes — lids drawn as gentle downward arcs (lost in the music)
    const closedEyes = (
      <g>
        <path d={`M ${x - eyeDX - headR*0.24} ${eyeY - headR*0.06} Q ${x - eyeDX} ${eyeY + headR*0.22} ${x - eyeDX + headR*0.24} ${eyeY - headR*0.06}`}
          fill="none" stroke={ink} strokeWidth={fsw} strokeLinecap="round"/>
        <path d={`M ${x + eyeDX - headR*0.24} ${eyeY - headR*0.06} Q ${x + eyeDX} ${eyeY + headR*0.22} ${x + eyeDX + headR*0.24} ${eyeY - headR*0.06}`}
          fill="none" stroke={ink} strokeWidth={fsw} strokeLinecap="round"/>
      </g>
    );
    // A cheeky wink — one open dot eye, one flat closed lid
    const winkEyes = (
      <g>
        <circle cx={x - eyeDX} cy={eyeY} r={eyeR} fill={ink}/>
        <line x1={x + eyeDX - headR*0.24} y1={eyeY} x2={x + eyeDX + headR*0.24} y2={eyeY}
          stroke={ink} strokeWidth={fsw} strokeLinecap="round"/>
      </g>
    );

    // Mouths: an open "cheer" ellipse that pulses (variants 0,1), a grin-with-tongue (3),
    // and a chatty smile arc (2). All wrapped so they animate open/closed in place.
    let mouth;
    if (v === 1) {
      // Big round scream of joy
      mouth = <ellipse cx={x} cy={mouthY + headR*0.05} rx={headR*0.30} ry={headR*0.34} fill={ink}/>;
    } else if (v === 2) {
      // Wide smile arc
      mouth = <path d={`M ${x - headR*0.34} ${mouthY - headR*0.04} Q ${x} ${mouthY + headR*0.34} ${x + headR*0.34} ${mouthY - headR*0.04}`}
        fill="none" stroke={ink} strokeWidth={fsw} strokeLinecap="round"/>;
    } else if (v === 3) {
      // Open grin with a flash of tongue
      mouth = (
        <g>
          <ellipse cx={x} cy={mouthY + headR*0.04} rx={headR*0.32} ry={headR*0.24} fill={ink}/>
          <ellipse cx={x} cy={mouthY + headR*0.14} rx={headR*0.16} ry={headR*0.12} fill={color} opacity={filled ? 0.55 : 0.9}/>
        </g>
      );
    } else if (v === 4) {
      // Belting it out — tall open singer's mouth, eyes closed in bliss
      mouth = <ellipse cx={x} cy={mouthY + headR*0.06} rx={headR*0.22} ry={headR*0.38} fill={ink}/>;
    } else if (v === 5) {
      // Whistling — a tight little "o", with the wink
      mouth = <circle cx={x} cy={mouthY} r={headR*0.15} fill={ink}/>;
    } else {
      // Classic open "whoa" mouth
      mouth = <ellipse cx={x} cy={mouthY} rx={headR*0.26} ry={headR*0.24} fill={ink}/>;
    }

    faceEls = (
      <g opacity={op}>
        {v === 2 ? happyEyes : v === 4 ? closedEyes : v === 5 ? winkEyes : dotEyes}
        <g style={{animation:`fan-sing ${singDur}s ease-in-out infinite`, animationDelay:`${singDelay}s`,
          transformBox:'fill-box', transformOrigin:'center'}}>
          {mouth}
        </g>
      </g>
    );
  }

  // ── HANDS — small floating circle hands (no arm lines — they read cleanly at
  // crowd scale, and ride the parent's bob). Most fans rest; some wave, throw
  // devil horns, hold up a lighter, or raise a phone-light.
  let handsEls = null;
  if (hands && headR > 2.0) {
    const handR  = headR * 0.46;
    const hf     = filled ? color : 'none';
    const hornW  = Math.max(sw * 0.9, r * 0.14);
    const restY  = y + r * 0.12;
    const restDX = halfW * 0.94;
    const restHand = (side, key) => (
      <circle key={key} cx={x + side * restDX} cy={restY} r={handR}
        fill={hf} stroke={color} strokeWidth={sw} opacity={op}/>
    );

    if (hands === 'wave') {
      // Both hands up, swaying side-to-side in opposite phase = a waving crowd.
      const wy   = headCy - headR * 0.7;
      const wdx  = halfW * 1.02;
      const sway = headR * 0.55;
      handsEls = (
        <g>
          <g style={{animation:'fan-wave 1.05s ease-in-out infinite',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            <circle cx={x - wdx} cy={wy} r={handR} fill={hf} stroke={color} strokeWidth={sw} opacity={op}/>
          </g>
          <g style={{animation:'fan-wave 1.05s ease-in-out infinite', animationDelay:'-0.525s',
            ['--swA']:`${-sway}px`, ['--swB']:`${sway}px`}}>
            <circle cx={x + wdx} cy={wy} r={handR} fill={hf} stroke={color} strokeWidth={sw} opacity={op}/>
          </g>
        </g>
      );
    } else if (hands === 'fist') {
      // 🤘 One raised hand pumping DEVIL HORNS; the other rests.
      const fy = headCy - headR * 1.05;
      const fx = x + halfW * 0.35;
      handsEls = (
        <g>
          {restHand(-1, 'rest')}
          <g style={{animation:'fan-fist 0.7s ease-in-out infinite', ['--pump']:`${-(headR * 1.4)}px`}}>
            <circle cx={fx} cy={fy} r={handR} fill={hf} stroke={color} strokeWidth={sw} opacity={op}/>
            {detail && <g stroke={color} strokeWidth={hornW} strokeLinecap="round" opacity={op}>
              <line x1={fx - handR * 0.55} y1={fy - handR * 0.3} x2={fx - handR * 0.85} y2={fy - handR * 1.5}/>
              <line x1={fx + handR * 0.55} y1={fy - handR * 0.3} x2={fx + handR * 0.85} y2={fy - handR * 1.5}/>
            </g>}
          </g>
        </g>
      );
    } else if (hands === 'lighter') {
      // One hand raised holding a flickering lighter flame; the other rests.
      const ly = headCy - headR * 0.85;
      const lx = x - halfW * 0.28;
      const flameY = ly - handR * 1.5;
      handsEls = (
        <g>
          {restHand(1, 'rest')}
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
      const py2 = headCy - headR * 1.1;
      const px2 = x - halfW * 0.3;
      handsEls = (
        <g>
          {restHand(1, 'rest')}
          <g style={{animation:'fan-wave 2.2s ease-in-out infinite',
            ['--swA']:`${-headR * 0.3}px`, ['--swB']:`${headR * 0.3}px`}}>
            <rect x={px2 - handR * 0.42} y={py2 - handR * 0.9}
              width={handR * 0.84} height={handR * 1.3} rx={handR * 0.2}
              fill="#cfe0ff" opacity={op} style={{filter:'drop-shadow(0 0 2px #cfe0ff)'}}/>
          </g>
        </g>
      );
    } else {
      // rest — both hands down by the sides
      handsEls = <g>{restHand(-1, 'l')}{restHand(1, 'r')}</g>;
    }
  }

  // Body silhouette — optionally mirrored upside-down about its own centre so the
  // crowd shows a mix of two outlines.
  const bodyCenterY = (apexY + baseY) / 2;
  const bodyPath = (
    <path d={body} fill={filled ? color : 'none'} stroke={color} strokeWidth={sw}
      strokeLinejoin="round" strokeLinecap="round" opacity={op}/>
  );

  return (
    <>
      {bodyFlip
        ? <g transform={`matrix(1,0,0,-1,0,${(2 * bodyCenterY).toFixed(2)})`}>{bodyPath}</g>
        : bodyPath}
      <circle cx={x} cy={headCy} r={headR} fill={filled ? color : '#0a0e18'}
        stroke={color} strokeWidth={sw} opacity={op}/>
      {faceEls}
      {handsEls}
    </>
  );
}


import { ENHARMONIC_RESPELL, canonicalRoot, getSpelledPool, pitchIndex, semitonesUpSpelled, buildScale, getIntervalNotes, getFourthFifth, playableScale } from "./music/notes.js";

import { HC_UPGRADE_THRESHOLD, STOCK_REFILL_RATE, AMP_RANGE, AMP_LINK_DIST, AMP_DICE, AMP_UPGRADE_MAX, CAMERA_ZOOM_MS, LIMELIGHT_HEX, LIMELIGHT_TO_WIN, LIMELIGHT_FAME, FAME_TO_WIN, UNDERDOG_MIN_DEFICIT, TOKEN_MAX, FAN_DIEHARD_WEIGHT, FAN_CASUAL_WEIGHT, FAN_MULT_CAP, FAN_DIEHARD_CAP, FAN_CASUAL_CAP, FAN_DIEHARD_START, FAN_CASUAL_START, EXCITE_PER_CASUAL, LOYALTY_PER_DIEHARD, FAN_GAIN_BY_RING, FAN_DECAY, FAN_BORED_AFTER, FAN_PROMOTE_EVERY, FAN_RECOVERY_LAG, FAN_FLEE_MIN, FAN_FLEE_MAX, FAN_DEFECT_TO_VICTOR, EVENT_HEX_COUNT, EVENT_RESPAWN_TURNS, FLAMING_DISC_COUNT, FLAMING_DISC_ROUNDS, GROUPIE_COOLDOWN, AMP_UNPLUG_DIST, CHARGE_ZONE_COUNT, CHARGE_ZONE_BOOST_TURNS, CHARGE_ZONE_COOLDOWN, CHARGE_FLOOR_BONUS, EDGE_MAX_STAGE, EDGE_DRIVE_BY_STAGE, EDGE_SUSTAIN_PENALTY_BY_STAGE, EDGE_HC_COST_BY_STAGE, EDGE_FAN_COST_BY_STAGE, EDGE_RESOLVE_HC_BONUS_BY_STAGE, EDGE_COLLAPSE_FAN_LOSS, EDGE_COLLAPSE_VIBE, THRASH_DIE, THRASH_CEIL_DIE, SONIC_LIMELIGHT_FP } from "./data/gameConstants.js";
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
    { id:'psycho_bushido', label:'🌀 Psycho Bushido', pre:[] },
    { id:'e_rush',         label:'🎴 E-Rush',         pre:[] },
    { id:'hydra',          label:'🐉 Hydra',           pre:['amp_1','amp_2','amp_3'], fire:'hydra' },
  ]},
  Metalness_Monster: { name: 'Metalness Monster', color: '#ffcc00', skills: [
    { id:'master_moshpits', label:'🤘 Master of Moshpits', pre:[] },
    { id:'riff_slayer',     label:'🗡️ Riff Slayer',        pre:[] },
    { id:'paranoia',        label:'🌀 Paranoia',           pre:['discord_1'] },
    { id:'azrael',          label:'💀 Azrael',             pre:[] },
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
import { CADENCE_OBJECTIVES, cadenceHints, detectCadence, detectChromaticRun, staggerDuration, detectDiatonicRun, driveBoostFromRun, detectSkipClimb, detectRepeatPattern, sustainBoostFromPattern, scoreTrackHC, randomNote } from "./music/cadence.js";
import { evaluateChord } from "./music/chords.js";

// ── CADENCE HINTS ────────────────────────────────────────────────────────────
// Given the finals trail, work out which ending note(s) would advance (or
// resolve) each off-cooldown cadence. For each cadence, find the LONGEST tail
// of the trail that matches the start of its degree pattern (the first final
// of the run sets the root), then report the next required pitch class.


// Check whether the tail of a finals trail completes any cadence (skipping
// objectives on cooldown). Longest pattern wins.

// Three tiers, each unlocking / boosting random on-hit physical effects.
// Effects roll independently on a successful swing hit.
const SWING_UPGRADE_TIERS = [
  {
    id: 'swing_1',
    label: 'Wild Swing',
    icon: '🌀',
    desc: 'On hit: 20% chance to TRIP — target\'s movement halved next turn.',
    maxLevel: 1,
  },
  {
    id: 'swing_2',
    label: 'Reckless Abandon',
    icon: '💥',
    desc: 'Trip chance → 35%. Adds DROP INSTRUMENT (20%) — target loses 1 Drive until recovered.',
    prereq: 'swing_1',
    maxLevel: 1,
  },
  {
    id: 'swing_3',
    label: 'Dazed & Confused',
    icon: '😵',
    desc: 'Adds DAZED (15%) — target\'s next move goes to a random wrong hex. All chances bumped.',
    prereq: 'swing_2',
    maxLevel: 1,
  },
];

// Chance tables per upgrade tier (cumulative unlocks)
// { trip, drop, dazed } — each 0–1 probability
const SWING_EFFECT_CHANCES = {
  swing_1: { trip: 0.20, drop: 0,    dazed: 0    },
  swing_2: { trip: 0.35, drop: 0.20, dazed: 0    },
  swing_3: { trip: 0.40, drop: 0.25, dazed: 0.15 },
};

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
// Three tiers unlocked via the HC upgrade system. Once a tier is unlocked,
// those interval notes:
//   • Are colored (no longer gray)
//   • Do NOT count against Harmonic structure (discordCount not incremented)
//   • CAN contribute to HC points
//   • Keep all existing special effects (tritone feedback, m7 mojo drain, etc.)
// Before unlock: grayed out, same rules as any other discord note.
const DISCORD_UPGRADE_TIERS = [
  {
    id: 'discord_1',
    label: 'Blues Lick',
    icon: '🎷',
    desc: "Flat 7th (minor 7th) no longer discord in Major scales. End your track on it to inflict Mojo Drain on next attack target.",
    notesByMode: { major: ['minorSeventh'], minor: [] },
  },
  {
    id: 'discord_2',
    label: 'Borrowed Chord',
    icon: '✨',
    desc: "Major 3rd no longer discord in Minor scales. End your track on it to cleanse one active status effect — or, if you're clean, raise a shield that blocks the next incoming status.",
    notesByMode: { major: [], minor: ['majorThird'] },
  },
  {
    id: 'discord_3',
    label: "Devil's Interval",
    icon: '🔥',
    desc: "Tritone never breaks harmony in either mode. End on it to arm a Burn — your next attack sets the rival alight for 2 turns (50% each turn to lose 1 Vibe).",
    notesByMode: { major: ['tritone'], minor: ['tritone'] },
  },
  {
    id: 'discord_4',
    label: 'Chromatic Climb',
    icon: '⚡',
    desc: "A chromatic run of 3+ notes no longer causes discord. Out-of-scale notes stay grey but the run is clean. Unlocks Stagger.",
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
    // colour-note powers (Blues 7th, Devil's Interval, Chromatic/Stagger, Borrowed
    // Chord) arrive as you learn the theory that justifies them (see applySkillEffects).
    {
      id: 'theory',
      label: 'Music Theory',
      icon: '🎼',
      color: '#66ccff',
      desc: 'The spine of the game. Start on the Major Pentatonic; climb to unlock dissonance as power.',
      skills: [
        { id:'theory_major',     label:'The Full Scale',       icon:'🎼', hcCost:8,  gated:true, prereq:null,
          desc:'Adds the 4th & 7th, completing the Major (Ionian) scale — those two notes stop costing Discord.' },
        { id:'theory_minor',     label:'Minor Tonality',       icon:'🌑', hcCost:10, gated:true, prereq:'theory_major',
          desc:'Unlocks the Minor scale and the Major/Minor pivot. Declare Minor at the pivot for a darker key, Discord-free.' },
        { id:'theory_dom7',      label:'Blues / Dominant 7th', icon:'🎷', hcCost:12, gated:true, prereq:'theory_minor',
          desc:'The ♭7 joins your clean palette. BLUES LICK: end a track on the ♭7 to arm Mojo Drain on your next target.' },
        { id:'theory_modes',     label:'Modal Colour',         icon:'🌀', hcCost:14, gated:true, prereq:'theory_dom7',
          desc:"Lydian ♯4 & Mixolydian ♭7 become clean. DEVIL'S INTERVAL: the tritone never breaks harmony — end on it to arm a Burn (2 turns, 50%/turn to lose 1 Vibe)." },
        { id:'theory_chromatic', label:'Chromatic Mastery',    icon:'⚡', hcCost:18, gated:true, prereq:'theory_modes',
          desc:'CAPSTONE — every Discord penalty halved; the whole chromatic scale is yours. Chromatic runs of 3+ play clean and STAGGER rivals, and the Major-3rd cleanse (Borrowed Chord) comes online in Minor.' },
      ],
    },
    // ── THE BAND — pick your identity (three short 3-tier paths) ──
    {
      id: 'electric',
      label: 'Electric',
      icon: '⚡',
      color: '#ffcc44',
      desc: 'Your rig. Amps power your Sonic Attack and grow your die; a Roadie keeps the rig following you.',
      skills: [
        { id:'amp_1',    label:'Amp I',   icon:'🔊', hcCost:8,  gated:true, prereq:null,
          desc:'Place Amp 1 on an adjacent hex. Sonic Attack online. Within range: d6→d8.' },
        { id:'amp_2',    label:'Amp II',  icon:'🔊', hcCost:12, gated:true, prereq:'amp_1',
          desc:'Place Amp 2. Within range of both: d8→d10.' },
        { id:'roadie_1', label:'Roadie',  icon:'🔧', hcCost:12, gated:true, prereq:'amp_2',
          desc:'Hire a Roadie — moves one of your amps 2 hexes every couple of turns, so your rig follows you.' },
        { id:'amp_3',    label:'Amp III', icon:'🔊', hcCost:18, gated:true, prereq:'roadie_1',
          desc:'Place Amp 3. Within range of all three: d10→d12 — fully wired.' },
        { id:'overcharge', label:'Overcharge', icon:'🎸', hcCost:14, gated:true, prereq:'amp_2',
          desc:'Charge Zones no longer just spark your dice — tapping one now lets you choose: the usual charge (random die floor/ceiling boost), OR one curated Chord Stack note plus a bonus revoice to spend on it.' },
      ],
    },
    {
      id: 'cqc', // internal id stays 'cqc' — player-facing name is THRASH
      label: 'Thrash',
      icon: '🥊',
      color: '#ff6644',
      desc: 'Thrash — brutal melee. Each tier also trains a permanent +1 Drive.',
      skills: [
        { id:'shank_skank',     label:'Shank Skank',     icon:'🗡️', hcCost:8,  gated:true, prereq:null,
          desc:"On hit: 20% TRIP — rival's movement halved next turn. (+1 permanent Drive.)" },
        { id:'cosmic_boogaloo', label:'Cosmic Boogaloo', icon:'🌀', hcCost:12, gated:true, prereq:'shank_skank',
          desc:'Trip 35% + 15% DAZED (next move lurches the wrong way). (+1 permanent Drive.)' },
        { id:'moon_shuffle',    label:'Moon Shuffle',    icon:'🌙', hcCost:16, gated:true, prereq:'cosmic_boogaloo',
          desc:'Trip 40% + Dazed 18% + 12% DROP INSTRUMENT (rival loses Drive until retrieved). (+1 permanent Drive.)' },
      ],
    },
    {
      id: 'crew',
      label: 'Crew',
      icon: '🎉',
      color: '#44cc88',
      desc: 'Rally your fans. Deployable crews you tap from your Spirit card — support, disruption, protection. Each recharges after a few turns.',
      skills: [
        { id:'fans_4eva',    label:'Fans 4Eva',           icon:'💚', hcCost:8, gated:false,
          desc:'Deployable crew — restore 2 Vibe. Recharges in 3 turns.' },
        { id:'pranksta',     label:'Bust Out Pranksta',   icon:'🪤', hcCost:8, gated:false,
          desc:'Deployable crew — disconnect up to 2 rival amps within 4 hexes. Recharges in 3 turns.' },
        { id:'junkyard_dog', label:'Junkyard Dog',        icon:'🔩', hcCost:8, gated:false,
          desc:'Deployable crew — arm a junkyard weapon: +2 on your next Swing roll. Recharges in 3 turns.' },
        { id:'fandom_army',  label:'Several Fandom Army', icon:'🛡️', hcCost:8, gated:false,
          desc:'Deployable crew — +2 Sustain for your next battle. Fans form a wall around you. Recharges in 3 turns.' },
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
        { id:'psycho_bushido', label:'Psycho Bushido', icon:'🌀', hcCost:10, gated:false,
          desc:'In Thrash, when your swing die lands 5 or 6 the rival freezes — their die is forced to a 1.' },
        { id:'e_rush',         label:'いいラッシュ (E-Rush)', icon:'🎴', hcCost:12, gated:false,
          desc:'End a melody line on an E, then face a rival in a riff-off that turn: every answer note spawns a ghost note — both keys must be hit or the note misses.' },
        { id:'hydra',          label:'Hydra',          icon:'🐉', hcCost:16, gated:true, prereq:'amp_3',
          desc:'CAPSTONE — requires Amp III. With 3 amps in range, your Sonic Attack rolls 3d6 instead of d12, firing three beams.' },
      ],
    },
    {
      id: 'metalness',
      label: 'Metalness Monster',
      icon: '🤘',
      color: '#ffcc00',
      desc: 'Trash-metal violence. An exclusive arsenal only the Monster can wield.',
      spiritOnly: 'Metalness_Monster',
      skills: [
        { id:'master_moshpits', label:'Master of Moshpits', icon:'🎸', hcCost:10, gated:false,
          desc:'On ANY battle win, if you have a banked note: burn it for +1 Vibe damage (can finish a knockdown). The pit floods the board.' },
        { id:'riff_slayer',     label:'Riff Slayer',        icon:'🗡️', hcCost:12, gated:false,
          desc:"Commit a SKIP-CLIMB (3+ notes leaping by thirds, one direction) to arm it. If a riff-off breaks out that turn, 2–3 of the rival's notes glitch mid-flight." },
        { id:'paranoia',        label:'Paranoia',           icon:'🌀', hcCost:14, gated:true, prereq:'theory_dom7',
          desc:"Supercharges your Mojo Drain (from the Blues 7th): now lasts 3 turns AND freezes 2 of the rival's note slots." },
        { id:'azrael',          label:'Azrael',             icon:'💀', hcCost:16, gated:false,
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
        { id:'blaster_of_ra', label:'Blaster of Ra', icon:'🌀', hcCost:12, gated:false,
          desc:'REPLACES the Smash. A ranged, PIERCING bass-drop: hurl your unused stock down the forward beam, hammering EVERY rival in line — undefendable, scattering their stock and knocking them back. Leaves you Exposed.' },
        { id:'displace', label:'Displace', icon:'🌌', hcCost:10, gated:false,
          desc:"He can't run — he warps. Teleport to an open hex beside your amp rig (costs 3 AP, 2-turn cooldown). The slow zoner's get-out-of-jail. Needs at least one amp to warp to." },
        { id:'sunbeam', label:'Sunbeam', icon:'☀️', hcCost:16, gated:true, prereq:'amp_3',
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
// When two plugged-in Spirits clash with a Sonic Attack while facing each
// other (each standing in the other's beam), the battle becomes a RIFF-OFF:
// a call-and-response rhythm duel. The attacker lays down a riff; the
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
  const [introDone, setIntroDone] = useState(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  // 🎬 Opening movie — plays on every launch, any input skips (attract style).
  if (!introDone) {
    return <div style={isMobile ? mobileColorStyle : {}}><OpeningMovie onDone={() => setIntroDone(true)} /></div>;
  }
  if (showTutorial) {
    return <div style={isMobile ? mobileColorStyle : {}}><Tutorial onBack={() => setShowTutorial(false)} /></div>;
  }
  if (!gameState) {
    return <div style={isMobile ? mobileColorStyle : {}}><Lobby onStart={gs => setGameState(gs)} onTutorial={() => setShowTutorial(true)} /></div>;
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
  // botBusyRef removed (Phase 7c) — debounce folded into botStepRef ('pending').

  // 🤘 MASTER OF MOSHPITS — spiritId → mob key. While set, the crowd PNGs
  // swarm that rival's hex on the board and "rock" them. Cleared after a beat.
  const [moshpitTargets, setMoshpitTargets] = useState({});

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
  // 🎹/🎸 instrument used to read notes in riff-off battles (toggle on the countdown card)
  const [riffView, setRiffView] = useState('piano');
  // 🎚️ falling-notes difficulty (toggle on the countdown card) — presets tune
  // fall speed + grade windows (riff/fallingNotes.js). Ref mirror so the run
  // builder (fired from timers) never reads a stale closure.
  const [riffDifficulty, setRiffDifficulty] = useState(RIFF_FALL_DEFAULT);
  const riffDifficultyRef = useRef(riffDifficulty);
  useEffect(() => { riffDifficultyRef.current = riffDifficulty; }, [riffDifficulty]);
  // ⏭ when on, the lore/intro cards (riff_intro, round-2 intro) auto-advance to the countdown
  const [skipBattleIntros, setSkipBattleIntros] = useState(false);
  const skipBattleIntrosRef = useRef(false);
  useEffect(() => { skipBattleIntrosRef.current = skipBattleIntros; }, [skipBattleIntros]);

  // ⏭ Auto-skip: when the toggle is on, jump straight from a battle intro card into the
  // count-in. (The handoff card stays — it shows the live score, not lore.)
  useEffect(() => {
    if (!battleState?.riffOff || !skipBattleIntrosRef.current) return;
    if (battleState.phase === 'riff_intro' || battleState.phase === 'riff_r2intro') {
      const t = setTimeout(() => riffBeginTurn('attacker'), 60);
      return () => clearTimeout(t);
    }
  }, [battleState?.phase, battleState?.riffOff]);

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
  // retaliationTimer: countdown seconds remaining
  const [retaliationTimer, setRetaliationTimer] = useState(null);
  const moveStepsLeft = engineState.turn.moveStepsLeft; // engine-owned (Phase 2)
  const [chordMode, setChordMode] = useState(false); // 🎸 taps build the combat chord instead of the melody
  // 🎯 TURN STEP — progressive HUD flow: pivot → chord → melody → move_act
  const [turnStep, setTurnStep] = useState('pivot');
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
  // The very first tip (skill_tree) is triggered by the initial skill pick useEffect.
  // The pivot tip fires naturally from endTurn → setTurnStep('pivot') → showTip('pivot').
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
  // pointsFlash: { lines: ['...','...'], key: Date.now() } — clears after animation
  // freshNoteIdx: { spiritId, indices:Set<number>, key } — which Note Stock slots
  // just got refilled at turn start, so they can pop in instead of silently changing.
  const [freshNoteIdx, setFreshNoteIdx] = useState(null);

  const [pulsingHex, setPulsingHex] = useState(null); // hex num that glows on turn start
  // ─── BOARD DEPLOYABLES ── (moved to ./hooks/useBoardState.js)
  const {
    amps, setAmps,
    boardCards, setBoardCards,
    cardRespawnIn, setCardRespawnIn,
    pendingCardPickup, setPendingCardPickup,
    roadieAction, setRoadieAction,
    roadieAnimations, setRoadieAnimations,
    ampPlacing, setAmpPlacing,
  } = useBoardState();
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

  // ─── BGM SETUP ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const idx = nextBgmTrack();
    currentTrackIdxRef.current = idx;
    setBgmTrackNum(idx + 1);
    const audio = new Audio(BGM_TRACKS[idx]);
    audio.volume = bgmVolume;
    audio.loop = false;
    audioRef.current = audio;
    audio.play().catch(() => {});
    function handleEnded() {
      const next = nextBgmTrack(currentTrackIdxRef.current);
      currentTrackIdxRef.current = next;
      setBgmTrackNum(next + 1);
      audio.src = BGM_TRACKS[next];
      audio.play().catch(() => {});
    }
    audio.addEventListener("ended", handleEnded);
    return () => { audio.removeEventListener("ended", handleEnded); audio.pause(); };
  }, []); // eslint-disable-line

  useEffect(() => { if (audioRef.current) audioRef.current.muted = bgmMuted; }, [bgmMuted]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = bgmVolume; }, [bgmVolume]);

  const bgmSkip = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = nextBgmTrack(currentTrackIdxRef.current);
    currentTrackIdxRef.current = next;
    setBgmTrackNum(next + 1);
    audio.src = BGM_TRACKS[next];
    if (!bgmMuted) audio.play().catch(() => {});
  }, [bgmMuted]);

  // Attach wheel listener as non-passive
  useEffect(() => {
    const div = boardDivRef.current;
    if (!div) return;
    const handler = (evt) => handleBoardWheel(evt);
    div.addEventListener("wheel", handler, { passive: false });
    return () => div.removeEventListener("wheel", handler);
  });

  // ─── 🎓 BEGINNER TIP DEFINITIONS ───────────────────────────────────────────
  // Each tip = { title, pages: [{ body, anchor? }] }. `anchor` names a HUD
  // element wearing data-tip-anchor="<name>" — the overlay spotlights it and
  // draws an arrow to it (falls back to a centered card if it's not on screen).
  // Content is written against the CURRENT rules — if a system changes, the
  // tip lies until someone updates it. Don't let the tip lie.
  const BEGINNER_TIPS = {
    skill_tree: {
      title: '🌳 Welcome — Theory Tree',
      pages: [
        { body: 'Welcome to the stage. First order of business: pick a SKILL TARGET from the Theory Tree — the ability you\'re saving toward. New scale tones, amps, crew, combat tricks... choose a route that fits how you want to play. Or panic-pick. Everyone does their first game.' },
        { body: 'You pay for skills with HC (Harmonic Coverage) points: every in-scale note you play earns HC, and when the bar fills, the skill\'s yours. The mini progress bar lives on your spirit card, so you always know how close you are.', anchor: 'note-stock' },
        { body: 'One more thing in your back pocket: a 🔄 TRANSPOSE card. One-time use, swaps your Root Note for any note in your stock. If your opening hand looks like it was dealt by an enemy, this is your escape hatch. Save it. Or don\'t — it\'s your funeral.' },
      ],
    },
    pivot: {
      title: '🎵 Step 1 — Choose Your Scale',
      pages: [
        { body: 'See that big glowing badge? That\'s your ROOT NOTE — the tonal center of everything you do this turn. Now pick MAJOR (bright, consonant, sunshine) or MINOR (dark, tense, brooding). Together they define your scale.', anchor: 'root-note' },
        { body: ['Why care? Notes IN your scale are "clean" — they earn HC and keep the crowd happy. Off-scale notes are DISCORD: no HC, and the audience notices. They always notice.', 'Root feeling wrong? Your 🔄 Transpose card can swap it before you commit to a mode. A bad root is a choice; staying on one is a lifestyle.'] },
      ],
    },
    chord: {
      title: '🎸 Step 2 — Build Your Chord',
      pages: [
        { body: 'This vertical rack is your CHORD STACK — up to 5 notes that ARE your combat stats. The chord sets your DRIVE (⚔️ attack, red) and SUSTAIN (🛡️ defense, blue). Watch the colored arrows as you add notes: red ▲ = more punch, blue ▲ = more armor.', anchor: 'chord-stack' },
        { body: ['Your chord is not decoration — it\'s ammo. Every Swing you throw BURNS the first 2 notes off the front of the stack. You rebuild it one note per turn with your revoice. Swing wildly with an empty chord and you\'re fighting with base stats, which is a polite way of saying "losing".', 'Rule of thumb: keep the stack fed. A 5-note chord walking into a fight is a very different conversation than a 1-note one.'] },
      ],
    },
    melody: {
      title: '🎶 Step 3 — Build Your Melody',
      pages: [
        { body: 'Now compose your MELODY LINE from your Note Stock. This is the big one: each note you commit = 1 hex of movement (AP) this turn. In-scale notes also bank HC toward your next skill. Short track = safe but slow. Long track = mobile but you might hit discords.', anchor: 'note-stock' },
        { body: 'Your track builds up here as you tap notes. The colored slots mark special intervals — tritone (red, spicy), 5th (pink) and 4th (purple, sturdy), Major 3rd (green, cleansing), minor 7th (blue, draining). The LAST note matters most: it becomes next turn\'s Root, feeds cadences, and can put you on the Dissonance Edge. When it sounds right, hit COMMIT.', anchor: 'commit-track' },
      ],
    },
    move_act: {
      title: '🚶 Step 4 — Move & Act',
      pages: [
        { body: 'Track committed — your notes are now AP. Spend them here: MOVE across hexes, FACE to turn (1 step), and fight. Position matters: attacks fire into the cone or beam you\'re FACING. Sneaking behind someone is not just rude, it\'s tactics.', anchor: 'actions-bar' },
        { body: ['Three ways to ruin someone\'s set:', '⚔️ SWING (1 AP) — the melee jab. Cheap, defended, drives your chord into them.', '🎸 SMASH (2 AP) — the haymaker. Undefendable, ignores Sustain, hurls your unused stock... and leaves you Exposed. Commit issues, in weapon form.', '🔊 SONIC (2 AP) — the ranged beam. Needs an amp in range. Less damage, way more Fame.'] },
        { body: 'Done? Hit END TURN. Your last committed note becomes next turn\'s Root Note — so that throwaway discord you ended on? That\'s tomorrow\'s tonal center. Plan the ending.', anchor: 'end-turn' },
      ],
    },
    combat: {
      title: '⚔️ Battle!',
      pages: [
        { body: 'A SWING is a Thrash battle: both sides roll a d4 — attacker adds DRIVE, defender adds SUSTAIN. Win and you deal Vibe damage (up to 4) and might land a status effect. Lose as the attacker and you take a humiliation tap of 1 Vibe. Yes, it stings. It\'s supposed to.' },
        { body: ['The fine print your rival hopes you skip:', 'Your swing burns the first 2 notes of your Chord Stack — the hit literally plays your chord. And swinging drops your guard: −1 Sustain until your next turn.', 'Thrash pays a flat 1 FP. It\'s for hurting people. If you want FAME, plug into an amp and go Sonic — margin-scaled FP, multiplied by your crowd.'] },
      ],
    },
    fans: {
      title: '🎤 Fans',
      pages: [
        { body: 'You drew a crowd! Fans never hand you FP directly — they MULTIPLY every FP you earn, up to ×2 with a full house. Diehards (♥, solid) are your loyal core and worth about three Casuals (👥, hollow), who are... let\'s say "emotionally flexible".' },
        { body: ['Growing the crowd: commit clean tracks near the action — centre rings pay 2 casuals a turn, the back row pays zero. Perform well and casuals harden into Diehards.', 'Losing the crowd: skulk in the outer ring too long and casuals get bored and leave. Get knocked down and 7–10 of them flee on the spot — and a couple defect straight to whoever flattened you. Fans, man.'] },
      ],
    },
    amp_place: {
      title: '🔊 Amplifiers',
      pages: [
        { body: 'Amp ready to deploy! Place it from CREW & GEAR on your spirit card. Amps project your sound: standing within range of your rig keeps you PLUGGED IN — bigger Harmonic Coverage for HC, and it switches on the Sonic Attack.', anchor: 'crew-gear' },
        { body: ['More amps in range = a meaner Sonic dice pool: 1 amp rolls 2d6 keep-best, 2 amps roll 3d6, 3 amps roll 2d6+d8. Fully wired is fully loud.', 'Guard the rig: rivals can walk up and UNPLUG your amps (a Roadie replugs them), and wandering too far leaves your rig cold until you come back. An amp far from the fight is an expensive lawn ornament.'] },
      ],
    },
    cadence: {
      title: '🎼 Cadences',
      pages: [
        { body: 'A CADENCE is a harmonic pattern formed by the FINAL notes of your tracks across turns — like V→I, or the full IV→V→I. Land the resolution and it pays bonus FP (crowd-multiplied, naturally). The hints in your Note Stock panel show exactly which final note keeps a sequence alive. The game is literally telling you the answer — take the hint.', anchor: 'note-stock' },
      ],
    },
    riff: {
      title: '🎸 Riff Discovered!',
      pages: [
        { body: 'That note pattern you just played? A legendary RIFF. First discovery writes it into the Riffbook and pays FP; replaying known riffs pays too. There are more hidden in the note-space — treat every track as an excavation. Some spirits win with fists; the archaeologists win with licks.' },
      ],
    },
    knockdown: {
      title: '😵 Knock Down!',
      pages: [
        { body: 'A spirit\'s Vibe hit zero — KNOCKED DOWN. The bill: 1 life gone, −1 FP, and the crowd stampedes (a chunk of casuals flee, some straight into the arms of whoever did the flattening). They respawn at their home corner with full Vibe... after sitting out a turn to think about what happened.' },
        { body: 'Burn through ALL your lives and it\'s a true KO — out of the game, thanks for playing, merch table\'s on the left. Watch your Vibe bar. Retreating to heal isn\'t cowardice, it\'s set management.', anchor: 'vibe-bar' },
      ],
    },
    fame: {
      title: '⭐ Fame Points (FP)',
      pages: [
        { body: `FP is the win condition: first to ${FAME_TO_WIN} takes the crown. This gold bar is the only bar that truly matters — everything else exists to feed it.`, anchor: 'fame-bar' },
        { body: ['The Fame menu: 🔊 Sonic wins (margin-scaled — style points are real), 🎸 riff discoveries, 🎼 cadence resolutions, ✨ holding centre-stage Limelight a full turn, 🧠 acing rock trivia at event hexes.', 'EVERY one of those is multiplied by your crowd (up to ×2) — a deed in front of a full house is worth double. And if you\'re trailing badly, the underdog bonus quietly inflates your payouts up to ×2.5. The comeback is canon.'] },
        { body: `One warning, hotshot: reach ${FAME_TO_WIN} FP without a comfortable lead and the sky splits open — the ROCK GOD descends as a final boss for EVERYONE. Win big or win together.` },
      ],
    },
    skill_unlock: {
      title: '🌳 Skill Unlocked!',
      pages: [
        { body: 'New ability unlocked — the HC grind paid off. Skills are permanent: scale tones, amps, crew, combat upgrades, signature moves. Your spirit card wears the new badge; hover it to gloat over the details.' },
        { body: 'Now pick your NEXT target and keep the loop rolling: in-scale notes → HC → skill → repeat. Spirits who stop building around mid-game tend to become content in other people\'s highlight reels.', anchor: 'hc-bar' },
      ],
    },
    status_effect: {
      title: '⚡ Status Effect!',
      pages: [
        { body: ['Someone\'s wearing a status effect. The house specials:', '🔥 BURN — Vibe damage over time. 😵 STAGGER — freezes note slots so part of your kit is just... gone. 🧿 MOJO DRAIN — saps your performance and fan draw.', 'They wear off after a few turns, and a Major 3rd cleanses. The badges sit in your Note Stock panel — glance before you plan, not after you commit.'], anchor: 'note-stock' },
      ],
    },
    intervals: {
      title: '🎵 Special Intervals',
      pages: [
        { body: ['Some notes in your scale moonlight as weapons — the legend up top shows this turn\'s exact notes:', '🔴 TRITONE — maximum dissonance. Drive up, can BURN rivals. The devil\'s interval, and it knows it. 💗 5th / 💜 4th — the load-bearing consonances, your Sustain backbone. 💚 MAJOR 3rd — cleanses status effects. 🔵 MINOR 7th — arms Mojo Drain.', 'All of them pay bonus HC when played in-scale. Free money for good taste.'], anchor: 'interval-legend' },
      ],
    },
    edge: {
      title: '⚡ Dissonance Edge',
      pages: [
        { body: 'You ended your track on a DISCORD — you\'re on the EDGE now. Drive up, Sustain down: full glass-cannon, and it shows on your card, so every rival can read the opening you just handed them. Bold. Let\'s see if it\'s the good kind of bold.' },
        { body: 'Stay out another turn without resolving and the ride ESCALATES — more Drive, worse Sustain, and it keeps charging you HC and fans for the privilege. Getting into any fight while riding burns the stance, win or lose. The Edge is a bar tab: fun to run up, less fun to settle.' },
        { body: 'The exit: end a track on your Root, 3rd, or 5th to RESOLVE — Sustain restored, a temp Drive kicker, and an HC payout scaled to how deep you rode. But the clock is real: miss the final turn\'s resolve and it all COLLAPSES — stance gone, fans walk, and you take a Vibe hit as a parting gift. Land the resolve. Be legend, not cautionary tale.' },
      ],
    },
  };

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
    if (activeTipRef.current) return; // don't overwrite a tip already showing
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
  const noteStock    = actingNoteState?.noteStock    ?? [];
  const melodyLine    = actingNoteState?.melodyLine    ?? [];
  const usedStockIdx = actingNoteState?.usedStockIdx ?? [];
  const rootNote     = actingNoteState?.rootNote     ?? 'C';
  const scaleMode    = actingNoteState?.scaleMode    ?? 'major';
  const pivotPending  = actingNoteState?.pivotPending ?? false;
  // Sonic die tier — driven by the RIG (connected amp chain) the Spirit is plugged
  // into, not by counting each amp separately. One cord to the rig; amps daisy-chain
  // to each other. ampsInRange = size of the chain you're plugged into (0 = unplugged).
  const ampRigs = computeAmpRigs(amps, spirits);
  const ampsInRange = acting ? (ampRigs.rigByOwner[acting.id]?.amps.length ?? 0) : 0;
  // 🤖 keep the bot's live-state mirrors fresh
  useEffect(() => { moveStepsLeftRef.current = moveStepsLeft; }, [moveStepsLeft]);
  useEffect(() => { actionTokenUsedRef.current = actionTokenUsed; }, [actionTokenUsed]);
  useEffect(() => { actingRef.current = acting; }, [acting]);
  useEffect(() => { winnerRef.current = winner; }, [winner]);
  useEffect(() => { ampsInRangeRef.current = ampsInRange; }, [ampsInRange]);
  // "Goes to eleven" event boost — counts as +1 amp in range while active
  const elevenBoost = (actingNoteState?.elevenTurns ?? 0) > 0 ? 1 : 0;
  const diceTier = AMP_DICE[Math.min(ampsInRange + elevenBoost, 3)];
  const hcPoints      = actingNoteState?.hcPoints      ?? 0;
  const upgradesPending = actingNoteState?.upgradesPending ?? 0;
  // 🎓 showTip runs from setTimeouts — a ref keeps its view of the Theory Tree
  // modal fresh (the closure's `upgradesPending` can be a render behind).
  useEffect(() => { upgradesPendingRef.current = upgradesPending; }, [upgradesPending]);
  // 🎓 Flush tips that were queued while the Theory Tree modal was up — one at
  // a time (reruns as each closes), after a beat so the modal animates out.
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
  function isNotePlayable(note) {
    if (currentScale.includes(note)) return true;
    const key = getIntervalKey(note);
    if (!key) return false;
    if (key === 'tritone') return unlockedIntervalKeys.has('tritone');
    return unlockedIntervalKeys.has(key); // interval notes: playable once unlocked
  }
  const feedbackBoost  = actingNoteState?.feedbackBoost  ?? false;
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
          return true;
        })
        .map(h => h.num)
    );
  }, [action, acting, moveStepsLeft, spiritByNum]);

  // ─── NOTE SOUND (distorted guitar) ───────────────────────────────────────────
  const audioCtxRef = useRef(null);

  // ── 🎛️ AMP KNOBS — player-adjustable tone for note playback ────────────────
  // drive: distortion amount · tone: brightness · echo: slapback level/repeats
  // verb: reverb wet level. Defaults match the original baked-in sound.
  const TONE_KNOB_DEFAULTS = { drive: 0.45, tone: 0.35, echo: 0.55, verb: 0.18, voice: 'saw' };
  // 🎚️ Each Spirit starts with its OWN signature tone; any tweak a player makes
  // applies only to that Spirit, never the others. Keyed by spirit id.
  const TONE_BY_SPIRIT = {
    cosmic_ronin:      { drive: 0.55, tone: 0.62, echo: 0.40, verb: 0.18, voice: 'saw' },      // bright cutting lead
    intergalactic_0:   { drive: 0.30, tone: 0.42, echo: 0.55, verb: 0.38, voice: 'triangle' }, // mellow cosmic groove
    Metalness_Monster: { drive: 0.82, tone: 0.30, echo: 0.20, verb: 0.14, voice: 'fuzz' },      // heavy fuzz
    Glamarchy:         { drive: 0.45, tone: 0.55, echo: 0.62, verb: 0.42, voice: 'square' },    // glam shimmer
  };
  // 🎙️ VOICE — the oscillator character. Each voice swaps the waveforms (and
  // tweaks how hard it drives) for a genuinely different timbre, cycling order:
  const TONE_VOICE_ORDER = ['saw', 'square', 'triangle', 'sine', 'fuzz'];
  const TONE_VOICES = {
    saw:      { label: 'LEAD',   osc1: 'sawtooth', osc2: 'sawtooth', sub: 'square',   driveMul: 1.0,  octave: false },
    square:   { label: 'BUZZ',   osc1: 'square',   osc2: 'square',   sub: 'square',   driveMul: 0.9,  octave: false },
    triangle: { label: 'MELLOW', osc1: 'triangle', osc2: 'triangle', sub: 'sine',     driveMul: 0.7,  octave: false },
    sine:     { label: 'CLEAN',  osc1: 'sine',     osc2: 'sine',     sub: 'sine',     driveMul: 0.5,  octave: false },
    fuzz:     { label: 'FUZZ',   osc1: 'square',   osc2: 'sawtooth', sub: 'square',   driveMul: 1.5,  octave: true  },
  };
  // Per-spirit tone state: every Spirit owns its tone; the panel edits the ACTING
  // Spirit's, and the synth plays each note in the tone of whoever is performing.
  const [toneBySpirit, setToneBySpirit] = useState(() => {
    const m = {};
    for (const id of Object.keys(SPIRIT_DEFS)) m[id] = { ...TONE_KNOB_DEFAULTS, ...(TONE_BY_SPIRIT[id] ?? {}) };
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

  // Cached noise impulse response for the reverb convolver (built once per ctx)
  const reverbImpulseRef = useRef(null);
  function getReverbImpulse(ctx) {
    if (reverbImpulseRef.current && reverbImpulseRef.current.sampleRate === ctx.sampleRate) {
      return reverbImpulseRef.current;
    }
    const len = Math.floor(ctx.sampleRate * 1.7);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      }
    }
    reverbImpulseRef.current = buf;
    return buf;
  }

  function getAudioCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

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

  // Waveshaper curve for hard clipping distortion
  function makeDistortionCurve(ctx, amount = 300) {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function playNoteSound(note, opts = {}) {
    try {
      const ctx = getAudioCtx();
      let freq = opts.freq; // optional raw-frequency override (riff-off octave contours)
      if (freq == null) {
        const pc = NOTE_FREQS[note];
        if (pc === undefined) return;
        freq = PC_FREQ_BASE[pc];
      }
      const now = ctx.currentTime;
      const holdTime  = opts.holdTime  ?? 1.1;   // how long it stays loud
      const fadeTime  = opts.fadeTime  ?? 0.8;   // release fade duration
      const volume    = opts.volume    ?? 0.18;
      const totalTime = holdTime + fadeTime;
      // 🎛️ Amp knob settings (live — read from ref so timeouts get fresh values)
      const kn = toneBySpiritRef.current?.[actingRef.current?.id] ?? TONE_KNOB_DEFAULTS;

      // 🎙️ VOICE — wave character (defaults to the classic saw lead)
      const V = TONE_VOICES[kn.voice] ?? TONE_VOICES.saw;

      // Two detuned oscillators for thickness — waveform set by the VOICE
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = V.osc1;
      osc2.type = V.osc2;
      osc1.frequency.setValueAtTime(freq,         now);
      osc2.frequency.setValueAtTime(freq * 1.008, now); // slight detune

      // Sub oscillator one octave down for body
      const sub = ctx.createOscillator();
      sub.type = V.sub;
      sub.frequency.setValueAtTime(freq / 2, now);

      // Optional octave-UP oscillator — gives FUZZ its searing bite
      let oct = null, octGain = null;
      if (V.octave) {
        oct = ctx.createOscillator(); oct.type = 'square';
        oct.frequency.setValueAtTime(freq * 2, now);
        octGain = ctx.createGain(); octGain.gain.value = 0.16;
        oct.connect(octGain);
      }

      // Mix oscillators
      const oscGain1 = ctx.createGain(); oscGain1.gain.value = 0.5;
      const oscGain2 = ctx.createGain(); oscGain2.gain.value = 0.5;
      const subGain  = ctx.createGain(); subGain.gain.value  = 0.2;
      osc1.connect(oscGain1); osc2.connect(oscGain2); sub.connect(subGain);

      // Pre-distortion gain — DRIVE knob, scaled by the voice (1× clean → ~11× scorching)
      const drive = ctx.createGain(); drive.gain.value = (1 + kn.drive * 10) * V.driveMul;
      oscGain1.connect(drive); oscGain2.connect(drive); subGain.connect(drive);
      if (octGain) octGain.connect(drive);

      // Waveshaper distortion — curve hardness follows DRIVE (wider, gnarlier range)
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(ctx, 20 + kn.drive * 900 * V.driveMul);
      shaper.oversample = '4x';
      drive.connect(shaper);

      // Tone stack — TONE knob opens the lowpass (1.2kHz dark → 6.5kHz bright)
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1200 + kn.tone * 5300; lp.Q.value = 0.9;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 120;
      shaper.connect(lp); lp.connect(hp);

      // Presence mid boost — a touch more presence as TONE opens up
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking'; mid.frequency.value = 1800;
      mid.gain.value = 3 + kn.tone * 4; mid.Q.value = 1.2;
      hp.connect(mid);

      // Hotter drive compensation — a gentle backoff; the master limiter below
      // catches the peaks, so DRIVE can roar much harder than before
      const comp = ctx.createGain();
      comp.gain.value = 1 - kn.drive * 0.12;
      mid.connect(comp);

      // 🔊 MASTER LIMITER — tames peaks so cranked drive/voices stay punchy
      // without clipping the output. Everything (dry + echo + verb) feeds it.
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -16; master.knee.value = 22;
      master.ratio.value = 5; master.attack.value = 0.003; master.release.value = 0.25;
      master.connect(ctx.destination);

      // Amp envelope: sharp pick → hold at volume → slow fade
      const ampEnv = ctx.createGain();
      ampEnv.gain.setValueAtTime(0,              now);
      ampEnv.gain.linearRampToValueAtTime(volume,            now + 0.008);      // pick attack
      ampEnv.gain.linearRampToValueAtTime(volume * 0.82,     now + 0.06);       // slight settle
      ampEnv.gain.setValueAtTime(volume * 0.82,              now + holdTime);   // hold
      ampEnv.gain.exponentialRampToValueAtTime(0.001,        now + totalTime);  // slow release

      // ECHO knob — slapback delay level + regenerating repeats (lusher range)
      const delayNode  = ctx.createDelay(0.7);
      delayNode.delayTime.value = 0.19;
      const delayGain  = ctx.createGain();
      delayGain.gain.value = kn.echo * 0.68;
      const delayFb    = ctx.createGain();           // feedback — repeats grow with knob
      delayFb.gain.value = Math.min(0.72, kn.echo * 0.7);
      const delayFade  = ctx.createGain();
      delayFade.gain.setValueAtTime(1,  now + 0.19);
      delayFade.gain.exponentialRampToValueAtTime(0.001, now + totalTime + 0.6 + kn.echo * 1.6);

      comp.connect(ampEnv);
      // Dry path
      ampEnv.connect(master);
      // Wet delay path (with feedback loop for repeats)
      if (kn.echo > 0.02) {
        ampEnv.connect(delayNode);
        delayNode.connect(delayFb);
        delayFb.connect(delayNode);
        delayNode.connect(delayGain);
        delayGain.connect(delayFade);
        delayFade.connect(master);
      }
      // VERB knob — convolution reverb wet path
      if (kn.verb > 0.02) {
        const convolver = ctx.createConvolver();
        convolver.buffer = getReverbImpulse(ctx);
        const revGain = ctx.createGain();
        revGain.gain.value = kn.verb * 0.85;
        ampEnv.connect(convolver);
        convolver.connect(revGain);
        revGain.connect(master);
      }

      osc1.start(now); osc2.start(now); sub.start(now);
      if (oct) oct.start(now);
      const tail = 0.35 + kn.echo * 1.6; // let echo repeats ring out
      osc1.stop(now + totalTime + tail);
      osc2.stop(now + totalTime + tail);
      sub.stop(now + totalTime + tail);
      if (oct) oct.stop(now + totalTime + tail);
    } catch (_) { /* audio unavailable — silent fail */ }
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
    intergalactic_0:   'pocket',     // 👽 swung 808 bassline
    Glamarchy:         'strut',      // 👑 stomp-clap swagger + glitter gliss
  };

  function playTrackSequence(track, opts = {}) {
    if (opts.style === 'shred')     { playShredSequence(track); return; }
    if (opts.style === 'breakdown') { playBreakdownSequence(track); return; }
    if (opts.style === 'pocket')    { playPocketSequence(track); return; }
    if (opts.style === 'strut')     { playStrutSequence(track); return; }
    // The committed track plays as a real MELODY, not a slop of evenly
    // spaced notes. Each commit rolls a fresh groove: a mix of eighths,
    // quarters and dotted notes, the occasional breath between phrases,
    // a couple of random accents — and the final note rings out long,
    // because every phrase deserves a resolution.
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
      const vlf = voiceLeadFreq(note, prevFreq); if (vlf) prevFreq = vlf;
      setTimeout(() => playNoteSound(note, {
        holdTime: dur,
        fadeTime: last ? 0.9 : 0.35,
        volume: accent ? 0.19 : 0.14,
        freq: vlf ?? undefined,
      }), tMs);
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
  function clickNoteStock(idx, _flyEvent, _forceChordMode) {
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
    if (chordMode || _forceChordMode) {
      if (hasConfirmed) { addLog('✓ Already confirmed this turn.'); return; }
      if (pivotPending) { addLog('⚡ Declare Major or Minor first!'); return; }
      if (actingNoteState?.revoiceUsedThisTurn) { addLog('🎸 You\'ve already revoiced your chord this turn.'); return; }
      const chord = actingNoteState?.chordStack ?? [];
      if (chord.length >= 5) { addLog('🎸 Chord is full (5 notes) — drop one to revoice.'); return; }
      const note = noteStock[idx];
      playNoteSound(note);
      // 🎸 FLY — launch chord note chip animation toward the chord stack slot
      if (typeof _flyEvent === 'object' && _flyEvent && chordStackRef.current) {
        const src = _flyEvent.currentTarget?.getBoundingClientRect?.();
        const stackEl = chordStackRef.current;
        const stackRect = stackEl.getBoundingClientRect();
        // Target = centre of the slot this note will land in (vertical, top→bottom)
        const slotH = (stackRect.height - 30) / 5; // rough per-slot height
        const slotIdx = chord.length; // about to become this index
        const tgtX = stackRect.left + stackRect.width / 2;
        const tgtY = stackRect.top + 20 + slotIdx * slotH + slotH / 2;
        if (src) {
          const srcX = src.left + src.width / 2;
          const srcY = src.top + src.height / 2;
          setFlyChordNote({ note, x: tgtX, y: tgtY, dx: srcX - tgtX, dy: srcY - tgtY, key: Date.now() });
          setTimeout(() => setFlyChordNote(null), 500);
        }
      }
      setNoteField(acting.id, {
        chordStack:   [...chord, note],
        usedStockIdx: usedAdd(usedStockIdx, idx),
        revoiceUsedThisTurn: true,
      });
      addLog(`🎸 ${note} → chord (revoiced to ${chord.length + 1} notes)`);
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
    playNoteSound(note);
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

  // 🎸 Drop one note from your Chord Stack — costs your single revoice for the turn.
  // Floored at 1 note so your stance is never empty (you always have SOME chord).
  function removeChordNote(i) {
    if (!acting || !canAct || hasConfirmed || pivotPending) return; // N4/N7: gate
    if (actingNoteState?.revoiceUsedThisTurn) { addLog('🎸 You\'ve already revoiced this turn.'); return; }
    const chord = actingNoteState?.chordStack ?? [];
    if (chord.length <= 1) { addLog('🎸 Can\'t drop your last note — your stance needs at least one.'); return; }
    if (i < 0 || i >= chord.length) return;
    const dropped = chord[i];
    setNoteField(acting.id, { chordStack: chord.filter((_, k) => k !== i), revoiceUsedThisTurn: true });
    addLog(`🎸 Dropped ${dropped} from the chord (revoiced).`);
  }

  function declarePivot(newMode) {
    if (!acting || !canAct) return; // N4/N7: gate
    if (newMode === 'minor' && !(actingNoteState?.unlockedSkills ?? []).includes('theory_minor')) {
      addLog('🔒 Minor Tonality is locked — unlock it in the Theory tree to play in a minor key.');
      return;
    }
    // Resolve canonical spelling now that mode is known (handles G#/Ab, C#/Db splits)
    const respelledRoot = canonicalRoot(rootNote, newMode);
    // Respell the existing stock to match the new root context
    const respelledStock = (actingNoteState?.noteStock ?? []).map(n => {
      const pool = getSpelledPool(respelledRoot, newMode);
      const idx = pitchIndex(n);
      return idx !== -1 ? pool[idx] : n;
    });

    // ── MODE BONUS ────────────────────────────────────────────────────────────
    // Major → +1 HC point (bright momentum, major scales favour harmonic runs)
    // Minor → +1 tempSustain (dark resolve, defensive edge)
    const isMojoDrained = (actingNoteState?.mojoDrain ?? 0) > 0;
    let bonusPatch = {};
    let bonusMsg = '';
    if (newMode === 'major') {
      const targetSkill = actingNoteState?.targetSkillId ? SKILL_BY_ID[actingNoteState.targetSkillId] : null;
      const targetCost  = targetSkill?.hcCost ?? HC_UPGRADE_THRESHOLD;
      const { newHCPoints, upgradeTriggered } = advanceHC(actingNoteState?.hcPoints ?? 0, 1, targetCost);
      const newUpgradesPending = upgradeTriggered
        ? (actingNoteState?.upgradesPending ?? 0) + 1
        : (actingNoteState?.upgradesPending ?? 0);
      bonusPatch = { hcPoints: newHCPoints, upgradesPending: newUpgradesPending,
        totalHC: (actingNoteState?.totalHC ?? 0) + 1 };
      bonusMsg = upgradeTriggered
        ? ` · ☀️ Major bonus: +1 HC → 🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!`
        : ` · ☀️ Major bonus: +1 HC [${newHCPoints}/${targetCost}]`;
    } else {
      if (!isMojoDrained) {
        const prevDrive = actingNoteState?.tempDrive ?? 0;
        const newDrive = prevDrive + 1;
        bonusPatch = { tempDrive: newDrive };
        bonusMsg = ` · 🌑 Minor bonus: +1 Drive (now +${newDrive})`;
      } else {
        bonusMsg = ' · 🌑 Minor (Mojo Drained — Drive bonus blocked)';
      }
    }

    setNoteField(acting.id, {
      scaleMode:   newMode,
      rootNote:    respelledRoot,
      pivotPending: false,
      noteStock:   respelledStock,
      ...bonusPatch,
    });
    addLog(`🎸 ${respelledRoot} ${newMode} — scale set, start building!${bonusMsg}`);
    setTurnStep('chord'); // advance HUD flow → chord stack
    setTimeout(() => showTip('chord'), 300);
    // If Major bonus triggered an upgrade, award the skill
    if (bonusPatch.upgradesPending > (actingNoteState?.upgradesPending ?? 0) && actingNoteState?.targetSkillId) {
      setTimeout(() => awardTargetSkill(acting.id), 60);
    }
  }

  function clearNoteTrack() {
    if (!acting || !canAct) return; // N4/N7: gate
    setNoteField(acting.id, {
      melodyLine: [],
      usedStockIdx: [],
      discordCount: 0,
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
      discordCount: newDiscord,
      bankedNote:   null,  // consumed
    });
    addLog(`💾 Banked note ${note} → track (${playable ? 'playable' : '⚡ discord'}) · ${newTrack.length} notes`);
  }

  function confirmNoteTrack() {
    if (!acting || !canAct) return; // N4/N7: gate
    const baseTrack = actingNoteState?.melodyLine ?? [];
    if (baseTrack.length === 0) { addLog('❌ No notes in track!'); return; }
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
      playTrackSequence(melodyLine, { style: COMMIT_STYLES[acting?.id] });
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
    // Overdrive card: pardon one discord note (reduce effective discord by 1)
    const overdriveActive = actingNoteState?.overdriveActive ?? false;
    // 🌀 FREESTYLE — Intergalactic 0's first wrong note each turn lands intentional, not wrong:
    // it's pardoned from the discord penalty (and, below, doesn't drag the crowd + earns Flair).
    const freestylePardon = acting?.id === 'intergalactic_0';
    const effectiveDiscord = Math.max(0, discordCount - (overdriveActive ? 1 : 0) - (freestylePardon ? 1 : 0));
    // chromClimbActive: if discord_4 unlocked and a chromatic run of 3+ is present,
    // treat the track as non-discord for scoring (individual grey notes are cosmetic only)
    // Note: chromClimbActive is set after the discord upgrade flags below — forward ref is fine
    // because we only use it after those lines. We declare it here as a let and assign below.
    let allInScale     = effectiveDiscord === 0;
    const lastNote     = melodyLine[melodyLine.length - 1];
    const firstNote    = melodyLine[0];
    // pivotPending is now set at the START of the next turn (in startNewTurnNotes),
    // not here at the end of scoring — so the key choice is a start-of-round decision.
    const newPivotPending = false; // will be set true when next turn begins
    // Carry forward current mode as default; player can change at pivot prompt
    const newMode = scaleMode;
    // Respell the new root note using enharmonic map (split roots resolve at next pivot)
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
    // Tritone: anywhere in track → feedbackBoost (works even with Dischord)
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
    // Chromatic run: detect longest run; discord only if discord_4 not unlocked
    const chromRunLen        = detectChromaticRun(melodyLine);
    const chromStagger       = hasChromClimb ? staggerDuration(chromRunLen) : 0;
    // If discord_4 unlocked and a chrom run of 3+ exists, the whole track is treated as non-discord
    const chromClimbActive   = hasChromClimb && chromRunLen >= 3;
    if (chromClimbActive) allInScale = true;

    // ── 🔥 DEVIL'S INTERVAL → BURN (Tritone last note, discord_3 unlocked) ─────
    // Ending on the tritone ARMS a Burn for this turn. The next rival you ATTACK
    // (swing or sonic) catches fire: Burned for 2 turns, 50% each of those turns
    // to lose 1 Vibe. The arm is consumed by the first hit that lands
    // (applied in applyPendingCombatEffects, which runs on every hit).
    let feedbackOverloadMsg = '';
    const burnArm = isTritoneEnd && !isMojoDrained;
    if (burnArm) {
      feedbackOverloadMsg = ' · 🔥 BURN ARMED — next attack sets the rival alight!';
      addLog(`🔥 ${acting.name}'s Devil's Interval smoulders — your next attack will BURN the target!`);
      triggerEffectFlash(acting.id, '🔥', 'BURN ARMED!', '#ff5522');
    }

    // ── DRIVE BOOST: diatonic step runs (scale-only, blocked by Mojo Drain) ──
    const diatonicRunLen   = detectDiatonicRun(melodyLine, currentScale);

    // ── 🗡️ RIFF SLAYER (Metalness) — a skip-climb (3+ notes leaping by thirds,
    // one direction) ARMS the intimidation for this turn. If a riff-off breaks
    // out before the turn ends, the rival's notes will glitch.
    const ownsRiffSlayer = (actingNoteState?.unlockedSkills ?? []).includes('riff_slayer');
    const skipClimbLen   = detectSkipClimb(melodyLine, currentScale);
    const riffSlayerArm  = ownsRiffSlayer && skipClimbLen >= 3;

    // ── 🌀 PARANOIA (Metalness) — supercharges Mojo Drain (Blues Lick). When the
    // m7 ending charges a drain, Paranoia stretches it to 3 turns AND charges a
    // 2-slot note freeze on the same hit.
    const ownsParanoia   = (actingNoteState?.unlockedSkills ?? []).includes('paranoia');

    // ── 🎴 いいラッシュ / E-RUSH (Shredding Ronin) — ending a track on an E arms
    // the ghost-note barrage for any riff-off that breaks out this turn.
    const ownsERush      = (actingNoteState?.unlockedSkills ?? []).includes('e_rush');
    const eRushArm       = ownsERush && lastNote === 'E';

    const rawDriveBoost    = !isMojoDrained ? driveBoostFromRun(diatonicRunLen) : 0;
    const prevTempDrive    = actingNoteState?.tempDrive ?? 0;
    let newTempDrive       = prevTempDrive;
    let driveOverflowToHC  = 0; // lower-value discard feeds Harmonic Charge
    if (rawDriveBoost > 0) {
      if (rawDriveBoost > prevTempDrive) {
        driveOverflowToHC = prevTempDrive; // discard lower into HC
        newTempDrive = rawDriveBoost;
      } else {
        driveOverflowToHC = rawDriveBoost; // new one is lower — discard it
        // prevTempDrive stays
      }
    }

    // ── FEEDBACK BOOST: repeat patterns (scale-only, blocked by Mojo Drain) ───
    const repeatPatLen      = detectRepeatPattern(melodyLine, currentScale);
    const rawSustainBoost   = !isMojoDrained ? sustainBoostFromPattern(repeatPatLen) : 0;
    const prevTempSustain   = actingNoteState?.tempSustain ?? 0;
    let newTempSustain      = prevTempSustain;
    let sustainOverflowToHC = 0;
    if (rawSustainBoost > 0) {
      if (rawSustainBoost > prevTempSustain) {
        sustainOverflowToHC = prevTempSustain;
        newTempSustain = rawSustainBoost;
      } else {
        sustainOverflowToHC = rawSustainBoost;
      }
    }

    // Total overflow fed to Harmonic Charge as bonus points
    const hcOverflow = driveOverflowToHC + sustainOverflowToHC;

    // ── APPLY SELF EFFECTS (blocked by Mojo Drain) ───────────────────────────
    const newFeedbackBoost = !isMojoDrained && trackHasTritone;
    const newDieFloorBoost = !isMojoDrained && isOctaveResolution ? 2 : 0;

    // ── MAJOR 3RD: cleanse oldest status effect ───────────────────────────────
    // Cleanses one ACTIVE debuff — the game's real debuffs are individual flags
    // (mojoDrain / stagger / tripped / dazed / instrumentDropped), so check those
    // first; the legacy statusEffects list is kept as a fallback.
    let newStatusEffects = [...(actingNoteState?.statusEffects ?? [])];
    let majorThirdMsg = '';
    let cleansePatch = {};
    if (isMajorThirdEnd) {
      if ((actingNoteState?.mojoDrain ?? 0) > 0)   { cleansePatch.mojoDrain = 0;             majorThirdMsg = ' · ✨ Maj3 — cleansed Mojo Drain'; }
      else if (actingNoteState?.stagger)           { cleansePatch.stagger = null;            majorThirdMsg = ' · ✨ Maj3 — cleansed Stagger'; }
      else if ((actingNoteState?.burn?.turnsLeft ?? 0) > 0) { cleansePatch.burn = null;       majorThirdMsg = ' · ✨ Maj3 — doused the Burn'; }
      else if (actingNoteState?.tripped)           { cleansePatch.tripped = false;           majorThirdMsg = ' · ✨ Maj3 — cleansed Tripped'; }
      else if (actingNoteState?.dazed)             { cleansePatch.dazed = false;             majorThirdMsg = ' · ✨ Maj3 — cleansed Dazed'; }
      else if (actingNoteState?.instrumentDropped) { cleansePatch.instrumentDropped = false; majorThirdMsg = ' · ✨ Maj3 — recovered instrument'; }
      else if (newStatusEffects.length > 0) {
        const removed = newStatusEffects.shift();
        majorThirdMsg = ` · ✨ Maj3 — cleansed "${removed}"`;
      } else {
        // No active debuff — raise a shield that blocks the NEXT incoming status.
        cleansePatch.statusShield = true;
        majorThirdMsg = ' · ✨ Maj3 — SHIELD up (blocks next status)';
      }
      const shieldUp = !!cleansePatch.statusShield;
      addLog(`✨ ${acting.name}'s Borrowed Chord rings out${majorThirdMsg.replace(' · ✨ Maj3 —', '')}!`);
      triggerEffectFlash(acting.id, '✨', shieldUp ? 'SHIELD UP!' : 'CLEANSED!', '#44ffaa');
    }

    // ── HC SCORING ────────────────────────────────────────────────────────────
    // A track scores its base Harmonic Charge, then a DISCHORD costs a flat 1 point
    // for the whole track (not 1 per note), floored at 0. A dischord note no longer
    // wipes the round to zero — it just trims a point. Chromatic Climb pardons fully;
    // Chromatic Mastery halves the (already small) cost.
    const hasChromMastery = (actingNoteState?.unlockedSkills ?? []).includes('theory_chromatic');
    const discordFlat    = effectiveDiscord > 0 ? 1 : 0;
    const discordPenalty = chromClimbActive ? 0 : (hasChromMastery ? Math.floor(discordFlat / 2) : discordFlat);
    const baseScore = scoreTrackHC(melodyLine, fourthNote, fifthNote);
    let breakdown = [...baseScore.breakdown];
    let earned = Math.max(0, baseScore.points - discordPenalty);
    if (discordPenalty > 0 && baseScore.points > 0) {
      breakdown.push(`−${discordPenalty} discord`);
    }
    // ── 🎭 PERFORMANCE SCORE P — FLAIR (Crowd & Intimidation layer, §4) ──
    // P measures how INTERESTING the placement was, not how long the track is:
    // melodic shape (contour, leaps, interval variety) + palette + recognized
    // gestures + repeated motifs, with track length only a small nudge. 0–10.
    // The pure kernel now lives in engine/systems/economy.js (`performanceScore`,
    // Phase 5a — single source of truth); it's invoked below once its remaining
    // inputs (Edge resolve, suspended ending) are known.

    // ── ⚡ DISSONANCE EDGE — dissonance as a combat stance, not a banked meter ──
    // (DESIGN_AUDIT_v2.md §9 v2. Replaces the Tension meter, which banked
    // off-scale play into a hidden number cashed in later for free — no cost
    // to sitting on it, no cost that scaled with how much was piled on. This
    // version puts the risk ON the board: ending a track on a Discord note
    // trades Sustain for Drive, visibly, so it's a stance a rival can read and
    // swing at, not a savings account nobody can see.)
    //
    // Stage 0 = off. End a track on a Discord (off-scale) note → stage 1: Drive
    // up, Sustain down, HC + fans paid up front. Stay out another turn without
    // landing on your Root/3rd/5th → stage 2 (stronger buff, steeper cost) —
    // that's the LAST turn to resolve. Land the resolve any time you're riding
    // and you get Sustain back, a +1 temp Drive flourish, and an HC bonus scaled
    // to the stage you resolved from. Miss the resolve on the stage-2 turn and
    // it collapses: stance gone, fans walk, a self-inflicted Vibe hit — the tune
    // just fell apart. Getting into ANY battle while riding burns the stance
    // either way, win or lose (see `clearBattleBuffs`) — you don't get to bank
    // the risk past the fight you chose to take it into.
    const chordTones         = new Set([currentScale[0], currentScale[2], currentScale[4]]);
    const edgeResolvedNow    = melodyLine.length > 0 && chordTones.has(lastNote);
    const edgeEndedOnDiscord = melodyLine.length > 0 && !isNotePlayable(lastNote);
    const prevEdgeStage      = actingNoteState?.edgeStage ?? 0;
    let newEdgeStage           = prevEdgeStage;
    let edgeHcCost             = 0;
    let edgeFanCost            = 0;
    let edgeHcBonus            = 0;
    let edgeCollapseFans       = 0;
    let edgeResolvedThisTurn   = false;
    let edgeCollapsedThisTurn  = false;
    if (prevEdgeStage === 0) {
      if (edgeEndedOnDiscord) {
        newEdgeStage = 1;
        edgeHcCost   = EDGE_HC_COST_BY_STAGE[1];
        edgeFanCost  = EDGE_FAN_COST_BY_STAGE[1];
        showTip('edge');
        addLog(`⚡ ${acting.name} steps onto the Edge — Drive +${EDGE_DRIVE_BY_STAGE[1]} / Sustain −${EDGE_SUSTAIN_PENALTY_BY_STAGE[1]} (−${edgeHcCost} HC, −${edgeFanCost} fan${edgeFanCost !== 1 ? 's' : ''}).`);
        triggerEffectFlash(acting.id, '⚡', 'ON THE EDGE!', '#ff8866');
      }
    } else if (edgeResolvedNow) {
      edgeHcBonus = EDGE_RESOLVE_HC_BONUS_BY_STAGE[prevEdgeStage];
      newEdgeStage = 0;
      edgeResolvedThisTurn = true;
      addLog(`⚡ ${acting.name} resolves the Edge (was stage ${prevEdgeStage}/${EDGE_MAX_STAGE}) — Sustain restored, +1 temp Drive, +${edgeHcBonus} HC!`);
      triggerEffectFlash(acting.id, '⚡', 'RESOLVED!', '#ffd700');
    } else if (prevEdgeStage >= EDGE_MAX_STAGE) {
      newEdgeStage = 0;
      edgeCollapsedThisTurn = true;
      edgeCollapseFans = EDGE_COLLAPSE_FAN_LOSS;
      addLog(`⚡ ${acting.name} never resolved the Edge — it collapses! Stance lost, ${EDGE_COLLAPSE_FAN_LOSS} fans walk, −${EDGE_COLLAPSE_VIBE} Vibe.`);
      triggerEffectFlash(acting.id, '⚡', 'COLLAPSE!', '#ff3344');
      applyVibeDamage(acting.id, EDGE_COLLAPSE_VIBE, 'Dissonance Collapse');
    } else {
      newEdgeStage = prevEdgeStage + 1;
      edgeHcCost   = EDGE_HC_COST_BY_STAGE[newEdgeStage];
      edgeFanCost  = EDGE_FAN_COST_BY_STAGE[newEdgeStage];
      const lastChance = newEdgeStage >= EDGE_MAX_STAGE;
      addLog(`⚡ ${acting.name} rides it out — Edge escalates to stage ${newEdgeStage}/${EDGE_MAX_STAGE} (Drive +${EDGE_DRIVE_BY_STAGE[newEdgeStage]} / Sustain −${EDGE_SUSTAIN_PENALTY_BY_STAGE[newEdgeStage]}, −${edgeHcCost} HC, −${edgeFanCost} fan${edgeFanCost !== 1 ? 's' : ''})${lastChance ? ' — RESOLVE NEXT TURN OR LOSE IT' : ''}.`);
      triggerEffectFlash(acting.id, '⚡', lastChance ? 'LAST CHANCE!' : 'ESCALATED!', '#ff5566');
    }
    // Resolve pays a one-turn Drive flourish through the existing tempDrive
    // pipeline (same field the pattern-boost detectors above already write) —
    // it's exactly that kind of reward, so it reuses the rail instead of adding one.
    if (edgeResolvedThisTurn) newTempDrive = Math.max(newTempDrive, 1);

    // theory_sus — a suspended ending (the 2nd or 4th) earns a small "hang" flair once unlocked
    const perfSusEnd = (actingNoteState?.unlockedSkills ?? []).includes('theory_sus')
      && (lastNote === semitonesUpSpelled(rootNote, scaleMode, 2) || lastNote === intervals.fourth);
    // 🎭 Performance Score P — pure kernel (engine/systems/economy.js). `freestyle`
    // (Intergalactic 0's pardoned first wrong note) comes back too, since the flash/
    // log below need it and its arithmetic must not drift from the score's.
    const { score: perfScore, freestyle: perfFreestyle } = performanceScore({
      melodyLine,
      trackHasTritone, isOctaveResolution,
      diatonicRunLen, repeatPatLen, skipClimbLen,
      hasGatedEnding: isMinorSeventhEnd || isMajorThirdEnd || isTritoneEnd,
      hasRiff: !!riffMatch, cadenceResolved,
      earned, edgeResolved: edgeResolvedThisTurn, susEnd: perfSusEnd,
      discordCount, freestylePardon,
    });

    // ── 🎭 STAGE B ROUTING: Performance Score P → HC top-up (§5b) + crowd excitement (§5a) ──
    // Baseline-on for now (no skill gate yet — will later sit behind Crowd Read / Stage Presence).
    const perfHcBonus = perfScore >= 10 ? 2 : (perfScore >= 7 ? 1 : 0);   // §5b — tiny, capped at +2
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
    while (perfExcitement >= EXCITE_PER_CASUAL)   { perfExcitement -= EXCITE_PER_CASUAL;   perfFansGained += 1; }
    while (perfLoyalty    >= LOYALTY_PER_DIEHARD) { perfLoyalty    -= LOYALTY_PER_DIEHARD; perfPromotions += 1; }
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

    // Drive/Sustain overflow feeds HC points (non-stacking rule); Edge HC cost is
    // a real sacrifice, not a soft floor — it can eat into points earned this turn.
    const earnedTotal = earned + hcOverflow + perfHcBonus + edgeHcBonus - edgeHcCost;

    // Check upgrade threshold against target skill cost
    const targetSkill = actingNoteState?.targetSkillId ? SKILL_BY_ID[actingNoteState.targetSkillId] : null;
    const targetCost  = targetSkill?.hcCost ?? HC_UPGRADE_THRESHOLD;
    const { newHCPoints: rawHCPoints, upgradeTriggered } = advanceHC(hcPoints, earnedTotal, targetCost);
    const newHCPoints = Math.max(0, rawHCPoints); // floor — a heavy Edge cost can't drive the bar negative
    const newUpgradesPending = upgradeTriggered
      ? (actingNoteState?.upgradesPending ?? 0) + 1
      : (actingNoteState?.upgradesPending ?? 0);

    // ── POINTS FLASH ─────────────────────────────────────────────────────────
    const flashLines = [];
    if (earned > 0) {
      flashLines.push(`+${earned} HC pts`);
      breakdown.forEach(b => flashLines.push(b));
      if (upgradeTriggered) flashLines.push(`🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!`);
    }
    if (rawDriveBoost > 0)    flashLines.push(`⚔️ Drive +${newTempDrive}${driveOverflowToHC > 0 ? ` (↑HC +${driveOverflowToHC})` : ''}`);
    if (rawSustainBoost > 0)  flashLines.push(`🛡️ Sustain +${newTempSustain}${sustainOverflowToHC > 0 ? ` (↑HC +${sustainOverflowToHC})` : ''}`);
    if (trackHasTritone)      flashLines.push('🔥 Tritone — Damage ×2');
    if (isOctaveResolution)   flashLines.push('🎶 Octave — HC +2');
    if (isMajorThirdEnd)      flashLines.push(cleansePatch.statusShield ? '✨ Borrowed Chord — Shield Up!' : '✨ Borrowed Chord — Cleanse!');
    if (isMinorSeventhEnd)    flashLines.push(ownsParanoia ? '🌀 PARANOIA — drain 3t + 2 slots frozen!' : '🎷 Blues Lick — Mojo Drain!');
    if (riffSlayerArm)        flashLines.push(`🗡️ RIFF SLAYER ARMED — skip-climb ×${skipClimbLen}!`);
    if (eRushArm)             flashLines.push('🎴 いいラッシュ ARMED — ghost barrage ready!');
    if (isTritoneEnd)         flashLines.push('🔥 Devil\u2019s Interval — Burn armed!');
    if (chromStagger > 0)     flashLines.push(`⚡ Chromatic Climb ×${chromRunLen} — Stagger ${chromStagger}t`);
    if (chromClimbActive && discordCount > 0) flashLines.push(`⚡ Chromatic Climb — discord pardoned`);
    if (perfFreestyle > 0)    flashLines.push('🌀 Freestyle — first wrong note landed perfect!');
    if (canBank)              flashLines.push(`💾 Banked: ${newBankedNote.note}`);
    if (totalNotes > actingSpeed && !canBank) flashLines.push(`⚠️ ${totalNotes - actingSpeed} note(s) discarded (bank full)`);
    if (discordPenalty > 0)   flashLines.push(`⚡ ${discordCount} Dischord — −${discordPenalty} HC`);
    if (edgeResolvedThisTurn)    flashLines.push(`⚡ Edge resolved — Sustain back, +1 Drive, +${edgeHcBonus} HC`);
    else if (edgeCollapsedThisTurn) flashLines.push(`⚡ Edge collapsed — −${EDGE_COLLAPSE_VIBE} Vibe, −${edgeCollapseFans} fans`);
    else if (newEdgeStage > 0)   flashLines.push(`⚡ Edge ${newEdgeStage}/${EDGE_MAX_STAGE}${newEdgeStage >= EDGE_MAX_STAGE ? ' — resolve next turn!' : ''}`);
    flashLines.push(`🎭 Performance ${perfScore}/10`);
    if (perfHcBonus > 0)    flashLines.push(`🎸 Flair HC +${perfHcBonus}`);
    if (perfFansGained > 0) flashLines.push(`🎤 +${perfFansGained} new fan${perfFansGained !== 1 ? 's' : ''} won over!`);
    if (perfPromotions > 0) flashLines.push(`💜 ${perfPromotions} fan${perfPromotions !== 1 ? 's' : ''} → Diehard!`);
    if (flashLines.length > 0) {
      setPointsFlash({ lines: flashLines, key: Date.now() });
      setTimeout(() => setPointsFlash(null), 4500);
    }

    // ── LOG ───────────────────────────────────────────────────────────────────
    const scoreStr = earned > 0
      ? ` · 🎯 +${earned}pts (${breakdown.join(', ')})${hcOverflow > 0 ? ` +${hcOverflow}HC overflow` : ''}${upgradeTriggered ? ` · 🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!` : ` · HC [${newHCPoints}/${targetCost}]`}`
      : (discordPenalty > 0 ? ` · ⚡ ${discordCount} Dischord — no points` : ` · HC [${newHCPoints}/${targetCost}]`);
    const driveMsg   = rawDriveBoost > 0   ? ` · ⚔️ Drive +${newTempDrive}` : '';
    const sustMsg    = rawSustainBoost > 0  ? ` · 🛡️ Sustain +${newTempSustain}` : '';
    const triMsg     = trackHasTritone      ? ' · 🔥 Damage ×2'          : '';
    const octMsg     = isOctaveResolution   ? ' · 🎶 Octave HC+2'           : '';
    const m7Msg      = isMinorSeventhEnd    ? (ownsParanoia ? ' · 🌀 Paranoia ready (3t + freeze)' : ' · 🎷 Mojo Drain ready') : '';
    const rsMsg      = riffSlayerArm        ? ' · 🗡️ Riff Slayer ARMED' : '';
    const tritoneEndMsg = '';
    const chrMsg     = chromStagger > 0     ? ` · ⚡ Stagger ${chromStagger}t`   : '';
    const chromClimbMsg = (chromClimbActive && discordCount > 0) ? ' · ⚡ Chrom Climb — no discord' : '';
    const speedMsg   = totalNotes > actingSpeed
      ? ` · SPD ${actingSpeed}/${totalNotes}${canBank ? ` · 💾 ${newBankedNote.note} banked` : ' · bank full'}`
      : ` · SPD ${hexes}/${actingSpeed}`;
    addLog(`✓ Committed · ${hexes} hexes${scoreStr}${driveMsg}${sustMsg}${triMsg}${octMsg}${majorThirdMsg}${m7Msg}${tritoneEndMsg}${chrMsg}${chromClimbMsg}${feedbackOverloadMsg}${rsMsg}${speedMsg} · Next RN: ${newRootRaw} (pick Major/Minor)`);
    if (trackHasTritone || isMinorSeventhEnd || isMajorThirdEnd || isOctaveResolution) showTip('intervals');

    // 🎸 Your chord is a STANDING stance — it persists across turns and is only
    // changed by a revoice (one note add/drop per turn), so we don't touch it here.
    setChordMode(false);
    setNoteField(acting.id, {
      melodyLine:       [],
      discordCount:    0,
      pivotPending:    newPivotPending,
      rootNote:        newRootRaw,
      scaleMode:       newMode,
      hcPoints:        newHCPoints,
      totalHC:         (actingNoteState?.totalHC ?? 0) + earnedTotal,
      edgeStage:       newEdgeStage,
      perfScore:       perfScore,
      recentP:         [...(actingNoteState?.recentP ?? []), perfScore].slice(-2),
      excitement:      perfExcitement,
      loyalty:         perfLoyalty,
      lowPerfStreak:   lowPerfStreak,
      upgradesPending: newUpgradesPending,
      hasConfirmed:    true,
      feedbackBoost:   newFeedbackBoost,
      dieFloorBoost:   newDieFloorBoost,
      statusEffects:   newStatusEffects,
      tempDrive:       newTempDrive,
      tempSustain:     newTempSustain,
      bankedNote:      newBankedNote,
      pendingMojoDrain: isMinorSeventhEnd ? (ownsParanoia ? 3 : 2) : (actingNoteState?.pendingMojoDrain ?? 0),
      pendingStagger:  (isMinorSeventhEnd && ownsParanoia) ? 3
                       : (chromStagger > 0 ? chromStagger : (actingNoteState?.pendingStagger ?? 0)),
      pendingParanoia: (isMinorSeventhEnd && ownsParanoia) ? true : false,
      riffSlayerArmed: riffSlayerArm ? true : (actingNoteState?.riffSlayerArmed ?? false),
      burnArmed:       burnArm ? true : (actingNoteState?.burnArmed ?? false),
      eRushArmed:      eRushArm ? true : (actingNoteState?.eRushArmed ?? false),
      overdriveActive: false,
      transposeCardPending: null,
      ...cleansePatch, // Borrowed Chord (Maj3 end) — clears one active debuff
    });
    // If a skill was just earned, award it now (adds to unlockedSkills, fires side-effects).
    // Small timeout so the state update above settles before awardTargetSkill reads noteStates.
    if (upgradeTriggered && actingNoteState?.targetSkillId) {
      setTimeout(() => awardTargetSkill(acting.id), 60);
    }
    setTurnStep('move_act'); // advance HUD flow → movement & actions
    setTimeout(() => showTip('move_act'), 300);
    // Grant the movement budget — the engine applies the tripped-halving rule.
    // (tripped is still true at commit time; it clears at the START of this spirit's NEXT turn)
    const grantedSteps = dispatch(moveBudgetSet(hexes, !!actingNoteState?.tripped)).turn.moveStepsLeft;
    if (actingNoteState?.tripped) {
      addLog(`🌀 ${acting?.name} is TRIPPED — movement halved this turn! (${grantedSteps} hex${grantedSteps !== 1 ? 'es' : ''})`);
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
  // pivotPending is preserved so the Major/Minor prompt appears before building starts.
  // Also clears per-turn debuffs: tripped (movement halved), dazed, instrumentDropped.
  function startNewTurnNotes(spiritId) {
    // Record whether this spirit starts their turn on the limelight hex.
    // (The engine reads its own synced spirit positions.)
    dispatch(turnStarted(spiritId));
    setNoteStates(prev => {
      const ns = prev[spiritId];
      if (!ns) return prev;

      // 🎵 GRADUAL REFILL — unused notes carry over; only up to STOCK_REFILL_RATE
      // spent slots recharge this turn. Spend big one turn, run short the next.
      const usedIdxs   = usedList(ns.usedStockIdx);
      const refreshing = new Set(usedIdxs.slice(0, STOCK_REFILL_RATE));
      const newStock = ns.noteStock.map((note, idx) =>
        refreshing.has(idx) ? randomNote(ns.rootNote, ns.scaleMode) : note
      );
      const carriedUsed = usedIdxs.filter(i => !refreshing.has(i)); // insertion order preserved (was a Set)

      // 🎵 Announce the refill instead of letting it happen silently — same
      // "pop in like fans do" treatment as flashFanFx, deferred via setTimeout
      // so it fires safely outside this functional update (mirrors tickFans).
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

      return {
        ...prev,
        [spiritId]: {
          ...ns,
          noteStock:    newStock,
          melodyLine:    [],
          revoiceUsedThisTurn: false,  // 🎸 fresh revoice each turn — your chord PERSISTS
          usedStockIdx: carriedUsed,
          discordCount: 0,
          hasConfirmed: false,
          dieFloorBoost: 0,
          smashExposed: false,   // 🎸💥 exposure clears at the start of your own turn
          // 🌌 Displace cooldown ticks down on Intergalactic 0's own turns
          displaceCd: Math.max(0, (ns.displaceCd ?? 0) - 1),

          // Tick down roadie cooldowns
          roadies: (ns.roadies ?? []).map(r =>
            r.cooldownTurns > 0 ? { ...r, cooldownTurns: r.cooldownTurns - 1 } : r
          ),
          // Tick down groupie crew cooldowns
          groupieCooldowns: Object.fromEntries(
            Object.entries(ns.groupieCooldowns ?? {}).map(([k, v]) => [k, Math.max(0, v - 1)])
          ),
          // Tick down cadence objective cooldowns
          cadenceCooldowns: Object.fromEntries(
            Object.entries(ns.cadenceCooldowns ?? {}).map(([k, v]) => [k, Math.max(0, v - 1)])
          ),
          // Tick down "goes to eleven" boost
          elevenTurns: Math.max(0, (ns.elevenTurns ?? 0) - 1),
          // ⚡ Charge Zone charges tick down on the holder's own turns (2 ≈ 2 rounds);
          // battles burn them early via burnChargesAfterBattle.
          chargeFloorTurns: Math.max(0, (ns.chargeFloorTurns ?? 0) - 1),
          chargeCeilTurns:  Math.max(0, (ns.chargeCeilTurns  ?? 0) - 1),
          // ⚡ Overcharge bonus revoice expires unspent — it's a one-shot, not a
          // recurring budget like revoiceUsedThisTurn.
          bonusRevoiceAvailable: false,
          // Mixer recharges every turn
          mixerUsedThisTurn: false,
          // 🥊 CQC swing exposure clears at the start of your next turn
          swingExposed: false,
          // Refresh modulation cards (exhausted resets each turn) — but spent
          // one-shots (e.g. the starter Transpose) fall away instead of recharging.
          modCards: (ns.modCards ?? [])
            .filter(c => !(c.oneShot && c.exhausted))
            .map(c => ({ ...c, exhausted: false })),
          // Prompt major/minor choice at the START of this spirit's turn
          pivotPending: true,
          // 🗡️ Riff Slayer only lives for the turn it was armed — disarm on next turn
          riffSlayerArmed: false,
          // 🔥 Devil's Interval Burn arm likewise only lives for the turn it was set
          burnArmed: false,
          // 🎴 E-Rush likewise only lives for the turn it was armed
          eRushArmed: false,
        },
      };
    });
  }

  // Called when an attack hits — apply pendingMojoDrain / pendingStagger to target.
  // (Blues Lick charges Mojo Drain, Chromatic Climb charges Stagger; both land
  // on the next attack target, swing or sonic.)
  function applyPendingCombatEffects(attackerId, targetId) {
    // Read current state up-front so we can log outside the updater
    const atkNow = noteStates[attackerId] ?? {};
    const tgtNow = noteStates[targetId] ?? {};
    const willDrain   = (atkNow.pendingMojoDrain ?? 0) > 0 && (tgtNow.mojoDrain ?? 0) === 0;
    const willStagger = (atkNow.pendingStagger ?? 0) > 0 && !tgtNow.stagger;
    const isParanoia  = !!atkNow.pendingParanoia && willDrain;
    const atkName = spirits.find(s => s.id === attackerId)?.name;
    const tgtName = spirits.find(s => s.id === targetId)?.name;
    // ✨ Borrowed Chord shield blocks Mojo Drain / Stagger entirely — the
    // attacker still spends the charge (it was "used up" breaking the shield).
    if ((willDrain || willStagger) && consumeStatusShield(targetId)) {
      addLog(`✨ ${tgtName} is shielded — ${atkName}'s status attack fizzles!`);
      setNoteStates(prev => ({ ...prev, [attackerId]: { ...(prev[attackerId] ?? {}),
        pendingMojoDrain: 0, pendingStagger: 0, pendingParanoia: false, burnArmed: false } }));
      return;
    }
    if (isParanoia) {
      addLog(`🌀 ${atkName}'s PARANOIA grips ${tgtName} — Mojo Drained ${atkNow.pendingMojoDrain} turns AND 2 note slots frozen. They can't play straight!`);
      showTip('status_effect');
    } else {
      if (willDrain) {
        addLog(`💧 ${atkName}'s Blues Lick lands — ${tgtName} is MOJO DRAINED for ${atkNow.pendingMojoDrain} turn${atkNow.pendingMojoDrain !== 1 ? 's' : ''}!`);
        showTip('status_effect');
      }
      if (willStagger) {
        addLog(`⚡ ${atkName}'s attack STAGGERS ${tgtName} — 2 note slots frozen for ${atkNow.pendingStagger} turn${atkNow.pendingStagger !== 1 ? 's' : ''}!`);
        showTip('status_effect');
      }
    }
    // 💥 Board VFX — staggered after any CQC flashes already queued
    if (isParanoia) {
      setTimeout(() => triggerEffectFlash(targetId, '🌀', 'PARANOIA!', '#aa55ff'), 150);
    } else {
      if (willDrain)   setTimeout(() => triggerEffectFlash(targetId, '💧', 'MOJO DRAINED!', '#4499ff'), 150);
      if (willStagger) setTimeout(() => triggerEffectFlash(targetId, '⚡', 'STAGGERED!', '#ff8800'), willDrain ? 650 : 150);
    }

    setNoteStates(prev => {
      const atk = prev[attackerId];
      const tgt = prev[targetId];
      if (!atk || !tgt) return prev;

      let newAtk = { ...atk, pendingMojoDrain: 0, pendingStagger: 0, pendingParanoia: false, feedbackBoost: false };
      let newTgt = { ...tgt };

      // Mojo Drain: strip boosts + silence for 2 turns (blocked if already drained)
      if ((atk.pendingMojoDrain ?? 0) > 0 && (tgt.mojoDrain ?? 0) === 0) {
        newTgt = {
          ...newTgt,
          mojoDrain:      atk.pendingMojoDrain,
          feedbackBoost:  false,
          dieFloorBoost:  0,
          // statusEffects preserved — Mojo Drain silences future boosts, doesn't cleanse past debuffs
        };
      }

      // Stagger: pick 2 random stock slots, freeze them for N turns (doesn't stack)
      if ((atk.pendingStagger ?? 0) > 0 && !(tgt.stagger)) {
        const allSlots = Array.from({ length: 8 }, (_, i) => i);
        // Shuffle and pick 2
        for (let i = allSlots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
        }
        const frozenSlots = allSlots.slice(0, 2);
        newTgt = {
          ...newTgt,
          stagger: { slots: frozenSlots, turnsLeft: atk.pendingStagger },
        };
      }

      return { ...prev, [attackerId]: newAtk, [targetId]: newTgt };
    });

    // 🔥 BURN — Devil's Interval armed this attack; the struck rival catches fire.
    const atkBurnArmed = (engineRef.current.noteStates?.[attackerId] ?? noteStates[attackerId] ?? {}).burnArmed;
    if (atkBurnArmed) {
      // The charge is spent on this hit either way — disarm now.
      setNoteStates(prev => ({ ...prev, [attackerId]: { ...(prev[attackerId] ?? {}), burnArmed: false } }));
      if (consumeStatusShield(targetId)) {
        addLog(`✨ ${tgtName} is shielded — ${atkName}'s Burn fizzles out!`);
      } else {
        setNoteStates(prev => ({ ...prev, [targetId]: { ...(prev[targetId] ?? {}), burn: { turnsLeft: 2 } } }));
        addLog(`🔥 ${atkName}'s Devil's Interval IGNITES ${tgtName} — BURNED for 2 turns (50%/turn to lose 1 Vibe)!`);
        showTip('status_effect');
        setTimeout(() => triggerEffectFlash(targetId, '🔥', 'BURNED!', '#ff5522'), 300);
      }
    }
  }

  // ─── INITIAL SKILL PICK — open skill tree overlay at the very start of a spirit's first turn ───
  // Triggers once per spirit when they have never chosen a skill target.
  useEffect(() => {
    if (!acting) return;
    // OWNERSHIP: only the client that controls the acting spirit may open the
    // pick and write to its tree — remote clients would otherwise dispatch a
    // duplicate NOTE_SHEET_PATCHED and relay it (desync). They receive the
    // acting client's write via the ACTION relay instead.
    if (!canAct) return;
    const ns = noteStates[acting.id] ?? {};
    const hasTarget   = !!ns.targetSkillId;
    const hasSkills   = (ns.unlockedSkills?.length ?? 0) > 0;
    const hasPending  = (ns.upgradesPending ?? 0) > 0;
    const alreadyPrompted = !!ns.initialPickDone;
    // Only prompt once, and only if they have nothing yet
    if (!hasTarget && !hasSkills && !hasPending && !alreadyPrompted) {
      setNoteStates(prev => ({
        ...prev,
        [acting.id]: {
          ...prev[acting.id],
          upgradesPending: 1,
          initialPickDone: true,
        }
      }));
      setTimeout(() => showTip('skill_tree'), 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting?.id]);
  function move(toNum) {
    const s = spirits.find(sp => sp.id === acting.id);
    const ns = noteStates[acting.id] ?? {};

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
    // Amps no longer unplug/replug from movement — distance just makes the rig go
    // COLD (handled live by computeAmpRigs) and re-powers when you step back in range.
    // The `unplugged` flag is now strictly sabotage (Pranksta) and only a Roadie clears it.
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
  }

  // ─── SKILL TREE — TARGET SELECTION & AWARD ───────────────────────────────────
  // New flow:
  //   1. Player picks a target skill → stored as targetSkillId, hcCost stored as target cost
  //   2. Every HC earned counts toward hcPoints (resets at targetCost, carries overflow)
  //   3. When threshold hit → upgradesPending=1, skill awarded automatically, overlay opens to pick next
  //   4. Player picks next target → overlay closes, cycle repeats

  function applySkillEffects(spiritId, skillId) {
    // Pure side-effects only (state mutations outside noteStates)
    // noteStates.unlockedSkills is updated by the caller
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    const skill  = SKILL_BY_ID[skillId];

    if (skillId === 'fans_4eva')    addLog(`💚 ${spirit?.name} — Fans 4Eva! Crew ready to deploy from your HUD: restore 2 Vibe.`);
    if (skillId === 'pranksta')     addLog(`🪤 ${spirit?.name} — Bust Out Pranksta! Crew ready to deploy: disconnect up to 2 rival amps.`);
    if (skillId === 'junkyard_dog') addLog(`🔩 ${spirit?.name} — Junkyard Dog! Crew ready to deploy: arm a junkyard weapon (+2 on next Swing).`);
    if (skillId === 'fandom_army')  addLog(`🛡️ ${spirit?.name} — Several Fandom Army! Crew ready to deploy: +2 Sustain for your next battle.`);
    if (skillId === 'hero_pose')    addLog(`🌟 ${spirit?.name} — HERO POSE unlocked! Pose on centre hex for 2 turns to win.`);
    if (skillId === 'master_moshpits') addLog(`🤘 ${spirit?.name} — MASTER OF MOSHPITS! Win a battle with a banked note to burn it for +1 Vibe and flood the pit.`);
    if (skillId === 'riff_slayer')  addLog(`🗡️ ${spirit?.name} — RIFF SLAYER! Commit a skip-climb (notes leaping by thirds) to rattle a rival in any riff-off that turn.`);
    if (skillId === 'paranoia')     addLog(`🌀 ${spirit?.name} — PARANOIA! Your Mojo Drain now lasts 3 turns AND freezes 2 of the rival's note slots.`);
    if (skillId === 'azrael')       addLog(`💀 ${spirit?.name} — AZRAEL! Every rival you knock down feeds Fame equal to your knockdown streak. Resets when you go down.`);
    if (skillId === 'psycho_bushido') addLog(`🌀 ${spirit?.name} — PSYCHO BUSHIDO! A Thrash swing of 5–6 forces the rival's die to a 1.`);
    if (skillId === 'e_rush')       addLog(`🎴 ${spirit?.name} — いいラッシュ unlocked! End on an E, then a riff-off that turn buries the rival under ghost notes.`);
    if (skillId === 'theory_major')     addLog(`🎼 ${spirit?.name} — THE FULL SCALE! The 4th & 7th are now Discord-free — your Major scale is complete.`);
    if (skillId === 'theory_minor')     addLog(`🌑 ${spirit?.name} — MINOR TONALITY! You can now declare Minor at the pivot and play a minor key, clean.`);
    if (skillId === 'theory_sus')       addLog(`🕊️ ${spirit?.name} — SUSPENSIONS! Ending on the 2nd or 4th now rings out for bonus Flair.`);
    if (skillId === 'theory_dom7')      addLog(`🎷 ${spirit?.name} — DOMINANT 7th! The ♭7 joins your clean palette — blues away.`);
    if (skillId === 'theory_modes')     addLog(`🌀 ${spirit?.name} — MODAL SHIFT! Lydian ♯4 and Mixolydian ♭7 are now clean color tones.`);
    if (skillId === 'theory_chromatic') addLog(`⚡ ${spirit?.name} — CHROMATIC MASTERY! All Discord penalties are halved.`);
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
    if (skillId === 'hydra')        addLog(`🐉 ${spirit?.name} — HYDRA! With 3 amps, your Sonic Attack rolls 3d6 and fires three beams.`);
    if (skillId === 'blaster_of_ra') addLog(`🌀 ${spirit?.name} — BLASTER OF RA! Your Smash becomes a ranged, piercing bass-drop down the beam — undefendable, scatters & knocks back every rival in line.`);
    if (skillId === 'displace')      addLog(`🌌 ${spirit?.name} — DISPLACE! Warp to your amp rig for 3 AP (2-turn cooldown). He doesn't run — he transcends space.`);
    if (skillId === 'sunbeam')       addLog(`☀️ ${spirit?.name} — SUNBEAM! With 3 amps, your Sonic beam reaches +2 hexes and leaves burning ground in its wake.`);

    // CQC skill → swing tier; pure `CQC_SWING_MAP` from engine/systems/skills.js.
    if (CQC_SWING_MAP[skillId]) {
      const tier = SWING_UPGRADE_TIERS.find(t => t.id === CQC_SWING_MAP[skillId]);
      addLog(`🥊 ${spirit?.name} unlocks ${skill?.label}! ${tier?.desc ?? ''}`);
      // PERMANENT +1 DRIVE — practising the CQC arts makes the Spirit stronger
      // over the game. Idempotent: each CQC skill grants its +1 only once.
      const alreadyBuffed = (ns.driveBuffsApplied ?? []).includes(skillId);
      if (!alreadyBuffed) {
        setSpirits(prev => prev.map(s => s.id === spiritId ? { ...s, drive: (s.drive ?? 6) + 1 } : s));
        setNoteStates(prev => {
          const ns2 = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: {
            ...ns2, driveBuffsApplied: [...(ns2.driveBuffsApplied ?? []), skillId]
          }};
        });
        addLog(`💪 ${spirit?.name}'s Thrash training pays off — permanent +1 Drive! (now ${(spirit?.drive ?? 6) + 1})`);
      }
    }
    if (['amp_1','amp_2','amp_3'].includes(skillId)) {
      const ownedCount = amps.filter(a => a.ownerId === spiritId).length;
      if (ownedCount < AMP_UPGRADE_MAX) {
        // Don't enter click-to-place mode here — the skill overlay is open and
        // swallows board clicks (this is what made placement feel broken).
        // The glowing "Place Amp" chip in CREW & GEAR handles placement anytime.
        addLog(`🔊 ${spirit?.name} — Amp ${ownedCount + 1} ready! Deploy it from CREW & GEAR on your spirit card.`);
      }
    }
    if (['roadie_1','roadie_2','roadie_3'].includes(skillId)) {
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
      if (elig.reason === 'prereq')        addLog(`❌ Requires ${SKILL_BY_ID[skill.prereq]?.label} first.`);
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
        hcPoints:            prev[spiritId]?.hcPoints ?? 0,
      }
    }));

    const spirit = spirits.find(s => s.id === spiritId);
    addLog(`🎯 ${spirit?.name} is saving toward: ${skill.icon} ${skill.label} (${skill.hcCost} HC)`);
    if (turnStep === 'pivot') setTimeout(() => showTip('pivot'), 400);
  }

  // Called when advanceHC fires upgradeTriggered — awards the target skill & opens overlay.
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
    const legacyMap = { amp:'amp_1', roadie:'roadie_1', close_combat:'shank_skank',
      discord_1:'discord_1', discord_2:'discord_2', discord_3:'discord_3', discord_4:'discord_4' };
    setSkillTarget(spiritId, legacyMap[categoryId] ?? categoryId);
  }

  // 🔊 Valid hexes for a spirit's NEXT amp. The FIRST amp sits beside the spirit; every
  // amp after must EXTEND the rig — placed touching one of that spirit's existing amps —
  // so the rig grows outward as one connected mass you commit to (and must defend).
  // Occupied hexes (spirits/amps) are excluded.
  function ampPlaceCandidates(spiritId) {
    const occupied = new Set([
      ...spirits.filter(s => !s.knockedOut).map(s => s.num),
      ...amps.map(a => a.hexNum),
    ]);
    const owned = amps.filter(a => a.ownerId === spiritId);
    const out = new Set();
    const addOpenNeighbors = (hexNum) => {
      const h = HEX_BY_NUM[hexNum]; if (!h) return;
      getFlatTopNeighborSlots(h).forEach(n => { if (!occupied.has(n.num)) out.add(n.num); });
    };
    if (owned.length === 0) {
      const sp = spirits.find(s => s.id === spiritId);
      if (sp) addOpenNeighbors(sp.num);
    } else {
      owned.forEach(a => addOpenNeighbors(a.hexNum));
    }
    return out;
  }

  // Player clicked a hex while ampPlacing — drop the amp there if valid
  function placeAmp(hexNum) {
    if (!canAct) return; // OWNERSHIP: only the controlling client places amps
    if (!ampPlacing) return;
    const spiritId = ampPlacing;
    const spirit = spirits.find(s => s.id === spiritId);
    if (!spirit) { setAmpPlacing(null); return; }
    const spiritHex = HEX_BY_NUM[spirit.num];
    if (!spiritHex) { setAmpPlacing(null); return; }
    // First amp drops beside you; later amps must extend the connected rig.
    const hasRig = amps.some(a => a.ownerId === spiritId);
    if (!ampPlaceCandidates(spiritId).has(hexNum)) {
      addLog(hasRig
        ? '🔊 Amps must EXTEND your rig — place on an open hex touching one of your amps.'
        : '🔊 Place your first Amp on an open hex beside you.');
      return;
    }
    const newAmp = {
      id: `amp-${spiritId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ownerId: spiritId,
      ownerColor: spirit.color,
      hexNum,
      connected: false,
    };
    setAmps(prev => [...prev, newAmp]);
    setAmpPlacing(null);
    addLog(`🔊 ${spirit.name} places an Amp on hex #${hexNum}!`);
    showTip('amp_place');
    // Only reopen the "pick next target" overlay if this placement came from a skill-award flow
    setNoteStates(prev => {
      const ns = prev[spiritId] ?? {};
      if (!ns.pendingAwardSkillId) return prev; // manual placement — no overlay needed
      return {
        ...prev,
        [spiritId]: {
          ...ns,
          upgradesPending:     1,
          pendingAwardSkillId: null,
        }
      };
    });
  }

  // Amp connection is now automatic — determined by axialDist at derived-state time.
  // Kept as a no-op for any residual UI references.
  function connectAmp() {}

  // ─── CREW & GEAR DEPLOYABLES ─────────────────────────────────────────────────
  // Groupie crews are one-tap abilities in the HUD. Each deployment puts that
  // crew on a GROUPIE_COOLDOWN (own turns) before it can be sent out again.
  function deployGroupie(spiritId, skillId) {
    if (!canAct) return; // N4/N7: gate
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    if (!spirit || spirit.knockedOut) return;
    if (!(ns.unlockedSkills ?? []).includes(skillId)) return;
    if ((ns.groupieCooldowns?.[skillId] ?? 0) > 0) {
      addLog(`🎉 That crew is still recovering — ${ns.groupieCooldowns[skillId]} turn(s) left.`);
      return;
    }

    const startCooldown = () => setNoteStates(prev => ({
      ...prev,
      [spiritId]: {
        ...prev[spiritId],
        groupieCooldowns: { ...(prev[spiritId]?.groupieCooldowns ?? {}), [skillId]: GROUPIE_COOLDOWN },
      },
    }));

    // Groupies stream out from this Spirit's home corner toward whatever they act on.
    const homeNum = CORNERS[spirit.corner]?.homeNum ?? spirit.num;

    if (skillId === 'fans_4eva') {
      if (spirit.vibe >= spirit.maxVibe) { addLog(`💚 ${spirit.name} is already at full Vibe — save the fans for later!`); return; }
      flyCrew({ fromHexNum: homeNum, toHexNum: spirit.num, icon:'🎉', color:'#ff66bb', label:'🎉 Crowd-surf!' });
      setSpirits(prev => prev.map(s => s.id === spiritId
        ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 2) } : s));
      addLog(`💚 ${spirit.name} crowd-surfs into their fans — +2 Vibe restored!`);
      startCooldown();
      return;
    }

    if (skillId === 'pranksta') {
      const spiritHex = HEX_BY_NUM[spirit.num];
      if (!spiritHex) return;
      // Up to 2 nearest live rival amps within 4 hexes
      const targets = amps
        .filter(a => a.ownerId !== spiritId && !a.unplugged)
        .map(a => {
          const ah = HEX_BY_NUM[a.hexNum];
          return ah ? { amp: a, dist: axialDist(spiritHex.q, spiritHex.r, ah.q, ah.r) } : null;
        })
        .filter(t => t && t.dist <= 4)
        .sort((x, y) => x.dist - y.dist)
        .slice(0, 2);
      if (targets.length === 0) { addLog(`🪤 No live rival amps within 4 hexes — the pranksters shrug.`); return; }
      const hitIds = new Set(targets.map(t => t.amp.id));
      setAmps(prev => prev.map(a => hitIds.has(a.id)
        ? { ...a, unplugged: true, unpluggerId: spiritId } : a));
      targets.forEach(t => {
        const owner = spirits.find(s => s.id === t.amp.ownerId);
        flyCrew({ fromHexNum: homeNum, toHexNum: t.amp.hexNum, icon:'🎉', color:'#ff66bb', label:'🎉 Pranksta!' });
        addLog(`🪤 Pranksters yank the cable on ${owner?.name ?? 'a rival'}'s amp at #${t.amp.hexNum}!`);
      });
      if (targets[0]) focusOnHex(targets[0].amp.hexNum, 1100, 0.5);
      startCooldown();
      return;
    }

    if (skillId === 'junkyard_dog') {
      if (ns.junkyardArmed) { addLog(`🔩 ${spirit.name} is already holding a junkyard weapon!`); return; }
      flyCrew({ fromHexNum: homeNum, toHexNum: spirit.num, icon:'🎉', color:'#ff66bb', label:'🎉 Junkyard drop!' });
      setNoteStates(prev => ({
        ...prev,
        [spiritId]: { ...prev[spiritId], junkyardArmed: true },
      }));
      addLog(`🔩 The fans pass ${spirit.name} something rusty over the barricade — next Swing gets +2!`);
      startCooldown();
      return;
    }

    if (skillId === 'fandom_army') {
      flyCrew({ fromHexNum: homeNum, toHexNum: spirit.num, icon:'🎉', color:'#ff66bb', label:'🎉 Fan wall!' });
      setNoteStates(prev => {
        const cur = prev[spiritId] ?? {};
        return {
          ...prev,
          [spiritId]: { ...cur, tempSustain: Math.max(cur.tempSustain ?? 0, 2) },
        };
      });
      addLog(`🛡️ ${spirit.name}'s fandom forms a human wall — +2 Sustain for the next battle!`);
      startCooldown();
      return;
    }
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

  // Roadie action flow
  function startRoadieAction(spiritId, roadieId) {
    if (!canAct) return; // N4/N7: gate
    setRoadieAction({ spiritId, roadieId, phase: 'selectHex' });
    addLog(`🔧 Roadie activated — click a hex adjacent to your Amp`);
  }


  // ─── MODULATION CARDS ────────────────────────────────────────────────────────
  // MOD_CARD_DEFS: definitions for all card types
  const MOD_CARD_DEFS = {
    chromatic_shift: {
      icon: '🎼',
      name: 'Chromatic Shift',
      desc: 'Rewrite all discord notes in your stock into in-scale notes for your chosen mode.',
      color: '#44ffaa',
      usableWhen: 'after-pivot', // after choosing major/minor, before building
    },
    transpose: {
      icon: '🔄',
      name: 'Transpose',
      desc: 'Re-draw your Root Note from any note in your current stock — you choose.',
      color: '#ffcc44',
      usableWhen: 'during-pivot', // instead of accepting assigned root
    },
    overdrive: {
      icon: '⚡',
      name: 'Overdrive',
      desc: 'One discord note in your track counts as in-scale for HC scoring this turn.',
      color: '#ff8844',
      usableWhen: 'before-commit', // before committing the melody line
    },
  };

  function playModCard(cardId) {
    if (!acting || !canAct) return; // N4/N7: gate
    const ns = actingNoteState;
    const card = (ns?.modCards ?? []).find(c => c.id === cardId);
    if (!card || card.exhausted) return;
    const def = MOD_CARD_DEFS[card.type];
    if (!def) return;

    if (card.type === 'chromatic_shift') {
      if (pivotPending) { addLog('🎼 Declare Major or Minor first, then play Chromatic Shift.'); return; }
      // Replace all out-of-scale notes in stock with random in-scale notes
      const newStock = (ns.noteStock ?? []).map((note, idx) => {
        if (usedHas(ns.usedStockIdx, idx)) return note; // already used — leave it
        if (currentScale.includes(note)) return note; // already in scale — leave it
        // Out of scale — replace with a random in-scale note
        const inScalePool = currentScale;
        return inScalePool[Math.floor(Math.random() * inScalePool.length)];
      });
      setNoteField(acting.id, {
        noteStock: newStock,
        modCards: (ns.modCards ?? []).map(c => c.id === cardId ? { ...c, exhausted: true } : c),
      });
      addLog(`🎼 Chromatic Shift — all discord notes rewritten to ${rootNote} ${scaleMode}!`);
    }

    else if (card.type === 'transpose') {
      // Open a "pick your new root" overlay — set a pending state
      setNoteField(acting.id, {
        transposeCardPending: cardId,
        modCards: (ns.modCards ?? []).map(c => c.id === cardId ? { ...c, exhausted: true } : c),
      });
      addLog('🔄 Transpose — click any note in your stock to use it as your new Root Note.');
    }

    else if (card.type === 'overdrive') {
      if (hasConfirmed) { addLog('⚡ Overdrive must be played before committing your track.'); return; }
      setNoteField(acting.id, {
        overdriveActive: true,
        modCards: (ns.modCards ?? []).map(c => c.id === cardId ? { ...c, exhausted: true } : c),
      });
      addLog('⚡ Overdrive active — one discord note will count as in-scale this commit!');
    }
  }

  function resolveTransposeCard(noteIdx) {
    if (!acting) return;
    const ns = actingNoteState;
    if (!ns?.transposeCardPending) return;
    const newRoot = ns.noteStock[noteIdx];
    if (!newRoot) return;
    const canonRoot = canonicalRoot(newRoot, scaleMode);
    // Respell stock
    const pool = getSpelledPool(canonRoot, scaleMode);
    const newStock = (ns.noteStock ?? []).map(n => {
      const idx = pitchIndex(n);
      return idx !== -1 ? pool[idx] : n;
    });
    setNoteField(acting.id, {
      rootNote: canonRoot,
      noteStock: newStock,
      pivotPending: true, // re-prompt for major/minor with new root
      transposeCardPending: null,
    });
    addLog(`🔄 Transpose — new Root Note: ${canonRoot}. Choose Major or Minor.`);
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

  // ─── SWING EFFECTS (extended for full CQC skill chain) ────────────────────────
  // Builds a chance table from the attacker's unlockedSkills CQC chain.
  function getCQCChances(atkNs) {
    const skills = atkNs.unlockedSkills ?? [];
    // Base chances per CQC skill unlocked (cumulative — later tiers include earlier)
    if (skills.includes('baki_gravity'))   return { slip:0.35, dazed:0.23, drop:0.18, confused:0.10 };
    if (skills.includes('moon_shuffle'))   return { slip:0.30, dazed:0.18, drop:0.12, confused:0     };
    if (skills.includes('cosmic_boogaloo'))return { slip:0.25, dazed:0.15, drop:0,    confused:0     };
    if (skills.includes('shank_skank'))    return { slip:0.20, dazed:0,    drop:0,    confused:0     };
    return null;
  }

  // ─── SWING EFFECT INFO (shared by the roll, the result banner & the apply) ────
  // Human-readable description of what each status effect does AFTER the battle
  // (i.e. once the overlay closes and the defender has been pushed back). Keep
  // the `after` text aligned with what applySwingEffects actually does below.
  const SWING_FX_INFO = {
    slip:     { icon:'🌀', label:'Slip',     color:'#44ddff', after:'loses 2 note slots on their next turn' },
    trip:     { icon:'🌀', label:'Trip',     color:'#aaffaa', after:'movement halved on their next turn' },
    drop:     { icon:'🎸', label:'Drop',     color:'#ff4444', after:'drops their instrument — −1 Drive until they recover it' },
    dazed:    { icon:'😵', label:'Dazed',    color:'#ff66ff', after:'33% of their moves go the wrong way next turn' },
    confused: { icon:'💫', label:'Confused', color:'#ffaa44', after:'hurts itself for Vibe damage right after the push' },
  };
  // Friendly name of the highest swing/CQC upgrade the attacker owns.
  function swingUpgradeName(atkNs) {
    const skills = atkNs?.unlockedSkills ?? [];
    if (skills.includes('baki_gravity'))    return 'Baki Gravity';
    if (skills.includes('moon_shuffle'))    return 'Moon Shuffle';
    if (skills.includes('cosmic_boogaloo')) return 'Cosmic Boogaloo';
    if (skills.includes('shank_skank'))     return 'Shank Skank';
    const up = atkNs?.swingUpgrades ?? [];
    if (up.includes('swing_3')) return 'Dazed & Confused';
    if (up.includes('swing_2')) return 'Reckless Abandon';
    if (up.includes('swing_1')) return 'Dirty Boots';
    return 'Swing Upgrade';
  }

  // ─── ROLL SWING EFFECTS (pure — no state changes) ─────────────────────────────
  // Rolls the attacker's swing/CQC status-effect chances ONCE and freezes the
  // outcome so the result overlay can tell the player exactly what will happen
  // before they close it. Returns null when the attacker has no swing upgrade
  // (or the attack is Sonic — CQC is melee only). When it returns an object,
  // `effects` is the list that actually landed (empty array = rolled but missed).
  function rollSwingEffects(attackerId, sonicAttack) {
    if (sonicAttack) return null; // CQC = melee only
    const atkNs = noteStates[attackerId] ?? {};
    const cqcChances = getCQCChances(atkNs);
    const swingUpgrades = atkNs.swingUpgrades ?? [];
    if (!cqcChances && swingUpgrades.length === 0) return null;

    const chances = cqcChances ?? (() => {
      const highestTier = ['swing_3','swing_2','swing_1'].find(t => swingUpgrades.includes(t));
      return highestTier ? SWING_EFFECT_CHANCES[highestTier] : null;
    })();
    if (!chances) return null;

    const effects = [];
    if (chances.slip  > 0 && Math.random() < chances.slip)        effects.push('slip');
    if (chances.trip  > 0 && Math.random() < (chances.trip ?? 0)) effects.push('trip');
    if (chances.drop  > 0 && Math.random() < chances.drop)        effects.push('drop');
    if (chances.dazed > 0 && Math.random() < chances.dazed)       effects.push('dazed');
    if (chances.confused > 0 && Math.random() < chances.confused) effects.push('confused');

    // GUARANTEE: an upgraded CQC swing ALWAYS lands at least one effect on a hit.
    // The per-effect % now decides *which* / *how many* stack; if the independent
    // rolls all missed, force one in, weighted by this tier's chances.
    let guaranteed = false;
    if (effects.length === 0) {
      const pool = ['slip','trip','drop','dazed','confused']
        .map(k => [k, chances[k] ?? 0]).filter(([, w]) => w > 0);
      if (pool.length) {
        const total = pool.reduce((a, [, w]) => a + w, 0);
        let r = Math.random() * total, chosen = pool[0][0];
        for (const [k, w] of pool) { if (r < w) { chosen = k; break; } r -= w; }
        effects.push(chosen);
        guaranteed = true;
      }
    }

    // Pre-roll the Confused self-damage so the preview number matches what lands.
    let confusedDmg = 0;
    if (effects.includes('confused')) {
      const r = Math.floor(Math.random() * 6) + 1;
      confusedDmg = r <= 3 ? 1 : r <= 5 ? 2 : 3;
    }

    return { upgradeName: swingUpgradeName(atkNs), effects, confusedDmg, guaranteed };
  }

  // ─── SWING EFFECTS ────────────────────────────────────────────────────────────
  // Applies the status effects of a swing/CQC upgrade to the defender. Pass the
  // pre-rolled result from rollSwingEffects() so the board does exactly what the
  // result overlay promised; if omitted, it rolls fresh (legacy fallback).
  // Fires after the overlay closes — same beat as the knockback / push-back.
  // ── ✨ BORROWED CHORD SHIELD ──────────────────────────────────────────────
  // Returns true (and consumes the shield) if the spirit is holding a Borrowed
  // Chord shield. One shield blocks the ENTIRE next incoming negative-status
  // event (CQC procs, Mojo Drain, Stagger, Burn). Loud feedback so it's never
  // ambiguous whether it fired.
  function consumeStatusShield(spiritId) {
    const ns = engineRef.current.noteStates?.[spiritId] ?? noteStates[spiritId] ?? {};
    if (!ns.statusShield) return false;
    setNoteStates(prev => ({ ...prev, [spiritId]: { ...(prev[spiritId] ?? {}), statusShield: false } }));
    const sp = spirits.find(s => s.id === spiritId);
    addLog(`✨ ${sp?.name}'s Borrowed Chord shield absorbs the hit — status BLOCKED!`);
    triggerEffectFlash(spiritId, '✨', 'SHIELDED!', '#44ffaa');
    return true;
  }

  function applySwingEffects(attackerId, defenderId, prerolled) {
    const roll = prerolled !== undefined ? prerolled : rollSwingEffects(attackerId, false);
    if (!roll) return; // attacker has no swing upgrade

    const attacker = spirits.find(s => s.id === attackerId);
    const defender = spirits.find(s => s.id === defenderId);
    const effects = roll.effects ?? [];

    // Rolled, but nothing landed — tell the player so the upgrade never feels
    // silently broken.
    if (effects.length === 0) {
      addLog(`🗡️ ${attacker?.name}'s ${roll.upgradeName} rolled for a status effect on ${defender?.name} — but none landed this time.`);
      return;
    }

    // ✨ Borrowed Chord shield blocks the whole CQC status event.
    if (consumeStatusShield(defenderId)) {
      addLog(`✨ ${defender?.name} shrugs off ${attacker?.name}'s ${roll.upgradeName} — shielded!`);
      return;
    }

    // 💥 Board VFX — fire a shockwave flash on the victim for each landed
    // effect, staggered 0.5s apart so multiple procs read clearly. These land
    // the moment the hit resolves (same beat as the damage number).
    const FX_DEFS = {
      slip:     { icon:'🌀', label:'SLIPPED!',  color:'#44ddff' },
      trip:     { icon:'🌀', label:'TRIPPED!',  color:'#aaffaa' },
      drop:     { icon:'🎸', label:'DROPPED!',  color:'#ff4444' },
      dazed:    { icon:'😵', label:'DAZED!',    color:'#ff66ff' },
      confused: { icon:'💫', label:'CONFUSED!', color:'#ffaa44' },
    };
    effects.forEach((fx, i) => {
      const def = FX_DEFS[fx];
      if (def) setTimeout(() => triggerEffectFlash(defenderId, def.icon, def.label, def.color), i * 500);
    });

    setNoteStates(prev => {
      const tgt = prev[defenderId] ?? {};
      const updates = {};
      if (effects.includes('slip')) {
        // CQC SLIP: rival loses 2 notes next turn — freeze 2 random stock
        // slots for 1 turn (reuses the Stagger slot-freeze; ticks at the
        // end of the defender's own turn). Doesn't stack on an existing Stagger.
        if (!tgt.stagger) {
          const allSlots = Array.from({ length: 8 }, (_, i) => i);
          for (let i = allSlots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
          }
          updates.stagger = { slots: allSlots.slice(0, 2), turnsLeft: 1 };
          addLog(`🌀 ${attacker?.name} SLIPS ${defender?.name}! They lose 2 notes next turn.`);
        } else {
          addLog(`🌀 ${attacker?.name} slips ${defender?.name} — but they're already staggered.`);
        }
      }
      if (effects.includes('trip')) {
        updates.tripped = true;
        addLog(`🌀 ${attacker?.name} TRIPS ${defender?.name}! Movement halved next turn.`);
      }
      if (effects.includes('drop')) {
        updates.instrumentDropped = true;
        addLog(`💥 ${defender?.name} DROPS their instrument! -1 Drive until recovered.`);
      }
      if (effects.includes('dazed')) {
        updates.dazed = true;
        addLog(`😵 ${defender?.name} is DAZED & CONFUSED! Their moves next turn have a 33% chance of going the wrong way!`);
      }
      if (effects.includes('confused')) {
        // Baki Gravity confused: self-damage to defender. Use the value rolled
        // up-front (and shown in the result overlay) so the board matches.
        const confDmg = roll.confusedDmg ?? 1;
        addLog(`💫 ${defender?.name} is CONFUSED — hurts themselves for ${confDmg} Vibe dmg!`);
        // Apply self-damage after state update
        setTimeout(() => applyVibeDamage(defenderId, confDmg, 'confusion'), 200);
      }
      return { ...prev, [defenderId]: { ...tgt, ...updates } };
    });
  }

  // ─── AMP UNPLUG SYSTEM ────────────────────────────────────────────────────────
  // Amps NEVER unplug from movement — wandering just makes the rig go dead at
  // range (handled by computeAmpRigs). The `unplugged` flag is strictly sabotage
  // (Pranksta / an adjacent rival unplug), and the ONLY thing that clears it is a
  // Roadie's Fix Cable action (roadieStartFix → roadieReplugAmp). There is no
  // automatic re-plug — you must spend a Roadie to get back in the mix.

  // Unplug a rival's amp — must be adjacent to the amp hex
  function unplugRivalAmp(ampId) {
    if (!canAct) return; // N4/N7: gate
    const spirit = spirits.find(s => s.id === acting?.id);
    if (!spirit) return;
    const spiritHex = HEX_BY_NUM[spirit.num];
    setAmps(prev => prev.map(amp => {
      if (amp.id !== ampId) return amp;
      if (amp.ownerId === acting?.id) { addLog(`🔌 That's your own amp!`); return amp; }
      if (amp.unplugged) { addLog(`🔌 That amp is already unplugged.`); return amp; }
      const ampHex = HEX_BY_NUM[amp.hexNum];
      const neighbors = getFlatTopNeighborSlots(spiritHex);
      const isAdjacent = neighbors.some(n => n.num === amp.hexNum) || spirit.num === amp.hexNum;
      if (!isAdjacent) { addLog(`🔌 You need to be adjacent to the amp to unplug it!`); return amp; }
      const owner = spirits.find(s => s.id === amp.ownerId);
      addLog(`🔌 ${spirit.name} UNPLUGS ${owner?.name ?? 'rival'}'s amp on #${amp.hexNum}! They drop to d6 until a Roadie fixes it.`);
      return { ...amp, unplugged: true, unpluggerId: acting?.id };
    }));
  }

  // Roadie re-plugs an amp — called as part of roadie action
  function roadieReplugAmp(spiritId, ampId) {
    const spirit = spirits.find(s => s.id === spiritId);
    const ampNow = amps.find(a => a.id === ampId);
    // 🏃 Send a roadie token running from the Spirit to the amp it's fixing.
    if (spirit && ampNow) {
      flyCrew({ fromHexNum: spirit.num, toHexNum: ampNow.hexNum,
        icon: '🔧', color: spirit.color ?? '#ffcc44', label: '🔧 Fixing cable…' });
      focusOnHex(ampNow.hexNum, 1200, 0.5);
    }
    setAmps(prev => prev.map(amp => {
      if (amp.id !== ampId || !amp.unplugged) return amp;
      addLog(`🔧 ${spirit?.name}'s Roadie re-plugs the amp on #${amp.hexNum} — back in the mix!`);
      return { ...amp, unplugged: false, unpluggerId: null };
    }));
  }


  // ─── BOARD CARD SYSTEM ───────────────────────────────────────────────────────
  const MOD_CARD_TYPES = ['chromatic_shift', 'transpose', 'overdrive'];

  function pickRandomCardType() {
    return MOD_CARD_TYPES[Math.floor(Math.random() * MOD_CARD_TYPES.length)];
  }

  function spawnBoardCards(currentCards /* currentSpirits, currentAmps */) {
    // Mod Cards cut (Phase 6): the board no longer spawns 🃏 Mod Cards — that
    // scattered-pickup role is now Lost Chords (Lighters were cut too; see
    // ECONOMY_HANDOFF.md). No-op keeps callers safe.
    return currentCards ?? [];
  }

  // Called from move() — check if spirit stepped on a card hex
  function checkCardPickup(spiritId, hexNum) {
    const card = boardCards.find(c => c.hexNum === hexNum);
    if (!card) return;
    const cardType = pickRandomCardType();
    // Remove card from board immediately
    setBoardCards(prev => prev.filter(c => c.id !== card.id));
    // Open pickup modal
    setPendingCardPickup({ spiritId, cardType, cardId: card.id });
    addLog(`🃏 ${spirits.find(s=>s.id===spiritId)?.name} steps on a Mod Card!`);
  }

  function resolveCardPickup(choice) {
    // choice: 'take' | 'replace-idx-N' | 'discard'
    if (!pendingCardPickup) return;
    const { spiritId, cardType } = pendingCardPickup;
    const spirit = spirits.find(s => s.id === spiritId);
    const ns = noteStates[spiritId];
    const cards = ns?.modCards ?? [];
    const def = { chromatic_shift:'🎼 Chromatic Shift', transpose:'🔄 Transpose', overdrive:'⚡ Overdrive' }[cardType] ?? cardType;

    if (choice === 'discard') {
      addLog(`🃏 ${spirit?.name} discards the ${def}.`);
    } else if (choice === 'take') {
      // Hand not full — just add
      const newCard = { id: `card-${Date.now()}`, type: cardType, exhausted: false };
      setNoteField(spiritId, { modCards: [...cards, newCard] });
      addLog(`🃏 ${spirit?.name} picks up ${def}!`);
    } else if (choice.startsWith('replace-')) {
      const replaceIdx = parseInt(choice.split('-')[1], 10);
      const replaced = cards[replaceIdx];
      const replacedDef = { chromatic_shift:'🎼 Chromatic Shift', transpose:'🔄 Transpose', overdrive:'⚡ Overdrive' }[replaced?.type] ?? replaced?.type;
      const newCards = cards.map((c, i) =>
        i === replaceIdx ? { id: `card-${Date.now()}`, type: cardType, exhausted: false } : c
      );
      setNoteField(spiritId, { modCards: newCards });
      addLog(`🃏 ${spirit?.name} replaces ${replacedDef} with ${def}!`);
    }
    setPendingCardPickup(null);
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
  // 🎤 Fans, not HC: knowing rock trivia is crowd cred, not musicianship.
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

  // 🎵 Board mini-goal pickup — called whenever a spirit enters a hex during a move.
  // Lighters (direct, unearned Fame) were cut -- see ECONOMY_HANDOFF.md. Every
  // board token is a Lost Chord now. Landing on one now offers a real choice —
  // bank it into your stock (as before) or weave it straight into your Chord
  // Stack, spending this turn's revoice — unless that revoice is already spent,
  // in which case we skip the modal and auto-bank (still animated).
  function checkTokenPickup(spiritId, hexNum) {
    const tok = boardTokens.find(t => t.num === hexNum);
    if (!tok) return;
    dispatch(tokenPickedUp(spiritId, hexNum));
    // 🗡️ SHREDDING RONIN — the virtuoso finds more music in it: ~50% of the time he
    // pockets a SECOND (fresh in-scale) note from the same find. Roll once, here.
    const roninGreed = spiritId === 'cosmic_ronin' && Math.random() < 0.5;
    const revoiceSpent = !!noteStates[spiritId]?.revoiceUsedThisTurn;
    if (revoiceSpent) {
      bankLostChordNote(spiritId, tok.note, roninGreed);
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
    if (choice === 'chord') {
      const sp = spirits.find(s => s.id === spiritId);
      const ns = noteStates[spiritId] ?? {};
      if ((ns.chordStack ?? []).length >= 5) { bankLostChordNote(spiritId, note, roninGreed); return; }
      setNoteStates(prev => {
        const cur = prev[spiritId]; if (!cur) return prev;
        return { ...prev, [spiritId]: { ...cur, chordStack: [...(cur.chordStack ?? []), note], revoiceUsedThisTurn: true } };
      });
      addLog(`🎸 ${sp?.name} weaves the Lost Chord (${note}) straight into the Chord Stack — revoiced!`);
      // The Ronin's serendipitous second note (if any) still lands in the stock —
      // the "chord" choice only applies to the primary found note.
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
  // available stock pitch improves the current chord the most (same idea as the
  // bot's revoice planner in botPlanRevoice), falling back to a fresh in-scale
  // note if the stock has nothing useful. This is what makes it feel "curated"
  // rather than a blind freebie.
  function curatedChordNote(spiritId) {
    const ns = noteStates[spiritId] ?? {};
    const chord = ns.chordStack ?? [];
    const have  = new Set(chord.map(pitchIndex));
    const cands = [...new Set((ns.noteStock ?? []).filter(n => !have.has(pitchIndex(n))))];
    if (cands.length) {
      const weight = (c) => c.drive + c.sustain;
      let best = cands[0], bestW = weight(spiritChord(spiritId, [...chord, cands[0]]));
      for (const note of cands.slice(1)) {
        const w = weight(spiritChord(spiritId, [...chord, note]));
        if (w > bestW) { bestW = w; best = note; }
      }
      return best;
    }
    return randomNote(ns.rootNote, ns.scaleMode);
  }

  // Chord-assist alternative (Overcharge only): ONE extra Chord Stack note,
  // curated toward the current chord, PLUS a bonus revoice to spend on it —
  // kept as a separate flag from revoiceUsedThisTurn (visibly its own budget,
  // see the ⚡ BONUS REVOICE widget in the Actions panel) so it can't be
  // laundered into a second free way to touch Drive/Sustain.
  function grantChargeChordAssist(spiritId) {
    const sp = spirits.find(s => s.id === spiritId);
    const ns = noteStates[spiritId] ?? {};
    if ((ns.chordStack ?? []).length >= 5) {
      addLog(`🎸 ${sp?.name}'s Chord Stack is already full — the charge sparks into the dice instead.`);
      grantChargeSpark(spiritId);
      return;
    }
    const note = curatedChordNote(spiritId);
    setNoteStates(prev => {
      const cur = prev[spiritId]; if (!cur) return prev;
      return { ...prev, [spiritId]: { ...cur, chordStack: [...(cur.chordStack ?? []), note], bonusRevoiceAvailable: true } };
    });
    triggerEffectFlash(spiritId, '🎸', 'OVERCHARGED!', '#ff66cc');
    addLog(`🎸 ${sp?.name} overcharges — ${note} lands straight in the Chord Stack, plus a bonus revoice this turn!`);
  }

  // Called whenever a spirit enters a hex during a move.
  function checkChargeZonePickup(spiritId, hexNum) {
    const zone = chargeZones.find(z => z.num === hexNum && (z.cooldown ?? 0) <= 0);
    if (!zone) return;
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

  // ⚡ Bonus revoice widget (Overcharge chord-assist) — add a stock note to the
  // Chord Stack, or drop one, spending the ONE bonus revoice the charge granted.
  // Separate guard from the normal revoiceUsedThisTurn budget by design.
  function spendBonusRevoiceAdd(idx) {
    if (!acting || !canAct || !actingNoteState?.bonusRevoiceAvailable) return; // N4/N7: gate
    const chord = actingNoteState.chordStack ?? [];
    if (chord.length >= 5) { addLog('🎸 Chord Stack is full — drop a note first.'); return; }
    const note = actingNoteState.noteStock?.[idx];
    if (note == null) return;
    const used = actingNoteState.usedStockIdx ?? [];
    setNoteField(acting.id, {
      chordStack: [...chord, note],
      usedStockIdx: usedAdd(used, idx),
      bonusRevoiceAvailable: false,
    });
    addLog(`⚡ ${acting.name} spends the bonus revoice — ${note} joins the Chord Stack!`);
  }
  function spendBonusRevoiceDrop(i) {
    if (!acting || !canAct || !actingNoteState?.bonusRevoiceAvailable) return; // N4/N7: gate
    const chord = actingNoteState.chordStack ?? [];
    if (chord.length <= 1) { addLog("🎸 Can't drop your last note — your stance needs at least one."); return; }
    if (i < 0 || i >= chord.length) return;
    const dropped = chord[i];
    setNoteField(acting.id, { chordStack: chord.filter((_, k) => k !== i), bonusRevoiceAvailable: false });
    addLog(`⚡ ${acting.name} spends the bonus revoice — drops ${dropped} from the chord.`);
  }

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
        grantHC(spiritId, 3);
        lines.push(`🕯️ Rolled 6 — the legends ANSWER. A chord you've never heard rings out.`);
        lines.push(`+3 Harmonic Charge.`);
        addLog(`🕯️ The 27 Club answers ${spirit?.name}'s séance — +3 HC!`);
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
        grantHC(spiritId, 1);
        lines.push(`🕯️ Rolled ${roll} — a faint whisper of a melody drifts through.`);
        lines.push(`+1 Harmonic Charge.`);
        addLog(`🕯️ A faint whisper reaches ${spirit?.name} — +1 HC.`);
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
        grantHC(spiritId, 2);
        lines.push(`💰 Rolled ${roll} — the envelope works. Your single is in HEAVY rotation.`);
        lines.push(`+2 Harmonic Charge.`);
        addLog(`💰 Payola pays off for ${spirit?.name} — +2 HC!`);
      } else {
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, hcPoints: Math.max(0, (cur.hcPoints ?? 0) - 2) } };
        });
        lines.push(`💰 Rolled ${roll} — BUSTED. Your face is on the evening news next to the word "scandal."`);
        lines.push(`-2 Harmonic Charge progress.`);
        addLog(`💰 ${spirit?.name} caught in the Payola Scandal — -2 HC progress!`);
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
      grantHC(spiritId, 3);
      lines.push(`🎟️ The pass is real. The door opens onto a room full of legends swapping licks.`);
      lines.push(`You soak it all in: +3 Harmonic Charge.`);
      addLog(`🎟️ ${spirit?.name} works the Backstage Pass — +3 HC!`);
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
  // Harmonic Charge, Stage 2 pays fans. Every fumbled note shaves 1 Vibe, but the
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
        setTimeout(() => grantHC(spiritId, gain), 60);
        lines.push(passed
          ? `💫 SLOW-DANCE ANGEL — ${prev.hits}/${total} chords clean. The floor sways. +${gain} Harmonic Charge.`
          : `💫 SLOW-DANCE ANGEL — ${prev.hits}/${total} clean. Shaky, but you got through it. +${gain} Harmonic Charge.`);
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
  function renderInstrument(view, noteKeys, gotKeys, accent) {
    const lit = new Set(noteKeys || []);
    const done = new Set(gotKeys || []);
    if (view === 'guitar') {
      const names = ['E','A','D','G','B','e'];
      const gauge = [3.2, 2.6, 2.0, 1.6, 1.2, 0.8];
      const GPOS = { e:[0,0], f:[0,1], a:[1,0], b:[1,2], c:[1,3], d:[2,0], g:[3,0] };
      const N = 6, FRETS = 7, colW = 30, fh = 24, side = 20, topPad = 20;
      const W = (N - 1) * colW + side * 2, H = topPad + FRETS * fh + 14;
      const sx = i => side + i * colW, nutY = topPad, fy = f => nutY + f * fh;
      const posOf = k => {
        const nat = k.toLowerCase(); const base = GPOS[nat]; if (!base) return null;
        return k === k.toUpperCase() && k !== nat ? [base[0], base[1] + 1] : base; // sharp = +1 fret
      };
      const blips = [...lit].map(k => ({ k, pos: posOf(k), dn: done.has(k) })).filter(b => b.pos);
      return (
        <svg width={W} height={H} style={{maxWidth:'100%'}}>
          {names.map((nm, i) => (
            <text key={`n${i}`} x={sx(i)} y={topPad - 6} textAnchor="middle" fontSize={9} fontWeight="bold" fill={`${accent}cc`} fontFamily="monospace">{nm}</text>
          ))}
          {[3,5,7].filter(f => f <= FRETS).map(f => (
            <circle key={`in${f}`} cx={(sx(2) + sx(3)) / 2} cy={nutY + (f - 0.5) * fh} r={3.5} fill={`${accent}33`}/>
          ))}
          {Array.from({ length: FRETS + 1 }).map((_, f) => (
            <line key={`f${f}`} x1={sx(0)} y1={fy(f)} x2={sx(N - 1)} y2={fy(f)} stroke={f === 0 ? '#dbe4f0' : `${accent}44`} strokeWidth={f === 0 ? 3.5 : 1}/>
          ))}
          {names.map((_, i) => (
            <line key={`s${i}`} x1={sx(i)} y1={fy(0)} x2={sx(i)} y2={fy(FRETS)} stroke="#aab8cc" strokeWidth={gauge[i]} strokeLinecap="round"/>
          ))}
          {blips.map(({ k, pos, dn }) => {
            const [s, f] = pos, cx = sx(s);
            if (f === 0) return <circle key={k} cx={cx} cy={nutY - 9} r={5} fill={dn ? '#2bd66b' : 'none'} stroke={dn ? '#2bd66b' : accent} strokeWidth={2}/>;
            return <circle key={k} cx={cx} cy={nutY + (f - 0.5) * fh} r={7.5} fill={dn ? '#2bd66b' : accent} stroke="#06111f" strokeWidth={1} style={dn ? {} : { filter:`drop-shadow(0 0 5px ${accent})` }}/>;
          })}
        </svg>
      );
    }
    // piano — one octave, C–B, with black keys. Naturals light the whites; sharps
    // light the black between the right pair.
    const whites = ['c','d','e','f','g','a','b'];
    const blackAfter = [0, 1, 3, 4, 5];
    const blackForSharp = { C:0, D:1, F:3, G:4, A:5 }; // uppercase sharp → white index it sits right of
    const W = 26, H = 84, bw = 16, bh = 52, svgW = whites.length * W;
    return (
      <svg width={svgW} height={H} style={{maxWidth:'100%'}}>
        {whites.map((l, i) => {
          const isLit = lit.has(l), dn = done.has(l);
          const fill = dn ? '#2bd66b' : isLit ? accent : '#e6ecf6';
          return <rect key={l} x={i * W} y={0} width={W - 1} height={H} rx={3} fill={fill} stroke="#0a0e16" strokeWidth={1}
            style={isLit && !dn ? { filter:`drop-shadow(0 0 7px ${accent})` } : {}}/>;
        })}
        {blackAfter.map(i => {
          const sharp = Object.keys(blackForSharp).find(s => blackForSharp[s] === i);
          const isLit = sharp && lit.has(sharp), dn = sharp && done.has(sharp);
          const fill = dn ? '#2bd66b' : isLit ? accent : '#0c1018';
          return <rect key={`b${i}`} x={(i + 1) * W - bw / 2} y={0} width={bw} height={bh} rx={2} fill={fill} stroke="#000" strokeWidth={1}
            style={isLit && !dn ? { filter:`drop-shadow(0 0 6px ${accent})` } : {}}/>;
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
    if (kind === 'hc')       { grantHC(id, 3); addLog(`🧪 +3 HC → ${nm}`); }
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
    if (skill.fire === 'hydra') {
      devSetupHydra();
    }
  }

  // 🐉 Unlock Hydra and deploy 3 of the Ronin's amps within range, so a Sonic
  // Attack at range will roll 3d6. (Then attack a rival to see it.)
  function devSetupHydra() {
    const id = 'cosmic_ronin';
    const ronin = spirits.find(s => s.id === id);
    if (!ronin) { addLog('🧪 Ronin is not in this game.'); return; }
    const home = HEX_BY_NUM[ronin.num];
    if (!home) return;
    const occupied = new Set([...spirits.map(s => s.num), ...amps.map(a => a.hexNum)]);
    const spots = Object.keys(HEX_BY_NUM).map(Number).filter(num => {
      const h = HEX_BY_NUM[num];
      const d = axialDist(home.q, home.r, h.q, h.r);
      return !occupied.has(num) && d >= 1 && d <= AMP_RANGE;
    }).slice(0, 3);
    if (spots.length < 3) { addLog('🧪 Not enough free hexes near the Ronin for 3 amps.'); return; }
    setAmps(prev => [...prev, ...spots.map((num, i) => ({
      id: `amp-${id}-dev-${Date.now()}-${i}`, ownerId: id, ownerColor: ronin.color, hexNum: num, connected: false,
    }))]);
    addLog('🐉 TEST: Hydra unlocked + 3 amps deployed near the Ronin. Attack a rival at range to see the 3d6!');
    setDevOpen(false);
  }

  // Add raw Harmonic Charge toward the spirit's current target skill.
  // Crossing the threshold awards the skill exactly like a committed track would.
  function grantHC(spiritId, amount) {
    const ns         = noteStates[spiritId] ?? {};
    const targetCost = ns.targetSkillId ? (SKILL_BY_ID[ns.targetSkillId]?.hcCost ?? HC_UPGRADE_THRESHOLD) : HC_UPGRADE_THRESHOLD;
    const { newHCPoints, upgradeTriggered } = advanceHC(ns.hcPoints ?? 0, amount, targetCost);
    setNoteStates(prev => ({
      ...prev,
      [spiritId]: {
        ...prev[spiritId],
        hcPoints: newHCPoints,
        totalHC: (prev[spiritId]?.totalHC ?? 0) + amount,
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
    for (const t of STAGE_FX_THRESHOLDS) {
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
    const occupied = [...spirits.map(s => s.num), ...amps.map(a => a.hexNum)];
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
  // The endgame boss. Reaching FAME_TO_WIN with a lead < ROCK_GOD_RUNAWAY_LEAD
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
      const occupied = [...spirits.map(sp => sp.num), ...amps.map(a => a.hexNum)];
      const dest = freeNeighborHex(LIMELIGHT_HEX, occupied);
      if (dest) setSpirits(prev => prev.map(sp => sp.id === squatter.id ? { ...sp, num: dest } : sp));
      addLog(`💥 ${squatter.name} is hurled off the Limelight by the shockwave — 1 Vibe!`);
      setTimeout(() => applyVibeDamage(squatter.id, 1, 'Divine Shockwave'), 300);
    }

    addLog(`🌩️🌩️🌩️ ${leader?.name} reaches ${FAME_TO_WIN} Fame — but the race is TOO CLOSE. The sky splits open…`);
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
    const chord = ns.chordStack?.length ? spiritChord(spiritId, ns.chordStack) : null;
    const raw = (chord ? chord.drive : (sp.drive ?? 6)) + (ns.tempDrive ?? 0);
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
  // Hitting FAME_TO_WIN triggers the Fame Legend victory.
  function grantFame(spiritId, fp, reason, amplify = true) {
    if (fp <= 0) return;
    const sp = spirits.find(s => s.id === spiritId);
    const ns = noteStates[spiritId] ?? {};
    // 🎤 Fans amplify the value of every deed (wins, riffs, cadences). The crowd
    // doesn't convert TO Fame — it multiplies the Fame you earn. Pass amplify=false
    // for non-deed awards (e.g. the future Rock Gods finale payout) to skip this.
    const mult    = amplify ? crowdMultiplier(ns.diehards ?? FAN_DIEHARD_START, ns.casuals ?? 0) : 1;
    const finalFp = amplify ? Math.max(fp, Math.round(fp * mult)) : fp;
    const newFame = (ns.fame ?? 0) + finalFp;
    // Phase 5c: fame write is now a semantic engine action (no-op vs the old
    // setNoteStates full-replace — finalFp>0 so applyFameChanged's floor never
    // bites here). The crowd mult / thresholds / win-check below stay client.
    dispatch(fameChanged(spiritId, finalFp));
    const crowdStr = (amplify && finalFp !== fp) ? ` (${fp} ×🎤${mult.toFixed(2)} crowd)` : '';
    addLog(`⭐ ${sp?.name} earns ${finalFp} Fame Point${finalFp !== 1 ? 's' : ''}${crowdStr}${reason ? ` — ${reason}` : ''}! (${Math.min(newFame, FAME_TO_WIN)}/${FAME_TO_WIN})`);
    showTip('fame');
    // 🎇 The show grows with the legend — Stage Effects fire at ⭐8/16/24.
    checkStageFxThresholds(ns.fame ?? 0, newFame);
    if (newFame >= FAME_TO_WIN) {
      if (engineRef.current.rockGod.summoned) {
        // 🤘 A Rock God holds the gate — Fame alone can't end it now. Victory
        // flows only through the boss fight (godDefeated crowns the FP leader).
      } else {
        // 🤘 THE RULE OF THE GODS — a runaway lead is crowned outright; a close
        // race summons a Rock God to settle it (data/rockGods.js).
        const rivalBest = Math.max(0, ...spirits.filter(s => s.id !== spiritId && !s.knockedOut)
          .map(s => engineRef.current.noteStates?.[s.id]?.fame ?? 0));
        if (newFame - rivalBest >= ROCK_GOD_RUNAWAY_LEAD) {
          addLog(`🌟🌟🌟 ${sp?.name} reaches ${FAME_TO_WIN} Fame — A LEGEND IS BORN! 🌟🌟🌟`);
          setTimeout(() => {
            dispatch(winnerDeclared(spiritId)); // N5: engine winner slice → derived `winner` renders on all clients
          }, 600);
        } else {
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

  // ── SONIC FAME — the primary FP engine. Margin-scaled + center-stage bonus. ──
  function awardSonicFame(spiritId, margin, loserId, centerBonus = 0) {
    const base = sonicFame(margin) + centerBonus;
    const { fp, deficit, mult } = underdogBonus(spiritId, loserId, base);
    if (deficit >= UNDERDOG_MIN_DEFICIT && fp > base) {
      const nm = spirits.find(s => s.id === spiritId)?.name;
      addLog(`🔥 UNDERDOG! ${nm} was down ${deficit} Fame — the crowd ROARS! (${base} → ${fp}, ×${mult.toFixed(2)})`);
      triggerEffectFlash(spiritId, '🔥', 'UNDERDOG!', '#ffaa22');
      grantFame(spiritId, fp, `sonic win by ${margin}`);
    } else {
      grantFame(spiritId, base, `sonic win by ${margin}${centerBonus ? ' +spotlight' : ''}`);
    }
  }

  // ── THRASH FAME — flat 1 FP. You fight to hurt, not to shine. ──
  function awardThrashFame(spiritId, loserId) {
    const base = thrashFame();
    const { fp, deficit, mult } = underdogBonus(spiritId, loserId, base);
    if (deficit >= UNDERDOG_MIN_DEFICIT && fp > base) {
      const nm = spirits.find(s => s.id === spiritId)?.name;
      addLog(`🔥 UNDERDOG! ${nm} was down ${deficit} Fame — the crowd ROARS! (${base} → ${fp}, ×${mult.toFixed(2)})`);
      triggerEffectFlash(spiritId, '🔥', 'UNDERDOG!', '#ffaa22');
      grantFame(spiritId, fp, `thrash win`);
    } else {
      grantFame(spiritId, base, `thrash win`);
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

    const base = FAN_GAIN_BY_RING[ring] ?? 0;
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
      if (streak % FAN_PROMOTE_EVERY === 0 && casuals > 0 && diehards < FAN_DIEHARD_CAP) {
        casuals -= 1; diehards += 1; promoted = true;
      }
    }
    dispatch(fansChanged(spiritId, { casuals, diehards, centerStreak: streak, fanActedThisTurn: inCentre }));
    flashFanFx(spiritId, 'gain', base + recruit);
    const nm = spirits.find(s => s.id === spiritId)?.name;
    const gainedStr = recruit > 0 ? `+${base} (+${recruit} won over)` : `+${base}`;
    const where = ring === 'main' ? 'the Mainstage' : ring === 'pit' ? 'the Pit' : 'the neutral floor';
    addLog(`🎤 ${nm} works ${where} — casuals ${gainedStr} → ♥${diehards}·👥${casuals} (×${crowdMultiplier(diehards, casuals).toFixed(2)})`);
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
    // Shake up to 2 Diehards down into Casuals — their faith wavers.
    const shaken = Math.min(2, diehards);
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
    const gain = baseAmount + centreBonus;
    {
      const ns = engineRef.current.noteStates[spiritId];
      if (ns) {
        let casuals  = Math.min(FAN_CASUAL_CAP, (ns.casuals ?? 0) + gain);
        let diehards = ns.diehards ?? FAN_DIEHARD_START;
        let streak   = ns.centerStreak ?? 0;
        let promoted = false;
        if (inCentre) {
          streak += 1;
          if (streak % FAN_PROMOTE_EVERY === 0 && casuals > 0 && diehards < FAN_DIEHARD_CAP) {
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
    // 🌀 ROLLS HARD — Intergalactic 0 plants like a boulder: shrug off 1 hex of any shove.
    // Still pushable (and edge-able) on a committed hit — just sturdier.
    if (targetId === 'intergalactic_0') {
      spaces -= 1;
      if (spaces <= 0) { addLog(`🌀 ${target.name} Rolls Hard — the push barely budges him.`); return; }
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

  // ⚡ Dissonance Edge combat mods — the stage-indexed Drive-up/Sustain-down
  // read from riding an unresolved Discord ending (gameConstants EDGE_* tables).
  // Pure lookup off `edgeStage`; called from both the Swing and Sonic resolvers
  // alongside the existing tempDrive/tempSustain reads, not instead of them —
  // this is a separate, visible stance, not a re-skin of the pattern-boost bonus.
  function edgeCombatMods(ns) {
    const stage = ns?.edgeStage ?? 0;
    return {
      drive:          EDGE_DRIVE_BY_STAGE[stage] ?? 0,
      sustainPenalty: EDGE_SUSTAIN_PENALTY_BY_STAGE[stage] ?? 0,
    };
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

  // 🤘 MASTER OF MOSHPITS — wrap a battle WIN's damage. If the winner owns the
  // skill and has a banked note, the note is burned for +1 Vibe (folded into the
  // hit so it can finish a knockdown), and the pit floods the board to rock the
  // rival (only if they survive the blow). attackerId is threaded to applyVibeDamage
  // so Azrael can credit the knockdown.
  function resolveWinDamage(winnerId, loserId, baseDmg, sourceLabel) {
    const wNs   = noteStates[winnerId] ?? {};
    const armed = (wNs.unlockedSkills ?? []).includes('master_moshpits') && !!wNs.bankedNote;
    let dmg = baseDmg;
    if (armed) {
      dmg = baseDmg + 1;
      const burned = wNs.bankedNote?.note;
      setNoteStates(prev => ({ ...prev, [winnerId]: { ...prev[winnerId], bankedNote: null } }));
      addLog(`🤘 MASTER OF MOSHPITS! ${spirits.find(s=>s.id===winnerId)?.name} burns the banked ${burned} — the pit erupts for +1 Vibe!`);
      // Crowd swarms once the hit (and any knockdown) has settled — only if the
      // rival is still standing to be rocked.
      setTimeout(() => triggerMoshpit(loserId), 460);
    }
    applyVibeDamage(loserId, dmg, sourceLabel, winnerId);
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

    // ── 🔩 Junkyard weapon — armed by the Junkyard Dog crew, consumed on this swing ──
    const junkBonus = nsA.junkyardArmed ? 2 : 0;
    if (junkBonus) {
      addLog(`🔩 ${attacker.name} swings the junkyard weapon — +2 to the attack!`);
      setNoteStates(prev => ({
        ...prev,
        [attacker.id]: { ...prev[attacker.id], junkyardArmed: false },
      }));
    }

    // 🎸 Harmony → combat: Drive/Sustain are read from the chord you committed
    // (falls back to the static spirit stat until a chord has been played).
    const atkChord = (nsA.chordStack?.length) ? spiritChord(attacker.id, nsA.chordStack) : null;
    const defChord = (nsD.chordStack?.length) ? spiritChord(targetId, nsD.chordStack) : null;
    const atkChordDrive   = atkChord ? atkChord.drive   : (attacker.drive ?? 6);
    let   defChordSustain = defChord ? defChord.sustain : (defender.sustain ?? 5);
    // 💥 SMASH EXPOSURE — a Smashed rival is wide open: this blow ignores their Sustain, then clears.
    if (nsD.smashExposed) { defChordSustain = 0; setNoteField(targetId, { smashExposed: false }); addLog(`💥 ${defender.name} is Exposed — the hit lands clean!`); }
    if (atkChord) addLog(`🎸 ${attacker.name}'s chord: ${atkChord.name} (⚔️${atkChord.drive})${defChord ? ` vs ${defender.name}'s ${defChord.name} (🛡️${defChord.sustain})` : ''}`);
    // 🛡️ Defending frays your chord — each blow absorbed costs a note (floored at 1
    // remaining, so you're never bled to nothing). It rebuilds on your next turn.
    if (defChord && !posing[targetId] && (nsD.chordStack?.length ?? 0) > 1) {
      const frayedNotes = nsD.chordStack.slice(0, -1);
      const frayed = spiritChord(targetId, frayedNotes);
      setNoteField(targetId, { chordStack: frayedNotes });
      addLog(`🛡️ ${defender.name}'s chord frays under the blow — ${defChord.name} → ${frayed.name} (🛡️${frayed.sustain})`);
    }

    const atkBase  = atkChordDrive + (nsA.instrumentDropped ? -1 : 0) + skillMods.pyroBonus + junkBonus;
    const atkEdge  = edgeCombatMods(nsA);
    const defEdge   = edgeCombatMods(nsD);
    const atkBonus = (nsA.tempDrive ?? 0) + atkEdge.drive;
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
    // -1 Sustain, edge mods, junkyard, etc. The spin overlay below just displays
    // the already-decided faces (battle.atkRoll / battle.defRoll).
    const rollState = dispatch(attackRolled('swing', attacker.id, targetId, {
      atkStat, defStat,
      posing: defenderPosing,
      halveDef: skillMods.halveDef,
      psychoEligible: (nsA.unlockedSkills ?? []).includes('psycho_bushido'),
      atkFloor, atkDie, defDie,
    }));
    const {
      atkRoll, defRoll, atkTotal, defTotal, attackerWon, margin, damage, psychoBushido,
    } = rollState.battle;

    // 🌀 PSYCHO BUSHIDO (Shredding Ronin) — a blistering 5 or 6 stuns the rival
    // into folding: the engine already dropped their die to 1; announce it.
    if (psychoBushido) {
      addLog(`🌀 PSYCHO BUSHIDO! ${attacker.name} explodes with a ${atkRoll} — ${defender.name} is stunned by the pure speed and folds. Their die drops to a 1!`);
    }

    if (nsA.instrumentDropped) addLog(`🎸💥 ${attacker.name} playing on a dropped instrument — Drive -1!`);
    addLog(`⚔️ ${attacker.name} SWINGS at ${defender.name}!${defenderPosing ? ' — caught posing!' : ''}`);
    // ⚡ A battle ensued — Charge Zone charges burn off for BOTH combatants.
    burnChargesAfterBattle([attacker.id, targetId], 'the Thrash battle spent it');
    // 🎸 The jab spends your harmony: the swing plays out the FIRST 2 committed notes
    // of your Chord Stack (Drive was already read above, from the full chord).
    // The chord shrinks from the front; revoice rebuilds it 1 note/turn.
    const swingChordLeft = (nsA.chordStack ?? []).slice(2);
    const swingChordSpent = (nsA.chordStack ?? []).slice(0, 2);
    if (swingChordSpent.length) {
      addLog(`🎸 ${attacker.name} burns ${swingChordSpent.join('+')} from the chord — ${swingChordLeft.length ? spiritChord(attacker.id, swingChordLeft).name : 'chord exhausted (base stats until revoiced)'}.`);
    }
    // 🥊 CQC EXPOSURE — committing to a swing drops your guard: −1 Sustain until your
    // next turn (melee-only risk; ranged Sonic keeps you safe).
    setNoteStates(prev => ({ ...prev, [acting.id]: { ...prev[acting.id], swingExposed: true, chordStack: swingChordLeft } }));

    // pickPos: 0 = center. Negative = toward attacker (left). Positive = toward defender (right).
    showTip('combat');
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
      // Freeze the swing/CQC status-effect roll now so the result overlay can
      // tell the player exactly what lands before they close it (melee only).
      swingEffectRoll: rollSwingEffects(acting.id, false),
      // Stable dance-craze name shown when a plain swing connects (no effect).
      danceName: pickDanceName(),
      psychoBushido, // 🌀 forced the rival's die to 1
    });
    if (psychoBushido) setTimeout(() => triggerEffectFlash(targetId, '🌀', 'BUSHIDO!', '#4488ff'), 200);
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
    T(() => {
      setBattleState(p => p ? { ...p, phase: 'atk_die_spin' } : p);
      // Spin random d6 faces
      const spinI = setInterval(() => {
        setBattleState(p => {
          if (!p || p.phase !== 'atk_die_spin') { clearInterval(spinI); return p; }
          return { ...p, spinFaceAtk: Math.floor(Math.random() * atkDie) + 1 };
        });
      }, 80);
    }, 5600);
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
    const sides = bs.dieSides ?? 6;
    setBattleState(p => p ? { ...p, phase: 'atk_die_spin', pickPos: -(p.atkStat ?? 0) + (p.defStat ?? 0) } : p);
    const spinI = setInterval(() => {
      setBattleState(p => {
        if (!p || p.phase !== 'atk_die_spin') { clearInterval(spinI); return p; }
        return { ...p, spinFaceAtk: Math.floor(Math.random() * sides) + 1 };
      });
    }, 80);
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

    // 🗡️ SHREDDING RONIN — brute force isn't his art. His own Smash lands SOFT (≈half),
    // so for the full Smash cost (all stock, no movement, Exposed) it's a bad trade he
    // should almost never take. And he's WEAK TO it: a Smash on Ronin scatters DOUBLE his
    // stock — his carefully arranged arsenal blown across the board.
    const roninSmasher = acting.id === 'cosmic_ronin';
    const roninTarget  = target.id === 'cosmic_ronin';
    // 🎸💥 Smash outcome is deterministic (no roll) — pure math in the engine (Phase 3b).
    const { damage, knockback, scatterN } = smashOutcome(thrown, { roninSmasher, roninTarget });

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
    if (roninSmasher) addLog(`🗡️ The windmill is not the Ronin's way — the blow lands clumsy.`);
    if (roninTarget)  addLog(`🗡️ ${target.name}'s arsenal scatters wide — brute chaos shatters the precise.`);
    triggerEffectFlash(targetId, '🎸', 'SMASH!', '#ff3344');
    resolveWinDamage(acting.id, targetId, damage, 'The Smash');
    battleKnockback(acting.id, targetId, knockback);
    if (stepsBeforeSmash > 2) addLog(`🦶 ${acting.name} is rooted by the wind-up — no movement left this turn.`);
    addLog(`💢 ${acting.name} is left wide open — Exposed until their next turn.`);
  }

  // 🌀💥 BLASTER OF RA — Intergalactic 0's signature; REPLACES the Smash once unlocked.
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

    // 🌀 Same fuel/formula as the Smash — single source (Phase 3b). Base values
    // (non-Ronin); per-target Ronin ×2 scatter is applied in the loop below.
    const { damage, knockback, scatterN: scatterEach } = smashOutcome(thrown);

    // Hurl ALL unused stock down the beam; ride the recoil into Exposed.
    setNoteField(acting.id, { usedStockIdx: usedAdd(used, unusedIdxs), smashExposed: true });

    addLog(`🌀💥 ${acting.name} drops the BLASTER OF RA — a bass-drop shockwave screams down the beam, UNDEFENDABLE, piercing ${targets.length} rival${targets.length > 1 ? 's' : ''}!`);
    triggerEffectFlash(acting.id, '🌀', 'RA!', '#aa55ff');

    targets.forEach(t => {
      const sc = scatterEach * (t.id === 'cosmic_ronin' ? 2 : 1); // 🗡️ Ronin still weak to the blast
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

  // 🌌 DISPLACE — Intergalactic 0's signature. He can't run; he WARPS. Teleport to an open
  // hex beside his amp rig for 3 AP, then a 2-turn cooldown. A deliberate get-out-of-jail
  // (the AP cost rules out a same-turn Sonic follow-up), not a kite tool. Needs ≥1 amp.
  const DISPLACE_AP = 3;
  function resolveDisplace(hexNum) {
    if (!acting) return;
    const ns = actingNoteState ?? {};
    if ((ns.displaceCd ?? 0) > 0) { addLog(`🌌 Displace is recharging — ${ns.displaceCd} turn${ns.displaceCd > 1 ? 's' : ''} left.`); return; }
    if (moveStepsLeft < DISPLACE_AP) { addLog(`🌌 Displace needs ${DISPLACE_AP} AP.`); return; }
    if (!amps.some(a => a.ownerId === acting.id)) { addLog('🌌 No rig to warp to — place an amp first.'); return; }
    if (!ampPlaceCandidates(acting.id).has(hexNum)) { addLog('🌌 Warp to an open hex beside your amp rig.'); return; }

    triggerEffectFlash(acting.id, '🌌', 'WARP', '#aa55ff');
    dispatch(spiritWarped(acting.id, hexNum, DISPLACE_AP)); // reducer owns the position write
    setNoteField(acting.id, { displaceCd: 2 });
    setAction(null);
    addLog(`🌌 ${acting.name} folds space and WARPS to hex #${hexNum} — Space is the place.`);
  }

  function initiateSonicAttack(targetId) {
    if (!acting) return;
    if (rockGodActive) { addLog(`🤘 The Spirits stand UNITED — take it to the God!`); return; }
    if (actionTokenUsed) { addLog('🔊 Already used your Action Token this turn!'); return; }
    if (ampsInRange < 1) { addLog('🔊 Sonic Attack requires at least 1 connected Amp!'); return; }

    const attacker = spirits.find(s => s.id === acting.id);
    const defender = spirits.find(s => s.id === targetId);
    if (!attacker || !defender) return;

    if (moveStepsLeft < 2) {
      addLog(`🔊 Not enough Action Points — Sonic Attack costs 2 AP.`);
      return;
    }

    dispatch(beatsSpent(2, true));
    setAction(null);

    // 🔊 Sonic chord is saved for playback at the RESULT moment (beam blast/fizzle).
    // Moved from here to the result phase so the chord rings when the beam fires.
    const sonicChordNotes = [...(actingNoteState?.chordStack ?? [])];

    // ── RIFF-OFF TRIGGER ─────────────────────────────────────────────────────
    // If the defender is ALSO plugged in (their own live amp in range) and the
    // attacker stands inside the defender's sonic beam — i.e. the two Spirits
    // are connected, in line of sight, and facing each other down the same
    // line — the Sonic Attack escalates into a head-to-head RIFF-OFF.
    // (AP + Action Token were already spent above, same cost as a Sonic Attack.)
    const riffDefHex = HEX_BY_NUM[defender.num];
    const riffDefPlugged = riffDefHex ? amps.some(amp => {
      const ampHex = HEX_BY_NUM[amp.hexNum];
      return ampHex && !amp.unplugged && amp.ownerId === targetId &&
        axialDist(riffDefHex.q, riffDefHex.r, ampHex.q, ampHex.r) <= AMP_RANGE;
    }) : false;
    if (riffDefPlugged && !posing[targetId] && getSonicBeam(defender).has(attacker.num)) {
      // ⚡ A riff-off is still a battle — charges burn off (no dice to boost here).
      burnChargesAfterBattle([attacker.id, targetId], 'the riff-off spent it');
      startRiffOff(attacker, defender);
      return;
    }

    const nsA     = noteStates[attacker.id] ?? {};
    const nsD     = noteStates[targetId]    ?? {};

    // ── Stage Effects / skill mods ────────────────────────────────────────────
    const skillMods = getBattleSkillMods(attacker.id, targetId);
    if (skillMods.laserActive)  addLog(`🔴 Laser Show fires! Defender's die will be halved.`);
    if (skillMods.fogActive)    addLog(`🌫️ Fog Machine fires! Defender -1 Drive, -1 Sustain this battle.`);
    if (skillMods.pyroBonus > 0)addLog(`🔥 Pyrotechnics! +${skillMods.pyroBonus} bonus added to Drive roll.`);

    // Amp count caps at 3 ("goes to eleven" event boost counts as +1 amp)
    // NOTE: declared BEFORE powerBonus below — referencing it earlier crashed the game
    const ampCount    = Math.min(ampsInRange + elevenBoost, 3);

    // PA skill bonuses for Sonic Attack
    const atkSkills    = nsA.unlockedSkills ?? [];
    const pedalBonus   = atkSkills.includes('pedal_dist') ? 1 : 0;
    const powerBonus   = (atkSkills.includes('power_chords') && ampCount >= 2) ? 2 : 0;
    if (pedalBonus)  addLog(`🎛️ Pedal Distortion! +1 Drive on Sonic Attack.`);
    if (powerBonus)  addLog(`🤘 Power Chords! +2 Drive (${ampCount} amps in range).`);

    // 🎸 Harmony → combat: Drive/Sustain are read from the chord you committed
    // (falls back to the static spirit stat until a chord has been played).
    const atkChord = (nsA.chordStack?.length) ? spiritChord(attacker.id, nsA.chordStack) : null;
    const defChord = (nsD.chordStack?.length) ? spiritChord(targetId, nsD.chordStack) : null;
    const atkChordDrive   = atkChord ? atkChord.drive   : (attacker.drive ?? 6);
    let   defChordSustain = defChord ? defChord.sustain : (defender.sustain ?? 5);
    // 💥 SMASH EXPOSURE — a Smashed rival is wide open: this blow ignores their Sustain, then clears.
    if (nsD.smashExposed) { defChordSustain = 0; setNoteField(targetId, { smashExposed: false }); addLog(`💥 ${defender.name} is Exposed — the hit lands clean!`); }
    if (atkChord) addLog(`🎸 ${attacker.name}'s chord: ${atkChord.name} (⚔️${atkChord.drive})${defChord ? ` vs ${defender.name}'s ${defChord.name} (🛡️${defChord.sustain})` : ''}`);
    // 🛡️ Defending frays your chord — each blow absorbed costs a note (floored at 1
    // remaining, so you're never bled to nothing). It rebuilds on your next turn.
    if (defChord && !posing[targetId] && (nsD.chordStack?.length ?? 0) > 1) {
      const frayedNotes = nsD.chordStack.slice(0, -1);
      const frayed = spiritChord(targetId, frayedNotes);
      setNoteField(targetId, { chordStack: frayedNotes });
      addLog(`🛡️ ${defender.name}'s chord frays under the blow — ${defChord.name} → ${frayed.name} (🛡️${frayed.sustain})`);
    }
    // 🔊 Projecting the chord down the beam spends its FIRST committed note (Drive was
    // read above, from the full chord). Lighter touch than the melee jab's 2 notes.
    // 🐉 HYDRA costs more energy than a normal Sonic — three beams scream out, so it
    // burns the first 2 Chord Stack notes instead of 1. (Normal Sonic spends 1.)
    const sonicSpendN     = (ampCount === 3 && atkSkills.includes('hydra')) ? 2 : 1;
    const sonicChordLeft  = (nsA.chordStack ?? []).slice(sonicSpendN);
    const sonicChordSpent = (nsA.chordStack ?? []).slice(0, sonicSpendN);
    if (sonicChordSpent.length) {
      setNoteField(attacker.id, { chordStack: sonicChordLeft });
      addLog(`🎸 ${attacker.name} projects ${sonicChordSpent.join('')} from the chord — ${sonicChordLeft.length ? spiritChord(attacker.id, sonicChordLeft).name : 'chord exhausted (base stats until revoiced)'}.`);
    }

    const atkBase  = atkChordDrive + (nsA.instrumentDropped ? -1 : 0)
                   + skillMods.pyroBonus + pedalBonus + powerBonus;
    const atkEdge  = edgeCombatMods(nsA);
    const defEdge   = edgeCombatMods(nsD);
    const atkBonus = (nsA.tempDrive ?? 0) + atkEdge.drive;
    const atkStat  = atkBase + atkBonus;
    const defBase  = defChordSustain - (skillMods.fogActive ? 1 : 0) - (nsD.swingExposed ? 1 : 0);
    const defBonus = (nsD.tempSustain ?? 0) - defEdge.sustainPenalty;
    const defStat  = defBase + defBonus;
    const defenderPosing = posing[targetId];

    // Check if defender is plugged in (within range of one of THEIR OWN live amps)
    const defHex = HEX_BY_NUM[defender.num];
    const defenderPluggedIn = defHex ? amps.some(amp => {
      const ampHex = HEX_BY_NUM[amp.hexNum];
      return ampHex && !amp.unplugged && amp.ownerId === targetId &&
        axialDist(defHex.q, defHex.r, ampHex.q, ampHex.r) <= AMP_RANGE;
    }) : false;

    // Is the target at range (not directly adjacent)?
    const atkHex    = HEX_BY_NUM[attacker.num];
    const isAtRange = atkHex && defHex
      ? axialDist(atkHex.q, atkHex.r, defHex.q, defHex.r) > 1
      : false;

    // Unplugged defender cannot retaliate against a plugged-in ranged attacker
    const retaliationBlocked = isAtRange && !defenderPluggedIn;

    // Roll — attacker rolls a KEEP-HIGHEST pool from amps; defender uses a flat d6.
    // 🐉 HYDRA (Shredding Ronin capstone) — at 3 amps the rig overdrives to 3d8.
    // The pool sizing stays client (reads amp/skill state); the DICE roll on the
    // engine's seeded rng (Phase 3b) — keep-highest + defender d6 + verdict.
    const hasHydra    = atkSkills.includes('hydra');
    const hydraActive = ampCount === 3 && hasHydra;
    let   dicePool    = sonicDicePool(ampCount, hasHydra);
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
    const diceLabel   = dicePoolLabel(dicePool);
    const dieSides    = Math.max(...dicePool); // fallback for single-die animation paths
    const rollState = dispatch(attackRolled('sonic', attacker.id, targetId, {
      atkStat, defStat,
      posing: defenderPosing,
      halveDef: skillMods.halveDef,
      dicePool, atkFloor,
    }));
    const {
      atkRoll, defRoll, atkTotal, defTotal, attackerWon, margin, damage, diceVals, keptIdx,
    } = rollState.battle;
    if (hydraActive) addLog(`🐉 HYDRA AWAKENS! ${attacker.name} overdrives the rig — ${diceLabel}, keep best [${diceVals.join(', ')}] → ${atkRoll}, three beams scream out!`);

    if (nsA.instrumentDropped) addLog(`🎸💥 ${attacker.name} playing on dropped instrument — Drive -1!`);
    addLog(`🔊 ${attacker.name} launches SONIC ATTACK at ${defender.name}! (${diceLabel} keep best — ${ampCount} amp${ampCount > 1 ? 's' : ''})${retaliationBlocked ? ' — UNPLUGGED TARGET CANNOT RETALIATE!' : ''}`);
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
      ampCount,
      dieSides,                  // = max(dicePool); fallback for single-die anim paths
      defDieSides: 6,            // Sonic: defender always rolls d6
      dicePool,                  // 🔊 keep-highest pool: die sizes, e.g. [6,6,8]
      diceVals,                  // rolled values (length === dicePool.length)
      diceSpin: diceVals,        // animated faces while spinning (seeded to the result)
      keptIdx,                   // index of the kept (max) die
      diceLabel,                 // "2d6" / "2d6+d8" / "3d8"
      hydra: hydraActive,        // 🐉 overdriven rig (art/loom)
      sunbeam: hasSunbeam,       // ☀️ extra-lit beam (Intergalactic 0 capstone)
      retaliationBlocked,
      skillMods,
      pedalBonus,
      powerBonus,
      swingEffectRoll: null, // Sonic = ranged, no CQC status effects
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
    T(() => {
      setBattleState(p => p ? { ...p, phase: 'atk_die_spin' } : p);
      const spinI = setInterval(() => {
        setBattleState(p => {
          if (!p || p.phase !== 'atk_die_spin') { clearInterval(spinI); return p; }
          return { ...p, spinFaceAtk: Math.floor(Math.random() * dieSides) + 1,
            diceSpin: dicePool.map(s => Math.floor(Math.random() * s) + 1) };
        });
      }, 80);
    }, 5600);
  }

  // ── RIFF-OFF ENGINE ──────────────────────────────────────────────────────────
  // Sequential call-and-response on a shared keyboard: the attacker plays
  // their riff first, results are logged, the keyboard is passed, and the
  // defender answers with a transformed riff. Accuracy decides the winner;
  // average reaction time breaks ties.
  function startRiffOff(attacker, defender) {
    // The engine generates both riffs + skill modifiers on its seeded rng and
    // stores them in engineState.battle — this client just renders that data.
    // (slayer/eRush flags are client-supplied until noteStates joins in Ph 5.)
    const atkNs = noteStates[attacker.id] ?? {};
    const slayer = (atkNs.unlockedSkills ?? []).includes('riff_slayer') && !!atkNs.riffSlayerArmed;
    const eRush  = (atkNs.unlockedSkills ?? []).includes('e_rush') && !!atkNs.eRushArmed;
    const eb = dispatch(riffOffStarted(attacker.id, defender.id, { slayer, eRush })).battle;
    const atk = eb.atkRiff, def = eb.defRiff;
    const defGlitch = eb.defGlitch, defGhosts = eb.defGhosts;
    const defNotesArr = riffDegreesToNotes(def.degrees, def.sharps);
    addLog(`🎸🔥 RIFF-OFF! ${attacker.name} and ${defender.name} lock eyes — both plugged in, beams crossed!`);
    addLog(`🎶 ${attacker.name} calls a ${RIFF_CONTOUR_LABELS[atk.contour]} — ${defender.name} must answer with a ${RIFF_ANSWER_LABELS[def.kind].name}.`);

    // 🗡️ RIFF SLAYER — the rival cracks under pressure: 2–3 answer notes lurch
    if (slayer) {
      addLog(`🗡️ RIFF SLAYER! ${attacker.name}'s menace rattles ${defender.name} — ${defGlitch.length} of their notes will LURCH mid-riff. They're on edge!`);
      // consume the arm so it can't carry into another riff-off
      setNoteStates(prev => ({ ...prev, [attacker.id]: { ...prev[attacker.id], riffSlayerArmed: false } }));
    }

    // 🎴 いいラッシュ / E-RUSH — every answer note spawns a ghost second key
    if (eRush) {
      addLog(`🎴 いいラッシュ! ${attacker.name}'s E-Rush buries ${defender.name} under a ghost barrage — every answer note now demands TWO keys!`);
      setNoteStates(prev => ({ ...prev, [attacker.id]: { ...prev[attacker.id], eRushArmed: false } }));
    }

    riffEngineRef.current = null;
    setBattleState({
      riffOff: true, sonicAttack: true,   // sonicAttack → sonic-scale knockback
      phase: 'riff_intro',
      attackerId: attacker.id, defenderId: defender.id,
      atkRiff: { notes: riffDegreesToNotes(atk.degrees, atk.sharps),
                 freqs: atk.degrees.map((d, i) => riffDegreeFreq(d, atk.sharps[i])),
                 rhythm: atk.rhythm, contour: atk.contour },
      defRiff: { notes: defNotesArr,
                 freqs: def.degrees.map((d, i) => riffDegreeFreq(d, def.sharps[i])),
                 rhythm: def.rhythm, kind: def.kind },
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
    const preset = RIFF_FALL_DIFFICULTY[riffDifficultyRef.current] ?? RIFF_FALL_DIFFICULTY[RIFF_FALL_DEFAULT];
    const timeline = buildRiffTimeline(side.rhythm, round, preset.leadTime);
    const eng = {
      turn, preset, t0: performance.now(), timers: [],
      notes: side.notes.map((k, i) => {
        const feel     = timeline[i]?.feel ?? 'steady';
        const ghostKey = (turn === 'defender' && bs.defGhosts) ? bs.defGhosts[i] : null;
        return {
          idx: i, key: k, feel, ghostKey,
          hitAt: timeline[i]?.hitAt ?? (preset.leadTime + i * 1000),
          okWin: riffOkWindow(preset, feel, !!ghostKey),
          resolved: false, hitMain: false, hitGhost: false,
        };
      }),
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
          n.key = letter;
          setBattleState(p => {
            if (!p?.riffOff) return p;
            const notes2 = [...p.defRiff.notes]; notes2[idx] = letter;
            const freqs2 = [...(p.defRiff.freqs ?? [])]; freqs2[idx] = freq;
            const run2 = p.riffRun ? { ...p.riffRun,
              notes: p.riffRun.notes.map(g => g.idx === idx ? { ...g, key: letter, glitched: true } : g) } : p.riffRun;
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
        notes: eng.notes.map(n => ({ idx: n.idx, key: n.key, hitAt: n.hitAt, feel: n.feel, ghostKey: n.ghostKey, okWin: n.okWin })),
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
    if (hit) playNoteSound(null, {
      freq: side.freqs?.[n.idx],
      holdTime: grade === 'perfect' ? 0.5 : grade === 'good' ? 0.42 : 0.34,
      fadeTime: 0.4,
      volume:   grade === 'perfect' ? 0.22 : grade === 'good' ? 0.18 : 0.14,
    });
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
    if (turn === 'attacker') {
      setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_handoff', feedback: null } : p);
    } else {
      riffResolve();
    }
  }

  // Replay a riff-off performance through the in-game amp — same voice the
  // player heard while striking, groove (gaps + rests) intact.
  function playRiffOffPlayback(freqs, rhythm) {
    if (!freqs) return;
    let tMs = 0;
    freqs.forEach((fr, i) => {
      tMs += i === 0 ? 0 : 280 + (rhythm?.[i]?.gapBefore ?? RIFF_GAP_NORMAL);
      setTimeout(() => playNoteSound(null, { freq: fr, holdTime: 0.4, fadeTime: 0.38, volume: 0.17 }), tMs);
    });
  }

  function riffResolve() {
    const bs = battleStateRef.current;
    if (!bs?.riffOff) return;
    // Submit both performances to the engine and let it rule the duel — the
    // multiplayer seam: networked clients will each submit their own results
    // array and every peer computes the identical verdict.
    dispatch(riffResultsSubmitted('attacker', bs.atkResults));
    dispatch(riffResultsSubmitted('defender', bs.defResults));
    const verdict = dispatch(riffResolved()).battle.verdict;
    // damage is decided in the engine verdict now (Phase 3e) — no client re-derive.
    const { round, attackerWon, margin, tie, decidedBy, damage } = verdict;
    const A = verdict.atkStats, D = verdict.defStats;
    const atkName = spirits.find(s => s.id === bs.attackerId)?.name;
    const defName = spirits.find(s => s.id === bs.defenderId)?.name;
    if (tie) addLog(`🎸 RIFF-OFF R${round}: dead heat — both nailed ${A.hits}/${RIFF_LEN} at the same quality. The crowd can't pick a winner!`);
    else addLog(`🎸 RIFF-OFF R${round}: ${attackerWon ? atkName : defName} takes it on ${decidedBy}! (${A.hits}/${RIFF_LEN}·${A.perfects}✦·${A.quality}%${A.avgRt != null ? ` · ${A.avgRt}ms` : ''} vs ${D.hits}/${RIFF_LEN}·${D.perfects}✦·${D.quality}%${D.avgRt != null ? ` · ${D.avgRt}ms` : ''})`);
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
    setBattleState(p => p?.riffOff ? { ...p, clashStage: 'clash' } : p); // beams shoot + collide
    playBeamClash(round >= 2);
    setTimeout(() => {
      const s = battleStateRef.current;
      if (!s?.riffOff || s.phase !== 'riff_clash') return;
      const decisive = !s.tie && s.margin >= 3;        // ≥2-note accuracy gap = total domination
      if (round >= 2 || decisive) {
        const winner = s.tie ? null : (s.attackerWon ? 'attacker' : 'defender');
        const wName  = winner ? spirits.find(x => x.id === (winner === 'attacker' ? s.attackerId : s.defenderId))?.name : null;
        addLog(winner
          ? `🌟 BEAM CLASH${round >= 2 ? ' — FINAL ROUND' : ''}: ${wName}'s beam OVERPOWERS and sweeps the stage!`
          : `🌟 BEAM CLASH: the beams cancel out — neither Spirit breaks through!`);
        playBeamBreak(round >= 2);
        setBattleState(p => p?.riffOff ? { ...p, clashStage: 'break', clashWinner: winner } : p);
        setTimeout(() => setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_result' } : p), 2000);
      } else {
        // Too close to break — beams lock, SURGE, and we play a real ROUND 2:
        // fresh riffs, faster and meaner, sudden death. The round-1 beams stay
        // locked in the background while the new riffs play out.
        addLog(`⚡ ROUND 1 TOO CLOSE — the beams LOCK and SURGE! Bring on ROUND 2!`);
        playBeamSurge();
        setBattleState(p => p?.riffOff ? { ...p, clashStage: 'escalate' } : p);
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
            ...extra,
          });
          addLog(`🎸🔥 ROUND 2! New riffs — faster, meaner, sudden death!`);
          // 🗡️ RIFF SLAYER carries into Round 2 if it was active in Round 1
          const r2Glitch = eb2.defGlitch;
          if (r2Glitch.length > 0) {
            addLog(`🗡️ Still rattled — Riff Slayer lurches ${r2Glitch.length} of their Round 2 notes!`);
          }
          // 🎴 E-Rush ghost barrage also carries into Round 2 if it was active
          const r2Ghosts = eb2.defGhosts;
          if (r2Ghosts) {
            addLog(`🎴 The ghost barrage rages on — Round 2 answer notes still demand TWO keys!`);
          }
          setBattleState(p => p?.riffOff ? {
            ...p,
            round: 2,
            r1Won: s2.attackerWon, r1Tie: s2.tie, r1Margin: s2.margin, // remember Round 1's edge
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
      // Riff-off is a Sonic-class encounter — use Sonic push/FP rules.
      const loser = spirits.find(x => x.id === loserId);
      battleKnockback(winnerId, loserId, sonicKnockback(margin, loser?.vibe ?? 1, loser?.maxVibe ?? 1));
      resolveWinDamage(winnerId, loserId, damage, spirits.find(x => x.id === winnerId)?.name);
      const ring = hexRingFromCenter(spirits.find(x => x.id === winnerId)?.num ?? -1);
      const centerBonus = (ring === 'main' || ring === 'pit') ? SONIC_LIMELIGHT_FP : 0;
      awardSonicFame(winnerId, margin, loserId, centerBonus);
      if (attackerWon) applyPendingCombatEffects(attackerId, defenderId);
    }
    clearBattleBuffs(attackerId, defenderId);
    riffEngineRef.current?.timers?.forEach(clearTimeout);
    riffEngineRef.current = null;
    setBattleState(null);
    setDiceDisplay(null);
  }

  // Zero out tempDrive/tempSustain for both combatants once a battle resolves.
  // Bonuses from melody line patterns last only for the turn they were built —
  // they should not compound across multiple battles.
  // ⚡ Also burns any active Dissonance Edge stance for BOTH combatants, win or
  // lose, attacker or defender — stepping into a fight spends the risk you were
  // carrying either way (DESIGN_AUDIT_v2.md §9 v2). No refund of the HC/fans
  // already paid and no collapse penalty either — the fight itself was the cost.
  function clearBattleBuffs(attackerId, defenderId) {
    setNoteStates(prev => {
      const next = { ...prev };
      if (attackerId && next[attackerId]) next[attackerId] = { ...next[attackerId], tempDrive: 0, edgeStage: 0 };
      if (defenderId && next[defenderId]) next[defenderId] = { ...next[defenderId], tempSustain: 0, edgeStage: 0 };
      return next;
    });
  }

  // 🥊 Countering (the retaliation roll) is a CQC perk — gated behind owning any CQC skill.
  function ownsCQC(spiritId) {
    const u = engineRef.current.noteStates?.[spiritId]?.unlockedSkills ?? noteStates[spiritId]?.unlockedSkills ?? [];
    return ['shank_skank', 'cosmic_boogaloo', 'moon_shuffle'].some(id => u.includes(id));
  }

  // Close the battle overlay and apply any pending effects immediately
  function closeBattleOverlay() {
    const s = battleStateRef.current;
    if (!s || s.phase !== 'result') { setBattleState(null); setDiceDisplay(null); return; }
    const { attackerWon, damage, margin, attackerId, defenderId, sonicAttack } = s;
    if (attackerWon) {
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
            ...amps.map(a => a.hexNum),
            ...boardCards.map(c => c.hexNum),
            ...chargeZones.map(z => z.num),
            ...eventHexes,
            ...boardTokens.map(t => t.num),
            spotlightHex, LIMELIGHT_HEX,
          ];
          dispatch(thrashTokensSpawned(defSpirit.num, occupied, tier));
          const report = engineRef.current.board.lastThrashTokens;
          if (report) addLog(`🎵 ${report.added.length} Lost Chord${report.added.length !== 1 ? 's' : ''} knocked loose from the impact!`);
        }
        applySwingEffects(attackerId, defenderId, s.swingEffectRoll); // CQC = melee only
      }
      applyPendingCombatEffects(attackerId, defenderId); // Mojo Drain / Stagger land on any hit
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
          setTimeout(() => {
            setBattleState(p => {
              if (!p) return p;
              if (p.posing) return { ...p, phase: 'result' };
              const dds = p.defDieSides ?? 6;
              return { ...p, phase: 'def_die_spin', spinFaceDef: randDie(dds) };
            });
            // Spin defender die faces randomly
            const spinI2 = setInterval(() => {
              setBattleState(p => {
                if (!p || p.phase !== 'def_die_spin') { clearInterval(spinI2); return p; }
                const dds = p.defDieSides ?? 6;
                return { ...p, spinFaceDef: randDie(dds) };
              });
            }, 90);
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
                if (!isSonic) applySwingEffects(attackerId, defenderId, snap.swingEffectRoll); // CQC = melee only
                applyPendingCombatEffects(attackerId, defenderId); // Mojo Drain / Stagger land on any hit
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


  // ── COUNTER / RETALIATION — DISABLED ────────────────────────────────────────
  // Counter mechanic is temporarily removed pending a redesign that accounts for
  // the Sonic/Thrash split. The functions and state (retaliationTimer, ownsCQC,
  // resolveRetaliation, handleCounterDieClick, finishCounter) are commented out.
  // The battle flow now resolves immediately on result — no retaliation prompt.

  // roadieSelectHex — used for MOVE AMP flow: player clicks a hex, then a direction
  function roadieSelectHex(hexNum) {
    if (!roadieAction || roadieAction.phase !== 'selectHex') return;
    setRoadieAction(prev => ({ ...prev, phase: 'selectDir', adjHexNum: hexNum }));
    addLog(`🔧 Roadie at hex #${hexNum} — click a direction hex to move the Amp`);
  }

  // roadieStartFix — used for FIX CABLE flow: player picks which unplugged amp to fix
  function roadieStartFix(spiritId, roadieId) {
    if (!canAct) return; // N4/N7: gate
    const unpluggedAmps = amps.filter(a => a.ownerId === spiritId && a.unplugged);
    if (unpluggedAmps.length === 0) {
      addLog('🔧 No unplugged amps to fix!');
      return;
    }
    if (unpluggedAmps.length === 1) {
      // Only one — go straight to confirm
      setRoadieAction({ spiritId, roadieId, phase: 'replug', ampId: unpluggedAmps[0].id });
      addLog(`🔧 Roadie ready to replug Amp on #${unpluggedAmps[0].hexNum} — confirm!`);
    } else {
      // Multiple — let player pick (phase: 'pickAmp')
      setRoadieAction({ spiritId, roadieId, phase: 'pickAmp' });
      addLog(`🔧 Multiple unplugged amps — click one to fix`);
    }
  }

  function confirmRoadieReplug() {
    if (!canAct || !roadieAction || roadieAction.phase !== 'replug') return; // N4/N7: gate
    const { spiritId, roadieId, ampId } = roadieAction;
    roadieReplugAmp(spiritId, ampId);
    // Put roadie on cooldown
    setNoteStates(prev => {
      const s = prev[spiritId];
      if (!s) return prev;
      return {
        ...prev,
        [spiritId]: {
          ...s,
          roadies: (s.roadies ?? []).map(r =>
            r.id === roadieId ? { ...r, cooldownTurns: 2 } : r
          ),
        },
      };
    });
    setRoadieAction(null);
  }


  function roadieMoveAmp(dirHexNum) {
    if (!canAct || !roadieAction || roadieAction.phase !== 'selectDir') return; // N4/N7: gate
    const { spiritId, roadieId } = roadieAction;
    // Find amp adjacent to adjHexNum
    const adjHex = HEX_BY_NUM[roadieAction.adjHexNum];
    if (!adjHex) { setRoadieAction(null); return; }
    const ampHere = amps.find(a => {
      const ah = HEX_BY_NUM[a.hexNum];
      if (!ah) return false;
      return getFlatTopNeighborSlots(adjHex).some(n => n.num === a.hexNum) || a.hexNum === adjHex.num;
    });
    if (!ampHere) { addLog('🔧 No amp found — roadie action cancelled'); setRoadieAction(null); return; }

    // Move amp 2 hexes toward dirHexNum from its current position
    const ampHex = HEX_BY_NUM[ampHere.hexNum];
    const dirHex = HEX_BY_NUM[dirHexNum];
    if (!ampHex || !dirHex) { setRoadieAction(null); return; }

    // Step 1: nearest neighbor toward direction
    const step1 = neighborInDirection(ampHex, Math.atan2(dirHex.py - ampHex.py, dirHex.px - ampHex.px));
    // Step 2: another step in same direction from step1
    const step2 = step1 ? neighborInDirection(step1, Math.atan2(dirHex.py - ampHex.py, dirHex.px - ampHex.px)) : null;
    const finalHex = step2 ?? step1 ?? ampHex;

    const spirit = spirits.find(s => s.id === spiritId);
    const spiritHex = spirit ? HEX_BY_NUM[spirit.num] : null;

    // ── Spawn roadie slide animation ──────────────────────────────────────────
    const animId = `roadie-anim-${Date.now()}`;
    setRoadieAnimations(prev => [...prev, {
      id: animId,
      fromHex: spiritHex ?? ampHex,
      toAmpHex: ampHex,
      toFinalHex: finalHex,
      spiritColor: spirit?.color ?? '#ff8800',
      spiritName: spirit?.name ?? 'Roadie',
      startTime: Date.now(),
    }]);
    // Clear animation after it completes (2.8s total)
    setTimeout(() => {
      setRoadieAnimations(prev => prev.filter(a => a.id !== animId));
    }, 2800);

    setAmps(prev => prev.map(a => a.id === ampHere.id ? { ...a, hexNum: finalHex.num, connected: false, connectedBy: null } : a));

    // Put roadie on cooldown (2 turns) and remove from board
    setNoteStates(prev => {
      const s = prev[spiritId];
      if (!s) return prev;
      return {
        ...prev,
        [spiritId]: {
          ...s,
          roadies: (s.roadies ?? []).map(r =>
            r.id === roadieId ? { ...r, cooldownTurns: 2, onBoard: false, boardHex: null } : r
          ),
        },
      };
    });

    // Flavor log
    const flavorLines = [
      `🔧 ${spirit?.name}'s Roadie sprints out, grabs the cab, shoves it to hex #${finalHex.num} — gone before anyone noticed! (cooldown 2t)`,
      `🔧 ${spirit?.name}'s crew member dashes onto stage, kicks the Amp to hex #${finalHex.num}, then vanishes into the wings. (cooldown 2t)`,
      `🔧 A roadie for ${spirit?.name} hauls the cabinet across the floor to hex #${finalHex.num} — quick work! (cooldown 2t)`,
    ];
    addLog(flavorLines[Math.floor(Math.random() * flavorLines.length)]);
    setRoadieAction(null);
  }

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
    setRetaliationTimer(null);

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
        const occupied = spirits.map(sp => sp.num);
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
          ...amps.map(a => a.hexNum),
          ...boardCards.map(c => c.hexNum),
          ...chargeZones.map(z => z.num),
          ...eventHexes,
          ...boardTokens.map(t => t.num),
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

    // Advance queue first so we know who acts next, then replenish their used slots
    setTurnStep('pivot'); // reset HUD flow for next spirit's turn
    setTimeout(() => showTip('pivot'), 500);
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
  // 🤖 A self-tick. Some bot actions (declarePivot, the inter-step "beat") change
  // no value in the step-machine's dependency array, so the effect would never
  // re-fire to advance the turn. Bumping this after EVERY scheduled action gives
  // the effect a dependency that always changes — guaranteeing it re-evaluates
  // and the turn keeps flowing (pivot → build → commit → move → act → end).
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

  // Thin wrapper → pure policy function (engine/policies/bot.js)
  function botPickTarget(candidates, self) {
    return _botPickTarget(candidates, engineRef.current.noteStates);
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
    const unlocked = (engineRef.current.noteStates?.[self.id]?.unlockedSkills) ?? [];
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

  // A free adjacent hex to drop an amp on, biased toward centre stage so the rig
  // sits where the fighting is. Returns a hex num, or null if hemmed in.
  function botNeighborForAmp(self) {
    // Build outward: first amp beside the bot, later amps extend its rig. Among valid
    // hexes, prefer the one nearest centre stage (keeps the rig central / in beam play).
    const cands = [...ampPlaceCandidates(self.id)];
    if (!cands.length) return null;
    const hub = HEX_BY_NUM[LIMELIGHT_HEX];
    return cands
      .map(num => { const h = HEX_BY_NUM[num]; return { num, d: (hub && h) ? axialDist(h.q, h.r, hub.q, hub.r) : 0 }; })
      .sort((a, b) => a.d - b.d)[0].num;
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

  function botRevoiceChord(self, note) {
    const ns = engineRef.current.noteStates?.[self.id] ?? {};
    if (ns.revoiceUsedThisTurn || (ns.chordStack ?? []).length >= 5) return;
    const next = [...(ns.chordStack ?? []), note];
    setNoteField(self.id, { chordStack: next, revoiceUsedThisTurn: true });
    const ch = botSpiritChord(self.id, next);
    addLog(`🎸 ${self.name} voices ${note} into the Chord Stack — ${ch.name} (⚔️${ch.drive} 🛡️${ch.sustain}).`);
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
        // move→act, or declarePivot which changes no dep-array value).
        if (botStepRef.current === 'pending') botStepRef.current = prevStep;
        setBotNudge(n => n + 1);
      }, Math.max(0, Math.round(BOT_TICK / (gameSpeedRef.current || 1))));
    };

    // Shared per-cycle reads (fresh every fire — the nudge re-runs this effect).
    const ns        = engineRef.current.noteStates?.[self.id] ?? {};
    const unlocked  = ns.unlockedSkills ?? [];
    const liveSelf  = engineRef.current.spirits.find(s => s.id === self.id) ?? self;
    const hasSkill  = (id) => unlocked.includes(id);
    const crewReady = (id) => hasSkill(id) && (ns.groupieCooldowns?.[id] ?? 0) === 0;
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

      // 1b) PIVOT — declare a key before any note can be placed.
      if (ns.pivotPending) {
        // Flair leans minor for its defensive bonus — but ONLY once Minor Tonality is
        // unlocked. Declaring minor without theory_minor is rejected by declarePivot,
        // which would leave pivotPending stuck and the bot frozen on its pivot all turn.
        const mode = (self.style === 'Flair' && unlocked.includes('theory_minor')) ? 'minor' : 'major';
        schedule(guard(() => declarePivot(mode)));
        return;
      }

      // 1b.5) CHORD STACK — voice one note/turn toward a stronger combat chord and
      //       rebuild what last turn's attacks/defends drained. Free (no AP), once/turn.
      if (!ns.revoiceUsedThisTurn) {
        const voice = botPlanRevoice(self);
        if (voice != null) { schedule(guard(() => botRevoiceChord(self, voice))); return; }
      }

      const track = ns.melodyLine ?? [];
      const stock = ns.noteStock ?? [];
      const used  = ns.usedStockIdx ?? [];
      const scale = buildScale(ns.rootNote ?? 'C', ns.scaleMode ?? 'major');
      const isUsed = (i) => usedHas(used, i);

      // 1c) Pre-build setup — only while the track is still empty:
      if (track.length === 0) {
        // 🎼 Chromatic Shift — rewrite discord stock to in-scale before building.
        const csCard = (ns.modCards ?? []).find(c => c.type === 'chromatic_shift' && !c.exhausted);
        const discordInStock = stock.some((n, i) => !isUsed(i) && !scale.includes(n));
        if (csCard && discordInStock) { schedule(guard(() => playModCard(csCard.id))); return; }

        // 🔊 Deploy any unplaced amp beside us (boosts the Sonic die). Two beats:
        //     arm placement, then (next cycle, with ampPlacing set) drop it.
        const myAmpCount = amps.filter(a => a.ownerId === self.id).length;
        const ampUnlocks = ['amp_1','amp_2','amp_3'].filter(hasSkill).length;
        if (ampUnlocks > myAmpCount) {
          if (ampPlacing !== self.id) { schedule(() => setAmpPlacing(self.id)); return; }
          const ampHex = botNeighborForAmp(self);
          if (ampHex != null) { schedule(() => placeAmp(ampHex)); return; }
          schedule(() => setAmpPlacing(null)); return; // nowhere to place — bail cleanly
        }

        // 💚 Patch up early if we're hurting and the fans are ready.
        if (crewReady('fans_4eva') && (liveSelf.vibe ?? 0) <= (liveSelf.maxVibe ?? 0) - 2) {
          schedule(() => deployGroupie(self.id, 'fans_4eva')); return;
        }
      }

      // 1d/1e) MELODY LINE — plan-driven: clean notes ascending (Drive), all the way
      //        up to the 8-note cap (more notes = more HC), saving a 5th/4th for the
      //        final note (+5/+4), padding for movement only. See botPlanNoteStep.
      const plan = botPlanNoteStep(self);
      if (plan.commit) {
        // Squeeze Overdrive first if a discord note is still in the track (it now
        // pardons one −1 penalty rather than rescuing a zeroed track).
        const odCard = (ns.modCards ?? []).find(c => c.type === 'overdrive' && !c.exhausted);
        if (odCard && (ns.discordCount ?? 0) >= 1 && !ns.overdriveActive) {
          schedule(guard(() => playModCard(odCard.id))); return;
        }
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
      // 🪤 Pranksta — yank a nearby rival's cable to kill their Sonic die.
      const rivalAmpNear = myHex && amps.some(a => {
        if (a.ownerId === self.id || a.unplugged) return false;
        const ah = HEX_BY_NUM[a.hexNum];
        return ah && axialDist(myHex.q, myHex.r, ah.q, ah.r) <= 4;
      });
      if (crewReady('pranksta') && rivalAmpNear) { schedule(() => deployGroupie(self.id, 'pranksta')); return; }
      // 🛡️ Fandom Army — wall up (+2 Sustain) when a scrap looks imminent.
      if (crewReady('fandom_army') && (ns.tempSustain ?? 0) < 2 && botRivalsWithin(self, 2).length > 0) {
        schedule(() => deployGroupie(self.id, 'fandom_army')); return;
      }
      // 🔩 Junkyard Dog — arm a +2 Swing when a rival is in melee range.
      if (crewReady('junkyard_dog') && !ns.junkyardArmed && botRivalsWithin(self, 1).length > 0) {
        schedule(() => deployGroupie(self.id, 'junkyard_dog')); return;
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
        const coneNow0 = getRivalsInCone(self);
        // 🎸💥 SMASH a turtle: a high-Sustain rival in melee would shrug off a normal
        // swing, so bring the instrument down — undefendable, ignores their Sustain.
        // Needs 2 AP + at least 2 unused stock notes to hurl (leaves us Exposed).
        // 🗡️ Ronin never Smashes — brute force isn't his art (his Smash lands soft).
        if (coneNow0.length && steps >= 2 && self.id !== 'cosmic_ronin') {
          const usedSet  = ns.usedStockIdx;
          const isUsed    = (i) => usedHas(usedSet, i);
          const unused   = (ns.noteStock ?? []).filter((_, i) => !isUsed(i)).length;
          const t        = botPickTarget(coneNow0, self);
          const tSustain = spiritChord(t.id, engineRef.current.noteStates?.[t.id]?.chordStack ?? []).sustain;
          if (unused >= 2 && tSustain >= 6) {
            botStepRef.current = 'ending';
            schedule(guard(() => resolveSmash(t.id)));
            return;
          }
        }
        const beamNow = ampsInRangeRef.current >= 1 ? getRivalsInBeam(self) : [];
        if (beamNow.length && steps >= 2) {
          const t = botPickTarget(beamNow, self);
          botStepRef.current = 'ending';
          schedule(guard(() => initiateSonicAttack(t.id)));
          return;
        }
        const coneNow = getRivalsInCone(self);
        if (coneNow.length && steps >= 1) {   // jab now costs 1 AP
          const t = botPickTarget(coneNow, self);
          botStepRef.current = 'ending';
          schedule(guard(() => initiateSwing(t.id)));
          return;
        }
        // Not lined up — re-face toward the best shot (1 step to turn + 2 to fire).
        if (steps >= 3) {
          const bf = ampsInRangeRef.current >= 1 ? botBestFacing(self, 'beam') : null;
          if (bf) { schedule(aimFace(bf.angle)); return; }
          const cf = botBestFacing(self, 'cone');
          if (cf) { schedule(aimFace(cf.angle)); return; }
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
    // Attacker die — fired by whoever is attacking; auto only if attacker is a bot.
    if (bs.phase === 'atk_die_spin' && atkBot) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'atk_die_spin') handleAtkDieClick(); }, 700);
      return () => clearTimeout(t);
    }
    // Defender die — auto only if defender is a bot.
    if (bs.phase === 'def_die_spin' && defBot) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'def_die_spin') handleDefDieClick(); }, 700);
      return () => clearTimeout(t);
    }
    // Result card — if the active (acting) side is a bot, auto-close it so the
    // turn can wrap. closeBattleOverlay handles the win/whiff/retaliation branch.
    if (bs.phase === 'result' && isBot(acting)) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'result') closeBattleOverlay(); }, 1400);
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
    // Intro → start the attacker's call, but only if the ATTACKER is a bot (a
    // human attacker taps "DROP THE RIFF" themselves).
    if ((bs.phase === 'riff_intro' || bs.phase === 'riff_r2intro') && atkBot) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === bs.phase) riffBeginTurn('attacker'); }, 800);
      return () => clearTimeout(t);
    }
    // Handoff → start the defender's answer, but only if the DEFENDER is a bot (a
    // human defender taps "DROP THE ANSWER" themselves).
    if (bs.phase === 'riff_handoff' && defBot) {
      const t = setTimeout(() => { if (battleStateRef.current?.phase === 'riff_handoff') riffBeginTurn('defender'); }, 800);
      return () => clearTimeout(t);
    }
    // Clash + result are non-interactive spectacle — advance them whenever either
    // combatant is a bot (so a bot-involved duel never waits on a tap nobody owns).
    if (bs.phase === 'riff_clash' && bs.clashStage === 'charge' && (atkBot || defBot)) {
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
    // Amp placement mode takes priority
    if (ampPlacing) {
      placeAmp(num);
      return;
    }
    // Roadie: phase 1 — player clicks a hex adjacent to (or on) an amp
    if (roadieAction?.phase === 'selectHex') {
      const clickedHex = HEX_BY_NUM[num];
      if (!clickedHex) return;
      // Valid target: the hex must be occupied by an amp, or be a neighbor of one
      const hasAmpHere    = amps.some(a => a.hexNum === num);
      const hasAmpNearby  = amps.some(a => {
        const ah = HEX_BY_NUM[a.hexNum];
        if (!ah) return false;
        return getFlatTopNeighborSlots(clickedHex).some(n => n.num === a.hexNum);
      });
      if (hasAmpHere || hasAmpNearby) {
        roadieSelectHex(num);
      } else {
        addLog('🔧 Click a hex next to one of your Amps to send the Roadie there.');
      }
      return;
    }
    if (action === "swing") {
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
      const rivals = acting ? getRivalsInBeam(acting) : [];
      const target = rivals.find(r => r.num === num);
      if (target) { initiateSonicAttack(target.id); setAction(null); }
      else addLog("🔊 That spirit is not in your sonic beam!");
      return;
    }
    if (action === "smash") {
      const rivals = acting ? getRivalsInCone(acting) : [];
      const target = rivals.find(r => r.num === num);
      if (target) { resolveSmash(target.id); setAction(null); }
      else addLog("🎸 That spirit is not in melee range to Smash!");
      return;
    }
    if (action === "blaster") {
      // 🌀 Ranged & piercing — clicking any rival in the beam fires at ALL of them.
      const rivals = acting ? getRivalsInBeam(acting) : [];
      if (rivals.some(r => r.num === num)) { resolveBlasterOfRa(); setAction(null); }
      else addLog("🌀 Click a rival in your beam to fire the Blaster of Ra!");
      return;
    }
    if (action === "displace") {
      if (acting && ampPlaceCandidates(acting.id).has(num)) resolveDisplace(num);
      else addLog("🌌 Warp to an open hex beside your amp rig.");
      return;
    }
    if (action === "move") {
      if (reachable.has(num)) move(num);
      else addLog("❌ Can't reach that hex!");
      return;
    }
    const s = spiritByNum[num];
    if (s) addLog(`ℹ️ ${s.name} — ${s.vibe}/${s.maxVibe} Vibe · Hex #${num}`);
  }

  // ─── HEX VISUAL HELPERS ───────────────────────────────────────────────────────
  const HS = Math.round(HEX_SIZE * SCALE * 0.88);

  // Neighbours of acting spirit (used for amp placement highlights)
  const actingNeighbors = useMemo(() => {
    if (!ampPlacing) return new Set();
    // Highlight valid drop hexes for the placing spirit: beside it (first amp) or
    // touching its rig (extensions).
    return ampPlaceCandidates(ampPlacing);
  }, [ampPlacing, acting, spirits, amps]);

  // 🌌 Valid warp landing hexes while aiming Displace (open hexes beside the rig).
  const displaceTargets = useMemo(() => {
    if (action !== 'displace' || !acting) return new Set();
    return ampPlaceCandidates(acting.id);
  }, [action, acting, spirits, amps]);

  function hexFill(hex) {
    if (hex.num === LIMELIGHT_HEX) return "#ff44ff18";
    if (hex.num === spotlightHex)  return "#ffffff14";
    const sp = spiritByNum[hex.num];
    if (sp) return sp.color + "44";
    if (ampPlacing && actingNeighbors.has(hex.num)) return "#ffcc4422";
    if (action === 'displace' && displaceTargets.has(hex.num)) return "#aa55ff33";
    if (reachable.has(hex.num)) return "#ffffff18";
    // Swing cone highlight
    if (action === 'swing' && acting) {
      const cone = getSwingCone(acting);
      if (cone.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num);
        return isRival ? '#ff333344' : '#ff111122';
      }
    }
    // Sonic beam highlight
    if ((action === 'sonic' || action === 'blaster') && acting) {
      const beam = getSonicBeam(acting);
      if (beam.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num);
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
    // Roadie selectHex: highlight hexes adjacent to (or on) any amp
    if (roadieAction?.phase === 'selectHex') {
      const hasAmpHere = amps.some(a => a.hexNum === hex.num);
      const hexObj = HEX_BY_NUM[hex.num];
      const hasAmpNearby = hexObj && amps.some(a => {
        const ah = HEX_BY_NUM[a.hexNum];
        if (!ah) return false;
        return getFlatTopNeighborSlots(hexObj).some(n => n.num === a.hexNum);
      });
      if (hasAmpHere || hasAmpNearby) return "#ff880022";
    }
    // Amp range preview on hover: fill hexes within AMP_UNPLUG_DIST of the hovered amp
    if (hovered !== null) {
      const hoveredAmp = amps.find(a => a.hexNum === hovered);
      if (hoveredAmp) {
        const ampHex = HEX_BY_NUM[hoveredAmp.hexNum];
        const thisHex = HEX_BY_NUM[hex.num];
        if (ampHex && thisHex) {
          const dist = axialDist(ampHex.q, ampHex.r, thisHex.q, thisHex.r);
          if (dist <= AMP_UNPLUG_DIST && dist > 0)
            return hoveredAmp.ownerColor + "22";
        }
      }
    }
    return "transparent";
  }

  function hexStroke(hex) {
    if (hex.num === LIMELIGHT_HEX) return "#ff44ff";
    if (hex.num === spotlightHex)  return "#ffffaacc";
    const sp = spiritByNum[hex.num];
    if (sp && acting?.id === sp.id) return sp.color;
    if (sp) return sp.color;
    if (ampPlacing && actingNeighbors.has(hex.num)) return "#ffcc44cc";
    if (action === 'displace' && displaceTargets.has(hex.num)) return "#cc88ffcc";
    if (reachable.has(hex.num)) return "#ffffff88";
    // Swing cone stroke
    if (action === 'swing' && acting) {
      const cone = getSwingCone(acting);
      if (cone.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num);
        return isRival ? '#ff4444ee' : '#ff222244';
      }
    }
    // Sonic beam stroke
    if ((action === 'sonic' || action === 'blaster') && acting) {
      const beam = getSonicBeam(acting);
      if (beam.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num);
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
    // Roadie selectHex: highlight hexes adjacent to (or on) any amp
    if (roadieAction?.phase === 'selectHex') {
      const hasAmpHere = amps.some(a => a.hexNum === hex.num);
      const hexObj = HEX_BY_NUM[hex.num];
      const hasAmpNearby = hexObj && amps.some(a => {
        const ah = HEX_BY_NUM[a.hexNum];
        if (!ah) return false;
        return getFlatTopNeighborSlots(hexObj).some(n => n.num === a.hexNum);
      });
      if (hasAmpHere || hasAmpNearby) return "#ff8800bb";
    }
    if (hovered === hex.num && action) return "#ffffffaa";
    if (hex.stage) return "#ff44ff88";
    // Amp range preview on hover: stroke hexes within AMP_UNPLUG_DIST of the hovered amp
    if (hovered !== null) {
      const hoveredAmp = amps.find(a => a.hexNum === hovered);
      if (hoveredAmp) {
        const ampHex = HEX_BY_NUM[hoveredAmp.hexNum];
        const thisHex = HEX_BY_NUM[hex.num];
        if (ampHex && thisHex) {
          const dist = axialDist(ampHex.q, ampHex.r, thisHex.q, thisHex.r);
          if (dist <= AMP_UNPLUG_DIST && dist > 0)
            return hoveredAmp.ownerColor + "99";
        }
      }
    }
    return "transparent";
  }

  function hexStrokeW(hex) {
    if (hex.num === LIMELIGHT_HEX) return 2;
    const sp = spiritByNum[hex.num];
    if (sp && acting?.id === sp.id) return Math.round(3 / SCALE * 0.13);
    if (sp || reachable.has(hex.num) || hex.stage) return 1.5;
    if (ampPlacing && actingNeighbors.has(hex.num)) return 2;
    if (action === 'displace' && displaceTargets.has(hex.num)) return 2;
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

  // 🏃 Send a crew token (Roadie/Groupie) travelling from one hex to another.
  // Piggybacks on the roadieAnimations render (generalised to take icon + label).
  function flyCrew({ fromHexNum, toHexNum, icon = '🔧', color = '#ffcc44', label }) {
    const fromHex = HEX_BY_NUM[fromHexNum];
    const toHex   = HEX_BY_NUM[toHexNum];
    if (!fromHex || !toHex) return;
    const id = `crew-fly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setRoadieAnimations(prev => [...prev, {
      id, fromHex, toAmpHex: toHex, toFinalHex: toHex,
      spiritColor: color, spiritName: label ?? 'Crew',
      icon, labelText: label, startTime: Date.now(),
    }]);
    gt(() => setRoadieAnimations(prev => prev.filter(a => a.id !== id)), 2800);
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
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className={beginnerEnabled ? 'beginner-glow' : ''} style={{ fontFamily:"'Share Tech Mono','Courier New',monospace",
      background:"radial-gradient(ellipse at 50% -10%, #0a1226 0%, #050810 55%)",
      color:"#e2e8f0", minHeight:"100vh", display:"flex", flexDirection:"column", padding:10, boxSizing:"border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap" rel="stylesheet"/>

      {/* ── GAME OVER OVERLAY ── */}
      <GameOverOverlay
        winner={winner}
        spirits={spirits}
        noteStates={noteStates}
        limelightScores={limelightScores}
        onReturnToLobby={onReturnToLobby}
        FAME_TO_WIN={FAME_TO_WIN}
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
          onClose={() => setActiveTip(null)}
          onDisable={() => { setBeginnerEnabled(false); setActiveTip(null); }}
        />
      )}

      {/* 🎵 LOST CHORD PICKUP — bank it vs weave it into the Chord Stack */}
      {pendingLostChordPickup && (() => {
        const sp = spirits.find(s => s.id === pendingLostChordPickup.spiritId);
        const chordFull = (noteStates[pendingLostChordPickup.spiritId]?.chordStack?.length ?? 0) >= 5;
        return (
          <div style={{position:'fixed',inset:0,zIndex:99999,display:'flex',alignItems:'center',justifyContent:'center',
            background:'#000000aa',backdropFilter:'blur(3px)'}}>
            <div style={{width:360,maxWidth:'90vw',background:'linear-gradient(180deg,#0e1828,#080f1e)',
              border:'1.5px solid #7fe0ff',borderRadius:12,padding:'22px 20px 18px',
              boxShadow:'0 0 40px #7fe0ff33, 0 8px 32px #00000088',
              fontFamily:"'Share Tech Mono',monospace",textAlign:'center'}}>
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:12,color:'#7fe0ff',letterSpacing:1,marginBottom:10,
                textShadow:'0 0 10px #7fe0ff55'}}>🎵 LOST CHORD FOUND</div>
              <div style={{fontSize:26,fontWeight:900,color:'#fff',marginBottom:4,
                textShadow:'0 0 12px #7fe0ff'}}>{pendingLostChordPickup.note}</div>
              <div style={{fontSize:9,color:'#8aa5c5',marginBottom:16,lineHeight:1.5}}>
                {sp?.name} can bank it into the Note Stock, or weave it straight into the
                Chord Stack — that spends this turn's one revoice.
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <button onClick={() => resolveLostChordPickup('chord')} disabled={chordFull}
                  style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,cursor: chordFull?'not-allowed':'pointer',
                    opacity: chordFull ? 0.4 : 1,
                    background:'#1a0c1a',border:'1.5px solid #ff66cc',borderRadius:5,
                    color:'#ff99dd',padding:'8px 16px',letterSpacing:1}}>
                  🎸 Add to Chord Stack {chordFull ? '(chord full)' : '(spends revoice)'}
                </button>
                <button onClick={() => resolveLostChordPickup('bank')}
                  style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,cursor:'pointer',
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
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:12,color:'#44aaff',letterSpacing:1,marginBottom:10,
                textShadow:'0 0 10px #44aaff55'}}>⚡ CHARGE ZONE — OVERCHARGE</div>
              <div style={{fontSize:9,color:'#8aa5c5',marginBottom:16,lineHeight:1.5}}>
                {sp?.name} taps into the rig. Pick the payoff:
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <button onClick={() => resolveChargeChoice('boost')}
                  style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,cursor:'pointer',
                    background:'#0a1828',border:'1.5px solid #44aaff',borderRadius:5,
                    color:'#88ccff',padding:'8px 16px',letterSpacing:1,textAlign:'left'}}>
                  ⚡ Dice Charge — random Floor +{CHARGE_FLOOR_BONUS} or die-size up ({CHARGE_ZONE_BOOST_TURNS} rounds / until battle)
                </button>
                <button onClick={() => resolveChargeChoice('chord')}
                  style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,cursor:'pointer',
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
        <span style={{fontFamily:"'Orbitron',sans-serif",fontSize:17,color:"#f6ad55",letterSpacing:3,
          textShadow:"0 0 12px #f6ad5566, 0 0 28px #f6ad5522"}}>⚡ RLSW</span>
        <span style={{fontSize:10,color:"#3a5a7a"}}>v3.6</span>
        <button onClick={() => setShowRiffbook(true)} title="The Riffbook — legendary riffs hidden in the note system"
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
          🏆 first to ⭐{FAME_TO_WIN} FP wins
        </span>
        {flamingHexes.roundsLeft > 0 && (
          <span style={{fontSize:9,padding:"2px 8px",background:"#1a0800",border:"1px solid #ff6622",borderRadius:10,color:"#ff8844",
            animation:"marqueeBlink 1.4s ease-in-out infinite"}}>
            🔥💿 DISCO INFERNO — {flamingHexes.roundsLeft} round{flamingHexes.roundsLeft!==1?"s":""} left
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
            const m = crowdMultiplier(D, C);
            return (
              <span title="Crowd — Fame multiplier · ♥ diehards · 👥 casuals"
                style={{fontSize:9,padding:"2px 9px",background:"#160a12",border:"1px solid #ff66aa66",borderRadius:10,
                  color:"#ff66aa",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>
                🎤 ×{m.toFixed(2)} <span style={{color:'#ffcc44'}}>♥{D}</span> <span style={{color:'#66ccff'}}>👥{C}</span>
              </span>
            );
          })()}
          {/* BGM Controls */}
          <div style={{display:"flex",alignItems:"center",gap:4,background:"#0a1020",border:"1px solid #1e3a5f",borderRadius:4,padding:"2px 6px"}}>
            <span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>BGM</span>
            <span style={{fontSize:8,color:"#4488ff",minWidth:16,textAlign:"center"}}>{bgmTrackNum}</span>
            <button onClick={() => setBgmMuted(m => !m)}
              style={{fontFamily:"inherit",fontSize:10,padding:"1px 4px",background:"none",border:"none",color:bgmMuted?"#ff4444":"#88bbff",cursor:"pointer",lineHeight:1}}>
              {bgmMuted ? "🔇" : "🔊"}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={bgmVolume}
              onChange={e => setBgmVolume(parseFloat(e.target.value))}
              style={{width:40,accentColor:"#4488ff",cursor:"pointer"}}/>
            <button onClick={bgmSkip}
              style={{fontFamily:"inherit",fontSize:9,padding:"1px 4px",background:"none",border:"none",color:"#3a5a7a",cursor:"pointer",lineHeight:1}}>
              ⏭
            </button>
          </div>
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
            <span style={{fontFamily:"'Orbitron',sans-serif",fontSize:9,padding:"3px 10px",background:"#301520",
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
          fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:1.5,
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
        SWING_FX_INFO={SWING_FX_INFO}
        SWING_UPGRADE_TIERS={SWING_UPGRADE_TIERS}
        battleMeterImg={battleMeterImg}
        battlePickImg={battlePickImg}
        battleState={battleState}
        closeBattleOverlay={closeBattleOverlay}
        closeRiffOff={closeRiffOff}
        crowdBlueImg={crowdBlueImg}
        crowdPinkImg={crowdPinkImg}
        fameFromMargin={fameFromMargin}
        fireBeamClash={fireBeamClash}
        handleAtkDieClick={handleAtkDieClick}
        handleDefDieClick={handleDefDieClick}
        hydraImg={hydraImg}
        knockbackSpaces={knockbackSpaces}
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
        setBattleState={setBattleState}
        setDiceDisplay={setDiceDisplay}
        setRiffDifficulty={setRiffDifficulty}
        setRiffView={setRiffView}
        setSkipBattleIntros={setSkipBattleIntros}
        skipBattleIntro={skipBattleIntro}
        skipBattleIntros={skipBattleIntros}
        spirits={spirits}
      />





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
        ampPlacing={ampPlacing}
        noteStates={noteStates}
        setAmpPlacing={setAmpPlacing}
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
                  {/* Vibe */}
                  <div data-tip-anchor="vibe-bar" style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:7,color:"#3a5a7a",width:22}}>VIBE</span>
                    <div className="bar" style={{flex:1}}>
                      <div className="bar-f" style={{width:`${(s.vibe/s.maxVibe)*100}%`,
                        background:s.vibe>s.maxVibe*.4?"#44cc66":"#ff4444"}}/>
                    </div>
                    <span style={{fontSize:8,width:22,textAlign:"right",color:"#c0d0e0"}}>{s.vibe}/{s.maxVibe}</span>
                  </div>
                  {/* ⭐ Fame — the win condition, front and centre */}
                  <div data-tip-anchor="fame-bar" style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}
                    title={`Fame Points — first to ${FAME_TO_WIN} wins the game!`}>
                    <span style={{fontSize:7,color:"#ffd700",width:22,fontWeight:700}}>FAME</span>
                    <div className="bar" style={{flex:1,boxShadow:"0 0 5px #ffd70033"}}>
                      <div className="bar-f" style={{width:`${Math.min(100,((ns.fame ?? 0)/FAME_TO_WIN)*100)}%`,
                        background:"linear-gradient(90deg,#aa7700,#ffd700)",
                        boxShadow:"0 0 6px #ffd70088"}}/>
                    </div>
                    <span style={{fontSize:8,width:22,textAlign:"right",color:"#ffd700",fontWeight:700}}>{ns.fame ?? 0}</span>
                  </div>
                  {/* 🎛️ Drive & Sustain come from the player's Chord Stack now (not a static sheet) */}
                  <div style={{display:"flex",gap:9,marginTop:5,alignItems:"center"}}>
                    {/* boost = every live modifier on this stat, summed — pattern-boost tempDrive/
                        tempSustain PLUS the Dissonance Edge stage delta (edgeCombatMods), so the
                        dial always reflects the stat you'd actually fight with right now. */}
                    <StatKnob label="DRIVE"   value={spiritChord(s.id, ns.chordStack ?? []).drive}   boost={(ns.tempDrive   ?? 0) + edgeCombatMods(ns).drive} color="#ff6644"/>
                    <StatKnob label="SUSTAIN" value={spiritChord(s.id, ns.chordStack ?? []).sustain} boost={(ns.tempSustain ?? 0) - edgeCombatMods(ns).sustainPenalty} color="#44aaff"/>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                      <div>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                          <span style={{fontSize:7,color:"#cc66ff"}}>💗 VIBE</span>
                          <span style={{fontSize:7,color:"#cc66ff"}}>{s.maxVibe ?? 5}</span>
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

                {/* ── LEFT COLUMN — loadout: badges · crew & gear · HC · skills ── */}
                <div style={{flex:1, minWidth:170, order:1, display:"flex", flexDirection:"column",
                  borderRight:`1px solid ${s.color}22`}}>
                {/* Status badges */}
                {((ns.tempDrive??0)>0||(ns.tempSustain??0)>0||(ns.mojoDrain??0)>0||ns.stagger||(ns.burn?.turnsLeft??0)>0||ns.statusShield||ns.burnArmed||respawnFlashes[s.id]||ns.instrumentDropped||ns.tripped||ns.dazed||(ns.elevenTurns??0)>0||ns.junkyardArmed||ns.bonusRevoiceAvailable||(ns.edgeStage??0)>0||amps.some(a=>a.ownerId===s.id&&a.unplugged)) && (
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",padding:"4px 8px",borderTop:`1px solid ${s.color}22`}}>
                    {(ns.elevenTurns??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a1400",border:"1px solid #ffcc44",color:"#ffcc44"}}>
                        🎚️ GOES TO 11 — {ns.elevenTurns}t
                      </span>)}
                    {(ns.edgeStage??0)>0&&(
                      <span title={ns.edgeStage>=EDGE_MAX_STAGE
                        ? "On the Edge — resolve on Root/3rd/5th THIS turn or the stance collapses"
                        : "On the Edge — Drive up, Sustain down. End on Root/3rd/5th to resolve it for a payout."}
                        style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                        background: ns.edgeStage>=EDGE_MAX_STAGE ? "#2a0800" : "#1a0e00",
                        border:`1px solid ${ns.edgeStage>=EDGE_MAX_STAGE ? "#ff3344" : "#ff8866"}`,
                        color: ns.edgeStage>=EDGE_MAX_STAGE ? "#ff5566" : "#ff8866"}}>
                        ⚡ EDGE {ns.edgeStage}/{EDGE_MAX_STAGE} (⚔️+{EDGE_DRIVE_BY_STAGE[ns.edgeStage]}/🛡️−{EDGE_SUSTAIN_PENALTY_BY_STAGE[ns.edgeStage]}){ns.edgeStage>=EDGE_MAX_STAGE ? ' RESOLVE!' : ''}
                      </span>)}
                    {ns.bonusRevoiceAvailable&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0a18",border:"1px solid #ff66cc",color:"#ff99dd",
                        animation:"crew-ready-glow 2s ease-in-out infinite"}}>
                        ⚡ BONUS REVOICE READY
                      </span>)}
                    {ns.junkyardArmed&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a1200",border:"1px solid #ffaa22",color:"#ffaa22"}}>
                        🔩 WEAPON ARMED — next Swing +2
                      </span>)}
                    {(ns.tempDrive??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#2a0e00",border:"1px solid #ff6644",color:"#ffaa44"}}>
                        ⚔️ +{ns.tempDrive} atk
                      </span>)}
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
                    {ns.statusShield&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#03261a",border:"1px solid #44ffaa88",color:"#44ffaa"}}>
                        ✨ SHIELDED — blocks next status
                      </span>)}
                    {ns.burnArmed&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#2a0e00",border:"1px solid #ff5522",color:"#ff8855"}}>
                        🔥 BURN ARMED — next attack
                      </span>)}
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
                    {amps.some(a=>a.ownerId===s.id&&a.unplugged)&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0e00",border:"1px solid #ff880066",color:"#ff8800"}}>
                        🔌 AMP UNPLUGGED — d6 only
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
                    chromatic_shift: { icon:'🎼', name:'Chromatic Shift', color:'#44ffaa', desc:'Rewrite all discord notes → in-scale (after pivot)' },
                    transpose:       { icon:'🔄', name:'Transpose',       color:'#ffcc44', desc:'Pick any stock note as your new Root (during pivot)' },
                    overdrive:       { icon:'⚡', name:'Overdrive',       color:'#ff8844', desc:'1 discord note counts as in-scale (before commit)' },
                  };
                  return (
                    <div style={{padding:'5px 8px',borderTop:`1px solid ${s.color}22`}}>
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
                {/* ── CREW & GEAR — deployable amps, roadies, groupies, ultimate ── */}
                {(() => {
                  const unlocked = ns.unlockedSkills ?? [];
                  const myAmps   = amps.filter(a => a.ownerId === s.id);
                  const groupieIds = ['fans_4eva','pranksta','junkyard_dog','fandom_army'].filter(id => unlocked.includes(id));
                  const hasRoadies = (ns.roadies?.length ?? 0) > 0;
                  const hasUlt     = unlocked.includes('ultimate');
                  const ampUnlockCount = ['amp_1','amp_2','amp_3'].filter(id => unlocked.includes(id)).length;
                  const canPlaceAmp    = ampUnlockCount > myAmps.length;
                  if (!hasRoadies && groupieIds.length === 0 && !hasUlt && myAmps.length === 0 && !canPlaceAmp) return null;

                  const GROUPIE_DEFS = {
                    fans_4eva:    { icon:'💚', label:'Fans 4Eva',    hint:'+2 Vibe' },
                    pranksta:     { icon:'🪤', label:'Pranksta',     hint:'Unplug 2 rival amps ≤4 hex' },
                    junkyard_dog: { icon:'🔩', label:'Junkyard',     hint:'+2 next Swing' },
                    fandom_army:  { icon:'🛡️', label:'Fandom Army',  hint:'+2 Sustain next battle' },
                  };
                  const chipBase = {
                    fontFamily:'inherit', cursor:'pointer', borderRadius:4,
                    padding:'3px 7px', fontSize:8, lineHeight:1.3, whiteSpace:'nowrap',
                  };
                  return (
                    <div data-tip-anchor="crew-gear" style={{padding:'5px 8px', borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
                        <span style={{fontSize:7,color:'#3a5a7a',letterSpacing:2}}>CREW &amp; GEAR</span>
                        <span style={{flex:1,height:1,background:`linear-gradient(90deg, ${s.color}33, transparent)`}}/>
                      </div>

                      {/* AMPS row */}
                      {(myAmps.length > 0 || canPlaceAmp) && (
                        <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:4,alignItems:'center'}}>
                          <span style={{fontSize:7,color:'#ffcc4488',width:34}}>AMPS</span>
                          {myAmps.map((a,i) => (
                            <span key={a.id} title={a.unplugged ? 'Unplugged — send a Roadie or walk back in range' : 'Live'}
                              style={{...chipBase, cursor:'default',
                                background:a.unplugged?'#1a0e00':'#141a08',
                                border:`1px solid ${a.unplugged?'#ff8800':'#ffcc44'}66`,
                                color:a.unplugged?'#ff8800':'#ffcc44'}}>
                              🔊 #{a.hexNum}{a.unplugged?' ⚡✕':''}
                            </span>
                          ))}
                          {canPlaceAmp && !ampPlacing && canAct && (
                            <button style={{...chipBase, background:'#0a1020',
                                border:'1px dashed #ffcc44aa', color:'#ffcc44',
                                animation:'crew-ready-glow 2s ease-in-out infinite'}}
                              onClick={() => {
                                setAmpPlacing(s.id);
                                addLog(`🔊 ${s.name} — click an adjacent hex to place Amp ${myAmps.length + 1}`);
                              }}>
                              ➕ Place Amp {myAmps.length + 1}/{ampUnlockCount}
                            </button>
                          )}
                        </div>
                      )}

                      {/* ROADIES row */}
                      {hasRoadies && (
                        <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:4,alignItems:'center'}}>
                          <span style={{fontSize:7,color:'#88bbff88',width:34}}>CREW</span>
                          {ns.roadies.map((r, i) => {
                            const onCooldown = r.cooldownTurns > 0;
                            const isActive = roadieAction?.roadieId === r.id;
                            if (onCooldown) return (
                              <span key={r.id} style={{...chipBase, cursor:'default',
                                background:'#0a0e16', border:'1px solid #333344', color:'#444455'}}>
                                🔧 R{i+1} · {r.cooldownTurns}t
                              </span>
                            );
                            return (
                              <React.Fragment key={r.id}>
                                <button
                                  onClick={() => !isActive && startRoadieAction(s.id, r.id)}
                                  style={{...chipBase,
                                    background: isActive && roadieAction.phase!=='replug' && roadieAction.phase!=='pickAmp' ? s.color+'33' : '#0a1525',
                                    border:`1px solid ${s.color}66`, color:'#c0d0e0'}}>
                                  🔧 R{i+1} · Move Amp
                                </button>
                                {myAmps.some(a => a.unplugged) && (
                                  <button
                                    onClick={() => roadieStartFix(s.id, r.id)}
                                    style={{...chipBase,
                                      background: isActive && (roadieAction.phase==='replug'||roadieAction.phase==='pickAmp') ? '#113300' : '#0a1525',
                                      border:'1px solid #44ff8866', color:'#44ff88'}}>
                                    🔌 Fix Cable
                                  </button>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}

                      {/* GROUPIES row */}
                      {groupieIds.length > 0 && (
                        <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:4,alignItems:'center'}}>
                          <span style={{fontSize:7,color:'#44cc8888',width:34}}>FANS</span>
                          {groupieIds.map(id => {
                            const def = GROUPIE_DEFS[id];
                            const cd = ns.groupieCooldowns?.[id] ?? 0;
                            const armed = id === 'junkyard_dog' && ns.junkyardArmed;
                            if (cd > 0) return (
                              <span key={id} title={def.hint} style={{...chipBase, cursor:'default',
                                background:'#0a0e16', border:'1px solid #333344', color:'#444455'}}>
                                {def.icon} {cd}t
                              </span>
                            );
                            if (armed) return (
                              <span key={id} title="Weapon armed — lands on your next Swing" style={{...chipBase, cursor:'default',
                                background:'#1a1200', border:'1px solid #ffaa22', color:'#ffaa22'}}>
                                🔩 ARMED
                              </span>
                            );
                            return (
                              <button key={id} title={def.hint}
                                onClick={() => deployGroupie(s.id, id)}
                                style={{...chipBase, color:'#44cc88',
                                  background:'#08140e', border:'1px solid #44cc8866',
                                  animation:'crew-ready-glow 2.4s ease-in-out infinite'}}>
                                {def.icon} {def.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* ULTIMATE row */}
                      {hasUlt && (
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
                      )}

                      {/* Roadie action prompt (unchanged flow) */}
                      {roadieAction?.spiritId === s.id && (
                        <div style={{fontSize:8, color:'#ffcc44', marginTop:4,
                          padding:'3px 6px', background:'#1a1200', borderRadius:3,
                          border:'1px solid #ffcc4444'}}>
                          {roadieAction.phase === 'replug'
                            ? <>🔌 Replug amp on #{amps.find(a=>a.id===roadieAction.ampId)?.hexNum}?{' '}
                                <button onClick={confirmRoadieReplug}
                                  style={{fontFamily:'inherit',cursor:'pointer',background:'#113300',
                                    border:'1px solid #44ff88',borderRadius:3,color:'#44ff88',
                                    fontSize:9,marginLeft:4,padding:'1px 6px'}}>✓ Fix it!</button>
                              </>
                            : roadieAction.phase === 'pickAmp'
                              ? <>🔌 Click an unplugged amp hex to fix:<br/>
                                  {amps.filter(a=>a.ownerId===roadieAction.spiritId&&a.unplugged).map(a=>(
                                    <button key={a.id}
                                      onClick={()=>{
                                        setRoadieAction(prev=>({...prev,phase:'replug',ampId:a.id}));
                                        addLog(`🔌 Roadie targeting amp on #${a.hexNum}`);
                                      }}
                                      style={{fontFamily:'inherit',cursor:'pointer',background:'#0a1a0a',
                                        border:'1px solid #44ff88',borderRadius:3,color:'#44ff88',
                                        fontSize:9,margin:'2px 3px',padding:'1px 6px'}}>
                                      Amp #{a.hexNum}
                                    </button>
                                  ))}
                                </>
                            : roadieAction.phase === 'selectHex'
                              ? '📦 Click a hex near your Amp to move it'
                              : '📦 Click a direction hex to push the Amp toward'}
                          <button onClick={() => setRoadieAction(null)}
                            style={{fontFamily:'inherit', cursor:'pointer', background:'none', border:'none',
                              color:'#ff4444', fontSize:9, marginLeft:8, padding:0}}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── HC PROGRESS BAR ── */}
                {(() => {
                  const targetId  = ns.targetSkillId;
                  const targetDef = targetId ? SKILL_BY_ID[targetId] : null;
                  const hcPts     = ns.hcPoints ?? 0;
                  const targetCost = targetDef?.hcCost ?? 8;
                  const pct       = Math.min(1, hcPts / targetCost);
                  const routeDef  = targetDef ? SKILL_TREE.routes.find(r => r.id === targetDef.routeId) : null;
                  const barColor  = routeDef?.color ?? '#ffcc44';
                  return (
                    <div data-tip-anchor="hc-bar" style={{padding:"5px 8px 6px", borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3}}>
                        <span style={{fontSize:7, color:"#3a5a7a", letterSpacing:1}}>HC PROGRESS</span>
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
                          {hcPts} / {targetCost}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── OWNED SKILLS ── */}
                {(ns.unlockedSkills?.length ?? 0) > 0 && (() => {
                  return (
                    <div style={{padding:"4px 8px 6px", borderTop:`1px solid ${s.color}22`}}>
                      <div style={{fontSize:7, color:"#3a5a7a", letterSpacing:1, marginBottom:4}}>SKILLS</div>
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
                    </div>
                  );
                })()}
                <div style={{flex:1}}/>{/* push loadout content to top */}
                </div>{/* end left column */}
                </div>{/* end two-column row */}
              </div>
            );
          })()}

          {/* ── NOTE STOCK PANEL ── */}
          {acting && (
            <div data-tip-anchor="note-stock"
              className={`card${turnStep === 'pivot' || turnStep === 'melody' ? ' step-active' : turnStep === 'move_act' ? ' step-collapsed' : ''}`}
              style={{'--step-glow-color': turnStep === 'pivot' ? '#ffcc44' : turnStep === 'chord' ? '#ff66cc' : '#4488ff',
                borderLeft:`2px solid ${turnStep === 'pivot' ? '#ffcc44' : turnStep === 'melody' ? '#4488ff' : '#4488ff66'}`,padding:"6px 8px",marginBottom:4,
                ...(turnStep === 'move_act' ? {maxHeight:36,overflow:'hidden',transition:'max-height 0.4s ease, opacity 0.3s'} : {})}}>
              <NeonStrikeFX color={turnStep === 'pivot' ? '#ffcc44' : '#4488ff'}/>
              {/* Header: big Root Note badge + title + interval legend */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                {/* 🎵 ROOT NOTE — big mode-colored badge */}
                <div data-tip-anchor="root-note" title={pivotPending
                    ? `Root Note is ${rootNote} — choose Major or Minor below to set your scale`
                    : `Root Note — your scale is ${rootNote} ${scaleMode}. The LAST note of your committed track becomes next turn's Root!`}
                  style={{
                    width:48,height:48,borderRadius:9,flexShrink:0,
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    background: pivotPending ? "linear-gradient(135deg,#241a00,#120d00)"
                      : scaleMode==='major' ? "linear-gradient(135deg,#0d2050,#0a1228)"
                      : "linear-gradient(135deg,#240d45,#12091e)",
                    border:`2px solid ${pivotPending ? "#ffcc44" : scaleMode==='major' ? "#4488ff" : "#aa55ff"}`,
                    boxShadow:`0 0 14px ${pivotPending ? "#ffcc4466" : scaleMode==='major' ? "#4488ff66" : "#aa55ff66"}, inset 0 0 10px ${pivotPending ? "#ffcc4422" : scaleMode==='major' ? "#4488ff22" : "#aa55ff22"}`,
                  }}>
                  <span style={{fontSize:5.5,letterSpacing:1.5,color:"#7a90aa",fontWeight:700}}>ROOT</span>
                  <span style={{fontSize:18,fontWeight:900,color:"#ffffff",lineHeight:1,
                    textShadow:`0 0 10px ${pivotPending ? "#ffcc44" : scaleMode==='major' ? "#4488ff" : "#aa55ff"}`}}>
                    {rootNote}
                  </span>
                  <span style={{fontSize:6,letterSpacing:1,marginTop:1,fontWeight:700,
                    color: pivotPending ? "#ffcc44" : scaleMode==='major' ? "#88bbff" : "#cc99ff"}}>
                    {pivotPending ? "PICK MODE" : scaleMode === 'major' ? "☀️ MAJOR" : "🌑 MINOR"}
                  </span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="stitle" style={{marginBottom:3,color: turnStep === 'pivot' ? "#ffcc44" : "#4488ff"}}>
                    {turnStep === 'pivot' ? 'Step 1 — Choose Scale' : turnStep === 'chord' ? 'Step 2 — Chord Stack' : turnStep === 'melody' ? 'Step 3 — Build Melody' : 'Note Stock'}
                  </div>
                  {turnStep !== 'move_act' && (
                  <div data-tip-anchor="interval-legend" style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:7,color:"#cc55ff"}}>4th={fourthNote}</span>
                    <span style={{fontSize:7,color:"#ff55aa"}}>5th={fifthNote}</span>
                    <span style={{fontSize:7,color:"#ff3300"}}>tri={tritoneNote}</span>
                    <span style={{fontSize:7,color:"#44ffaa"}}>M3={majorThirdNote}</span>
                    <span style={{fontSize:7,color:"#4499ff"}}>m7={minorSeventhNote}</span>
                  </div>
                  )}
                </div>
              </div>
              {/* ⚡ DISSONANCE EDGE — current stage (0-2), live-previewed as you build. Shows
                  what CONFIRMING NOW would do: resolve (gold), escalate/start (red-orange),
                  or collapse (red) if you're at max stage and haven't landed on Root/3rd/5th. */}
              {acting && (() => {
                const stageNow      = actingNoteState?.edgeStage ?? 0;
                const chordTonesNow = new Set([currentScale[0], currentScale[2], currentScale[4]]);
                const lastPlaced    = melodyLine[melodyLine.length - 1];
                const trackEndedYet = !hasConfirmed && melodyLine.length > 0;
                const wouldResolve  = trackEndedYet && stageNow > 0 && chordTonesNow.has(lastPlaced);
                const wouldCollapse = trackEndedYet && stageNow >= EDGE_MAX_STAGE && !wouldResolve;
                const wouldStartOrEscalate = trackEndedYet && !wouldResolve && !wouldCollapse && !isNotePlayable(lastPlaced);
                const previewLabel = wouldResolve ? 'RESOLVE!' : wouldCollapse ? 'COLLAPSE!'
                                    : wouldStartOrEscalate ? (stageNow === 0 ? 'START' : 'ESCALATE') : null;
                const previewColor = wouldResolve ? "#ffd700" : wouldCollapse ? "#ff3344"
                                    : wouldStartOrEscalate ? "#ff5566" : "#ff8866";
                return (
                  <div title="Ending a track on a Discord note puts you ON THE EDGE: Drive up, Sustain down, paid for in HC + fans. Escalates if you stay out; land the resolve on Root/3rd/5th for a payout, or lose it all if you're still out at max stage."
                    style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                    <span style={{fontSize:7,color:"#ff8866",letterSpacing:0.5,flexShrink:0}}>⚡ EDGE</span>
                    <div style={{display:"flex",gap:2,flex:1}}>
                      {Array.from({length: EDGE_MAX_STAGE}, (_, i) => i + 1).map(stage => (
                        <div key={stage} className="bar" style={{flex:1,position:"relative",overflow:"hidden"}}>
                          <div className="bar-f" style={{
                            width: stage <= stageNow ? "100%" : "0%",
                            background: previewLabel && stage === Math.max(stageNow, 1) ? previewColor : "#ff8866",
                            animation: previewLabel && stage === Math.max(stageNow, 1)
                              ? "cadence-gold-pulse 1.2s ease-in-out infinite" : undefined,
                          }}/>
                        </div>
                      ))}
                    </div>
                    <span style={{fontSize:7,color: stageNow>=EDGE_MAX_STAGE ? "#ff5566" : "#ff8866",flexShrink:0}}>
                      {stageNow}/{EDGE_MAX_STAGE}{previewLabel ? ` · ${previewLabel}` : ''}
                    </span>
                  </div>
                );
              })()}
              {/* 🎛️ AMP TONE PANEL relocated → now flanks the Commit Track above the board. */}
              {/* Active effect badges — only show during melody step */}
              {(turnStep === 'melody' || turnStep === 'move_act') && (feedbackBoost || dieFloorBoost > 0 || statusEffects.length > 0
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
                                ? <span style={{fontWeight:700}}> to RESOLVE! ⭐{h.cadence.fp} FP</span>
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
                  )}{feedbackBoost && (
                    <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#2a0800",border:"1px solid #ff3300",color:"#ff5522"}}>
                      🔥 Damage ×2
                    </span>
                  )}
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
              {turnStep !== 'pivot' && !pivotPending && (
                <div className="step-collapsed" style={{fontSize:8,color:scaleMode==='major'?"#88bbff":"#cc99ff",marginBottom:4,
                  padding:"3px 7px",background:scaleMode==='major'?"#0a1228":"#12091e",border:`1px solid ${scaleMode==='major'?'#4488ff33':'#aa55ff33'}`,borderRadius:4}}>
                  ✓ Scale: {rootNote} {scaleMode === 'major' ? '☀️ Major' : '🌑 Minor'}
                </div>
              )}
              {turnStep !== 'pivot' && turnStep !== 'chord' && !pivotPending && !hasConfirmed && (() => {
                const chord = actingNoteState?.chordStack ?? [];
                const ch = spiritChord(acting?.id, chord);
                return (
                  <div className="step-collapsed" style={{fontSize:8,color:"#ff99dd",marginBottom:4,
                    padding:"3px 7px",background:"#0c0a18",border:"1px solid #ff66cc33",borderRadius:4}}>
                    ✓ Chord: {chord.join(' ')} — {ch.name} · ⚔️{ch.drive} 🛡️{ch.sustain}
                  </div>
                );
              })()}

              {/* Pivot choice — shown during pivot step */}
              {pivotPending ? (
                <div style={{background:"#0e0d18",border:"1.5px solid #ffcc44",borderRadius:5,padding:"8px 10px",marginBottom:4}}>
                  <div style={{fontSize:9,color:"#ffcc44",fontWeight:700,marginBottom:6}}>
                    ⚡ Root Note: <span style={{color:"#fff"}}>{rootNote}</span> — choose your scale
                  </div>

                  {/* Stock preview split by mode */}
                  {(() => {
                    const majRoot  = canonicalRoot(rootNote, 'major');
                    const minRoot  = canonicalRoot(rootNote, 'minor');
                    // Only light notes the player can actually play Discord-free given their
                    // Theory unlocks (everyone starts on the pentatonic) — not the full scale.
                    const unlocks  = actingNoteState?.unlockedSkills ?? [];
                    const majScale = playableScale(majRoot, 'major', unlocks);
                    const minScale = playableScale(minRoot, 'minor', unlocks);
                    const majIntervals = getIntervalNotes(majRoot, 'major');
                    const minIntervals = getIntervalNotes(minRoot, 'minor');
                    const stock = actingNoteState?.noteStock ?? [];

                    function noteColor(note, scale, intervals, mode) {
                      const pc = pitchIndex(note);
                      // Fourth and fifth are always diatonic — always show their color
                      if (pc === pitchIndex(intervals.fifth))        return { border:"#ff55aa", text:"#ff55aa", bg:"#2a0f1a" };
                      if (pc === pitchIndex(intervals.fourth))       return { border:"#cc55ff", text:"#cc55ff", bg:"#1a0a2a" };
                      // Special interval colors only show once the matching Discord upgrade is unlocked.
                      // If the note is already in-scale for this mode, it's just a plain scale note.
                      // Tritone: red only with discord_3 (Devil's Interval), both modes
                      if (pc === pitchIndex(intervals.tritone)) {
                        if (!scale.includes(note) && discordUnlocks.includes('discord_3'))
                          return { border:"#ff3300", text:"#ff3300", bg:"#2a0800" };
                        // Note: chromatic (discord_4) gives no special color — stays grey
                      }
                      // Minor seventh: blue only with discord_1 (Blues Lick), major mode only
                      if (pc === pitchIndex(intervals.minorSeventh)) {
                        if (!scale.includes(note) && mode === 'major' && discordUnlocks.includes('discord_1'))
                          return { border:"#4499ff", text:"#4499ff", bg:"#051525" };
                      }
                      // Major third: green only with discord_2 (Borrowed Chord), minor mode only
                      if (pc === pitchIndex(intervals.majorThird)) {
                        if (!scale.includes(note) && mode === 'minor' && discordUnlocks.includes('discord_2'))
                          return { border:"#44ffaa", text:"#44ffaa", bg:"#0a2a1a" };
                      }
                      if (scale.includes(note)) return { border:"#c0c8d8", text:"#e8eef8", bg:"#1a2035" };
                      return { border:"#333344", text:"#444455", bg:"#0d0d14" };
                    }

                    // Count how many stock notes are in-scale for each mode
                    const majInScale = stock.filter(n => {
                      const respelled = getSpelledPool(majRoot,'major')[pitchIndex(n)] ?? n;
                      return majScale.includes(respelled);
                    }).length;
                    const minInScale = stock.filter(n => {
                      const respelled = getSpelledPool(minRoot,'minor')[pitchIndex(n)] ?? n;
                      return minScale.includes(respelled);
                    }).length;

                    return (
                      <div style={{display:"flex",gap:6,marginBottom:8}}>
                        {/* Major preview */}
                        <div style={{flex:1,background:"#0a1228",borderRadius:4,padding:"6px 7px",
                          border:"1px solid #4488ff33"}}>
                          <div style={{fontSize:7,color:"#4488ff",letterSpacing:1,marginBottom:5,
                            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>♩ MAJOR</span>
                            <span style={{color:"#6aaa88",fontSize:7}}>{majInScale}/8 in scale</span>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:5}}>
                            {stock.map((note,i) => {
                              const pool = getSpelledPool(majRoot,'major');
                              const respelled = pool[pitchIndex(note)] ?? note;
                              const c = noteColor(respelled, majScale, majIntervals, 'major');
                              return (
                                <div key={i} style={{
                                  width:22,height:20,borderRadius:2,fontSize:8,fontWeight:700,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  border:`1.5px solid ${c.border}`,color:c.text,background:c.bg,
                                }}>{respelled}</div>
                              );
                            })}
                          </div>
                          <div style={{fontSize:7,color:"#4488ff88",marginBottom:1}}>Scale: {majScale.join(' · ')}</div>
                          <div style={{marginTop:4,padding:"3px 6px",borderRadius:3,
                            background:"#0d1830",border:"1px solid #4488ff44",
                            fontSize:7,color:"#88bbff"}}>
                            ☀️ Bonus: <span style={{color:"#aaccff",fontWeight:700}}>+1 HC point</span>
                          </div>
                        </div>

                        {/* Minor preview */}
                        <div style={{flex:1,background:"#12091e",borderRadius:4,padding:"6px 7px",
                          border:"1px solid #aa55ff33"}}>
                          <div style={{fontSize:7,color:"#aa55ff",letterSpacing:1,marginBottom:5,
                            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>♩ MINOR</span>
                            <span style={{color:"#6aaa88",fontSize:7}}>{minInScale}/8 in scale</span>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:5}}>
                            {stock.map((note,i) => {
                              const pool = getSpelledPool(minRoot,'minor');
                              const respelled = pool[pitchIndex(note)] ?? note;
                              const c = noteColor(respelled, minScale, minIntervals, 'minor');
                              return (
                                <div key={i} style={{
                                  width:22,height:20,borderRadius:2,fontSize:8,fontWeight:700,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  border:`1.5px solid ${c.border}`,color:c.text,background:c.bg,
                                }}>{respelled}</div>
                              );
                            })}
                          </div>
                          <div style={{fontSize:7,color:"#aa55ff88",marginBottom:1}}>Scale: {minScale.join(' · ')}</div>
                          <div style={{marginTop:4,padding:"3px 6px",borderRadius:3,
                            background:"#180d2a",border:"1px solid #aa55ff44",
                            fontSize:7,color:"#cc99ff"}}>
                            🌑 Bonus: <span style={{color:"#ddbbff",fontWeight:700}}>+1 Sustain</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{display:"flex",gap:6}}>
                    <button className="btn" onClick={()=>declarePivot("major")}
                      style={{flex:1,fontSize:9,padding:"5px 0",borderColor:"#4488ff",color:"#4488ff",
                        background:"#0a1228",fontWeight:700}}>
                      ☀️ Major
                    </button>
                    {(() => {
                      const minorOk = (actingNoteState?.unlockedSkills ?? []).includes('theory_minor');
                      return (
                    <button className="btn" onClick={()=>declarePivot("minor")} disabled={!minorOk}
                      title={minorOk ? "Declare Minor" : "🔒 Unlock Minor Tonality in the Theory tree"}
                      style={{flex:1,fontSize:9,padding:"5px 0",borderColor: minorOk ? "#aa55ff" : "#4a3a5a",color: minorOk ? "#aa55ff" : "#5a4a6a",
                        background:"#12091e",fontWeight:700, opacity: minorOk ? 1 : 0.45, cursor: minorOk ? "pointer" : "not-allowed"}}>
                      🌑 Minor {minorOk ? "" : "🔒"}
                    </button>
                      );
                    })()}
                  </div>
                </div>
              ) : hasConfirmed ? (
                <div style={{fontSize:8,color:"#44ff88",marginBottom:5,padding:"6px 8px",background:"#0d1f10",border:"1px solid #44ff8844",borderRadius:4}}>
                  ✓ Notes committed — move and use actions below.
                </div>
              ) : turnStep === 'chord' ? (
                /* ── STEP 2: CHORD STACK ── shown prominently after scale choice.
                   No revoice toggle — during chord step, editing is always live. */
                (() => {
                  const chord = actingNoteState?.chordStack ?? [];
                  const ch = spiritChord(acting?.id, chord);
                  const revoiced = !!actingNoteState?.revoiceUsedThisTurn;
                  const full = chord.length >= 5;
                  return (
                    <div style={{marginBottom:5}}>
                      <div className="step-active" style={{'--step-glow-color':'#ff66cc',background:"#0c0a18",border:"1.5px solid #ff66cc",borderRadius:6,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:"#ff99dd",fontWeight:700,marginBottom:4,letterSpacing:1}}>
                          🎸 CHORD STACK — your combat stance
                        </div>
                        <div style={{fontSize:7,color:"#6a8a9a",marginBottom:6}}>
                          {revoiced ? '✓ revoiced this turn (1/turn) — review your chord below'
                           : full ? 'chord full (5) — drop a note to swap' : 'tap a stock note to add · tap a chip to drop'}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6}}>
                          <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                            {chord.map((n,i)=>(
                              <span key={i} onClick={()=>removeChordNote(i)} title={revoiced?'locked':'tap to drop'}
                                style={{fontSize:11,fontWeight:700,color:"#ff99dd",background:"#1a0c1a",border:"1px solid #ff66cc66",borderRadius:4,padding:"2px 7px",cursor:revoiced?'default':'pointer'}}>{n}</span>
                            ))}
                          </div>
                          <span style={{marginLeft:"auto",fontSize:10,fontWeight:700,color:"#ffcc44"}}>{ch.name} · ⚔️{ch.drive} 🛡️{ch.sustain}</span>
                          {/* Hover preview — shows projected stats when hovering a stock note */}
                          {hoverScale?.note && !revoiced && !full && (() => {
                            const preview = spiritChord(acting?.id, [...chord, hoverScale.note]);
                            const dd = preview.drive - ch.drive;
                            const ds = preview.sustain - ch.sustain;
                            return (
                              <span style={{fontSize:8,fontWeight:700,marginLeft:6,whiteSpace:"nowrap"}}>
                                <span style={{color:"#6a8a9a"}}>→</span>{' '}
                                <span style={{color:dd>0?"#ff6644":dd<0?"#ff666688":"#8a8a8a"}}>⚔️{preview.drive}{dd!==0&&<span style={{fontSize:6}}>{dd>0?'+':''}{dd}</span>}</span>{' '}
                                <span style={{color:ds>0?"#44aaff":ds<0?"#44aaff88":"#8a8a8a"}}>🛡️{preview.sustain}{ds!==0&&<span style={{fontSize:6}}>{ds>0?'+':''}{ds}</span>}</span>
                              </span>
                            );
                          })()}
                        </div>
                        {/* Note stock for chord editing — always visible during chord step */}
                        {!revoiced && (
                          <div style={{marginBottom:6,padding:"4px 7px",background:"#140a18",border:"1px solid #ff66cc33",borderRadius:4}}>
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
                                const hexBorder = showAsDiscord ? "#444455" : showTritoneColor ? "#ff3300" : showMinorSeventhColor ? "#4499ff" : showMajorThirdColor ? "#44ffaa" : isFifth ? "#ff55aa" : isFourth ? "#cc55ff" : inScaleNote ? "#c0c8d8" : "#444455";
                                const hexText   = showAsDiscord ? "#555566" : showTritoneColor ? "#ff3300" : showMinorSeventhColor ? "#4499ff" : showMajorThirdColor ? "#44ffaa" : isFifth ? "#ff55aa" : isFourth ? "#cc55ff" : inScaleNote ? "#e8eef8" : "#555566";
                                const hexBg     = showAsDiscord ? "#111118" : showTritoneColor ? "#2a0800" : showMinorSeventhColor ? "#051525" : showMajorThirdColor ? "#0a2a1a" : isFifth ? "#2a0f1a" : isFourth ? "#1a0a2a" : inScaleNote ? "#1a2035" : "#111118";
                                /* Drive/Sustain benefit preview */
                                const previewChord = !used && !full ? spiritChord(acting?.id, [...chord, note]) : null;
                                const dDrive   = previewChord ? previewChord.drive   - ch.drive   : 0;
                                const dSustain = previewChord ? previewChord.sustain - ch.sustain : 0;
                                // 🕳️ A used slot is genuinely EMPTY -- no note color, no discord
                                // color, just a bare outline -- so it can never be mistaken for a
                                // discord note (which stays fully opaque in its own dim palette).
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
                        <button className="btn" onClick={()=>{ setChordMode(false); setTurnStep('melody'); setTimeout(() => showTip('melody'), 300); }}
                          style={{width:"100%",fontSize:9,padding:"6px 0",borderColor:"#44ff88",color:"#44ff88",fontWeight:700,
                            background:"#0a1a10",boxShadow:"0 0 8px #44ff8833"}}>
                          {revoiced ? '✓ Chord set — Continue to Melody →' : 'Continue to Melody →'}
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
                    // Special color rules mirror the Discord unlock gates:
                    // - tritone: needs discord_3 (out-of-scale until then → gray)
                    // - minorSeventh: needs discord_1 to show blue (in Major it's out-of-scale
                    //   without it; in Minor it's naturally in-scale → show as plain white)
                    // - majorThird: needs discord_2 to show green (in Minor it's out-of-scale
                    //   without it; in Major it's naturally in-scale → show as plain white)
                    // - fourth/fifth: always diatonic → always show their color
                    const showTritoneColor      = isTritone      && discordUnlocks.includes('discord_3');
                    const showMinorSeventhColor = isMinorSeventh && discordUnlocks.includes('discord_1') && scaleMode === 'major';
                    const showMajorThirdColor   = isMajorThird   && discordUnlocks.includes('discord_2') && scaleMode === 'minor';
                    // Out-of-scale interval notes that haven't been unlocked → gray discord
                    const showAsDiscord  = isIntervalNote && !isUnlocked && !inScaleNote;
                    const borderC = showAsDiscord        ? "#444455"
                                  : showTritoneColor     ? "#ff3300"
                                  : showMinorSeventhColor? "#4499ff"
                                  : showMajorThirdColor  ? "#44ffaa"
                                  : isFifth              ? "#ff55aa"
                                  : isFourth             ? "#cc55ff"
                                  : inScaleNote          ? "#c0c8d8"
                                  : "#444455";
                    const textC   = showAsDiscord        ? "#555566"
                                  : showTritoneColor     ? "#ff3300"
                                  : showMinorSeventhColor? "#4499ff"
                                  : showMajorThirdColor  ? "#44ffaa"
                                  : isFifth              ? "#ff55aa"
                                  : isFourth             ? "#cc55ff"
                                  : inScaleNote          ? "#e8eef8"
                                  : "#555566";
                    const bgC     = showAsDiscord        ? "#111118"
                                  : showTritoneColor     ? "#2a0800"
                                  : showMinorSeventhColor? "#051525"
                                  : showMajorThirdColor  ? "#0a2a1a"
                                  : isFifth              ? "#2a0f1a"
                                  : isFourth             ? "#1a0a2a"
                                  : inScaleNote          ? "#1a2035"
                                  : "#111118";
                    const shadow  = showAsDiscord        ? "none"
                                  : showTritoneColor     ? "0 0 6px #ff330077"
                                  : showMinorSeventhColor? "0 0 5px #4499ff77"
                                  : showMajorThirdColor  ? "0 0 5px #44ffaa55"
                                  : isFifth              ? "0 0 5px #ff55aa66"
                                  : isFourth             ? "0 0 5px #cc55ff66"
                                  : inScaleNote          ? "0 0 4px #c0c8d844"
                                  : "none";
                    const lockTip = isIntervalNote && !isUnlocked && !inScaleNote
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
                    return (
                      <div key={idx} onClick={(e)=>{ if (isStaggered) return; if (!used || mixerReady) clickNoteStock(idx, e); }}
                        onMouseEnter={(e)=>{ const x=e.clientX, y=e.clientY; clearTimeout(hoverScaleTimerRef.current); hoverScaleTimerRef.current=setTimeout(()=>setHoverScale({note,x,y}),1500); }}
                        onMouseLeave={()=>{ clearTimeout(hoverScaleTimerRef.current); setHoverScale(cur=>cur?.note===note?null:cur); }}
                        title={isStaggered ? "⚡ Staggered — unavailable"
                             : mixerReady ? "🎚️ Mixer — tap to layer this note again"
                             : resolvesCadence ? `🎯 End your track on this note to RESOLVE a cadence — Fame!${lockTip}`
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
                                   : isFresh ? "note-pop-in .5s ease-out" : undefined,
                          transition:"all .1s",
                        }}>
                        <div className="hexi" style={{
                          fontSize:9,fontWeight:700,
                          color: isStaggered ? "#ff8800" : mixerReady ? "#44ddff" : resolvesCadence ? "#ffd700" : isEmpty ? "transparent" : textC,
                          background: isStaggered ? "#1a0e00" : isEmpty ? "#141a24" : bgC,
                        }}>{isStaggered ? "⚡" : isEmpty ? "" : note}</div>
                      </div>
                    );
                  })}
                </div>
                  );
                })()}
                {/* 🎸 CHORD PREVIEW (in Revoice mode) — hover-a-note guidance (inline, instant via hoverScale) */}
                {!hasConfirmed && chordMode && (() => {
                  const chord = actingNoteState?.chordStack ?? [];
                  const full  = chord.length >= 5;
                  const hn    = hoverScale?.note;
                  const next  = hn ? spiritChord(acting?.id, [...chord, hn]) : null;
                  return (
                    <div style={{marginBottom:5,minHeight:34,background:"#140a18",border:"1px solid #ff66cc44",borderRadius:4,padding:"4px 7px"}}>
                      {hn && next ? (
                        <>
                          <div style={{fontSize:8,color:"#ff99dd",fontWeight:700,marginBottom:2}}>🎸 Add {hn} → {next.name}</div>
                          <div style={{fontSize:8}}>
                            <span style={{color:"#ff6644",fontWeight:700}}>⚔️{next.drive}</span>{'   '}
                            <span style={{color:"#44aaff",fontWeight:700}}>🛡️{next.sustain}</span>
                            {full && <span style={{color:"#ff6666",marginLeft:8}}>chord full — drop one to revoice</span>}
                          </div>
                        </>
                      ) : (
                        <span style={{fontSize:7.5,color:"#aa6688"}}>🎸 Revoice on — hover a note to preview what it adds to your chord</span>
                      )}
                    </div>
                  );
                })()}
                {/* 🎼 SCALE PEEK — fixed popup, 1.5s hover delay (no longer inline to avoid HUD jitter) */}
                {hoverScale && !chordMode && (() => {
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
                {/* Overdrive active banner */}
                {actingNoteState?.overdriveActive && !hasConfirmed && (
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,
                    background:'#1a0c00',border:'1.5px solid #ff8844',borderRadius:4,padding:'4px 8px'}}>
                    <span style={{fontSize:10}}>⚡</span>
                    <span style={{fontSize:8,color:'#ff8844',fontWeight:700}}>
                      Overdrive active — 1 discord note pardoned
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
                    🛡️{spiritChord(s.id, ns.chordStack ?? []).sustain}
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
                  {amps.some(a=>a.ownerId===s.id&&a.unplugged)&&<span style={{fontSize:7,color:"#ff8800"}} title="Amp unplugged!">🔌</span>}
                </div>
                {/* Owned skills + HC target row */}
                {(() => {
                  const owned     = ns.unlockedSkills ?? [];
                  const targetDef = ns.targetSkillId ? SKILL_BY_ID[ns.targetSkillId] : null;
                  const targetRoute = targetDef ? SKILL_TREE.routes.find(r => r.id === targetDef.routeId) : null;
                  const hcPts     = ns.hcPoints ?? 0;
                  const targetCost = targetDef?.hcCost ?? 8;
                  const pct       = Math.min(1, hcPts / targetCost);
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
                      {/* HC target mini-bar */}
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
                            {hcPts}/{targetCost}
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
            {turnStep === 'move_act' ? 'Step 4 — Move & Act' : 'Actions'}
          </div>
          {ampPlacing && (
            <div style={{fontSize:8,color:"#ffcc44",background:"#1a1200",border:"1px solid #ffcc4466",
              borderRadius:4,padding:"4px 8px",marginBottom:4}}>
              🔊 Click an adjacent hex to place your Amp
              <button className="btn" style={{marginLeft:6,fontSize:7,borderColor:"#ff4444",color:"#ff4444",padding:"1px 5px"}}
                onClick={() => setAmpPlacing(null)}>Cancel</button>
            </div>
          )}
          {/* ⚡ BONUS REVOICE — Overcharge chord-assist. Deliberately its own compact
              widget (not the normal chord editor) so it reads as a separate,
              one-shot budget rather than a second free revoice. */}
          {acting && actingNoteState?.bonusRevoiceAvailable && (
            <div className="step-active" style={{'--step-glow-color':'#ff66cc',
              background:"#140a18",border:"1.5px solid #ff66cc",borderRadius:6,padding:"6px 8px",marginBottom:6}}>
              <div style={{fontSize:8,color:"#ff99dd",fontWeight:700,marginBottom:4,letterSpacing:0.5}}>
                ⚡ BONUS REVOICE — Overcharge (separate from your normal 1/turn budget)
              </div>
              <div style={{fontSize:7,color:"#c88ad0",marginBottom:5}}>
                {(actingNoteState.chordStack?.length ?? 0) >= 5
                  ? 'Chord full — tap a chip below to drop one, freeing a slot.'
                  : 'Tap a stock note to add it to your Chord Stack.'}
              </div>
              <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:5}}>
                {(actingNoteState.chordStack ?? []).map((n, i) => (
                  <span key={i} onClick={() => spendBonusRevoiceDrop(i)} title="tap to drop (spends the bonus revoice)"
                    style={{fontSize:10,fontWeight:700,color:"#ff99dd",background:"#1a0c1a",
                      border:"1px solid #ff66cc66",borderRadius:4,padding:"2px 6px",cursor:"pointer"}}>{n}</span>
                ))}
              </div>
              {(actingNoteState.chordStack?.length ?? 0) < 5 && (
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {(actingNoteState.noteStock ?? []).map((n, i) => {
                    const used = usedHas(actingNoteState.usedStockIdx, i);
                    if (used) return null;
                    return (
                      <span key={i} onClick={() => spendBonusRevoiceAdd(i)} title="tap to add (spends the bonus revoice)"
                        style={{fontSize:9,fontWeight:700,color:"#ffcc44",background:"#0c0a18",
                          border:"1px solid #ffcc4466",borderRadius:4,padding:"2px 6px",cursor:"pointer"}}>{n}</span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {/* Amp placement now lives in the CREW & GEAR panel above */}
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
            {/* SWING — baseline attack, always available */}
            {hasConfirmed && !actionTokenUsed && (() => {
              const cone = acting ? getSwingCone(acting) : new Set();
              const rivals = acting ? getRivalsInCone(acting) : [];
              const canSwing = rivals.length > 0 && moveStepsLeft >= 1;
              return (
                <div style={{position:'relative',display:'inline-block'}}>
                  <button className={canSwing ? 'btn active' : 'btn'}
                    style={{borderColor: canSwing ? '#ff4444' : '#441111',
                      color: canSwing ? '#ff6666' : '#441111',
                      position:'relative'}}
                    disabled={!canSwing}
                    title="The jab — cheap (1 AP) & defended. Drives your chord into them and can land Thrash statuses."
                    onClick={() => {
                      if (action === 'swing') { setAction(null); }
                      else if (canSwing) {
                        setAction('swing');
                        addLog('⚔️ SWING — click a rival in your cone to attack! (1 AP)');
                      }
                    }}>
                    ⚔️ Swing{rivals.length > 0 ? ` (${rivals.length})` : ''} {!canSwing && moveStepsLeft < 1 ? '(1AP)' : ''}
                  </button>
                </div>
              );
            })()}
            {action === 'swing' && (
              <button className="btn" style={{borderColor:'#888',color:'#888'}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* 🎸 THE SMASH (melee) — or 🌀 BLASTER OF RA (ranged, piercing) for Intergalactic 0 */}
            {hasConfirmed && !actionTokenUsed && (() => {
              const ns = actingNoteState ?? {};
              // 🌀 Once Blaster of Ra is unlocked, it REPLACES the Smash: ranged beam, pierces all.
              const hasBlaster = acting?.id === 'intergalactic_0' && (ns.unlockedSkills ?? []).includes('blaster_of_ra');
              const rivals = acting ? (hasBlaster ? getRivalsInBeam(acting) : getRivalsInCone(acting)) : [];
              const unused = (ns.noteStock ?? []).filter((_, i) => !usedHas(ns.usedStockIdx, i)).length;
              const canFire = rivals.length > 0 && moveStepsLeft >= 2 && unused >= 2;
              const mode    = hasBlaster ? 'blaster' : 'smash';
              return (
                <div style={{position:'relative',display:'inline-block'}}>
                  <button className={canFire ? 'btn active' : 'btn'}
                    style={{borderColor: canFire ? '#ff33aa' : '#330022', color: canFire ? '#ff66cc' : '#330022'}}
                    disabled={!canFire}
                    title={hasBlaster
                      ? "Blaster of Ra (2 AP) — a ranged, piercing bass-drop down the beam: undefendable, scatters & knocks back EVERY rival in line. Ends your movement, leaves you Exposed. Hurls your unused stock."
                      : "The haymaker (2 AP) — primal & undefendable: ignores their Sustain, scatters their notes. But it ends all your movement this turn and leaves you Exposed. Hurls your unused stock."}
                    onClick={() => {
                      if (action === mode) { setAction(null); }
                      else if (canFire) {
                        setAction(mode);
                        addLog(hasBlaster
                          ? `🌀💥 BLASTER OF RA — click a rival in your beam to fire down the line! (${unused} notes to hurl)`
                          : `🎸💥 THE SMASH — click an adjacent rival to bring it down! (${unused} notes to hurl)`);
                      }
                    }}>
                    {hasBlaster ? '🌀 Blaster of Ra' : '🎸 Smash'}{rivals.length > 0 ? ` (${unused})` : ''} {!canFire && moveStepsLeft < 2 ? '(2AP)' : ''}
                  </button>
                </div>
              );
            })()}
            {(action === 'smash' || action === 'blaster') && (
              <button className="btn" style={{borderColor:'#888',color:'#888'}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* SONIC ATTACK — available when connected to ≥1 amp */}
            {hasConfirmed && !actionTokenUsed && (() => {
              const beam    = acting ? getSonicBeam(acting) : new Set();
              const targets = acting ? getRivalsInBeam(acting) : [];
              const plugged = ampsInRange >= 1;
              const ampCount = Math.min(ampsInRange + elevenBoost, 3);
              const hasHydra = (actingNoteState?.unlockedSkills ?? []).includes('hydra');
              const diceLabel = dicePoolLabel(sonicDicePool(ampCount, hasHydra));
              const canSonic = plugged && targets.length > 0 && moveStepsLeft >= 2;
              if (!plugged) return null; // hide entirely when not plugged in
              return (
                <div style={{position:'relative',display:'inline-block'}}>
                  <button className={canSonic ? 'btn active' : 'btn'}
                    style={{borderColor: canSonic ? '#44aaff' : '#112244',
                      color: canSonic ? '#66ccff' : '#112244'}}
                    disabled={!canSonic}
                    onClick={() => {
                      if (action === 'sonic') { setAction(null); }
                      else if (canSonic) {
                        setAction('sonic');
                        addLog(`🔊 SONIC ATTACK — click a target in your beam! (${diceLabel} keep best, ${ampCount} amp${ampCount>1?'s':''})`);
                      }
                    }}>
                    🔊 Sonic{targets.length > 0 ? ` (${targets.length})` : ''} {diceLabel}
                    {!canSonic && moveStepsLeft < 2 ? ' (2AP)' : ''}
                  </button>
                </div>
              );
            })()}
            {action === 'sonic' && (
              <button className="btn" style={{borderColor:'#888',color:'#888'}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* 🌌 DISPLACE — Intergalactic 0 warps to his amp rig (3 AP, 2-turn cooldown) */}
            {hasConfirmed && acting?.id === 'intergalactic_0'
              && (actingNoteState?.unlockedSkills ?? []).includes('displace') && (() => {
              const cd      = actingNoteState?.displaceCd ?? 0;
              const hasRig  = amps.some(a => a.ownerId === acting.id);
              const canWarp = cd <= 0 && hasRig && moveStepsLeft >= DISPLACE_AP;
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
            {/* UNPLUG RIVAL AMP — shown when adjacent to an unplugged-able rival amp */}
            {hasConfirmed && !actionTokenUsed && (() => {
              const actingHex = acting ? HEX_BY_NUM[acting.num] : null;
              if (!actingHex) return null;
              const adjacentRivalAmps = amps.filter(amp => {
                if (amp.ownerId === acting?.id) return false;
                if (amp.unplugged) return false;
                const ampHex = HEX_BY_NUM[amp.hexNum];
                if (!ampHex) return false;
                const neighbors = getFlatTopNeighborSlots(actingHex);
                return neighbors.some(n => n.num === amp.hexNum) || acting?.num === amp.hexNum;
              });
              if (adjacentRivalAmps.length === 0) return null;
              return adjacentRivalAmps.map(amp => {
                const owner = spirits.find(s => s.id === amp.ownerId);
                return (
                  <button key={amp.id} className="btn"
                    style={{borderColor:'#ff8800',color:'#ff8800'}}
                    onClick={() => { if (!canAct) return; unplugRivalAmp(amp.id); dispatch(beatsSpent(0, true)); }}>
                    🔌 Unplug {owner?.name?.split(' ')[0] ?? 'rival'}'s Amp
                  </button>
                );
              });
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
                      fontFamily: "'Orbitron', sans-serif",
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
              <div className="stitle" style={{marginBottom:0,color:"#aa88ff",flexShrink:0,fontSize:7}}>TRACK</div>
              {Array.from({length:8}).map((_,i)=>{
                const note = melodyLine[i];
                const isRoot   = i === 0 && note;
                const isTritone      = note && note === tritoneNote;
                const isMajorThird   = note && note === majorThirdNote;
                const isMinorSeventh = note && note === minorSeventhNote;
                const isFourth       = note && note === fourthNote;
                const isFifth        = note && note === fifthNote;
                const inScale        = note && currentScale.includes(note);
                const borderC = !note          ? "#2a1a5060"
                  : isRoot         ? "#44ff88"
                  : isTritone      ? "#ff3300"
                  : isMinorSeventh ? "#4499ff"
                  : isMajorThird   ? "#44ffaa"
                  : isFifth        ? "#ff55aa"
                  : isFourth       ? "#cc55ff"
                  : inScale        ? "#c0c8d8"
                  : "#444455";
                const textC = !note            ? "#2a1a5040"
                  : isRoot         ? "#44ff88"
                  : isTritone      ? "#ff3300"
                  : isMinorSeventh ? "#4499ff"
                  : isMajorThird   ? "#44ffaa"
                  : isFifth        ? "#ff55aa"
                  : isFourth       ? "#cc55ff"
                  : inScale        ? "#e8eef8"
                  : "#555566";
                const bgC = !note              ? "transparent"
                  : isRoot         ? "#0d2510"
                  : isTritone      ? "#2a0800"
                  : isMinorSeventh ? "#051525"
                  : isMajorThird   ? "#0a2a1a"
                  : isFifth        ? "#2a0f1a"
                  : isFourth       ? "#1a0a2a"
                  : inScale        ? "#1a2035"
                  : "#111118";
                const glow = isTritone      ? "drop-shadow(0 0 7px #ff330077)"
                           : isMinorSeventh ? "drop-shadow(0 0 6px #4499ff77)"
                           : isMajorThird   ? "drop-shadow(0 0 5px #44ffaa55)"
                           : isFifth        ? "drop-shadow(0 0 6px #ff55aa55)"
                           : isFourth       ? "drop-shadow(0 0 6px #cc55ff55)"
                           : "none";
                return (
                  <div key={i} className="hexw"
                    onMouseEnter={note ? (e) => { const x = e.clientX, y = e.clientY; clearTimeout(noteTipTimerRef.current); noteTipTimerRef.current = setTimeout(() => setNoteScaleTip({ note, x, y }), 900); } : undefined}
                    onMouseLeave={() => { clearTimeout(noteTipTimerRef.current); setNoteScaleTip(null); }}
                    style={{
                    width:33,height:37,
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
            {/* 🎸 CHORD STACK — vertical bar on the left side of the board (Drive/Sustain) */}
            {acting && !hasConfirmed && !pivotPending && (() => {
              const chord = actingNoteState?.chordStack ?? [];
              const ch = spiritChord(acting?.id, chord);
              const revoiced = !!actingNoteState?.revoiceUsedThisTurn;
              const isChordStep = turnStep === 'chord';
              return (
                <div ref={chordStackRef} data-tip-anchor="chord-stack"
                  className={isChordStep ? 'step-active' : ''}
                  style={{'--step-glow-color':'#ff66cc',
                    position:"absolute",left:4,top:50,zIndex:10,
                    display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                    background:"#060a10dd",
                    border:`1px solid ${isChordStep ? '#ff66cc66' : chordMode ? '#ff66cc44' : '#1a2a4044'}`,
                    borderRadius:6,padding:"6px 5px",
                    backdropFilter:"blur(4px)",
                    boxShadow:"0 2px 12px #00000088",
                    minWidth:44}}>
                  {/* Label */}
                  <div className="stitle" style={{marginBottom:0,color:"#ff66cc",fontSize:6,letterSpacing:1.5}}>CHORD</div>
                  {/* Slots — 5 hex chips, vertical */}
                  {Array.from({length:5}).map((_,i) => {
                    const note = chord[i];
                    return (
                      <div key={i}
                        onClick={note && !revoiced ? () => removeChordNote(i) : undefined}
                        title={note ? (revoiced ? 'locked' : 'tap to drop (revoice)') : ''}
                        className="hexw"
                        style={{
                          width:33,height:37,
                          opacity: note ? 1 : 0.25,
                          background: note ? "#ff66cc" : "#2a1a3055",
                          cursor: note && !revoiced ? 'pointer' : 'default',
                          transition:"all .15s",
                        }}>
                        <div className="hexi" style={{
                          fontSize:10,fontWeight:700,
                          color: note ? "#ffe0f0" : "#2a1a3040",
                          background: note ? "#1a0c1a" : "#07091466",
                        }}>{note || ""}</div>
                      </div>
                    );
                  })}
                  {/* Drive / Sustain readout */}
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1,marginTop:1}}>
                    <span style={{fontSize:7,fontWeight:700,color:"#ff6644"}}>⚔️{ch.drive}</span>
                    <span style={{fontSize:7,fontWeight:700,color:"#4499ff"}}>🛡️{ch.sustain}</span>
                  </div>
                  {/* Chord name */}
                  <div style={{fontSize:6,fontWeight:700,color:"#ffcc44",textAlign:"center",maxWidth:48,lineHeight:1.2}}>{ch.name}</div>
                  {/* Revoice toggle */}
                  <button className="btn"
                    style={{fontSize:6,padding:"2px 5px",
                      borderColor:chordMode?'#ff66cc':'#aa55ff',color:chordMode?'#ff66cc':'#aa55ff',
                      background:chordMode?'#2a0c22':'transparent',whiteSpace:"nowrap"}}
                    onClick={()=>setChordMode(m=>!m)}>
                    {chordMode ? '✓ ON' : '🎸 Revoice'}{revoiced?' ✓':''}
                  </button>
                  {/* Status hint */}
                  <div style={{fontSize:5,color:"#6a8a9a",textAlign:"center",maxWidth:48,lineHeight:1.3}}>
                    {revoiced ? '✓ done' : chordMode ? '+add / −drop' : '1/turn'}
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
                      style={{fontFamily:"'Orbitron',sans-serif", cursor:"pointer",
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
                  <g key={`fans-${s.id}`} style={{pointerEvents:"none"}}>
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
                          {fanPawnShape(px, py, r, col, isDie, sww, op, i % 6, i % 2 === 1, fanGesture(i))}
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
                            {fanPawnShape(px, py, r, sc, true, 1.25, 1, i % 6, i % 2 === 1, 'wave')}
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

              {/* ── 🔧 ROAD CREW & 🎉 GROUPIES ── a Spirit's crew musters by the home corner, apart from the fan sea ── */}
              {spirits.map(s => {
                if (!s.corner) return null;
                const home = HEX_BY_NUM[CORNERS[s.corner]?.homeNum];
                const hub  = HEX_BY_NUM[LIMELIGHT_HEX];
                if (!home || !hub) return null;
                const ns = noteStates[s.id] ?? {};
                const unlocked   = ns.unlockedSkills ?? [];
                const roadies    = ns.roadies ?? [];
                const groupieIds = ['fans_4eva','pranksta','junkyard_dog','fandom_army'].filter(id => unlocked.includes(id));
                if (roadies.length === 0 && groupieIds.length === 0) return null;

                const sc = CORNER_LABELS[s.corner]?.color ?? s.color;   // owner colour for the groupie glow

                const hx = home.px * SCALE, hy = home.py * SCALE;
                const cxC = hub.px * SCALE, cyC = hub.py * SCALE;
                // Outward unit vector (board centre → home corner) and its perpendicular.
                let ox = hx - cxC, oy = hy - cyC;
                const L = Math.hypot(ox, oy) || 1; ox /= L; oy /= L;
                const pxv = -oy, pyv = ox;
                // Muster point: just outside the home pocket, NEARER in than the fan sea (3.5·HS).
                const CREW_OUT = HS * 1.75;
                const baseX = hx + ox * CREW_OUT, baseY = hy + oy * CREW_OUT;
                const u = HS * 0.34; // crew-token unit — a touch larger than a fan so named crew reads clearly
                const clampV = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

                // A short row centred & pushed onto one flank of the home corner.
                const layout = (n, side) => {
                  const out = [], gap = u * 1.7;
                  for (let i = 0; i < n; i++) {
                    const slot = i - (n - 1) / 2;
                    const along = side * (u * 2.4) + slot * gap;
                    const x = baseX + pxv * along + ox * (Math.abs(slot) * u * 0.25);
                    const y = baseY + pyv * along + oy * (Math.abs(slot) * u * 0.25);
                    out.push({ x: clampV(x, 8, SVG_W - 8), y: clampV(y, 8, SVG_H - 8) });
                  }
                  return out;
                };
                const roadiePos  = layout(roadies.length, -1);    // crew on one flank
                const groupiePos = layout(groupieIds.length, +1); // groupies on the other

                return (
                  <g key={`crew-${s.id}`} style={{pointerEvents:"none"}}>
                    {/* ROADIES — hard-hatted stagehands with a wrench */}
                    {roadiePos.map((p, i) => {
                      const r = roadies[i];
                      const resting = (r?.cooldownTurns ?? 0) > 0 || r?.onBoard;
                      const dur = 4.2 + (i % 3) * 0.4;
                      const delay = -(((i * 0.5) % dur)).toFixed(2);
                      return (
                        <g key={`rd-${i}`} transform={`translate(${p.x} ${p.y})`} opacity={resting ? 0.4 : 1}
                           style={{animation:`fan-bob ${dur}s ease-in-out infinite`, animationDelay:`${delay}s`}}>
                          <ellipse cx={0} cy={u*0.95} rx={u*0.95} ry={u*0.26} fill="#000" opacity={0.28}/>
                          {/* body / shoulders */}
                          <path d={`M ${-u*0.8} ${u*0.85} Q 0 ${-u*0.1} ${u*0.8} ${u*0.85} Z`} fill="#7f97b0" stroke="#0a1018" strokeWidth={0.6}/>
                          {/* head */}
                          <circle cx={0} cy={-u*0.32} r={u*0.42} fill="#b9c9da" stroke="#0a1018" strokeWidth={0.6}/>
                          {/* hard hat — dome + brim (amber = crew) */}
                          <path d={`M ${-u*0.5} ${-u*0.42} A ${u*0.52} ${u*0.52} 0 0 1 ${u*0.5} ${-u*0.42} Z`} fill="#ffb347" stroke="#7a4a00" strokeWidth={0.5}/>
                          <rect x={-u*0.64} y={-u*0.5} width={u*1.28} height={u*0.16} rx={u*0.08} fill="#ffb347" stroke="#7a4a00" strokeWidth={0.4}/>
                          {/* wrench */}
                          <line x1={u*0.5} y1={u*0.25} x2={u*0.98} y2={u*0.72} stroke="#cdd8e2" strokeWidth={u*0.16} strokeLinecap="round"/>
                          <circle cx={u*1.0} cy={u*0.74} r={u*0.16} fill="none" stroke="#cdd8e2" strokeWidth={u*0.12}/>
                        </g>
                      );
                    })}

                    {/* GROUPIES — the die-hard superfans, drawn from the neon silhouette
                        sheet so they read as defined characters, not plain pawns. */}
                    {groupiePos.map((p, i) => {
                      const id = groupieIds[i];
                      const resting = (ns.groupieCooldowns?.[id] ?? 0) > 0;
                      const dur = 3.0 + (i % 3) * 0.45;
                      const delay = -(((i * 0.6) % dur)).toFixed(2);
                      const boxS = u * 2.4;                       // bigger + detailed vs the pawn fans
                      const cellC = i % 3, cellR = Math.floor(i / 3) % 3; // pick a pose from the 3×3 sheet
                      const bx = p.x - boxS / 2, by = p.y - boxS * 0.72;
                      const clipId = `gpclip-${s.id}-${i}`;
                      return (
                        <g key={`gp-${i}`} opacity={resting ? 0.4 : 1}
                           style={{animation:`fan-bob ${dur}s ease-in-out infinite`, animationDelay:`${delay}s`}}>
                          <ellipse cx={p.x} cy={p.y + boxS*0.28} rx={boxS*0.3} ry={boxS*0.09} fill="#000" opacity={0.3}/>
                          {/* owner-colour glow so you can tell whose die-hards these are */}
                          <ellipse cx={p.x} cy={p.y - boxS*0.04} rx={boxS*0.38} ry={boxS*0.5} fill={sc} opacity={0.22}
                            style={{filter:`blur(${boxS*0.16}px)`}}/>
                          <defs><clipPath id={clipId}><rect x={bx} y={by} width={boxS} height={boxS}/></clipPath></defs>
                          <image href={groupieFansImg}
                            x={bx - cellC*boxS} y={by - cellR*boxS} width={boxS*3} height={boxS*3}
                            clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice"
                            style={{mixBlendMode:'screen'}}/>
                        </g>
                      );
                    })}

                    {/* compact count tags, echoing the fan crowd's 🎤 tag */}
                    {roadies.length > 0 && (() => {
                      const c = roadiePos[Math.floor(roadiePos.length/2)] ?? {x:baseX,y:baseY};
                      return <text x={c.x} y={c.y + u*1.85} textAnchor="middle" fontSize={u*0.82}
                                fontWeight="bold" fill="#cdd8e2" stroke="#000" strokeWidth={0.3}
                                style={{filter:"drop-shadow(0 0 2px #000)"}}>🔧 {roadies.length}</text>;
                    })()}
                    {groupieIds.length > 0 && (() => {
                      const c = groupiePos[Math.floor(groupiePos.length/2)] ?? {x:baseX,y:baseY};
                      return <text x={c.x} y={c.y + u*1.85} textAnchor="middle" fontSize={u*0.82}
                                fontWeight="bold" fill="#ff8ace" stroke="#000" strokeWidth={0.3}
                                style={{filter:"drop-shadow(0 0 2px #000)"}}>🎉 {groupieIds.length}</text>;
                    })()}
                  </g>
                );
              })}

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
                    {/* Turn-start hex pulse */}
                    {pulsingHex === hex.num && sp && (
                      <polygon
                        points={pointyCorners(cx, cy, HS * 1.18)}
                        fill="none"
                        stroke={sp.color}
                        strokeWidth={3}
                        style={{
                          pointerEvents: "none",
                          animation: "hex-turn-pulse 1.8s ease-out forwards",
                          filter: `drop-shadow(0 0 8px ${sp.color}) drop-shadow(0 0 16px ${sp.color})`,
                        }}
                      />
                    )}

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
                      // 💨 SMOKE MACHINE — Spirits in the cloud fade from view
                      // (visual only; never hides the acting Spirit).
                      const smokeHidden = isHiddenBySmoke(sp);
                      return (
                        <g key="spirit-token"
                          style={{
                            ...(isRumbling ? {animation:"rumble 0.08s linear infinite"} : {}),
                            opacity: smokeHidden ? 0.04 : 1,
                            transition: 'opacity 1.4s ease',
                          }}>
                          {/* Base plate shadow */}
                          <ellipse cx={cx+2} cy={cy+3} rx={baseR} ry={baseR*0.32}
                            fill="#000" opacity={0.35} style={{pointerEvents:"none"}}/>
                          {/* Base plate glow ring */}
                          <circle cx={cx} cy={cy} r={baseR}
                            fill={sc+"18"} stroke={sc}
                            strokeWidth={isActing ? 2.2 : 1.4}
                            style={{pointerEvents:"none"}}
                            filter={isActing ? `drop-shadow(0 0 4px ${sc})` : undefined}/>
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
                                    y={cardY - HS * 0.34}
                                    textAnchor="middle" fontSize={iconSize}
                                    style={{animation:"affliction-pulse 1.8s ease-in-out infinite",
                                      filter:`drop-shadow(0 0 3px ${a.color})`}}>
                                    {a.icon}
                                  </text>
                                ))}
                              </g>
                            );
                          })()}
                          {/* Standee sprite */}
                          <image
                            href={spriteSrc}
                            x={cardX + imgOffX}
                            y={cardY + imgOffset.y}
                            width={cardW}
                            height={cardH}
                            preserveAspectRatio="xMidYMid meet"
                            style={{pointerEvents:"none"}}
                          />
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
                                  style={{fontFamily:"'Orbitron',sans-serif", letterSpacing:1,
                                    filter:`drop-shadow(0 0 7px ${f.color})`}}>
                                  {f.icon} {f.label}
                                </text>
                              </g>
                            </g>
                          ))}
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
                            return (
                              <g style={{pointerEvents:"none"}}>
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

              {/* ── AMP TOKENS ── */}
              {amps.map(amp => {
                const hex = HEX_BY_NUM[amp.hexNum];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.7;
                const pts = pointyCorners(cx, cy, r);
                // Connection now means: part of a chain its OWNER is plugged into.
                const isUnplugged = !!amp.unplugged;
                const isConnected = !isUnplugged && ampRigs.poweredAmpIds.has(amp.id);
                const ownerColor  = amp.ownerColor;
                const isRoadieTarget =
                  (roadieAction?.phase === 'selectHex' && (
                    amp.hexNum === roadieAction?.adjHexNum ||
                    getFlatTopNeighborSlots(HEX_BY_NUM[roadieAction?.adjHexNum ?? -1] ?? {q:999,r:999})
                      .some(n => n.num === amp.hexNum)
                  )) ||
                  (roadieAction?.phase === 'selectHex' && !roadieAction?.adjHexNum);
                return (
                  <g key={amp.id} style={{pointerEvents:"none"}}>
                    {/* Hover range ring — shown when this amp's hex is hovered */}
                    {hovered === amp.hexNum && (
                      <>
                        <circle cx={cx} cy={cy} r={AMP_UNPLUG_DIST * HS * 1.95}
                          fill={ownerColor + "0d"} stroke={ownerColor} strokeWidth={1.5}
                          strokeDasharray="6 4" opacity={0.7}
                          style={{pointerEvents:"none"}}/>
                        <text x={cx} y={cy - AMP_UNPLUG_DIST * HS * 1.95 - 5}
                          textAnchor="middle" fontSize={HS * 0.28}
                          fill={ownerColor} opacity={0.85}
                          style={{fontFamily:"monospace", pointerEvents:"none"}}>
                          range ({AMP_UNPLUG_DIST})
                        </text>
                      </>
                    )}
                    {/* Range ring (subtle, always visible) */}
                    {isConnected && (
                      <circle cx={cx} cy={cy} r={AMP_RANGE * HS * 1.15}
                        fill="none" stroke={ownerColor} strokeWidth={0.6}
                        opacity={0.18} strokeDasharray="4 6"/>
                    )}
                    {/* Hex body */}
                    <polygon points={pts}
                      fill={isUnplugged ? "#110808" : isConnected ? ownerColor+"33" : "#0a1020"}
                      stroke={isUnplugged ? "#662222" : isConnected ? ownerColor : "#444466"}
                      strokeWidth={isConnected ? 2 : 1}
                      strokeDasharray={isUnplugged ? "4 3" : undefined}
                      style={isConnected ? {
                        filter:`drop-shadow(0 0 6px ${ownerColor}) drop-shadow(0 0 12px ${ownerColor}88)`,
                        animation:"outline-pulse-soft 2s ease-in-out infinite",
                      } : undefined}
                    />
                    {/* Speaker circle */}
                    <circle cx={cx} cy={cy - HS*0.06} r={r*0.38}
                      fill="none" stroke={isUnplugged ? "#442222" : isConnected ? ownerColor : "#556688"} strokeWidth={1}/>
                    <circle cx={cx} cy={cy - HS*0.06} r={r*0.18}
                      fill={isUnplugged ? "#221111" : isConnected ? ownerColor+"88" : "#223344"}
                      stroke={isUnplugged ? "#442222" : isConnected ? ownerColor : "#556688"} strokeWidth={0.5}/>
                    {/* Knob row */}
                    {[-1,0,1].map(k => (
                      <circle key={k} cx={cx + k * r*0.22} cy={cy + r*0.42} r={r*0.07}
                        fill={isUnplugged ? "#441111" : isConnected ? ownerColor : "#445566"}/>
                    ))}
                    {/* Label */}
                    <text x={cx} y={cy + r*0.75} textAnchor="middle" fontSize={r*0.28}
                      fill={isUnplugged ? "#662222" : isConnected ? ownerColor : "#556688"}
                      style={{fontFamily:"monospace"}}>{isUnplugged ? "DEAD" : "AMP"}</text>
                    {/* Unplugged icon */}
                    {isUnplugged && (
                      <text x={cx} y={cy - r*0.1} textAnchor="middle" fontSize={r*0.55}
                        style={{pointerEvents:"none"}}>🔌</text>
                    )}
                    {isRoadieTarget && (
                      <polygon points={pts} fill="none" stroke="#ffcc44" strokeWidth={2}
                        style={{animation:"hex-turn-pulse 1s ease-in-out infinite",pointerEvents:"none"}}/>
                    )}
                  </g>
                );
              })}

              {/* ── 🔌 AMP RIG CABLING (Option B) — the ACTIVE Spirit runs ONE instrument cord
                  into its rig; amps then daisy-chain to EACH OTHER, so the whole rig reads as a
                  single snaking run. Powered chain = bright + flowing; a cold/severed sub-chain
                  shows dim; wander out of reach and the instrument cord frays red. ── */}
              {acting && (() => {
                const spiritHex = HEX_BY_NUM[acting.num];
                if (!spiritHex) return null;
                const sc = acting.corner ? (CORNER_LABELS[acting.corner]?.color ?? acting.color) : acting.color;
                const sx = Math.round(spiritHex.px * SCALE);
                const sy = Math.round(spiritHex.py * SCALE);
                const chains = ampRigs.chainsByOwner[acting.id] ?? [];
                const rig = ampRigs.rigByOwner[acting.id];           // best powered chain (or undefined)

                // one drooping cord between two points (instrument cord OR amp-to-amp patch)
                const renderCord = (key, ax, ay, bx, by, o) => {
                  const ddx = bx - ax, ddy = by - ay, len = Math.hypot(ddx, ddy) || 1;
                  const nx = -ddy / len, sag = len * (o.sagMul ?? 0.22), wob = o.wob ?? HS * 0.3, w = o.w ?? 2.4;
                  const c1x = ax + ddx * 0.33 + nx * wob, c1y = ay + ddy * 0.30 + sag;
                  const c2x = ax + ddx * 0.66 - nx * wob, c2y = ay + ddy * 0.66 + sag * 0.85;
                  const d = `M ${ax} ${ay} C ${c1x} ${c1y} ${c2x} ${c2y} ${bx} ${by}`;
                  const midX = (c1x + c2x) / 2, midY = (c1y + c2y) / 2 + sag * 0.12;
                  return (
                    <g key={key}>
                      <path d={d} fill="none" stroke={o.col} strokeWidth={w * 2.5} strokeLinecap="round" opacity={o.glow} style={{filter:'blur(2.5px)'}}/>
                      <path d={d} fill="none" stroke={o.col} strokeWidth={w} strokeLinecap="round" strokeDasharray={o.dash ?? undefined}
                        style={o.failing ? {animation:'cable-fray 0.5s ease-in-out infinite'} : undefined}/>
                      {o.flow && <path d={d} fill="none" stroke="#ffffff" strokeWidth={Math.max(0.9, w * 0.45)} strokeLinecap="round"
                        strokeDasharray="2 10" opacity={0.8} style={{animation:'cable-flow 0.9s linear infinite'}}/>}
                      {o.glyph && <text x={midX} y={midY} textAnchor="middle" dominantBaseline="central" fontSize={HS * 0.4}
                        style={{filter:`drop-shadow(0 0 2px ${o.col})`}}>{o.glyph}</text>}
                    </g>
                  );
                };

                // PATCH CORDS — amps daisy-chained to each other inside every chain
                const patch = [];
                chains.forEach((ch, ci) => {
                  const col = ch.powered ? sc : '#5a6a7a';
                  ch.edges.forEach(([a, b], ei) => {
                    const ha = HEX_BY_NUM[a.hexNum], hb = HEX_BY_NUM[b.hexNum];
                    if (!ha || !hb) return;
                    patch.push(renderCord(`patch-${ci}-${ei}`, ha.px * SCALE, ha.py * SCALE, hb.px * SCALE, hb.py * SCALE, {
                      col, dash: ch.powered ? null : '4 5', flow: ch.powered, glow: ch.powered ? 0.4 : 0.18,
                      sagMul: 0.16, wob: ((ei % 2) ? 1 : -1) * HS * 0.25, w: 2.0,
                    }));
                  });
                });

                // INSTRUMENT CORD — the ONE cable from the Spirit into the rig
                const ownNear = amps
                  .filter(a => a.ownerId === acting.id)
                  .map(a => { const ah = HEX_BY_NUM[a.hexNum]; return ah ? { a, ah, dist: axialDist(spiritHex.q, spiritHex.r, ah.q, ah.r) } : null; })
                  .filter(o => o && o.dist <= AMP_RANGE + 1)
                  .sort((x, y) => x.dist - y.dist);
                let anchor = null, state = null;
                if (rig) {
                  const rigIds = new Set(rig.amps.map(a => a.id));
                  anchor = ownNear.find(o => rigIds.has(o.a.id)) ?? null;
                  if (anchor) state = anchor.dist <= AMP_RANGE - 1 ? 'healthy' : 'stretched';
                } else if (ownNear.length) {
                  anchor = ownNear[0];
                  state = anchor.a.unplugged ? 'snapped' : 'lost';
                }
                let instrument = null;
                if (anchor) {
                  const ah = anchor.ah, ax = ah.px * SCALE, ay = ah.py * SCALE;
                  const ddx = sx - ax, ddy = sy - ay, len = Math.hypot(ddx, ddy) || 1;
                  const px = ax + (ddx / len) * (HS * 0.5), py = ay + (ddy / len) * (HS * 0.5);
                  const st = {
                    healthy:   { col: sc,        dash: null,  flow: true,  glow: 0.5,  sagMul: 0.28, glyph: null,  failing: false },
                    stretched: { col: '#ffcc44', dash: null,  flow: true,  glow: 0.45, sagMul: 0.10, glyph: '⚠️', failing: false },
                    lost:      { col: '#ff5544', dash: '5 5', flow: false, glow: 0.4,  sagMul: 0.20, glyph: '⚡', failing: true },
                    snapped:   { col: '#ff3344', dash: '4 6', flow: false, glow: 0.35, sagMul: 0.20, glyph: '🔌', failing: true },
                  }[state];
                  instrument = (
                    <g>
                      {renderCord('instr', px, py, sx, sy + HS * 0.12, { ...st, wob: HS * 0.35, w: 2.6 })}
                      <circle cx={px} cy={py} r={HS * 0.12} fill={st.col} stroke="#000" strokeWidth={0.5}/>
                      <circle cx={sx} cy={sy + HS * 0.12} r={HS * 0.1} fill="none" stroke={st.col} strokeWidth={1.4}/>
                    </g>
                  );
                }
                return (
                  <g style={{pointerEvents:'none'}}>
                    {patch}
                    {instrument}

                    {/* 🎲 Die glyph — the active Spirit's current Sonic die, parked at their feet */}
                    {(() => {
                      const plugged = ampsInRange >= 1;
                      const bw = HS * 1.25, bh = HS * 0.6;
                      const bx = sx - bw / 2, by = sy + HS * 0.5;
                      const col = plugged ? sc : '#5a6a7a';
                      return (
                        <g>
                          <rect x={bx} y={by} width={bw} height={bh} rx={bh * 0.28}
                            fill="#070d18ee" stroke={col} strokeWidth={1.2}
                            style={plugged ? {filter:`drop-shadow(0 0 4px ${col}88)`} : undefined}/>
                          <text x={sx} y={by + bh * 0.56} textAnchor="middle" dominantBaseline="central"
                            fontSize={bh * 0.56} fontWeight="bold" fill={col}
                            fontFamily="'Orbitron',sans-serif">
                            {diceTier}
                          </text>
                          {plugged && (
                            <text x={bx + bw - HS * 0.04} y={by + HS * 0.03} textAnchor="end" dominantBaseline="hanging"
                              fontSize={bh * 0.4} fill="#44ff88" fontFamily="monospace">🔊×{ampsInRange}</text>
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
                      fontFamily="'Orbitron',sans-serif" fontWeight={700}>EVENT</text>
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
                        fontFamily="'Orbitron',sans-serif">{zone.cooldown}t</text>
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

              {/* ── ROADIE direction-target highlights ── */}
              {roadieAction?.phase === 'selectDir' && (() => {
                const adjHex = HEX_BY_NUM[roadieAction.adjHexNum];
                if (!adjHex) return null;
                return getFlatTopNeighborSlots(adjHex).map(nb => {
                  const cx = Math.round(nb.px * SCALE);
                  const cy = Math.round(nb.py * SCALE);
                  return (
                    <g key={nb.num} style={{cursor:"pointer"}} onClick={() => roadieMoveAmp(nb.num)}>
                      <polygon points={pointyCorners(cx, cy, HS * 0.85)}
                        fill="#ffcc4422" stroke="#ffcc44" strokeWidth={1.5}
                        style={{animation:"hex-turn-pulse 1s ease-in-out infinite"}}/>
                      <text x={cx} y={cy+4} textAnchor="middle" fontSize={HS*0.35}
                        fill="#ffcc44" style={{pointerEvents:"none"}}>→</text>
                    </g>
                  );
                });
              })()}
              {/* ── ROADIE: cooldown ghost tokens on amps ── */}
              {amps.map(amp => {
                // Find any spirit whose roadie is on cooldown and owns this amp
                const ghostRoadie = spirits.find(sp => {
                  const ns = noteStates[sp.id];
                  return (ns?.roadies ?? []).some(r => r.cooldownTurns > 0 && sp.id === amp.ownerId);
                });
                if (!ghostRoadie) return null;
                const ns = noteStates[ghostRoadie.id];
                const roadie = (ns?.roadies ?? []).find(r => r.cooldownTurns > 0);
                if (!roadie) return null;
                const hex = HEX_BY_NUM[amp.hexNum];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                return (
                  <g key={`ghost-${amp.id}`} style={{pointerEvents:'none'}}>
                    {/* Small wrench ghost sitting on amp */}
                    <circle cx={cx + HS * 0.55} cy={cy - HS * 0.55} r={HS * 0.28}
                      fill="#0a1020cc" stroke={ghostRoadie.color + '88'} strokeWidth={0.8}/>
                    <text x={cx + HS * 0.55} y={cy - HS * 0.55 + 4}
                      textAnchor="middle" fontSize={HS * 0.3}
                      fill={ghostRoadie.color + 'aa'} style={{pointerEvents:'none'}}>🔧</text>
                    <text x={cx + HS * 0.55} y={cy - HS * 0.22}
                      textAnchor="middle" fontSize={HS * 0.22}
                      fill={ghostRoadie.color + '99'} style={{pointerEvents:'none',fontFamily:'monospace'}}>
                      {roadie.cooldownTurns}t
                    </text>
                  </g>
                );
              })}

              {/* ── ROADIE: animated token sliding from spirit → amp → destination ── */}
              {roadieAnimations.map(anim => {
                const fromCx = Math.round(anim.fromHex.px * SCALE);
                const fromCy = Math.round(anim.fromHex.py * SCALE);
                const ampCx  = Math.round(anim.toAmpHex.px * SCALE);
                const ampCy  = Math.round(anim.toAmpHex.py * SCALE);
                const toCx   = Math.round(anim.toFinalHex.px * SCALE);
                const toCy   = Math.round(anim.toFinalHex.py * SCALE);
                // Midpoint: interpolate from→amp→final via animateMotion
                const pathD = `M ${fromCx} ${fromCy} L ${ampCx} ${ampCy} L ${toCx} ${toCy}`;
                return (
                  <g key={anim.id} style={{pointerEvents:'none'}}>
                    {/* Token */}
                    <g style={{animation:'roadie-run 2.8s ease-in-out forwards'}}>
                      <animateMotion dur="2.4s" fill="freeze" path={pathD}
                        keyTimes="0;0.45;1" calcMode="spline"
                        keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
                      <circle r={HS * 0.32} fill={anim.spiritColor + '33'}
                        stroke={anim.spiritColor} strokeWidth={1.2}/>
                      <text textAnchor="middle" dominantBaseline="central"
                        fontSize={HS * 0.35} style={{pointerEvents:'none'}}>{anim.icon ?? '🔧'}</text>
                    </g>
                    {/* "En route…" label that fades in near the destination */}
                    <text
                      x={ampCx} y={ampCy - HS * 1.4}
                      textAnchor="middle" fontSize={HS * 0.32}
                      fill={anim.spiritColor}
                      stroke="#000" strokeWidth={0.3}
                      style={{
                        pointerEvents:'none',
                        animation:'roadie-label-fade 2.8s ease-in-out forwards',
                        fontFamily:'monospace',
                      }}>
                      {anim.labelText ?? '🔧 Roadie en route…'}
                    </text>
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
                      filter:`drop-shadow(0 0 5px ${d.color})`, fontFamily:"'Orbitron',sans-serif"}}>
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
                const sp = spirits.find(s => s.num === hovered && !s.knockedOut);
                if (!sp) return null;
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
                      {fanPawnShape(x, y, r, col, excited, 1.2, 1, i % 6, i % 2 === 1, excited ? 'wave' : fanGesture(i))}
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
                                                            {fanPawnShape(0, 0, u * 1.3, winColor, true, 1.0, 1, 1, false, 'wave')}
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
                        fill={winColor} fontFamily="'Orbitron',sans-serif"
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
