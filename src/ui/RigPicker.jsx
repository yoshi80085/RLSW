// =============================================================================
// ui/RigPicker.jsx — 🎛️ RIG PICKER — cycle through Spirit signature amp tones
// -----------------------------------------------------------------------------
// Extracted from RiffPractice so all practice modes share one rig selector.
// Displays a small button that cycles through the five Spirit tones; tapping
// auditions the new rig with an open-A power chord.
// =============================================================================
import React from "react";
import { TONE_KNOB_DEFAULTS, SPIRIT_TONES, playAmpPowerChord } from "../audio/ampVoice.js";
import { getRiffAudio } from "../audio/riffSfx.js";

export const RIG_ORDER = ['default', 'cosmic_ronin', 'intergalactic_0', 'Metalness_Monster', 'Glamarchy'];
export const RIG_LABEL = {
  default:           '🎛️ HOUSE',
  cosmic_ronin:      '⚔️ RONIN',
  intergalactic_0:   '🛸 IG-0',
  Metalness_Monster: '🤘 MONSTER',
  Glamarchy:         '👑 GLAM',
};
export const RIG_LS_KEY = 'rlsw.practice.rig';

export function loadRig() {
  try { const r = localStorage.getItem(RIG_LS_KEY); return RIG_ORDER.includes(r) ? r : 'default'; }
  catch { return 'default'; }
}

export function rigKnobs(rig) {
  return rig === 'default'
    ? TONE_KNOB_DEFAULTS
    : { ...TONE_KNOB_DEFAULTS, ...(SPIRIT_TONES[rig] ?? {}) };
}

export function playRigHit(freq, grade, rig) {
  const ctx = getRiffAudio(); if (!ctx || !freq) return;
  playAmpPowerChord(ctx, freq, grade, rigKnobs(rig));
}

export function RigPicker({ rig, onCycle, accent = '#19e6ff', style }) {
  return (
    <button onClick={onCycle} title="Amp rig — play through a Spirit's signature tone"
      style={{
        fontFamily: "'Saira Stencil One', sans-serif",
        fontSize: 10, letterSpacing: 1, cursor: 'pointer',
        padding: '6px 12px', borderRadius: 6,
        background: rig !== 'default' ? '#102030' : '#080f1e',
        border: `1px solid ${rig !== 'default' ? accent : '#1a2a40'}`,
        color: rig !== 'default' ? accent : '#3a5a7a',
        transition: 'all .2s',
        ...style,
      }}>
      {RIG_LABEL[rig] ?? rig}
    </button>
  );
}
