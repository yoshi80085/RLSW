// =============================================================================
// ui/CameraCalibrator.jsx — 📷 SHOW THE CAMERA WHERE THE NECK IS
// -----------------------------------------------------------------------------
// The camera half of Ear Spy, as a self-contained panel: preview, four-click
// calibration, the overlay that proves the calibration is right, and the coach
// line that says what to do when it isn't.
//
// Mounted only when the player asks for it. All the judgement lives in
// `vision/visionCoach.js` and all the geometry in `vision/neckGeometry.js`; this
// file is DOM and nothing else, which is why it has no tests and why it is kept
// this thin.
//
// ⚠️ EVERY FAILURE HERE IS SILENT. An uncalibrated board, a nut just out of shot,
// a hand the model cannot see, a calibration that came loose when the player
// shifted in their chair — none of them throw, none look like errors, and every
// one produces confident numbers that are wrong. That is why a panel this small
// spends most of its space on saying what is going on.
// =============================================================================

import { useEffect, useRef, useState, useCallback } from "react";
import { startCameraHand, cameraAvailable } from "../vision/cameraHand.js";
import { onNeck, CORNER_PROMPTS, MAX_FRET } from "../vision/neckGeometry.js";
import { diagnose, nextAction } from "../vision/visionCoach.js";

const ACCENT = '#19e6ff';
const GREEN = '#44ff88';
const AMBER = '#f6ad55';
const MAGENTA = '#ff2d95';
const VIOLET = '#8a5cff';
const DOTS = new Set([3, 5, 7, 9, 12]);

/**
 * @param {(ref: [number,number]|null) => void} onRef  called every frame with the
 *   hand position, or null when the camera has nothing to say. Wire straight into
 *   `neckTracker.setRef`.
 */
export default function CameraCalibrator({ onRef, onRecalibrate, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const sensorRef = useRef(null);
  const clicksRef = useRef(null);
  const onRefRef = useRef(onRef);
  const onRecalRef = useRef(onRecalibrate);
  // ⚠️ Refs are written in an effect, never during render — React may render a
  // component twice and discard one of them, and a ref mutated on the discarded
  // pass survives into the kept one.
  useEffect(() => { onRefRef.current = onRef; }, [onRef]);
  useEffect(() => { onRecalRef.current = onRecalibrate; }, [onRecalibrate]);

  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [clicks, setClicks] = useState(null);      // mirrors the ref, for render
  const [calibrated, setCalibrated] = useState(false);
  const [coach, setCoach] = useState(null);

  // ── Start the sensor ──
  useEffect(() => {
    let cancelled = false;
    let sensor = null;
    (async () => {
      if (!cameraAvailable()) { setError('this browser cannot open a camera'); return; }
      try {
        sensor = await startCameraHand(videoRef.current);
        if (cancelled) { sensor.stop(); return; }
        sensorRef.current = sensor;
        setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(/denied|NotAllowed/i.test(e.message || e.name)
            ? 'the browser blocked the camera — allow it from the icon in the address bar'
            : e.message);
        }
      }
    })();
    return () => {
      cancelled = true;
      // ⚠️ THE REFERENCE IS WITHDRAWN ON THE WAY OUT. Unmounting without this
      // leaves the neck tracker pinned to wherever the hand was when the panel
      // closed — a stuck position that looks exactly like a working one.
      onRefRef.current?.(null);
      (sensorRef.current || sensor)?.stop();
      sensorRef.current = null;
    };
  }, []);

  // ── The frame loop: draw, diagnose, hand the reference upstream ──
  useEffect(() => {
    if (!ready) return undefined;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const sensor = sensorRef.current;
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!sensor || !canvas || !video) return;

      if (canvas.width !== video.videoWidth && video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const st = sensor.state();
      onRefRef.current?.(sensor.ref());
      draw(canvas, sensor, clicksRef.current);

      const state = {
        cameraOn: true,
        micOn: true,                 // the room owns the mic; not this panel's business
        calibrating: !!clicksRef.current,
        clicksSoFar: clicksRef.current ? clicksRef.current.length : 0,
        corners: sensor.calibration() ? sensor.calibration().corners : null,
        calOk: st.calibrated,
        handsSeen: st.handsSeen,
        read: st.tips ? { tips: st.tips, spread: st.spread ?? 0 } : null,
        noHandMs: st.blindMs,
        offBoardRate: st.offBoardRate,
        visionMs: st.costMs,
        micState: 'music',
        logCount: 99,                // the scoreboard lives in the bench, not here
      };
      setCoach(nextAction(diagnose(state), state));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  const beginCalibration = useCallback(() => {
    clicksRef.current = [];
    setClicks([]);
    sensorRef.current?.setCalibration(null);
    setCalibrated(false);
    onRefRef.current?.(null);
    // ⚠️ ANYTHING LEARNED DESCRIBED THE OLD CAMERA POSITION. Carrying it across a
    // recalibration turns the correction into a second silent-drift bug on top of
    // the one it exists to fix.
    onRecalRef.current?.();
  }, []);

  const onCanvasClick = useCallback(e => {
    if (!clicksRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    // Normalised 0..1 — the same space MediaPipe reports landmarks in, so the
    // calibration and the hand never need converting between coordinate systems.
    clicksRef.current.push([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
    if (clicksRef.current.length === 4) {
      const ok = sensorRef.current?.setCalibration(clicksRef.current);
      setCalibrated(!!ok);
      if (!ok) setError('those four points are degenerate — try again');
      clicksRef.current = null;
      setClicks(null);
    } else setClicks([...clicksRef.current]);
  }, []);

  const sev = coach ? coach.severity : 'tip';
  return (
    <div style={S.panel}>
      <div style={S.head}>
        <span style={S.title}>📷 CAMERA — where your hand actually is</span>
        <button onClick={onClose} style={S.close}>✕ CLOSE</button>
      </div>

      <div style={S.stage}>
        <video ref={videoRef} playsInline muted style={S.video} />
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          style={{ ...S.canvas, cursor: clicks ? 'crosshair' : 'default' }}
        />
        {clicks && (
          <div style={S.prompt}>
            <b>CLICK THE PICTURE</b> ({clicks.length + 1} of 4) — {CORNER_PROMPTS[clicks.length]}
            <span style={{ opacity: .7 }}> · nothing to play, this is a mouse click</span>
          </div>
        )}
      </div>

      {error && <div style={S.err}>{error}</div>}

      {coach && (
        <div style={{ ...S.coach, borderColor: SEV_COLOR[sev] }}>
          <div style={{ ...S.coachBadge, color: SEV_COLOR[sev] }}>
            {sev === 'ok' ? 'ready' : sev === 'blocker' ? 'fix this first' : sev}
          </div>
          <div style={S.coachProblem}>{coach.problem}</div>
          <div style={S.coachFix}>→ {coach.fix}</div>
        </div>
      )}

      <div style={S.row}>
        <button onClick={beginCalibration} style={S.btn} disabled={!ready}>
          {calibrated ? 'RECALIBRATE' : 'CALIBRATE NECK'}
        </button>
        <span style={S.hint}>
          the cyan wires must sit on your real frets — four clicks always produce a
          calibration, and that overlay is the only thing that can tell you it is wrong
        </span>
      </div>
    </div>
  );
}

const SEV_COLOR = { blocker: MAGENTA, warn: AMBER, tip: VIOLET, ok: GREEN };

/** Everything visible on the overlay. Pure drawing; no decisions. */
function draw(canvas, sensor, clicks) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  if (!W || !H) return;
  ctx.clearRect(0, 0, W, H);
  const px = p => [p[0] * W, p[1] * H];
  const cal = sensor.calibration();

  if (clicks) {
    ctx.fillStyle = AMBER;
    ctx.font = '16px monospace';
    clicks.forEach((c, i) => {
      const [x, y] = px(c);
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillText(String(i + 1), x + 10, y - 8);
    });
  }

  // ⚠️ THE PREDICTED FRET WIRES ARE THE CALIBRATION CHECK, and the only one that
  // exists — four points fit a homography exactly, so the residual is always zero
  // and cannot tell you the clicks were bad. If these land on the real frets the
  // geometry is right; if they fan across the body it is not.
  if (cal) {
    for (let f = 0; f <= MAX_FRET; f++) {
      const w = cal.fretWire(f);
      if (!w) continue;
      ctx.strokeStyle = f === 0 ? '#fff' : DOTS.has(f) ? ACCENT : 'rgba(25,230,255,.32)';
      ctx.lineWidth = f === 0 ? 3 : DOTS.has(f) ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(...px(w[0]));
      ctx.lineTo(...px(w[1]));
      ctx.stroke();
    }
  }

  // Fingertips: filled where the geometry believed them, hollow where it did not,
  // amber before there is any calibration to be on or off. Three states, because
  // a "rejected" ring before calibration reports a failure that has not happened.
  for (const lms of sensor.hands()) {
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    for (const lm of lms) {
      ctx.beginPath(); ctx.arc(lm.x * W, lm.y * H, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const i of [8, 12, 16, 20]) {
      const lm = lms[i];
      if (!lm) continue;
      ctx.beginPath();
      ctx.arc(lm.x * W, lm.y * H, 7, 0, Math.PI * 2);
      if (!cal) { ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.stroke(); }
      else if (onNeck(cal.toNeck([lm.x, lm.y]))) { ctx.fillStyle = GREEN; ctx.fill(); }
      else { ctx.strokeStyle = MAGENTA; ctx.lineWidth = 2; ctx.stroke(); }
    }
  }

  // Where the camera thinks the hand is, drawn back onto the neck.
  const st = sensor.state();
  if (cal && st.fret != null) {
    const w = cal.fretWire(Math.max(0, Math.min(MAX_FRET, st.fret)));
    if (w) {
      ctx.strokeStyle = st.stale ? 'rgba(246,173,85,.6)' : GREEN;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(...px(w[0]));
      ctx.lineTo(...px(w[1]));
      ctx.stroke();
    }
  }
}

const S = {
  panel: {
    background: '#0b0f14', border: '1px solid #1e2c38', borderRadius: 10,
    padding: 12, marginBottom: 14,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: ACCENT, letterSpacing: 2, fontSize: 12, fontWeight: 600 },
  close: {
    background: 'transparent', border: '1px solid #2a3a4a', color: '#6a8aa4',
    borderRadius: 6, padding: '5px 10px', cursor: 'pointer', font: 'inherit', fontSize: 11,
  },
  stage: { position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#000' },
  video: { display: 'block', width: '100%' },
  canvas: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  prompt: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    background: 'rgba(7,10,14,.9)', borderTop: `1px solid ${AMBER}`,
    color: AMBER, padding: '7px 11px', fontSize: 12, letterSpacing: .5,
  },
  err: { color: MAGENTA, fontSize: 12, marginTop: 8 },
  coach: {
    marginTop: 10, borderLeft: '4px solid', borderRadius: 6,
    background: '#111820', padding: '9px 12px',
  },
  coachBadge: { fontSize: 10, letterSpacing: 2, fontWeight: 700, textTransform: 'uppercase' },
  coachProblem: { fontSize: 13, margin: '2px 0 4px', color: '#e8f0f6' },
  coachFix: { fontSize: 11, color: '#9fb4c4', lineHeight: 1.5 },
  row: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },
  btn: {
    background: '#0a2028', border: `1px solid ${ACCENT}`, color: ACCENT,
    borderRadius: 6, padding: '8px 14px', cursor: 'pointer', font: 'inherit',
    fontSize: 11, letterSpacing: 1, fontWeight: 600,
  },
  hint: { color: '#5a7a94', fontSize: 10, flex: '1 1 260px', lineHeight: 1.5 },
};
