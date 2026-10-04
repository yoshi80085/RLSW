import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings, landingTime, introEnd, duration, turnStart, entranceDuration, seatState, cues, crossedCues, CHARACTERS } from './timeline.js';
import { stingDuration } from '../../src/audio/spiritSting.js';

let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
for (const players of [2, 3, 4]) {
  const s = { ...DEFAULTS, players }, waiting = introEnd(s) - .01;
  const initial = Array.from({ length: players }, (_, i) => seatState(i, waiting, s));
  check(initial.every(st => st.visible && st.fall === 0 && st.fans === 0 && !st.targetable), `${players}P: all land off-board before any turn or fan grant`);
  for (let i = 0; i < players; i++) {
    const start = turnStart(i, s), end = start + entranceDuration(CHARACTERS[i]);
    const riff = seatState(i, start, s);
    check(riff.phase === 'Playing entrance riff' && riff.progress === 0 && riff.fans === 0, 'the first turn plays the riff in the waiting space');
    check(Math.abs(riff.stepStart - start - stingDuration(CHARACTERS[i]) / 1000) < 1e-9, 'step waits for the production character sting to finish');
    const midway = seatState(i, riff.stepStart + .42, s);
    check(midway.progress > 0 && midway.progress < 1 && midway.fans === 0 && !midway.targetable, 'travel does not grant fans or expose a waiting Spirit to battle');
    const after = seatState(i, end + .001, s);
    check(after.entered && after.fans === 2 && after.targetable && after.progress === 1, 'arrival grants exactly two fans');
    const future = Array.from({ length: players - i - 1 }, (_, j) => seatState(i + j + 1, end, s));
    check(future.every(st => st.fans === 0 && !st.entered && !st.targetable), 'earlier entrances never activate later seats');
    check(seatState(i, duration(s) + 100, s).fans === 2, 'time after arrival never grants the two fans again');
    check(seatState(i, waiting, s).fans === 0, 'seeking backward restores the waiting state');
    check(seatState(i, landingTime(i, s) - .4, s).fall > 0, 'the standee is airborne before impact');
    check(seatState(i, landingTime(i, s) - .4, { ...s, reduced: true }).fall === 0, 'reduced motion removes the fall');
  }
  check(cues(s).filter(c => c.kind === 'riff').length === players, 'one riff cue per player');
  check(cues(s).filter(c => c.kind === 'step').length === players, 'one arrival cue per player');
  const at = turnStart(0, s);
  check(crossedCues(at - .001, at, s).filter(c => c.kind === 'riff').length === 1 && crossedCues(at, at + .001, s).length === 0, 'a frame boundary cannot repeat a cue');
  check(crossedCues(duration(s), 0, s).length === 0, 'replay/rewind never fires stale sounds');
}
const malformed = normalizeSettings({ players: 99, stagger: -2, storm: 'bad', camera: 'unknown', reduced: 'yes' });
check(malformed.players === 4 && malformed.stagger === .55 && malformed.storm === DEFAULTS.storm && malformed.camera === 'cinematic' && !malformed.reduced, 'persisted values are bounded and validated');
check(duration({ ...DEFAULTS, players: 2 }) < duration(DEFAULTS), 'two-player scenes do not wait for absent seats');
console.log(`Bardbarian opening: ${checks} checks passed (presentation rehearsal; live match rules are not ported).`);
