// =============================================================================
// ui/ListenNeck.jsx — 👂 EAR SPY — put what you HEAR onto the neck
// -----------------------------------------------------------------------------
// The fourth room in Riff Mode, and the only one where you don't play. Someone
// else does — a friend across the room, a record, a video — and the neck lights
// up with where those notes live, what chord they add up to, and what key it's
// all in. Then you pick up the guitar and join in.
//
// The learning claim: every other practice mode trains hands. This one trains
// EARS, by doing the translation out loud until you stop needing it. You hear a
// change, the neck shows you the shape, and eventually you see the shape before
// the neck does.
//
// ⚠️ THIS MODE IS HONEST ABOUT BEING UNSURE, ON PURPOSE. Polyphonic detection
// off a room mic is genuinely hard — see the measured accuracy notes in
// `audio/chroma.js`. So nothing here asserts a single answer:
//   • chords show a ranked top-3 with confidence bars, not one verdict
//   • the best-guess fret is bright, alternate positions stay visible
//   • when the gate rejects a frame the last read HOLDS rather than blanking
// A system that shows its working reads as thinking. One that flickers between
// confident wrong answers reads as broken — and is.
//
// Stands on: audio/chroma.js (listening + gating), music/keyDetect.js (chord +
// key inference), music/neckPlacement.js (pitch → fret), ui/FretboardFull.jsx
// (the neon neck). No engine, no game state, no multiplayer — a lobby feature,
// exactly like the other three practice rooms.
// =============================================================================
import { useState, useRef, useEffect, useCallback } from "react";
import { FretboardFull } from "./FretboardFull.jsx";
import { chromaAvailable, startChromaListening } from "../audio/chroma.js";
import { makeKeyTracker, listenFrame, keyToScale, detectPalette } from "../music/keyDetect.js";
import { makeNeckTracker } from "../music/neckPlacement.js";
import CameraCalibrator from "./CameraCalibrator.jsx";
import { makeFretFusion } from "../vision/fretFusion.js";
import { makePhraseRecorder, analysePhrase, ROLE_LABELS } from "../music/riffAnalysis.js";
import { getRiffAudio } from "../audio/riffSfx.js";
import { makeNetClient } from "../net/client.js";
import { makeEarSpyLink } from "../net/earSpyLink.js";
import { PC_NAMES } from "../music/chords.js";
import { playAmpNote, TONE_KNOB_DEFAULTS } from "../audio/ampVoice.js";

// ── Neon palette — same language as Discord Coach and Fretboard Recon ───────
const ACCENT       = '#19e6ff';
const NEON_GREEN   = '#44ff88';
const NEON_VIOLET  = '#8a5cff';
const NEON_MAGENTA = '#ff2d95';
const NEON_AMBER   = '#f6ad55';

// How long a chord must hold before it joins the progression strip. Shorter
// than this and you are logging strum transients, which buries the actual
// changes in noise.
const CHORD_HOLD_MS = 300;
const PROGRESSION_MAX = 16;

// Human-readable causes for a rejected frame. The raw codes from chroma.js are
// for code; someone standing in a room wants to know what it thinks it heard.
const WHY = {
  quiet:     'silence',
  floor:     'too close to the room noise',
  noisy:     'that\'s noise, not notes',
  unfocused: 'no clear harmony in that',
  unstable:  'not holding still — voices or a knock',
  settling:  'listening…',
};

export function ListenNeck({ onBack }) {
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState(null);
  const [frame, setFrame] = useState(null);      // { musical, reject, db }
  const [chord, setChord] = useState(null);      // { ranked, confidence }
  const [keyEst, setKeyEst] = useState(null);
  const [layers, setLayers] = useState({});
  const [trail, setTrail] = useState([]);
  const [palette, setPalette] = useState(null);
  const [progression, setProgression] = useState([]);
  // Defaults chosen from what the view is FOR: the two things you always want
  // are what's ringing and what the passage is made of. Alternate positions are
  // the honest-uncertainty layer and useful on demand, but on by default they
  // light most of the neck and drown the answer.
  const [showOther, setShowOther] = useState(false);
  // 📷 Camera fusion. OFF by default and always will be: it needs a camera the
  // player has to place deliberately, and Ear Spy has to work for someone who
  // just wants to point a laptop at a room. Measured worth, EAR_SPY_HANDOFF §6 —
  // median fret error 0.44 with it against 2.53 without.
  const [camera, setCamera] = useState(false);
  // The camera's RAW fret reading, before anything learned is applied. Kept in a
  // ref rather than state because it updates every animation frame and nothing
  // renders from it directly.
  const camFretRef = useRef(null);
  // ⚠️ THE LOOP THAT PAYS FOR ITSELF. A heard pitch is playable in only three or
  // four places, and those places are a fourth apart — so the camera does not
  // need to know the fret, only which of a few options separated by five frets.
  // Once snapped, the true fret is KNOWN, and the gap to the camera's raw reading
  // is the parallax error, measured for free while somebody just plays. See
  // vision/fretFusion.js, including the aliasing limit the guards cannot cover.
  const fusionRef = useRef(makeFretFusion());
  const [showUsed, setShowUsed] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [riff, setRiff] = useState(null);        // the last finished phrase's report

  // ── Online ──
  // ⚠️ EAR SPY KEEPS ITS OWN CONNECTION rather than riding the match socket.
  // PRACTICE_MODES_HANDOFF §0.3 rules that practice modes never touch the
  // engine or `state.battle`; a listening room is not a match, has no seats in
  // the game sense, and must not be able to desync one. A separate room is also
  // the honest model — you invite a friend to play guitar, not to duel.
  const [online, setOnline] = useState(null);    // { code, seatId, seats }
  const [netErr, setNetErr] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [peer, setPeer] = useState(null);        // { seatId, state, stale, playing }
  const [floorSeatId, setFloorSeatId] = useState(null);

  const listenerRef = useRef(null);
  const keyTrackerRef = useRef(makeKeyTracker());
  const neckRef = useRef(makeNeckTracker());
  const phraseRef = useRef(makePhraseRecorder());
  const lastTRef = useRef(0);
  const holdRef = useRef({ name: null, since: 0, logged: null });
  // The last report's verdicts, held in a ref as well as state: the frame
  // callback needs them to filter the neck and must not be rebuilt to get them.
  const verdictRef = useRef({ dropPcs: null, flavorPcs: null });
  const netRef = useRef(null);
  const linkRef = useRef(null);
  // The remote player's neck is drawn by the SAME placement code as yours —
  // they sent notes, not pixels, so their line gets the same hand-position
  // reasoning and the same trail rather than a second, lesser renderer.
  const peerNeckRef = useRef(makeNeckTracker());
  const peerNeckTRef = useRef(0);
  const [peerLayers, setPeerLayers] = useState({});
  const [peerTrail, setPeerTrail] = useState([]);

  // ── The audition voice ────────────────────────────────────────────────────
  // Tapping the neck still sounds the note through the rig, because every other
  // room in Riff Mode does. The neck is an instrument first — you should be
  // able to check a shown position against your own ear without leaving.
  //
  // ⚠️ FretboardFull calls this as playNote(freq, string, fret) — it works the
  // frequency out from the neck geometry itself and hands it over. Taking
  // (string, fret) here and computing a frequency from the first argument would
  // sound a note derived from a Hz value, which is silently, wildly wrong.
  const playNote = useCallback((freq) => {
    const ctx = getRiffAudio();
    if (!ctx) return;
    playAmpNote(ctx, freq, {
      holdTime: 0.9, fadeTime: 0.5, volume: 0.22, knobs: { ...TONE_KNOB_DEFAULTS },
    });
  }, []);

  const stopListening = useCallback(() => {
    if (listenerRef.current) {
      listenerRef.current.stop();
      listenerRef.current = null;
    }
    setListening(false);
  }, []);

  // ⚠️ SETTINGS ARE READ THROUGH A REF, SO onFrame NEVER CHANGES IDENTITY.
  // startChromaListening captures the callback ONCE, at the moment the mic
  // opens. A callback that closes over state would be frozen at whatever the
  // settings were when you pressed LISTEN — the toggle below would appear to do
  // nothing until you stopped and started again. A ref keeps the live value
  // reachable without rebuilding the callback or restarting the stream.
  const optsRef = useRef({ showOther, showUsed, showTrail });
  useEffect(() => { optsRef.current = { showOther, showUsed, showTrail }; },
    [showOther, showUsed, showTrail]);

  const onFrame = useCallback((f) => {
    const now = performance.now();
    const dt = lastTRef.current ? now - lastTRef.current : 16.7;
    lastTRef.current = now;

    setFrame(f);

    // ⚠️ THE NECK KEEPS TICKING WHEN THE GATE SAYS NO; THE ESTIMATORS DO NOT.
    // These are two different needs that a bare `return` here conflated, and
    // getting it wrong froze the melody trail:
    //
    //   • Estimators must NOT see rejected frames. Room noise puts a little
    //     energy in all twelve pitch classes, flattening the key histogram and
    //     dragging every correlation toward zero — the key estimate got worse
    //     the longer the room was left running.
    //   • The neck tracker MUST keep ticking, because its clock is what expires
    //     the trail. Returning early stopped that clock the instant someone
    //     stopped playing, so the snake froze mid-phrase and sat there — and
    //     silence is precisely when it is supposed to drain away.
    //
    // So: tick the neck with an empty frame, refresh the trail, then stop.
    if (!f.musical) {
      neckRef.current.push([], dt);
      if (optsRef.current.showTrail) setTrail(neckRef.current.melodyTrail());
      return;
    }

    keyTrackerRef.current.push(f.chroma, dt);
    const key = keyTrackerRef.current.estimate();
    setKeyEst(key);

    // ── Camera fusion, before placement ──
    // The corrected reading goes to the tracker; the snap of the top voice feeds
    // the learner. Only the FRET is taken from the camera: finger height wrecks
    // the string coordinate and leaves the fret alone (neckGeometry §stringSlack).
    const rawCamFret = camFretRef.current;
    if (rawCamFret != null) {
      const corrected = fusionRef.current.correctedFret(rawCamFret);
      neckRef.current.setRef([neckRef.current.ref()[0], corrected]);
      if (f.notes.length) {
        const top = f.notes.reduce((a, b) => (b.midi > a.midi ? b : a));
        fusionRef.current.observe(top.midi, rawCamFret);
      }
    }

    const view = optsRef.current;
    const step = neckRef.current.push(f.notes, dt);
    if (step) phraseRef.current.push(step);

    // ── The look back ──
    // A finished phrase is what makes the judgement possible at all: whether a
    // discord was deliberate depends on the note AFTER it, so nothing can be
    // decided while the player is still playing.
    const finished = phraseRef.current.tick(neckRef.current.now());
    if (finished) {
      const report = analysePhrase(finished, {
        mode: key.best ? key.best.mode : 'minor',
        keyRootPc: key.best ? key.best.rootPc : undefined,
      });
      if (report.chord) {
        setRiff(report);
        verdictRef.current = { dropPcs: report.dropPcs, flavorPcs: report.flavorPcs };
      }
    }

    const verdict = verdictRef.current;
    setLayers(neckRef.current.layers({
      showUsed: view.showUsed,
      usedColor: NEON_GREEN,
      flavorColor: NEON_MAGENTA,
      dropPcs: verdict.dropPcs,
      flavorPcs: verdict.flavorPcs,
      showAlternates: view.showOther,
      showEchoes: view.showOther,
      colors: { heard: ACCENT, alternate: ACCENT, echo: NEON_VIOLET },
    }));

    const path = neckRef.current.melodyTrail();
    setTrail(view.showTrail ? path : []);

    // The palette needs the tonic, which a note set cannot supply on its own —
    // A minor pentatonic and C major pentatonic are the same five notes. The
    // key estimate is a genuinely independent measurement, so it gets to break
    // that tie; below the confidence bar we'd rather name the shape and stay
    // quiet about the root than assert one on no evidence.
    const keyHint = key.best && key.confidence >= 0.35 ? key.best.rootPc : undefined;
    const pal = detectPalette(neckRef.current.usageByPc(), { keyRootPc: keyHint });
    setPalette(pal);

    const res = listenFrame(f.chroma, f.bass, key, { topN: 3 });
    setChord(res);

    // ── Send it on, if it's your turn ──
    // `offer` does nothing unless we hold the floor, and coalesces to 8/sec
    // internally. Offering at animation rate is only safe BECAUSE of that
    // throttle — the room server closes sockets over 30 messages/second.
    if (linkRef.current) {
      linkRef.current.offer({
        chroma: f.chroma,
        notes: f.notes,
        musical: f.musical,
        chord: res.best ? { rootPc: res.best.rootPc, id: res.best.id, confidence: res.confidence } : null,
        key: key.best ? { rootPc: key.best.rootPc, mode: key.best.mode, confidence: key.confidence } : null,
        palette: pal.best ? { rootPc: pal.best.rootPc, id: pal.best.id } : null,
      });
    }

    // Progression strip: log a chord once it has HELD, not on every frame.
    const name = res.best ? res.best.name : null;
    const h = holdRef.current;
    if (name !== h.name) {
      h.name = name;
      h.since = now;
    } else if (name && now - h.since > CHORD_HOLD_MS && name !== h.logged) {
      h.logged = name;
      setProgression(p => [...p.slice(-(PROGRESSION_MAX - 1)), { name, confidence: res.confidence }]);
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!chromaAvailable()) {
      setErr('No microphone access here — this needs https or localhost.');
      return;
    }
    try {
      setErr(null);
      listenerRef.current = await startChromaListening(onFrame);
      setListening(true);
    } catch (e) {
      setErr(`Microphone error: ${e.message}`);
    }
  }, [onFrame]);

  const reset = useCallback(() => {
    keyTrackerRef.current.reset();
    neckRef.current.reset();
    phraseRef.current.reset();
    if (listenerRef.current) listenerRef.current.resetGate();
    holdRef.current = { name: null, since: 0, logged: null };
    verdictRef.current = { dropPcs: null, flavorPcs: null };
    setProgression([]);
    setLayers({});
    setTrail([]);
    setPalette(null);
    setRiff(null);
    setKeyEst(null);
    setChord(null);
  }, []);

  // ── Online room ───────────────────────────────────────────────────────────
  const goOnline = useCallback(async (mode) => {
    if (netRef.current) return;
    setNetErr(null);
    try {
      const net = makeNetClient();
      netRef.current = net;
      await net.connect();
      if (mode === 'host') net.createRoom('Ear Spy');
      else net.joinRoom(joinCode.trim().toUpperCase(), { name: 'Ear Spy' });
      await net.waitFor('WELCOME');

      const link = makeEarSpyLink(net);
      linkRef.current = link;
      link.onChange(() => {
        setFloorSeatId(link.floorSeatId);
        const p = link.peer();
        setPeer(p);
        // Drive the remote neck from their notes. A stale peer stops feeding
        // it, so their neck decays through the same trail logic as yours
        // instead of freezing on the last chord they happened to send.
        if (p && !p.stale && p.state.musical) {
          const t = performance.now();
          const dt = peerNeckTRef.current ? t - peerNeckTRef.current : 125;
          peerNeckTRef.current = t;
          peerNeckRef.current.push(p.state.notes, dt);
          setPeerLayers(peerNeckRef.current.layers({ usedColor: NEON_GREEN }));
          setPeerTrail(peerNeckRef.current.melodyTrail());
        }
      });

      net.on('ROOM_STATE', f => setOnline({ code: net.code, seatId: net.seatId, seats: f.seats || [] }));
      net.on('ERROR', f => setNetErr(f.msg || f.code));
      net.on('net:close', () => setNetErr('disconnected — reconnecting…'));
      setOnline({ code: net.code, seatId: net.seatId, seats: [] });
    } catch (e) {
      setNetErr(`couldn't connect: ${e.message}`);
      netRef.current = null;
      linkRef.current = null;
    }
  }, [joinCode]);

  const goOffline = useCallback(() => {
    linkRef.current?.dispose();
    netRef.current?.close();
    linkRef.current = null;
    netRef.current = null;
    peerNeckRef.current.reset();
    setOnline(null); setPeer(null); setFloorSeatId(null);
    setPeerLayers({}); setPeerTrail([]);
  }, []);

  useEffect(() => () => { stopListening(); goOffline(); }, [stopListening, goOffline]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { stopListening(); onBack(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack, stopListening]);

  // ── Derived display ───────────────────────────────────────────────────────
  const key = keyEst && keyEst.best ? keyToScale(keyEst.best.rootPc, keyEst.best.mode) : null;
  const keyConfidence = keyEst ? keyEst.confidence : 0;
  const musical = !!(frame && frame.musical);
  const statusText = !listening ? 'not listening'
    : musical ? 'hearing music'
    : (WHY[frame?.reject] || 'listening…');

  // The neck dims while the gate is refusing frames, so a held reading reads as
  // "this is what I last heard" rather than a live claim.
  const neckOpacity = !listening ? 0.5 : musical ? 1 : 0.55;

  const iHaveFloor = !!(online && floorSeatId != null && floorSeatId === online.seatId);
  const otherSeats = online ? (online.seats || []).filter(s => s.seatId !== online.seatId && !s.isBot) : [];
  const peerName = peer
    ? (otherSeats.find(s => s.seatId === peer.seatId)?.name ?? `Seat ${peer.seatId}`)
    : 'they';
  const peerPaletteLabel = peer?.state?.palette
    ? `${PC_NAMES[peer.state.palette.rootPc]} ${peer.state.palette.id.replace('_', ' ')}`
    : '';

  return (
    <div style={S.root}>
      <div style={S.hud}>
        <div>
          <div style={S.title}>👂 EAR SPY</div>
          <div style={S.subtitle}>someone else plays — the neck shows you where</div>
        </div>
        <button onClick={() => { stopListening(); onBack(); }} style={S.lobbyBtn}>← RIFF MODE</button>
      </div>

      {/* ── Transport ── */}
      <div style={S.controls}>
        <button
          onClick={() => (listening ? stopListening() : startListening())}
          style={{
            ...S.bigBtn,
            background: listening ? '#2a0a18' : '#0a2028',
            borderColor: listening ? NEON_MAGENTA : ACCENT,
            color: listening ? NEON_MAGENTA : ACCENT,
          }}>
          {listening ? '■ STOP' : '● LISTEN'}
        </button>
        <div style={{
          ...S.status,
          color: musical ? NEON_GREEN : listening ? NEON_AMBER : '#4a6a8a',
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: 4, marginRight: 8,
            background: musical ? NEON_GREEN : listening ? NEON_AMBER : '#2a3a4a',
            boxShadow: musical ? `0 0 10px ${NEON_GREEN}` : 'none',
          }}/>
          {statusText}
        </div>
        <button onClick={reset} style={S.smallBtn} disabled={!listening}>RESET</button>
        <label style={S.check}>
          <input type="checkbox" checked={showUsed} onChange={e => setShowUsed(e.target.checked)} />
          notes in play
        </label>
        <label style={S.check}>
          <input type="checkbox" checked={showTrail} onChange={e => setShowTrail(e.target.checked)} />
          melody trail
        </label>
        <label style={S.check}>
          <input type="checkbox" checked={showOther} onChange={e => setShowOther(e.target.checked)} />
          other possible positions
        </label>
        <label style={S.check}>
          <input type="checkbox" checked={camera} onChange={e => setCamera(e.target.checked)} />
          📷 watch my hand
        </label>
      </div>

      {/* ⚠️ THE CAMERA ONLY EVER SUPPLIES placePitch's `ref` ARGUMENT — one number,
          and the audio tracker keeps running underneath it as the fallback. Audio
          says WHEN and WHAT; video says WHERE. Two numbers of integration surface,
          and nothing about the listening chain changes if the camera is off, is
          refused, or loses the hand mid-phrase. */}
      {camera && (
        <CameraCalibrator
          onRef={ref => {
            camFretRef.current = ref ? ref[1] : null;
            if (!ref) neckRef.current.setRef(null);
          }}
          onRecalibrate={() => fusionRef.current.reset()}
          onClose={() => setCamera(false)}
        />
      )}

      {err && <div style={S.err}>{err}</div>}

      {/* ── The online room ──
          Turn-taking, because two people cannot play together over the
          internet: musicians stumble past ~25 ms of delay and a normal
          connection is several times that. One player holds the floor, the
          rest watch. Nothing here waits on a packet to keep time. */}
      <div style={S.roomBar}>
        {!online ? (
          <>
            <span style={S.roomLabel}>👥 PLAY WITH A FRIEND</span>
            <button onClick={() => goOnline('host')} style={S.smallBtn}>HOST A ROOM</button>
            <span style={S.tiny}>or</span>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="CODE"
              style={S.codeInput}
            />
            <button onClick={() => goOnline('join')} style={S.smallBtn} disabled={joinCode.length < 4}>JOIN</button>
          </>
        ) : (
          <>
            <span style={S.roomLabel}>ROOM <b style={{ color: ACCENT, letterSpacing: 4 }}>{online.code}</b></span>
            <span style={S.tiny}>{online.seats.length || 1} here</span>
            {iHaveFloor ? (
              <>
                <span style={{ ...S.turnPill, background: `${NEON_GREEN}22`, color: NEON_GREEN, borderColor: NEON_GREEN }}>
                  ● YOUR TURN — they can see you
                </span>
                <button onClick={() => linkRef.current?.releaseFloor()} style={S.smallBtn}>DONE</button>
                {otherSeats.map(s => (
                  <button key={s.seatId} onClick={() => linkRef.current?.passFloor(s.seatId)} style={S.smallBtn}>
                    PASS TO {s.name}
                  </button>
                ))}
              </>
            ) : floorSeatId != null ? (
              <span style={{ ...S.turnPill, background: `${NEON_VIOLET}22`, color: NEON_VIOLET, borderColor: NEON_VIOLET }}>
                ♪ {peerName} IS PLAYING — listen
              </span>
            ) : (
              <button onClick={() => linkRef.current?.claimFloor()} style={{ ...S.smallBtn, borderColor: ACCENT, color: ACCENT }}>
                TAKE THE FLOOR
              </button>
            )}
            <button onClick={goOffline} style={S.smallBtn}>LEAVE</button>
          </>
        )}
        {netErr && <span style={{ color: NEON_MAGENTA, fontSize: 9 }}>{netErr}</span>}
      </div>

      {/* ── Their neck ── */}
      {online && peer && (
        <div style={{ ...S.neckWrap, opacity: peer.stale ? 0.35 : 1, transition: 'opacity .3s', marginBottom: 6 }}>
          <div style={S.peerHeader}>
            <span style={{ color: NEON_VIOLET }}>♪ {peerName}</span>
            <span style={S.tiny}>
              {peer.stale ? 'gone quiet'
                : [
                    peer.state.chord ? `${PC_NAMES[peer.state.chord.rootPc]} ${peer.state.chord.id}` : null,
                    peer.state.key ? `in ${PC_NAMES[peer.state.key.rootPc]} ${peer.state.key.mode}` : null,
                    peer.state.palette ? peerPaletteLabel : null,
                  ].filter(Boolean).join(' · ') || 'listening…'}
            </span>
          </div>
          <FretboardFull
            layers={peerLayers}
            trail={peerTrail}
            showLabels="layers"
            playNote={playNote}
            accent={NEON_VIOLET}
          />
        </div>
      )}

      {/* ── The neck ── */}
      {/* ⚠️ showLabels="layers" — note names ONLY where something was heard.
          With letters on all 78 cells the handful that are lit cannot be picked
          out of the grid, and the whole question here is which few notes are in
          play. Fretboard Recon still passes `true`; it's hunting, so it needs
          the whole map. */}
      <div style={{ ...S.neckWrap, opacity: neckOpacity, transition: 'opacity .25s' }}>
        <FretboardFull
          layers={layers}
          trail={trail}
          showLabels="layers"
          playNote={playNote}
          accent={ACCENT}
        />
      </div>

      {/* ── Legend ── */}
      <div style={S.legend}>
        <span><b style={{ color: ACCENT, textShadow: `0 0 8px ${ACCENT}` }}>●</b> ringing now</span>
        {showTrail && <span><b style={{ color: ACCENT, opacity: 0.6 }}>╱</b> where the melody went</span>}
        {showUsed && <span><b style={{ color: NEON_GREEN }}>●</b> in play this session</span>}
        {showUsed && <span><b style={{ color: NEON_GREEN, opacity: 0.4 }}>●</b> touched once or twice</span>}
        {showUsed && <span><b style={{ color: NEON_MAGENTA }}>●</b> discord you meant</span>}
        {showOther && <span><b style={{ color: NEON_VIOLET, opacity: 0.5 }}>●</b> could also be here</span>}
      </div>

      {/* ── Readouts ── */}
      <div style={S.readouts}>
        <div style={S.card}>
          <div style={S.cardLabel}>CHORD — best guesses</div>
          {chord && chord.ranked.length ? chord.ranked.map((c, i) => (
            <div key={`${c.root}-${c.id}`} style={{ marginBottom: 7, opacity: i ? 0.5 : 1 }}>
              <div style={S.candRow}>
                <span style={{ fontSize: i ? 12 : 19, color: i ? '#a8c2da' : ACCENT }}>{c.name}</span>
                <span style={S.tiny}>{(c.score * 100).toFixed(0)}</span>
              </div>
              <div style={S.track}>
                <div style={{
                  width: `${Math.max(0, Math.min(100, c.score * 100))}%`,
                  height: '100%', background: i ? NEON_VIOLET : ACCENT,
                }}/>
              </div>
            </div>
          )) : <div style={S.tiny}>waiting for something to listen to…</div>}
          {chord && (
            <div style={S.tiny}>
              {chord.confidence > 0.5 ? 'confident' : chord.confidence > 0.2 ? 'fairly sure' : 'genuinely unsure'}
              {chord.keyBiased ? ' · weighted toward the key' : ''}
            </div>
          )}
        </div>

        <div style={S.card}>
          <div style={S.cardLabel}>KEY — the long game</div>
          <div style={{ fontSize: 24, color: key ? NEON_GREEN : '#3a5a7a' }}>
            {key ? `${key.root} ${key.mode}` : '—'}
          </div>
          <div style={S.track}>
            <div style={{ width: `${keyConfidence * 100}%`, height: '100%', background: NEON_GREEN }}/>
          </div>
          <div style={S.tiny}>
            {keyEst?.warmingUp ? 'needs a few more seconds of playing…'
              : key ? `${(keyConfidence * 100).toFixed(0)}% sure`
              : 'nothing yet'}
          </div>
          {key && <div style={S.scaleRow}>{key.notes.join('  ')}</div>}
        </div>

        {/* ── The long view: what this passage is BUILT from ── */}
        <div style={S.card}>
          <div style={S.cardLabel}>PALETTE — the notes in play</div>
          <div style={{ fontSize: 19, color: palette?.best ? NEON_GREEN : '#3a5a7a' }}>
            {palette?.best ? palette.best.name : '—'}
          </div>
          <div style={S.pcRow}>
            {palette?.notesUsed?.length
              ? palette.notesUsed.map(n => {
                  const outside = palette.best && !palette.best.pcs.includes(n.pc);
                  return (
                    <span key={n.pc} style={{
                      ...S.pcChip,
                      color: outside ? NEON_MAGENTA : NEON_GREEN,
                      borderColor: outside ? `${NEON_MAGENTA}66` : `${NEON_GREEN}44`,
                      opacity: 0.4 + 0.6 * n.weight,
                    }}>{n.name}</span>
                  );
                })
              : <span style={S.tiny}>nothing tallied yet</span>}
          </div>
          <div style={S.tiny}>
            {palette?.best
              ? (palette.best.outside.length
                  ? `${palette.best.outside.join(', ')} sits outside it — that's the flavour`
                  : 'everything played fits the shape')
              : 'give it a few bars'}
          </div>
        </div>

        {/* ── The look back: what that riff was, once it finished ── */}
        <div style={{ ...S.card, flex: '1 1 100%', borderColor: riff ? `${NEON_MAGENTA}33` : '#16263c' }}>
          <div style={S.cardLabel}>THE RIFF — analysed after it finished</div>
          {riff ? (
            <>
              <div style={{ fontSize: 17, color: '#e0f0ff' }}>
                played <span style={{ color: NEON_MAGENTA }}>{riff.summary}</span>
              </div>
              <div style={S.pcRow}>
                {riff.notes.map(n => {
                  const c = n.role === 'DEPTH' ? NEON_MAGENTA
                    : n.role === 'NOISE' ? '#3a4a5a'
                      : n.role === 'COLOR' ? NEON_VIOLET : NEON_GREEN;
                  return (
                    <span key={n.pc} title={ROLE_LABELS[n.role]} style={{
                      ...S.pcChip, color: c, borderColor: `${c}66`,
                      textDecoration: n.role === 'NOISE' ? 'line-through' : 'none',
                    }}>{n.name}</span>
                  );
                })}
              </div>
              <div style={S.tiny}>
                {riff.flavorPcs.size
                  ? 'magenta = discord you meant · struck through = never landed, so it\'s off the neck'
                  : 'struck through = never landed, so it\'s off the neck'}
              </div>
              {riff.coach && <div style={S.coach}>{riff.coach}</div>}
            </>
          ) : (
            <div style={S.tiny}>play a phrase and stop — the verdict comes in the gap</div>
          )}
        </div>

        <div style={{ ...S.card, flex: '1 1 100%' }}>
          <div style={S.cardLabel}>CHANGES HEARD</div>
          <div style={S.progression}>
            {progression.length
              ? progression.map((p, i) => (
                  <span key={i} style={{
                    ...S.chip,
                    opacity: p.confidence < 0.15 ? 0.45 : 1,
                    borderStyle: p.confidence < 0.15 ? 'dashed' : 'solid',
                  }}>{p.name}</span>
                ))
              : <span style={{ ...S.chip, opacity: 0.4 }}>nothing yet</span>}
          </div>
        </div>
      </div>

      <div style={S.hint}>
        Tap any fret to hear it · ESC to go back
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = {
  root: {
    position: 'fixed', inset: 0, background: '#050a14', overflowY: 'auto',
    fontFamily: "'Saira Stencil One', sans-serif", color: '#e0f0ff', zIndex: 100,
    padding: '16px 24px 28px',
  },
  hud: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 20, letterSpacing: 3, color: ACCENT, textShadow: `0 0 18px ${ACCENT}55` },
  subtitle: { fontSize: 9, letterSpacing: 2, color: '#4a6a8a', marginTop: 5 },
  lobbyBtn: {
    fontFamily: 'inherit', cursor: 'pointer', background: '#0a1020',
    border: '1px solid #2a4a6a', borderRadius: 4, color: '#5a8aaa',
    fontSize: 9, padding: '7px 14px', letterSpacing: 1,
  },
  controls: { display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 },
  bigBtn: {
    fontFamily: 'inherit', cursor: 'pointer', border: '1px solid',
    borderRadius: 5, fontSize: 13, letterSpacing: 2, padding: '10px 22px',
  },
  smallBtn: {
    fontFamily: 'inherit', cursor: 'pointer', background: '#0a1020',
    border: '1px solid #1e3a5f', borderRadius: 4, color: '#5a7a9a',
    fontSize: 9, padding: '7px 12px', letterSpacing: 1,
  },
  status: { fontSize: 11, letterSpacing: 1.5, display: 'flex', alignItems: 'center' },
  check: { fontSize: 9, letterSpacing: 1, color: '#4a6a8a', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  err: {
    color: NEON_MAGENTA, fontSize: 10, letterSpacing: 1, marginBottom: 10,
    border: `1px solid ${NEON_MAGENTA}55`, borderRadius: 4, padding: '8px 12px',
  },
  neckWrap: { width: '100%', maxWidth: 1400, margin: '0 auto' },
  roomBar: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    background: '#080e1a', border: '1px solid #16263c', borderRadius: 6,
    padding: '9px 12px', marginBottom: 12,
  },
  roomLabel: { fontSize: 9, letterSpacing: 2, color: '#4a6a8a' },
  codeInput: {
    fontFamily: 'inherit', background: '#0a1020', border: '1px solid #1e3a5f',
    borderRadius: 4, color: '#c8dcf0', fontSize: 11, letterSpacing: 3,
    padding: '6px 9px', width: 82, textAlign: 'center',
  },
  turnPill: {
    fontSize: 9.5, letterSpacing: 1.5, border: '1px solid',
    borderRadius: 999, padding: '5px 12px',
  },
  peerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    fontSize: 11, letterSpacing: 1.5, padding: '0 4px 5px',
  },
  legend: {
    display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap',
    fontSize: 8.5, letterSpacing: 1.4, color: '#4a6a8a', margin: '10px 0 16px',
  },
  readouts: {
    display: 'flex', gap: 14, flexWrap: 'wrap', maxWidth: 1400, margin: '0 auto',
  },
  card: {
    flex: '1 1 260px', background: '#0a1020', border: '1px solid #16263c',
    borderRadius: 8, padding: '12px 14px',
  },
  cardLabel: { fontSize: 8, letterSpacing: 2.4, color: '#3a5a7a', marginBottom: 10 },
  candRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 4, background: '#132033', borderRadius: 2, overflow: 'hidden', margin: '4px 0 2px' },
  tiny: { fontSize: 8.5, letterSpacing: 1.2, color: '#4a6a8a', marginTop: 6 },
  scaleRow: { fontSize: 12, letterSpacing: 2, color: '#a8c2da', marginTop: 8 },
  coach: {
    fontSize: 11, color: '#8aaabb', fontStyle: 'italic', marginTop: 10,
    paddingLeft: 12, borderLeft: `2px solid ${NEON_MAGENTA}44`,
  },
  pcRow: { display: 'flex', gap: 4, flexWrap: 'wrap', margin: '9px 0 2px' },
  pcChip: {
    border: '1px solid', borderRadius: 3, padding: '2px 6px',
    fontSize: 10, letterSpacing: 0.5,
  },
  progression: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: {
    background: '#101c2c', border: '1px solid #22364e', borderRadius: 4,
    padding: '4px 9px', fontSize: 11, color: '#c8dcf0',
  },
  hint: {
    textAlign: 'center', fontSize: 8, letterSpacing: 2, color: '#2a4a6a', marginTop: 18,
  },
};

export default ListenNeck;
