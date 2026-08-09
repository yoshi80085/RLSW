// ─── N13 EAR SPY ONLINE SMOKE ───────────────────────────────────────────────
// Proves the "see what your friend is playing" path headlessly: two clients in
// a room, one takes the floor and streams listening analysis, the other draws
// it. Covers the wire format, the floor rules, and the abuse edges.
//
//   node n13-earspy-smoke.mjs   (spawns its own server on a scratch port)

import { spawn } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { makeNetClient } from "../src/net/client.js";
import { makeEarSpyLink } from "../src/net/earSpyLink.js";
import {
  encodeRiffFrame, decodeRiffFrame, makeRiffSender, isStale, holdsFloor,
} from "../src/net/riffWire.js";

const PORT = 18799;
const url = `ws://127.0.0.1:${PORT}`;

const memStore = () => {
  const m = new Map();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
};
const tab = () => makeNetClient({ url, WebSocketImpl: WebSocket, storage: memStore() });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0;
const check = (label, fn) => { fn(); pass++; console.log(`  ✓ ${label}`); };

// ── Part 1: the wire format, with no server involved ────────────────────────
console.log("\nwire format");

const sampleState = () => ({
  chroma: Float32Array.from([1, 0, 0, 0, 0.8, 0, 0, 0.6, 0, 0, 0, 0]),
  notes: [{ midi: 57, strength: 1 }, { midi: 60, strength: 0.8 }],
  chord: { rootPc: 9, id: 'min', confidence: 0.7 },
  key: { rootPc: 9, mode: 'minor', confidence: 0.5 },
  palette: { rootPc: 9, id: 'pent_min' },
  musical: true,
});

check("a frame survives the round trip", () => {
  const d = decodeRiffFrame(encodeRiffFrame(sampleState()));
  assert.equal(d.chord.rootPc, 9);
  assert.equal(d.chord.id, 'min');
  assert.equal(d.key.mode, 'minor');
  assert.equal(d.palette.id, 'pent_min');
  assert.equal(d.notes.length, 2);
  assert.equal(d.notes[0].midi, 57);
  assert.equal(d.notes[0].pc, 9, "pc is derived on arrival, not sent");
  assert.ok(d.musical);
  assert.ok(Math.abs(d.chroma[0] - 1) < 0.01);
  assert.ok(Math.abs(d.chroma[4] - 0.8) < 0.01);
});

check("a frame is small enough to send eight times a second", () => {
  const bytes = JSON.stringify({ t: 'RIFF', frame: encodeRiffFrame(sampleState()) }).length;
  assert.ok(bytes < 220, `frame is ${bytes} bytes`);
  console.log(`      (${bytes} bytes → ~${(bytes * 8 / 1000).toFixed(1)} kB/s per player)`);
});

// ⚠️ THIS IS A TRUST BOUNDARY. The sender is another player's browser and the
// server deliberately does not understand the payload. Anything that would
// crash a renderer — an out-of-range pitch class, a short chroma array, a note
// list of ten thousand — has to die here rather than on screen.
console.log("\nmalicious and malformed frames");
check("junk decodes to something safe rather than throwing", () => {
  for (const junk of [null, undefined, 42, 'hello', [], {}, { c: 'not an array' }]) {
    const d = decodeRiffFrame(junk);
    assert.equal(d.chroma.length, 12);
    assert.equal(d.notes.length, 0);
    assert.equal(d.chord, null);
  }
});

check("out-of-range values are clamped or dropped, never rendered", () => {
  const d = decodeRiffFrame({
    c: [999, -5, NaN, 'x', 1e9, 0, 0, 0, 0, 0, 0, 0],
    n: [[999, 300], [-1, 5], ['x', 'y'], [60, 128]],
    h: { r: 47, i: 'min' },
    k: { r: -3, m: 1 },
    p: { r: 99, i: 'x' },
  });
  for (const v of d.chroma) assert.ok(v >= 0 && v <= 1, `chroma out of range: ${v}`);
  for (const n of d.notes) assert.ok(n.midi >= 0 && n.midi <= 127, `midi out of range: ${n.midi}`);
  assert.equal(d.chord, null, "pitch class 47 is not a pitch class");
  assert.equal(d.key, null);
  assert.equal(d.palette, null);
});

check("an oversized note list is truncated, not honoured", () => {
  const n = Array.from({ length: 10000 }, () => [60, 255]);
  assert.ok(decodeRiffFrame({ n }).notes.length <= 6);
});

check("a hostile id string can't grow without bound", () => {
  const d = decodeRiffFrame({ h: { r: 0, i: 'x'.repeat(100000) } });
  assert.ok(d.chord.id.length <= 12, `id length ${d.chord.id.length}`);
});

// ── Part 2: the throttle that keeps players connected ───────────────────────
// ⚠️ THE SERVER CLOSES SOCKETS OVER 30 MESSAGES/SECOND. Offering at animation
// rate without coalescing would not degrade gracefully — it would disconnect
// the player mid-riff, and only under real use, since a local test with one
// client and no game traffic never reaches the bucket.
console.log("\nsend rate");
check("sixty offers a second become eight sends", () => {
  let sent = 0;
  const s = makeRiffSender(() => sent++, { hz: 8 });
  let t = 0;
  for (let i = 0; i < 60; i++) { s.offer(sampleState(), t); t += 16.7; }
  assert.ok(sent <= 9 && sent >= 7, `sent ${sent} frames in a second`);
});

check("the newest state wins — a throttled offer is coalesced, not dropped", () => {
  const seen = [];
  const s = makeRiffSender(f => seen.push(f.h?.r), { hz: 8 });
  s.offer({ ...sampleState(), chord: { rootPc: 1, id: 'min', confidence: 1 } }, 0);
  s.offer({ ...sampleState(), chord: { rootPc: 2, id: 'min', confidence: 1 } }, 10);
  s.offer({ ...sampleState(), chord: { rootPc: 3, id: 'min', confidence: 1 } }, 20);
  s.flush(200);
  assert.deepEqual(seen, [1, 3], "the last state before the gap must arrive");
});

check("staleness is what stops a closed laptop looking like a held note", () => {
  assert.equal(isStale(1000, 1100, 1200), false);
  assert.equal(isStale(1000, 5000, 1200), true);
  assert.equal(isStale(null, 1000, 1200), true);
  assert.equal(holdsFloor(3, 3), true);
  assert.equal(holdsFloor(3, 4), false);
  assert.equal(holdsFloor(null, null), false);
});

// ── Part 3: two real clients through the real server ────────────────────────
const server = spawn(process.execPath, ["index.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)),
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "inherit"],
});
await new Promise(r => server.stdout.once("data", r)); // "listening" line

try {
  console.log("\ntwo players in a room");
  const a = tab(), b = tab();
  await a.connect();
  a.createRoom("Alex");
  await a.waitFor("WELCOME");
  await b.connect();
  b.joinRoom(a.code, { name: "Friend" });
  await b.waitFor("WELCOME");
  await a.waitFor("ROOM_STATE", { where: f => f.seats.length === 2 });

  const linkA = makeEarSpyLink(a);
  const linkB = makeEarSpyLink(b);

  check("nobody holds the floor to begin with", () => {
    assert.equal(linkA.floorSeatId, null);
    assert.equal(linkA.holdsFloor, false);
  });

  // A takes the floor.
  linkA.claimFloor();
  await b.waitFor("FLOOR", { where: f => f.floorSeatId === a.seatId });
  await sleep(30);

  check("both ends agree who is playing", () => {
    assert.equal(linkA.holdsFloor, true, "A knows it has the floor");
    assert.equal(linkB.holdsFloor, false, "B knows it does not");
    assert.equal(linkB.floorSeatId, a.seatId);
  });

  // ⚠️ A LISTENER MUST BE SILENT ON THE WIRE. If everyone streamed at once the
  // relay cost would be seats², and two necks would light up at the same time —
  // the exact thing turn-taking exists to prevent.
  check("a player without the floor sends nothing", () => {
    assert.equal(linkB.offer(sampleState()), false);
  });

  // A plays; B should see it.
  const gotFrame = b.waitFor("RIFF", { where: f => f.seatId === a.seatId });
  linkA.offer(sampleState());
  await gotFrame;
  await sleep(30);

  check("B can see what A is playing", () => {
    const peer = linkB.peer();
    assert.ok(peer, "B has a peer on the floor");
    assert.equal(peer.seatId, a.seatId);
    assert.equal(peer.state.chord.rootPc, 9);
    assert.equal(peer.state.chord.id, 'min');
    assert.equal(peer.playing, true);
    assert.equal(peer.stale, false);
  });

  check("A does not receive an echo of its own analysis", () => {
    assert.equal(linkA.peers().length, 0, "the relay excludes the sender");
  });

  // Hand over.
  linkA.passFloor(b.seatId);
  await a.waitFor("FLOOR", { where: f => f.floorSeatId === b.seatId });
  await sleep(30);

  check("the floor passes and the roles swap", () => {
    assert.equal(linkB.holdsFloor, true);
    assert.equal(linkA.holdsFloor, false);
  });

  // ⚠️ A HAND-OVER MUST INVALIDATE THE OLD DISPLAY. The previous holder's last
  // frame is a note they have stopped playing; leaving it lit would show two
  // players at once and make the turn indicator a lie.
  check("the previous player's neck stops reading as live", () => {
    const stalePeers = linkB.peers().filter(p => p.playing);
    assert.equal(stalePeers.length, 0, "nobody but the floor-holder reads as playing");
  });

  const gotB = a.waitFor("RIFF", { where: f => f.seatId === b.seatId });
  linkB.offer({ ...sampleState(), chord: { rootPc: 4, id: 'maj', confidence: 0.9 } });
  await gotB;
  await sleep(30);
  check("and now A sees B", () => {
    assert.equal(linkA.peer().state.chord.rootPc, 4);
    assert.equal(linkA.peer().state.chord.id, 'maj');
  });

  // Contention.
  const claimRefused = a.waitFor("ERROR", { where: f => f.code === "FLOOR_TAKEN" });
  linkA.claimFloor();
  await claimRefused;
  check("you can't take the floor from under someone", () => { assert.ok(true); });

  linkB.releaseFloor();
  await a.waitFor("FLOOR", { where: f => f.floorSeatId === null });
  await sleep(30);
  check("releasing opens the floor for anyone", () => {
    assert.equal(linkA.floorSeatId, null);
    assert.equal(linkB.holdsFloor, false);
  });

  // ⚠️ A PLAYER WHO CLOSES THE TAB WHILE HOLDING THE FLOOR WOULD OTHERWISE LOCK
  // THE ROOM FOREVER: every later claim is refused by a seat that no longer
  // exists, and nothing else in the protocol clears it.
  linkA.claimFloor();
  await b.waitFor("FLOOR", { where: f => f.floorSeatId === a.seatId });
  const floorFreed = b.waitFor("FLOOR", { where: f => f.floorSeatId === null });
  a.close();
  await floorFreed;
  check("a disconnect releases the floor instead of stranding it", () => { assert.ok(true); });

  // And the room is usable again.
  linkB.claimFloor();
  await b.waitFor("FLOOR", { where: f => f.floorSeatId === b.seatId });
  check("the room still works after the drop-out", () => {
    assert.equal(linkB.holdsFloor, true);
  });

  linkA.dispose();
  linkB.dispose();
  b.close();
  console.log(`\nN13 ear spy smoke: ${pass} checks passed\n`);
} finally {
  server.kill();
}
