// =============================================================================
// vision/cameraHand.js — 📷 THE CAMERA AS A HAND-POSITION SENSOR
// -----------------------------------------------------------------------------
// The runtime half of camera fusion: owns the webcam and the hand-landmark model,
// and answers one question — WHERE IS THE FRETTING HAND — as a [string, fret]
// reference that drops straight into `neckPlacement`'s `setRef`.
//
// Everything decidable without a camera lives in `neckGeometry.js` and is tested
// there. This file is the thin, untestable rind: getUserMedia, a WASM model, and
// a frame loop. It is kept deliberately small for exactly that reason.
//
// ── WHY THIS EXISTS AT ALL — the measurement, not the hunch ──
// Scored against hand-logged ground truth in a real room (EAR_SPY_HANDOFF §6):
//
//     median absolute error   camera 0.44 frets   ·   audio heuristic 2.53
//     within one fret         camera 88%          ·   audio heuristic 25%
//
// And the shape of the failure matters more than the gap. Across ten frets of
// real hand movement the audio-only estimate never left a three-fret band around
// its rest position: it was not estimating badly, it was not estimating. That is
// simply what a pitch can tell you about a position, and it is why `placePitch`
// has always described its own output as a guess.
//
// ── THE THREE THINGS THAT BITE, ALL OF THEM PREDICTED ──
//  1. A LAPTOP CAMERA POINTS AT YOUR FACE. It sees the neck end-on and half out
//     of frame, and no amount of code fixes a neck that is not in the picture.
//     Ergonomic, not algorithmic. The calibrator says so out loud.
//  2. CPU. An 8192-point FFT already runs every animation frame for the audio
//     chain, which needs the cycles more than this does. Vision runs at `hz`,
//     default 12 — a hand does not move meaningfully in 80 ms.
//  3. CALIBRATION DRIFT, and it is the dangerous one because it is SILENT. Shift
//     in your chair and every number stays plausible and becomes wrong. See
//     `offBoardRate`.
// =============================================================================

import {
  makeNeckCalibration, pickFrettingHand, makeVisionTracker, VISION_DEFAULTS,
} from './neckGeometry.js';

// ⚠️ LOADED FROM A CDN, AND DELIBERATELY NOT AN npm DEPENDENCY. Bundling the
// tasks-vision JS would put ~2 MB into the main bundle for every player, almost
// none of whom will turn the camera on — and it would only be half a fix, because
// the WASM runtime and the 8 MB hand model are fetched from Google's servers
// either way. So the whole thing stays off the critical path: the game builds,
// deploys and runs with no trace of it until someone ticks the box. The cost is
// that camera mode needs a working connection the first time, which it announces.
const MP_VERSION = '0.10.14';
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export const CAMERA_DEFAULTS = {
  hz: 12,
  width: 1280,
  height: 720,
  driftHalfLifeMs: 4000,
  // Below this the reference is withheld rather than offered weakly — a wrong
  // hand position is worse than none, because `placePitch` will believe it.
  minTips: VISION_DEFAULTS.minTips,
};

export function cameraAvailable() {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && typeof navigator.mediaDevices.getUserMedia === 'function';
}

/**
 * Start watching for a fretting hand.
 *
 * ⚠️ MEDIAPIPE IS IMPORTED DYNAMICALLY, NOT AT MODULE LOAD. Ear Spy has to open,
 * explain itself and run its whole audio half on a machine that is offline or has
 * no webcam; a static import would make the camera a hard dependency of the room.
 *
 * @param {HTMLVideoElement} video  where the preview goes
 * @returns {Promise<object>} the sensor handle
 */
export async function startCameraHand(video, opts = {}) {
  const o = { ...CAMERA_DEFAULTS, ...opts };
  if (!cameraAvailable()) throw new Error('this browser cannot open a camera');

  let landmarker;
  try {
    const mp = await import(/* @vite-ignore */ MP_BUNDLE);
    const files = await mp.FilesetResolver.forVisionTasks(MP_WASM);
    landmarker = await mp.HandLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MP_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 2,
    });
  } catch (e) {
    // Separated from the camera failure below because the fixes have nothing to
    // do with each other, and a merged "could not start" sends people to check a
    // webcam when the actual problem is the network.
    throw new Error(`the hand tracker could not be downloaded (${e.message})`, { cause: e });
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: o.width }, height: { ideal: o.height } },
  });
  video.srcObject = stream;
  await video.play();

  let cal = null;
  let hands = [];
  let read = null;
  let offBoardRate = 0;
  let lastT = 0;
  let lastCostMs = 0;
  let running = true;
  const vision = makeVisionTracker();

  function loop(t) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (t - lastT < 1000 / o.hz) return;
    const dt = lastT ? t - lastT : 1000 / o.hz;
    lastT = t;

    const t0 = performance.now();
    let result = null;
    try { result = landmarker.detectForVideo(video, t); } catch { /* frame not ready */ }
    lastCostMs = performance.now() - t0;

    hands = result ? result.landmarks || [] : [];
    const pick = cal ? pickFrettingHand(hands, cal, o) : null;
    read = pick ? pick.read : null;
    vision.push(read, dt);

    // ⚠️ THE DRIFT ALARM. There is no numeric test for a bad calibration — four
    // points fit a homography exactly, so the residual is identically zero for a
    // perfect calibration and for four random clicks. Drift can only be inferred
    // behaviourally: a hand the model CAN see whose fingertips keep landing off
    // the board means the board is no longer where we think it is.
    if (cal && hands.length) {
      const decay = Math.pow(0.5, dt / o.driftHalfLifeMs);
      offBoardRate = offBoardRate * decay + (read ? 0 : 1) * (1 - decay);
    }
  }
  requestAnimationFrame(loop);

  return {
    /** @param {[number,number][]|null} corners  four clicked points, normalised */
    setCalibration(corners) {
      cal = corners ? makeNeckCalibration(corners) : null;
      offBoardRate = 0;
      vision.reset();
      return !!cal;
    },
    calibration() { return cal; },
    /**
     * The hand position, as `neckPlacement.setRef` wants it, or null.
     *
     * ⚠️ THE STRING IS NOT REPORTED FROM THE CAMERA. A fingertip stands ~18 mm
     * above the board and the calibration maps the board, so that height
     * reprojects as roughly FIVE STRINGS of error and under half a fret — measured
     * in `neckGeometrySelftest`. The fret survives; the string does not. So the
     * string half of the reference is left to the audio tracker, which is no worse
     * at it, and only the fret — the number `placePitch` actually needs — comes
     * from the camera.
     */
    ref(fallbackString = VISION_DEFAULTS.restString ?? 2) {
      const v = vision.value();
      if (!v || v.stale) return null;
      return [fallbackString, v.fret];
    },
    /** Everything the UI needs to say what is going on. */
    state() {
      const v = vision.value();
      return {
        calibrated: !!cal,
        handsSeen: hands.length,
        tips: read ? read.tips : 0,
        spread: read ? read.spread : null,
        fret: v ? v.fret : null,
        stale: v ? v.stale : true,
        blindMs: vision.age(),
        offBoardRate,
        costMs: lastCostMs,
      };
    },
    /** Raw landmarks, for drawing the overlay. */
    hands() { return hands; },
    stop() {
      running = false;
      stream.getTracks().forEach(tr => tr.stop());
      try { landmarker.close(); } catch { /* already gone */ }
    },
  };
}
