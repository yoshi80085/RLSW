// =============================================================================
// music/pitchNames.js — canonical playback name for each pitch class.
//
// 🪦 THIS LIVED IN `riffLibrary.js` UNTIL 2026-08-17. That file held a 34-entry
// library of named tunes (Beethoven's Fifth, Ode to Joy, a dozen rock homages)
// which a committed melody was scanned against for Fame. The library was retired
// — see `engine/systems/melodyCommit.js` for the reasoning — and this constant
// was the one thing in it with nothing to do with riffs.
//
// ⚠️ IT MOVED RATHER THAN STAYING BEHIND IN A GUTTED FILE. `cadence.js` and the
// client both import it, and a `riffLibrary.js` that exports a single pitch-name
// array would read as a library that had lost its contents by accident.
// =============================================================================

// PITCH_INDEX convention, C = 0.
export const PC_PLAY_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
