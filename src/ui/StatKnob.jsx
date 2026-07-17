// Read-only stat gauge styled like an amp knob (Drive / Sustain). Lights dots up to
// the base value; any in-flux modifier lights or docks extra dots depending on
// sign — `boost` is the SUM of every temporary modifier currently live on this
// stat (pattern-boost tempDrive/tempSustain, Dissonance Edge stage deltas, etc.),
// so callers should add their sources together before passing it in, not call
// this once per source. Positive = extra white dots + a white "+N". Negative =
// dots pulled back off the base value in red + a red "−N" — a stat actively
// worse than your chord alone right now (e.g. riding the Edge). Not draggable.
export function StatKnob({ label, value = 0, boost = 0, max = 10, color = "#ffcc44" }) {
  const baseFrac  = Math.max(0, Math.min(1, value / max));
  const totalFrac = Math.max(0, Math.min(1, (value + boost) / max));
  const isPenalty = boost < 0;
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const frac = i / 10;
    const tA = (-135 + frac * 270) * (Math.PI / 180);
    return {
      x: 19 + Math.sin(tA) * 16, y: 19 - Math.cos(tA) * 16,
      lit:     frac <= (isPenalty ? totalFrac : baseFrac) + 0.001,
      boosted: !isPenalty && boost > 0 && frac > baseFrac + 0.001 && frac <= totalFrac + 0.001,
      docked:  isPenalty && frac > totalFrac + 0.001 && frac <= baseFrac + 0.001,
    };
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:1, userSelect:"none" }}
         title={`${label}: ${value}${boost !== 0 ? ` (${boost > 0 ? "+" : ""}${boost})` : ""}`}>
      <div style={{ position:"relative", width:38, height:38 }}>
        {ticks.map((t, i) => (
          <div key={i} style={{ position:"absolute", left:t.x - 1.25, top:t.y - 1.25, width:2.5, height:2.5,
            borderRadius:"50%", opacity: t.docked ? 0.55 : 1,
            background: t.boosted ? "#ffffff" : t.docked ? "#ff3344" : t.lit ? color : "#22304a",
            boxShadow:  t.boosted ? "0 0 4px #ffffff" : t.docked ? "0 0 4px #ff334488" : t.lit ? `0 0 3px ${color}` : "none" }}/>
        ))}
        <div style={{ position:"absolute", left:4, top:4, width:30, height:30, borderRadius:"50%",
          background:"radial-gradient(circle at 35% 28%, #1a2236, #0a0e1a 72%)",
          border:`1.5px solid ${(isPenalty ? "#ff3344" : color)}55`, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:13, fontWeight:800, color, lineHeight:1, textShadow:`0 0 6px ${color}99` }}>
            {value}
            {boost > 0 && <span style={{ fontSize:8, color:"#ffffff", verticalAlign:"super" }}>+{boost}</span>}
            {boost < 0 && <span style={{ fontSize:8, color:"#ff5566", verticalAlign:"super" }}>{boost}</span>}
          </span>
        </div>
      </div>
      <span style={{ fontSize:6, color:"#7a90aa", letterSpacing:1, fontFamily:"'Saira Stencil One',sans-serif" }}>{label}</span>
    </div>
  );
}
