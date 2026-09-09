import './clientRenderShim.mjs';
import { JSDOM } from 'jsdom';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import assert from 'node:assert/strict';
import process from 'node:process';
import { Game } from '../rlsw-simulator-v3_8_1.jsx';
import { buildTestingGroundsConfig } from '../data/matchSetup.js';
import { spiritPatched } from './actions.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/' });
dom.window.Element.prototype.animate = () => ({ cancel() {}, finished: Promise.resolve() });
for (const name of ['document', 'HTMLElement', 'Element', 'Node', 'MutationObserver']) {
  Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeNetFixture() {
  const listeners = new Map();
  const sentActions = [];
  const client = {
    on(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
      return () => listeners.get(type)?.delete(listener);
    },
    emit(type, frame) {
      for (const listener of listeners.get(type) ?? []) listener(frame);
    },
    requestCatchUp() {},
    sendAction(action, cursorBefore) { sentActions.push({ action, cursorBefore }); },
    sendLogLine() {},
  };
  return {
    client, sentActions, spectator: false, seatId: 'blue-seat',
    mySpiritId: 'cosmic_ronin', isHost: false, seats: [],
  };
}

const config = buildTestingGroundsConfig({ beginnerMode: false });
config.seed = 4242;
config.spirits = config.spirits.map(spirit => ({ ...spirit, cpu: false }));
const net = makeNetFixture();
config.net = net;
const root = createRoot(document.getElementById('root'));

try {
  await act(async () => root.render(<Game gameState={config} onReturnToLobby={() => {}} />));
  const ronin = () => document.querySelector('[data-spirit-id="cosmic_ronin"]');
  const initialVibe = Number(ronin()?.dataset.vibe);
  assert.ok(initialVibe > 0, 'fixture mounts with Ronin’s live Vibe card');
  const actionsBeforeCatchUp = net.sentActions.length;

  await act(async () => net.client.emit('CATCH_UP', {
    log: [{ seq: 1, cursorBefore: 0, action: spiritPatched('cosmic_ronin', { vibe: 7 }) }],
  }));

  assert.equal(Number(ronin()?.dataset.vibe), 7,
    'CATCH_UP rebuilds the mounted client from the authoritative action log');
  assert.equal(net.sentActions.length, actionsBeforeCatchUp,
    'replaying a catch-up log never relays its historical actions back to the server');

  await act(async () => net.client.emit('net:close', {}));
  assert.ok(document.body.textContent.includes('CONNECTION LOST'),
    'a dropped local socket displays the reconnecting banner');
  await act(async () => net.client.emit('net:open', {}));
  assert.ok(!document.body.textContent.includes('CONNECTION LOST'),
    'a restored local socket clears the reconnecting banner');

  await act(async () => net.client.emit('ROOM_STATE', { seats: [
    { seatId: 'blue-seat', name: 'Alex', isBot: false, connected: true },
    { seatId: 'red-seat', name: 'Rival', isBot: false, connected: false },
  ] }));
  assert.ok(document.body.textContent.includes('Rival disconnected'),
    'a disconnected rival is surfaced through the room-presence banner');
  await act(async () => net.client.emit('ROOM_STATE', { seats: [
    { seatId: 'blue-seat', name: 'Alex', isBot: false, connected: true },
    { seatId: 'red-seat', name: 'Rival', isBot: false, connected: true },
  ] }));
  assert.ok(!document.body.textContent.includes('Rival disconnected'),
    'a reconnected rival clears the room-presence banner');
  console.log('PASS: mounted client replays CATCH_UP, local reconnect, and room presence without action echo');
} finally {
  await act(async () => root.unmount());
  dom.window.close();
}
process.exit(0);
