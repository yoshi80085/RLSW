// The live, player-facing explanation of a Spirit's melody fan rule. It reads
// the music module's coach data, never guesses at a pattern in presentation.
import React from 'react';
import { styleCoachFor } from '../music/spiritStyle.js';

export function SpiritStyleCoach({ spiritId, melodyLine, maxNotes = 8 }) {
  const gestures = styleCoachFor(spiritId, melodyLine, Math.max(0, maxNotes - melodyLine.length));
  if (!gestures.length) return null;

  return (
    <div style={{ marginBottom: 5, padding: '5px 7px', borderRadius: 4,
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
            <div style={{ marginTop: 1, fontSize: 7, lineHeight: 1.25, color: '#7892aa' }}>{gesture.lesson}</div>
          </div>
        );
      })}
    </div>
  );
}
