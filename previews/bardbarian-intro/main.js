import { DEFAULTS, normalizeSettings, smooth, introEnd, duration, landingTime, turnStart, entranceDuration, CHARACTERS, crossedCues } from './timeline.js';
import { createIntroScene } from './scene.js';
import { createIntroAudio } from './audio.js';

const $ = selector => document.querySelector(selector), STORE = 'rlsw.bardbarian-intro.v1';
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let settings = { ...DEFAULTS, reduced: preference.matches }, t = 2.8, playing = false, sound = false, ready = false, disposed = false, raf = 0;
try { const saved = JSON.parse(localStorage.getItem(STORE)); if (saved?.version === 1) settings = normalizeSettings(saved.settings); } catch { /* private storage still has copy */ }
if (preference.matches) settings.reduced = true;
const audio = createIntroAudio();
const dials = [
  ['godScale', 'Bardbarian scale', .65, 1.35, .01], ['presence', 'Outline presence', .15, 1, .01],
  ['detail', 'Contour isolation', .25, .85, .01],
  ['storm', 'Swirling storm', 0, 1.5, .05], ['stagger', 'Seconds between arrivals', .55, 1.8, .05],
  ['fallHeight', 'Crash height', 8, 30, 1], ['impact', 'Impact rings & fragments', .2, 1.7, .05],
  ['shake', 'Impact camera shake', 0, 1, .05], ['bloom', 'Light bloom', 0, 1.3, .05], ['exposure', 'Exposure', .7, 1.8, .05],
];
$('#dials').innerHTML = dials.map(([key, label, min, max, step]) => `<label class="dial"><span>${label}<output id="${key}-value"></output></span><input type="range" id="${key}" aria-label="${label}" min="${min}" max="${max}" step="${step}"></label>`).join('');
function snapshot() {
  return { version: 1, scene: 'Bardbarian / The opening act', settings: { ...settings }, defaults: DEFAULTS,
    changedFromDefault: Object.fromEntries(Object.entries(settings).filter(([key, value]) => value !== DEFAULTS[key])) };
}
function renderControls() {
  for (const [key] of dials) { $(`#${key}`).value = settings[key]; $(`#${key}-value`).value = settings[key].toFixed(key === 'fallHeight' ? 0 : 2); }
  $('#players').value = settings.players; $('#camera').value = settings.camera; $('#reduced').checked = settings.reduced;
  $('#timeline').max = duration(settings);
  try { localStorage.setItem(STORE, JSON.stringify(snapshot())); } catch { /* no storage required */ }
}
renderControls();
let scene;
function fail(message) {
  $('#error').hidden = false; $('#error').textContent = message;
  $('#loading').hidden = true; playing = false; ready = false; audio.stop();
  for (const id of ['play', 'replay', 'skip', 'next']) $(`#${id}`).disabled = true;
}
try {
  scene = createIntroScene($('#scene'), {
    onReady() {
      if (disposed || ready) return; ready = true; $('#loading').hidden = true;
      for (const id of ['play', 'replay', 'skip', 'next']) $(`#${id}`).disabled = false;
    }, onError: fail,
  });
} catch (e) { fail(`This preview needs WebGL. ${e.message}`); }

const names = ['Shredding Ronin', 'Metalness Monster', 'Intergalactic 0', 'Shredding Ronin'];
function seatMarkup() {
  $('#seats').innerHTML = names.slice(0, settings.players).map((name, i) => `<div class="seat" id="seat-${i}"><b>P${i + 1} · ${name}</b><span></span></div>`).join('');
  $('#labels').innerHTML = names.slice(0, settings.players).map((name, i) => `<div class="actor-label" id="label-${i}"><b>P${i + 1} · ${name}</b><span></span></div>`).join('');
}
seatMarkup();
const clock = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
function render() {
  if (!scene || disposed) return;
  const states = scene.frame(t, settings), end = introEnd(settings), total = duration(settings);
  $('#timeline').value = t; $('#time').value = `${clock(t)} / ${clock(total)}`;
  $('#play').textContent = playing ? 'Pause' : t >= total ? 'Play again' : t < .1 || t === 2.8 ? 'Play introduction' : 'Continue';
  $('#god-title').style.opacity = smooth((t - .2) / .6) * (1 - smooth((t - 1.3) / .9));
  let chapter, title, description;
  if (t < 3.8) { chapter = '01 / THE SUMMONING'; title = 'A storm. A god. A stage.'; description = 'The Bardbarian introduces the Spirits.'; }
  else if (t < end - 1) { chapter = '02 / THE ARRIVAL'; title = 'Spirits, descend.'; description = 'Each Spirit crashes into a waiting space beyond the board.'; }
  else if (t < end) { chapter = '03 / BEFORE THE FIRST NOTE'; title = 'Every entrance has its moment.'; description = 'No fans yet. Each Spirit waits for its own first turn.'; }
  else {
    const active = states.findIndex(st => !st.entered);
    if (active < 0) { chapter = 'THE STAGE IS YOURS'; title = 'Four strings of fate. One arena.'; if (settings.players !== 4) title = 'The Spirits have arrived.'; description = 'Every Spirit has entered on its own turn and welcomed two fans.'; }
    else { chapter = `04 / PLAYER ${active + 1} · FIRST TURN`; title = `${names[active]}. Your stage.`; description = states[active].phase === 'Stepping in' ? 'The riff lands. One step onto the starting hex.' : 'Their signature riff calls the first two fans.'; }
  }
  $('#chapter').textContent = chapter; $('#headline').textContent = title; $('#description').textContent = description;
  states.forEach((st, i) => {
    const seat = $(`#seat-${i}`), label = $(`#label-${i}`);
    seat.style.setProperty('--seat', st.color); seat.querySelector('span').textContent = `${st.phase} · ${st.fans} fans`;
    label.style.left = `${st.x}px`; label.style.top = `${st.y}px`; label.style.color = st.color;
    label.style.opacity = st.visible && st.fall < .1 && t > landingTime(i, settings) + .4 ? '.95' : '0';
    label.querySelector('span').textContent = st.entered ? 'ON STAGE · 2 FANS' : t >= st.start ? 'FIRST TURN' : 'WAITING · 0 FANS';
  });
  $('#next').disabled = !ready || states.every(st => st.entered);
}
function seek(next, resume = false) {
  audio.stop(); t = Math.max(0, Math.min(duration(settings), next)); playing = resume && ready;
  render();
}
async function resume() {
  if (!ready) return;
  if (sound) { try { if (!await audio.enable()) sound = false; } catch { sound = false; } syncSound(); }
  playing = true;
}
function syncSound() { $('#sound').textContent = sound ? 'Sound on' : 'Sound off'; $('#sound').setAttribute('aria-pressed', String(sound)); }
$('#play').onclick = async () => {
  if (playing) { playing = false; await audio.pause(); render(); return; }
  if (t === 2.8 || t >= duration(settings)) seek(0);
  await resume();
};
$('#replay').onclick = async () => { seek(0); await resume(); };
$('#skip').onclick = async () => { seek(introEnd(settings) - .01); await resume(); };
$('#sound').onclick = async () => {
  if (sound) { sound = false; await audio.pause(); }
  else { try { sound = await audio.enable(); } catch { sound = false; } }
  syncSound();
};
$('#timeline').oninput = e => { seek(Number(e.target.value)); };
$('#next').onclick = async () => {
  const next = Array.from({ length: settings.players }, (_, i) => i).find(i => t < turnStart(i, settings) + entranceDuration(CHARACTERS[i]));
  if (next !== undefined) { seek(turnStart(next, settings) - .01); await resume(); }
};
document.querySelectorAll('[data-cue]').forEach(button => { button.onclick = () => {
  const points = { god: 2.8, landing: landingTime(0, settings) + .12, waiting: introEnd(settings) - .1,
    turn: introEnd(settings) + .65, final: duration(settings) };
  seek(points[button.dataset.cue]);
}; });
for (const [key] of dials) $(`#${key}`).oninput = e => {
  settings[key] = Number(e.target.value); renderControls();
  if (key === 'stagger') seek(Math.min(t, duration(settings)));
  else render();
};
$('#players').onchange = e => { settings.players = Number(e.target.value); renderControls(); seatMarkup(); scene?.setSeats(settings.players); seek(2.8); };
$('#camera').onchange = e => { settings.camera = e.target.value; renderControls(); render(); };
$('#reduced').onchange = e => { settings.reduced = e.target.checked; renderControls(); render(); };
const motionChange = e => { settings.reduced = e.matches; renderControls(); render(); };
preference.addEventListener('change', motionChange);
$('#reset').onclick = () => { settings = { ...DEFAULTS, reduced: preference.matches }; renderControls(); seatMarkup(); scene?.setSeats(settings.players); seek(2.8); };
$('#copy').onclick = async () => {
  const text = JSON.stringify(snapshot(), null, 2); $('#export').hidden = false; $('#export').value = text; $('#export').select();
  try { await navigator.clipboard.writeText(text); $('#copy-status').textContent = 'Copied. Paste this dial-in into the chat.'; }
  catch { $('#copy-status').textContent = 'Select and copy the settings above.'; }
};
$('#tune').onclick = () => {
  const hidden = document.body.classList.toggle('clean'); $('#tune').textContent = hidden ? 'Show controls' : 'Hide controls'; $('#tune').setAttribute('aria-expanded', String(!hidden));
};
const visibility = () => { if (document.hidden) { playing = false; audio.pause(); } };
document.addEventListener('visibilitychange', visibility);
let last = performance.now();
function frame(now) {
  if (disposed) return; raf = requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (document.hidden || !scene) return;
  try {
    if (playing && ready) {
      const before = t; t = Math.min(duration(settings), t + dt);
      if (sound) crossedCues(before, t, settings).forEach(c => audio.cue(c));
      if (t >= duration(settings)) playing = false;
    }
    render();
  } catch (e) { fail(`The scene stopped: ${e.message}`); cancelAnimationFrame(raf); }
}
raf = requestAnimationFrame(frame);
function dispose() {
  if (disposed) return; disposed = true; cancelAnimationFrame(raf); audio.dispose(); scene?.dispose();
  document.removeEventListener('visibilitychange', visibility); preference.removeEventListener('change', motionChange);
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);
