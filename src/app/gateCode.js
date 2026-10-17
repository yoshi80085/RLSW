// ═══ THE GATE'S CODE — the hidden sequence that opens the real game ════════
// Pure: no DOM, no timers, no storage. `gate.js` feeds it directions from the
// keyboard and the pad; `gateCheck.mjs` and `scripts/gate-code.mjs` drive it
// with plain arrays.
//
// ⚠️ THIS IS A CURTAIN, NOT A LOCK (Alex, 2026-10-17: *"make it seem like
//    'there's nothing but something broken in here' for anyone who may be
//    looking for the moment"*). Everything here ships to the browser, so anyone
//    who opens DevTools can step past it. The code is kept as a HASH only so
//    that skimming the bundle does not read it out in plain words — that is the
//    whole of the protection, and it is enough for the job it was asked to do.

/** The only words a code can be made of: both a keyboard and a pad can type all four. */
export const GATE_TOKENS = ['up', 'down', 'left', 'right'];

/**
 * cyrb53 over the space-joined tokens → a short base-36 string.
 * 📌 Synchronous on purpose: `crypto.subtle` is async AND needs a secure origin,
 *    and a check that silently fails on `http://` LAN play would lock Alex out
 *    of his own game.
 */
export function hashCode(tokens) {
  const str = tokens.join(' ');
  let h1 = 0xdeadbeef ^ 0x52, h2 = 0x41c6ce57 ^ 0x52;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Listens for the code. `push(token)` → true on the press that completes it.
 *
 * 🎯 A SLIDING WINDOW, not a "start over" state machine: it compares the LAST
 *    `length` presses every time. So a fumbled press needs no reset — just begin
 *    the code again straight away — and stray presses before it do no harm.
 * ⏱️ A pause longer than `gapMs` forgets everything, so a half-typed code from
 *    earlier can never be finished by someone else's idle prodding.
 * ⚠️ Wrong input does NOTHING visible. That is the design, not an omission: any
 *    reaction (a sound, a flash, "wrong code") tells the viewer something is
 *    listening, and the page is supposed to look dead.
 */
export function createCodeListener({ hash, length, gapMs, now = () => Date.now() }) {
  let recent = [];
  let last = -Infinity;
  return {
    push(token) {
      const t = now();
      if (t - last > gapMs) recent = [];
      last = t;
      recent.push(token);
      if (recent.length > length) recent.shift();
      return recent.length === length && hashCode(recent) === hash;
    },
    reset() { recent = []; last = -Infinity; },
  };
}
