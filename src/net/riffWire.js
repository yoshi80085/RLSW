// =============================================================================
// net/riffWire.js — WHAT A LISTENING FRAME LOOKS LIKE ON THE WIRE
// -----------------------------------------------------------------------------
// Ear Spy Online sends ANALYSIS, not audio. Each player's browser listens to
// their own microphone, runs the whole chroma → chord → key → neck chain
// locally, and ships the RESULT. The other end draws a neck from it.
//
// ⚠️ WHY THE ANALYSIS TRAVELS AND NOT (JUST) THE SOUND. The obvious design is
// to stream the audio and analyse it at the far end. It is worse in every way
// that matters here:
//   • Opus is a SPEECH codec. At call bitrates it preserves intelligibility and
//     spends nothing on the upper partials — precisely the harmonic detail
//     `chroma.js` reads. You would be analysing a smeared copy when a clean
//     original existed at the source.
//   • Packet loss becomes wrong notes. A dropout in an audio stream is a hole
//     in the spectrum, and a hole in the spectrum is a chord change that never
//     happened. A dropped analysis frame is just a stale display for 125 ms.
//   • It costs ~600 bytes/second instead of ~40 kbit/s.
// Audio still gets streamed for LISTENING (that's WebRTC, a separate concern).
// What is drawn on screen comes from here.
//
// ⚠️ AND THE THING THAT WOULD HAVE KICKED PLAYERS OFFLINE: the room server runs
// a token bucket of 30 messages/second per socket and CLOSES THE SOCKET when it
// is exceeded (`server/index.js`, LIMITS.msgPerSec → ws.close(1008)). Offering
// a frame at animation rate — 60/s — does not degrade, it disconnects the
// player mid-riff, and it would have looked perfect in local testing where
// nothing else is talking. `makeRiffSender` therefore coalesces to 8/s by
// default, leaving the other ~22 for actual gameplay traffic.
//
// PURE MODULE — no sockets, no React, no audio. Encoding and decoding are
// separately testable, which is what you want for anything that crosses a
// trust boundary.
// =============================================================================

export const WIRE_DEFAULTS = {
  // 8 Hz. Chords do not change faster than this, the neck's own smoothing is
  // 250 ms, and it leaves the server's budget mostly free. See the note above.
  hz: 8,
  maxNotes: 6,       // a six-string instrument cannot sound more at once
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const q8 = v => clamp(Math.round((Number(v) || 0) * 255), 0, 255);
const d8 = v => clamp(Number(v) || 0, 0, 255) / 255;
const isPc = v => Number.isInteger(v) && v >= 0 && v < 12;

/**
 * Pack a local listening state into the smallest sensible frame.
 *
 * Keys are single letters because this goes out eight times a second per
 * player and the server relays it to everyone in the room; the readability
 * cost is paid once, here, next to the decoder that explains it.
 *
 * @param {object} state
 *   chroma  — Float32Array(12), 0..1
 *   notes   — [{ midi, strength }]
 *   chord   — { rootPc, id, confidence } | null
 *   key     — { rootPc, mode, confidence } | null
 *   palette — { rootPc, id } | null
 *   musical — did the gate accept this frame
 */
export function encodeRiffFrame(state = {}, opts = {}) {
  const o = { ...WIRE_DEFAULTS, ...opts };
  const chroma = state.chroma || [];
  const out = {
    c: Array.from({ length: 12 }, (_, i) => q8(chroma[i])),
    n: (state.notes || [])
      .slice(0, o.maxNotes)
      .map(n => [clamp(Math.round(n.midi) || 0, 0, 127), q8(n.strength)]),
    g: state.musical ? 1 : 0,
  };
  if (state.chord && isPc(state.chord.rootPc)) {
    out.h = { r: state.chord.rootPc, i: String(state.chord.id || ''), c: q8(state.chord.confidence) };
  }
  if (state.key && isPc(state.key.rootPc)) {
    out.k = { r: state.key.rootPc, m: state.key.mode === 'major' ? 1 : 0, c: q8(state.key.confidence) };
  }
  if (state.palette && isPc(state.palette.rootPc)) {
    out.p = { r: state.palette.rootPc, i: String(state.palette.id || '') };
  }
  return out;
}

/**
 * Unpack a frame that arrived from someone else's browser.
 *
 * ⚠️ EVERY FIELD IS RE-VALIDATED, NOT TRUSTED. This crosses a trust boundary:
 * the sender is another player's machine, relayed by a server that deliberately
 * does not understand the payload. A pitch class of 47, a chroma array of
 * length 3, or a note list of ten thousand entries would each be a rendering
 * crash on the receiving end — a peer could hang your browser by hand-crafting
 * one frame. Decoding clamps and drops rather than throwing, so a malformed
 * frame costs one stale display tick and nothing else.
 */
export function decodeRiffFrame(frame, opts = {}) {
  const o = { ...WIRE_DEFAULTS, ...opts };
  const f = frame && typeof frame === 'object' ? frame : {};

  const chroma = new Float32Array(12);
  if (Array.isArray(f.c)) {
    for (let i = 0; i < 12; i++) chroma[i] = d8(f.c[i]);
  }

  const notes = Array.isArray(f.n)
    ? f.n.slice(0, o.maxNotes).reduce((acc, pair) => {
        if (!Array.isArray(pair)) return acc;
        const midi = Number(pair[0]);
        if (!Number.isInteger(midi) || midi < 0 || midi > 127) return acc;
        acc.push({ midi, pc: ((midi % 12) + 12) % 12, strength: d8(pair[1]) });
        return acc;
      }, [])
    : [];

  const chord = f.h && isPc(f.h.r)
    ? { rootPc: f.h.r, id: String(f.h.i ?? '').slice(0, 12), confidence: d8(f.h.c) }
    : null;
  const key = f.k && isPc(f.k.r)
    ? { rootPc: f.k.r, mode: f.k.m ? 'major' : 'minor', confidence: d8(f.k.c) }
    : null;
  const palette = f.p && isPc(f.p.r)
    ? { rootPc: f.p.r, id: String(f.p.i ?? '').slice(0, 12) }
    : null;

  return { chroma, notes, chord, key, palette, musical: !!f.g };
}

/**
 * Rate-limited sender: offer it a state every animation frame, it sends the
 * NEWEST one at most `hz` times a second.
 *
 * ⚠️ COALESCING, NOT DROPPING. The distinction matters. A plain "ignore calls
 * that arrive too soon" throttle discards whatever happened to land in the
 * window, so the frame that ships is an arbitrary one — and the last state
 * before the player stops playing is exactly the one most likely to be thrown
 * away, leaving the far end showing a note from mid-phrase forever. Keeping the
 * latest offer and flushing it on the next tick means the display always
 * settles on the truth.
 *
 * @param {function} sendFn  called with the encoded frame
 * @returns {{ offer(state, nowMs): boolean, flush(nowMs): boolean, reset(): void }}
 */
export function makeRiffSender(sendFn, opts = {}) {
  const o = { ...WIRE_DEFAULTS, ...opts };
  const intervalMs = 1000 / Math.max(1, o.hz);
  let pending = null;
  let lastSent = -Infinity;

  function flush(now) {
    if (!pending) return false;
    const frame = encodeRiffFrame(pending, o);
    pending = null;
    lastSent = now;
    sendFn(frame);
    return true;
  }

  return {
    offer(state, now = Date.now()) {
      pending = state;
      if (now - lastSent < intervalMs) return false;
      return flush(now);
    },
    /** Force the pending state out — use when the player stops or hands over. */
    flush(now = Date.now()) { return flush(now); },
    reset() { pending = null; lastSent = -Infinity; },
  };
}

// ── Floor control ───────────────────────────────────────────────────────────
// Turn-taking is not a UI nicety here, it is the design working around physics.
// Two people cannot play together over the internet — 25 ms is roughly where
// musicians start to stumble and a normal connection is several times that. So
// the room gives ONE player the floor at a time: they play, everyone else
// listens and watches. Nobody is ever waiting on a packet to keep time.

export const FLOOR = {
  CLAIM: 'claim',     // I'd like to play
  RELEASE: 'release', // I'm done
  PASS: 'pass',       // your turn (targeted)
};

/** Is this seat allowed to be sending analysis right now? */
export function holdsFloor(floorSeatId, seatId) {
  return floorSeatId != null && seatId != null && floorSeatId === seatId;
}

/**
 * A remote player's state goes stale when their frames stop — a closed laptop
 * looks exactly like a held note otherwise, and the neck would sit there lit
 * with a chord nobody is playing.
 */
export function isStale(lastFrameAtMs, now = Date.now(), staleMs = 1200) {
  return lastFrameAtMs == null || now - lastFrameAtMs > staleMs;
}
