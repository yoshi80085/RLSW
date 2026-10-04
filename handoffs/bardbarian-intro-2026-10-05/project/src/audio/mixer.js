// ─── 🎚️ THE MIXER — three channels, one source of truth ──────────────────────
// Alex asked for volume control over the notes he plays and the music behind
// them (2026-09-14). Dialled in on the `.scratch/mixer-preview` page; the
// defaults below are the levels he landed on, by ear, against real amp notes.
//
// 📌 THE LEVELS ARE MULTIPLIERS, NOT ABSOLUTE VOLUMES. Every sound in the game
//    already carries its own mix level — the bed sits at 0.40, a battle song at
//    0.70, thunder at 0.85 — and those relative levels are a mix somebody chose.
//    A fader that overwrote them would flatten the game's dynamics into one
//    loudness the first time anybody touched it. So a channel SCALES what is
//    already there: `musicVol(0.7)` is a battle song at the player's music level.
//
// ⚠️ THERE IS NO MUTE. Alex's call: zero is mute (preview, "None — 0 is mute").
//    Do not add a mute flag later without also adding somewhere to remember the
//    level it was muted FROM — a mute that forgets your level is a worse control
//    than the fader it sits next to.
//
// ⚠️ WEBAUDIO AND <audio> ARE BOTH IN HERE ON PURPOSE. Notes and SFX are graph
//    nodes (a GainNode each, in ampVoice/riffSfx); music is a set of <audio>
//    elements with no graph at all. They cannot share a mechanism, so they share
//    a NUMBER instead, and this module is where that number lives.

const STORAGE_KEY = 'rlsw.mix.v1';

/** The dial-in. music 44 · notes 61 · sfx 54 — Alex, 2026-09-14. */
export const MIX_DEFAULTS = Object.freeze({ music: 0.44, notes: 0.61, sfx: 0.54 });

/** Channel order, labels and accents — the ☰ rows are built from this. */
export const MIX_CHANNELS = Object.freeze([
  Object.freeze({ id: 'music', icon: '🎵', label: 'Music', color: '#f6ad55',
    title: 'The background bed, the menu song and the battle & riff-off songs.' }),
  Object.freeze({ id: 'notes', icon: '🎸', label: 'Notes', color: '#4fd1c5',
    title: 'The guitar itself — every note and power chord through the amp.' }),
  Object.freeze({ id: 'sfx',   icon: '💥', label: 'SFX',   color: '#ff66aa',
    title: 'Misses, wrong notes, beam clashes, thunder and the crowd.' }),
]);

const CHANNEL_IDS = MIX_CHANNELS.map(c => c.id);

// ⚠️ `typeof`, NOT `Number(v)`. Number(null), Number('') and Number([]) are all
//    0 — so a null or an empty string in storage would read as a perfectly valid
//    "silence this channel" and the game would come up mute with no way to tell
//    why. Anything that is not already a finite number is rejected outright and
//    the caller falls back to the default.
function clamp01(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function load() {
  const out = { ...MIX_DEFAULTS };
  try {
    // ⚠️ Guarded, not assumed. localStorage throws outright in a private window
    // and in some embedded webviews, and this module is imported by the audio
    // chain — an exception here would take the whole game's sound with it.
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return out;
    const saved = JSON.parse(raw);
    for (const id of CHANNEL_IDS) {
      const v = clamp01(saved?.[id]);
      if (v !== null) out[id] = v;
    }
  } catch { /* defaults are a fine answer */ }
  return out;
}

let levels = load();
const listeners = new Set();

function save() {
  try { globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(levels)); }
  catch { /* a volume that does not persist still works this session */ }
}

/** All three levels, as a copy — callers must not mutate the live object. */
export function getMix() { return { ...levels }; }

/** One channel's level, 0..1. Unknown channel → 1, so a typo is silent, not mute. */
export function getLevel(channel) {
  return Object.prototype.hasOwnProperty.call(levels, channel) ? levels[channel] : 1;
}

/** Set one channel. No-ops on an unchanged value so subscribers don't churn. */
export function setLevel(channel, value) {
  if (!CHANNEL_IDS.includes(channel)) return;
  const v = clamp01(value);
  if (v === null || v === levels[channel]) return;
  levels = { ...levels, [channel]: v };
  save();
  for (const fn of Array.from(listeners)) {
    try { fn(getMix()); } catch { /* one bad subscriber must not deafen the rest */ }
  }
}

/** Put every channel back to the dialled-in defaults. */
export function resetMix() {
  for (const id of CHANNEL_IDS) setLevel(id, MIX_DEFAULTS[id]);
}

/** Subscribe to changes. Returns the unsubscribe. */
export function onMixChange(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ── The two helpers the rest of the game actually calls ────────────────────
   `base` is the sound's own mix level — the number that was already hardcoded
   at the call site. Keep passing it; the fader scales it. */
export function musicVol(base = 1) { return base * getLevel('music'); }
export function sfxVol(base = 1)   { return base * getLevel('sfx');   }
