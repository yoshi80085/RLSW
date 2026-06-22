// =============================================================================
// ui/GameOverOverlay.jsx  —  end-of-game victory screen
// Pure presentational component: all data arrives via props, no app imports.
// Extracted verbatim from the Game render (GAME OVER OVERLAY block).
// =============================================================================
import React from "react";

export function GameOverOverlay({
  winner,
  spirits,
  noteStates,
  limelightScores,
  onReturnToLobby,
  FAME_TO_WIN,
  LIMELIGHT_TO_WIN,
}) {
  if (!winner) return null;
  const w = spirits.find(s => s.id === winner);
  const isFameWin   = (noteStates[winner]?.fame ?? 0) >= FAME_TO_WIN;
  const isLimelight = !isFameWin && (limelightScores[winner] ?? 0) >= LIMELIGHT_TO_WIN;
  return (
    <div style={{
      position:"fixed",inset:0,background:"#000000dd",zIndex:9999,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,
    }}>
      <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:18,
        color: isFameWin ? "#ffd700" : isLimelight ? "#ff88ff" : "#ffcc00",
        letterSpacing:4,textTransform:"uppercase",
        textShadow: isFameWin ? "0 0 24px #ffd700, 0 0 48px #ffd70088"
                  : isLimelight ? "0 0 20px #ff44ff, 0 0 40px #ff44ff88" : "none"}}>
        {isFameWin ? "⭐ A LEGEND IS BORN ⭐" : isLimelight ? "✨ LIMELIGHT VICTORY ✨" : "GAME OVER"}
      </div>
      {w && (
        <>
          <div style={{fontSize:13,color:w.color,fontFamily:"'Orbitron',sans-serif",letterSpacing:2}}>
            {isFameWin ? "⭐" : isLimelight ? "🎤" : "🏆"} {w.name}
          </div>
          <div style={{fontSize:10,color:"#3a5a7a"}}>
            {isFameWin
              ? `reached ${FAME_TO_WIN} Fame Points — their name is written in lights forever!`
              : isLimelight
                ? `held the Limelight for ${LIMELIGHT_TO_WIN} turns and DOMINATED the stage!`
                : "is the last Spirit standing!"}
          </div>
        </>
      )}
      <button className="btn end" onClick={onReturnToLobby}
        style={{padding:"8px 20px",fontSize:11,marginTop:10}}>
        Return to Lobby
      </button>
    </div>
  );
}
