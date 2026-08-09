// =============================================================================
// net/earSpyLink.js — EAR SPY ONLINE — see what your friend is playing
// -----------------------------------------------------------------------------
// Sits between the listening chain (`audio/chroma.js` → `music/*`) and the room
// socket (`net/client.js`). Sends your analysis while you hold the floor,
// collects everyone else's, and tells the UI whose turn it is.
//
// ⚠️ TURN-TAKING IS NOT A UI CHOICE, IT IS THE PHYSICS. Musicians start to
// stumble at roughly 25 ms of one-way delay — about the time sound takes to
// cross a small room. A good internet path plus Opus plus a jitter buffer is
// several times that, and no amount of engineering here changes it. So the
// room never asks two people to play at once: one player has the floor, the
// others listen and watch. Nothing in this file waits on a packet to keep time,
// which is exactly why it works.
//
// ⚠️ WHAT TRAVELS IS THE ANALYSIS, NOT THE AUDIO. Each browser analyses its own
// clean microphone signal and ships the result (see `net/riffWire.js` for why
// that beats analysing a compressed stream at the far end). Audio for LISTENING
// is a separate transport — WebRTC — and deliberately not this module's job:
// the picture on screen must not depend on a peer connection succeeding.
//
// NO REACT, NO AUDIO, NO DOM — a state machine over a socket, so the whole
// thing can be driven headlessly by `server/n13-earspy-smoke.mjs`.
// =============================================================================
import { encodeRiffFrame, decodeRiffFrame, makeRiffSender, isStale, WIRE_DEFAULTS } from "./riffWire.js";

export const LINK_DEFAULTS = {
  hz: WIRE_DEFAULTS.hz,
  staleMs: 1200,      // no frames for this long → stop drawing their neck as live
};

/**
 * @param {object} net    a client from `net/client.js` (needs .send and .on)
 * @param {object} opts   { hz, staleMs, now }
 * @returns {{
 *   offer, claimFloor, releaseFloor, passFloor,
 *   floorSeatId, holdsFloor, peers, peer, onChange, dispose
 * }}
 */
export function makeEarSpyLink(net, opts = {}) {
  const o = { ...LINK_DEFAULTS, ...opts };
  const now = o.now ?? (() => Date.now());

  /** @type {Map<number, {seatId, state, lastFrameAt}>} */
  const peers = new Map();
  let floorSeatId = null;
  const listeners = new Set();
  const notify = () => { for (const fn of [...listeners]) fn(); };

  const sender = makeRiffSender(frame => net.send({ t: 'RIFF', frame }), o);

  const offFrame = net.on('RIFF', (f) => {
    if (typeof f.seatId !== 'number') return;
    // ⚠️ IGNORE FRAMES FROM ANYONE WHO ISN'T HOLDING THE FLOOR. The server
    // already enforces this, but the check is cheap and this is the boundary
    // where a bad frame becomes something drawn on screen. A relay that grew a
    // spectate path, or an older server build, should not be able to light up
    // two necks at once and make the turn indicator a lie.
    if (floorSeatId != null && f.seatId !== floorSeatId) return;
    peers.set(f.seatId, {
      seatId: f.seatId,
      state: decodeRiffFrame(f.frame, o),
      lastFrameAt: now(),
    });
    notify();
  });

  const offFloor = net.on('FLOOR', (f) => {
    const next = typeof f.floorSeatId === 'number' ? f.floorSeatId : null;
    if (next === floorSeatId) return;
    floorSeatId = next;
    // A hand-over invalidates whatever the previous holder left on screen:
    // their last frame is a note they are no longer playing.
    for (const [seatId, p] of peers) if (seatId !== floorSeatId) p.lastFrameAt = 0;
    sender.reset();
    notify();
  });

  // ROOM_STATE carries the floor too, so a joiner or a reconnect learns whose
  // turn it is immediately instead of waiting for the next hand-over.
  const offState = net.on('ROOM_STATE', (f) => {
    if ('floorSeatId' in f) {
      const next = typeof f.floorSeatId === 'number' ? f.floorSeatId : null;
      if (next !== floorSeatId) { floorSeatId = next; notify(); }
    }
  });

  const api = {
    /** Whose turn it is, or null if the floor is open. */
    get floorSeatId() { return floorSeatId; },
    /** Am I the one playing? */
    get holdsFloor() {
      return floorSeatId != null && net.seatId != null && floorSeatId === net.seatId;
    },

    /**
     * Feed this every animation frame with your current listening state. It
     * coalesces to `hz` sends per second and does nothing at all unless you
     * hold the floor — a listener's browser is silent on the wire.
     */
    offer(state) {
      if (!api.holdsFloor) return false;
      return sender.offer(state, now());
    },

    claimFloor() { net.send({ t: 'FLOOR', mode: 'claim' }); },
    releaseFloor() {
      // Flush first: the last thing you played should land before you hand
      // over, or the far end keeps a mid-phrase note on screen until it goes
      // stale. (Harmless if the server has already moved the floor on.)
      sender.flush(now());
      net.send({ t: 'FLOOR', mode: 'release' });
    },
    passFloor(toSeatId) {
      sender.flush(now());
      net.send({ t: 'FLOOR', mode: 'pass', toSeatId });
    },

    /** Everyone whose analysis we're holding, freshest state included. */
    peers() {
      const t = now();
      return [...peers.values()].map(p => ({
        seatId: p.seatId,
        state: p.state,
        stale: isStale(p.lastFrameAt, t, o.staleMs),
        playing: p.seatId === floorSeatId && !isStale(p.lastFrameAt, t, o.staleMs),
      }));
    },
    /** The one player currently on the floor, if we're hearing from them. */
    peer() { return api.peers().find(p => p.seatId === floorSeatId) ?? null; },

    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    dispose() {
      offFrame?.(); offFloor?.(); offState?.();
      listeners.clear();
      peers.clear();
      sender.reset();
    },
  };

  return api;
}

export { encodeRiffFrame, decodeRiffFrame };
