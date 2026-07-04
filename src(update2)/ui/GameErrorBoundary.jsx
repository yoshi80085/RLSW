import React from "react";
import glamarchy_mirror from "../standees/Glamarchy_mirror.png";
import cosmic_ronin_mirror from "../standees/Cosmic_Ronin_mirror.png";
import intergalactic_0_mirror from "../standees/Intergalactic_0_mirror.png";
import metalness_monster_mirror from "../standees/Metalness_Monster_mirror.png";

export function isMirrorFacing(facingAngleRad) {
  const a = ((facingAngleRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return a > Math.PI / 2 && a < (3 * Math.PI) / 2;
}

export const MIRROR_SPRITES = {
  "Glamarchy":         glamarchy_mirror,
  "cosmic_ronin":      cosmic_ronin_mirror,
  "intergalactic_0":   intergalactic_0_mirror,
  "Metalness_Monster": metalness_monster_mirror,
};

// ─── APP ──────────────────────────────────────────────────────────────────────
export const mobileColorStyle = {
  filter: "saturate(0.82) brightness(0.93) hue-rotate(-5deg)",
};

// 🛟 Catches any render-time crash in the live game so the screen shows the error
// (and a way out) instead of going black. The error text is the key to diagnosing it.
export class GameErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { this.setState({ info }); console.error("RLSW crashed:", error, info); }
  render() {
    if (this.state.error) {
      const box = { fontFamily: "monospace", color: "#ffb3b3", background: "#0a0e18", whiteSpace: "pre-wrap",
        fontSize: 11, lineHeight: 1.5, padding: 12, borderRadius: 8, border: "1px solid #5a1a1a",
        maxHeight: 240, overflow: "auto", margin: "10px 0" };
      const btn = { fontFamily: "'Orbitron',sans-serif", fontSize: 12, padding: "8px 16px", borderRadius: 6,
        border: "1px solid #44aaff", background: "#0a1830", color: "#aad4ff", cursor: "pointer", marginRight: 10 };
      return (
        <div style={{ minHeight: "100vh", background: "#050810", color: "#e2e8f0", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Share Tech Mono',monospace" }}>
          <div style={{ maxWidth: 760, width: "100%" }}>
            <h2 style={{ color: "#ff6688", margin: "0 0 6px" }}>🎸 The show hit a snag</h2>
            <p style={{ color: "#8aa", margin: "0 0 4px" }}>
              The game crashed mid-render. Copy or screenshot the message below — it tells us exactly what threw.
            </p>
            <div style={box}>{String(this.state.error && (this.state.error.stack || this.state.error.message || this.state.error))}</div>
            {this.state.info?.componentStack && (
              <div style={box}>{this.state.info.componentStack}</div>
            )}
            <div style={{ marginTop: 8 }}>
              <button style={btn} onClick={() => { this.setState({ error: null, info: null }); this.props.onReset?.(); }}>↩ Back to lobby</button>
              <button style={btn} onClick={() => window.location.reload()}>⟳ Reload</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
