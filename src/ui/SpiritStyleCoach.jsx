// 🪦 UNMOUNTED 2026-09-12 — THIS COMPONENT HAS NO CALLERS.
//
// The panel came out of the arena's step-2 column, where it and the discord
// reminder were 59px of a 111px overflow that was pushing the ✓ Commit button
// below the fold. What it taught, Pickles teaches: `fan_phrases` names this
// Spirit's shapes and `fan_phrases_again` nudges once after a line that lands
// none of them. `styleCoachFor` in `music/spiritStyle.js` is callerless with it.
//
// ⚠️ LEFT IN THE TREE DELIBERATELY, AND THAT IS A DECISION WITH A COST. A dead
// module cannot be wrong out loud — this repo lost half of every descending run
// to a bug in two detectors that sat callerless for weeks (`cadence.js`). If the
// live counts are not coming back, DELETE this file and its `ARCHITECTURE.md`
// row in one pass and run `test:arch`, which asserts that doc names every module.
// Do not leave it here indefinitely on the strength of this comment.
//
// 📌 `detectSpiritStyle` IS NOT AFFECTED. It still pays the fans at commit; only
// the presentation of the in-progress counts is gone.
//
// The live STATE of a Spirit's melody fan rule: which phrases it wants, and how
// far off you are. It reads the music module's coach data, never guesses at a
// pattern in presentation.
//
// 🪦 THE LESSON LINE CAME OUT, 2026-09-12. Every gesture printed a sentence of
// prose under it — "Climb or fall through adjacent letter names." — on every
// melody step of every turn, forever, in a 238px column. Alex: *"lets have this
// information something Pickles comes out and says once and maybe a short
// reminder later."*
// 🎯 THE SPLIT IS STATE VS TEACHING. "2 notes to go" changes every click and has
// to be on screen; what a phrase IS never changes and is Pickles' job. The
// `fan_phrases` tip is its one home now, and `fan_phrases_again` the single
// reminder — both in the monolith's BEGINNER_TIPS.
// ⚠️ `lesson` IS STILL ON THE COACH DATA and is still the only copy of that
// sentence — `spiritStyle.js` owns it and the tip points here rather than
// restating it. Do not delete it from the music module to "finish the job".
// ⚠️ AND `data-tip-anchor` IS NOT DECORATION: two Pickles pages aim at
// `fans-want`, and a missing anchor does not throw — `BeginnerTipOverlay`
// silently re-centres the card.
import React from 'react';
import { styleCoachFor } from '../music/spiritStyle.js';

export function SpiritStyleCoach({ spiritId, melodyLine, maxNotes = 8 }) {
  const gestures = styleCoachFor(spiritId, melodyLine, Math.max(0, maxNotes - melodyLine.length));
  if (!gestures.length) return null;

  return (
    <div data-tip-anchor="fans-want"
      style={{ marginBottom: 5, padding: '5px 7px', borderRadius: 4,
      background: '#0b1322', border: '1px solid #2a4966' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 7, letterSpacing: 1.2, color: '#8fb6d8' }}>🎤 YOUR FANS WANT</span>
        <span style={{ fontSize: 7, color: '#63829c' }}>commit phrases for fans</span>
      </div>
      {gestures.map(gesture => {
        const status = gesture.hits > 0
          ? `✓ ${gesture.hits} fan${gesture.hits === 1 ? '' : 's'} ready`
          : gesture.reachable
            ? (gesture.notesNeeded === 1 ? '1 note to go' : gesture.notesNeeded > 1 ? `${gesture.notesNeeded} notes to go` : 'start a phrase')
            : 'start a fresh phrase';
        return (
          <div key={gesture.id} style={{ paddingTop: 3, borderTop: '1px solid #27415b' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ fontSize: 8, color: gesture.accent, fontWeight: 700 }}>
                {gesture.label} <span style={{ color: '#d8e9fa' }}>{gesture.pattern}</span>
              </span>
              <span style={{ flexShrink: 0, fontSize: 7, color: gesture.hits ? '#76f5ba' : '#91aac2' }}>{status}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
