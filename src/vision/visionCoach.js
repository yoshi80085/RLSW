// =============================================================================
// vision/visionCoach.js — 🧭 WHAT IS WRONG, AND WHAT TO DO ABOUT IT
// -----------------------------------------------------------------------------
// Every way the camera bench can fail, turned into one sentence telling the
// person what to physically do next.
//
// ⚠️ WHY THIS IS A MODULE AND NOT A FEW `if`s IN THE PAGE. The failures here are
// almost all SILENT: an uncalibrated board, a nut just out of frame, a hand the
// model cannot see, a calibration that came loose when you shifted in your chair.
// None of them throw, none of them look like errors, and every one of them
// produces confident numbers that are wrong. A page that shows the numbers
// without saying "your nut is out of shot" is not a diagnostic tool, it is a
// generator of bad data — and the whole reason this bench exists is to decide a
// question, which means the data has to be trustworthy or it is worse than none.
//
// PURE MODULE — no DOM, no camera, no timers. Takes a snapshot of the page state,
// returns a ranked list. Which means every rule is testable, and the rules are
// the part most likely to be wrong.
//
// ── THE ONE RULE OF THE COPY ──
// Every `fix` is an ACTION. Not "foreshortening is 0.19" but "move the camera
// round so it faces the side of the neck". The person reading it is holding a
// guitar and cannot do anything with a number.
// =============================================================================

import { checkCalibration } from './neckGeometry.js';

export const COACH_LIMITS = {
  // How long the camera can see no hand at all before that becomes the headline
  // problem rather than just a gap. Long enough to survive putting your pick down.
  noHandMs: 2500,
  // Sustained off-board rate that means the calibration no longer matches reality.
  driftRate: 0.5,
  // Vision cost per frame that starts stealing from the audio thread.
  slowMs: 40,
  // Below this many logs the scoreboard cannot mean anything yet.
  minLogs: 8,
};

/**
 * @param {object} s  snapshot of the page:
 *   cameraOn, micOn        booleans
 *   cdnError               string|null — mediapipe/getUserMedia failure text
 *   calibrating            boolean — mid four-click sequence
 *   clicksSoFar            0–3
 *   corners                the four clicked points, once complete
 *   calOk                  boolean — the homography solved
 *   handsSeen              how many hands the model found this frame
 *   read                   readHand() result for the fretting hand, or null
 *   noHandMs               ms since a hand was last successfully read
 *   offBoardRate           0..1 decaying rate of "hand visible, not on the board"
 *   visionMs               cost of the last detection
 *   micState               'music' | 'ignoring — <reason>' | 'silence' | 'mic off'
 *   logCount               entries on the scoreboard
 * @returns {{id, severity, problem, fix}[]}  worst first; [] means all is well
 */
export function diagnose(s = {}, opts = {}) {
  const o = { ...COACH_LIMITS, ...opts };
  const out = [];
  const add = (id, severity, problem, fix) => out.push({ id, severity, problem, fix });

  // ── Blockers, in the order they have to be solved ──
  // Deliberately sequential rather than "report everything": someone with no
  // camera running does not need to hear about their mic, and a list of six
  // problems is read as "this is broken" rather than as "do this next".
  if (s.cdnError) {
    add('cdn', 'blocker', s.cdnError,
      'the hand tracker is downloaded from a CDN the first time you start the camera, so this half of the bench needs a working internet connection. Everything on the audio side still works offline');
    return out;
  }

  if (s.camError) {
    add('camerror', 'blocker', s.camError,
      /denied|refus|NotAllowed/i.test(s.camError)
        ? 'the browser is blocking the camera for this page. Click the camera icon in the address bar and allow it, then press START CAMERA again'
        : 'check the camera is plugged in and not already in use by another app — video calls hold onto it exclusively');
    return out;
  }

  if (!s.cameraOn) {
    add('nocamera', 'blocker', 'the camera is off',
      'before you press START CAMERA, prop it so it can see the length of the neck. A laptop lid pointing at your face is the one angle that cannot work — it sees the neck end-on and half out of frame');
    return out;
  }

  if (s.calibrating) {
    add('calibrating', 'tip',
      `marking out the neck — corner ${(s.clicksSoFar || 0) + 1} of 4`,
      'click the four corners of the fretboard ON THE VIDEO with your mouse. Put the guitar down for this; there is nothing to play. If the nut or the 12th fret is not in the picture, stop and move the camera first — corners clicked where the neck leaves the frame produce a neck that looks right and reads wrong');
    return out;
  }

  if (!s.corners) {
    add('uncalibrated', 'blocker', 'the neck has not been calibrated, so nothing can be placed on it',
      s.handsSeen
        ? 'press CALIBRATE NECK and click the four corners it asks for'
        : 'get your fretting hand and the whole neck into the picture, then press CALIBRATE NECK');
    return out;
  }

  if (!s.calOk) {
    add('degenerate', 'blocker', 'those four points do not describe a surface',
      'they are probably in a line, or two of them are on top of each other. Recalibrate, clicking the four OUTER corners of the fretboard');
    return out;
  }

  // ── The calibration is usable; is it any good? ──
  for (const issue of checkCalibration(s.corners)) out.push(issue);

  // ── Live problems ──
  // ⚠️ DRIFT COMES BEFORE "NO HAND", because it is the one failure that lies.
  // A lost hand shows as blank and everybody understands blank; a drifted
  // calibration shows as a confident number that is quietly several frets out,
  // and it is invisible unless something says so.
  if (s.offBoardRate > o.driftRate && s.handsSeen) {
    add('drift', 'blocker',
      'your hand is in shot but keeps landing off the board — the calibration no longer matches where the neck is',
      'you have probably shifted in your chair, or the guitar has. Press CALIBRATE NECK again. Anything logged since this started is suspect');
  }

  if (!s.handsSeen && (s.noHandMs ?? 0) > o.noHandMs) {
    add('nohands', 'warn', 'the tracker cannot find a hand at all',
      'bring your fretting hand fully into the picture. Hands half out of frame, in deep shadow, or badly backlit by a window behind you are the usual causes');
  } else if (s.handsSeen && !s.read && (s.noHandMs ?? 0) > o.noHandMs) {
    add('offboard', 'warn', 'a hand is visible but not on the calibrated neck',
      'if that is your strumming hand, this is correct and you can ignore it. If it is the hand doing the fretting, recalibrate');
  } else if (s.read && s.read.tips < 3) {
    add('fewtips', 'tip', `only ${s.read.tips} of 4 fingertips can be placed`,
      'the fretting hand hides its own fingers from most angles. Raising the camera a little, or moving it toward the front of the guitar, usually recovers one or two');
  }

  if (s.read && s.read.spread > 6) {
    add('spread', 'warn', `the fingers are reading ${s.read.spread.toFixed(0)} frets apart, which is not a shape a hand makes`,
      'one fingertip is being mislocated, or the calibration is stretched. Check the drawn fret wires still sit on your real frets');
  }

  if (s.visionMs > o.slowMs) {
    add('slow', 'warn', `hand tracking is taking ${s.visionMs.toFixed(0)} ms a frame`,
      'drop the vision Hz slider. A hand does not move meaningfully in 80 ms, and the audio side needs the CPU more than this does');
  }

  // ── The audio half, which the comparison cannot happen without ──
  if (!s.micOn) {
    add('nomic', 'warn', 'the mic is off, so there is nothing to compare the camera against',
      'press START MIC. The bench measures the camera AGAINST the audio-only guess; on its own the camera reading proves nothing');
  } else if (s.micState && s.micState.startsWith('ignoring')) {
    add('gated', 'tip', `the mic is hearing something and rejecting it (${s.micState.replace('ignoring — ', '')})`,
      'this is correct between notes — it is the gate refusing to treat room noise as music. If it persists while you are actually playing, tune it on listen-test.html');
  }

  return out;
}

/**
 * The single line the page should lead with — what to do RIGHT NOW.
 *
 * ⚠️ ONE INSTRUCTION AT A TIME, and a positive state when there is nothing wrong.
 * Six simultaneous complaints read as "this is broken and I cannot fix it"; the
 * worst one plus a count reads as a queue you can work through. And a coach that
 * only ever speaks up to complain leaves you unsure whether silence means fine or
 * means dead — so when the list is empty it says what to do next instead.
 */
export function nextAction(issues, s = {}, opts = {}) {
  const o = { ...COACH_LIMITS, ...opts };
  if (issues.length) {
    return { ...issues[0], others: issues.length - 1 };
  }
  if ((s.logCount ?? 0) < o.minLogs) {
    return {
      id: 'ready', severity: 'ok',
      problem: 'everything is working',
      fix: `play something in one position, then click the fret you are in on the strip. ${o.minLogs - (s.logCount ?? 0)} more log${o.minLogs - (s.logCount ?? 0) === 1 ? '' : 's'} before the verdict means anything`,
      others: 0,
    };
  }
  return {
    id: 'scoring', severity: 'ok',
    problem: 'everything is working',
    fix: 'keep logging, and move around the neck — a verdict built only on the 5th fret says nothing about the 10th',
    others: 0,
  };
}
