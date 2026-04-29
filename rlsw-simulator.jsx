import { useState, useCallback, useMemo } from "react";

// ─── HEX GRID MATH ───────────────────────────────────────────────────────────
// Flat-top hexagons, axial coordinates
const HEX_SIZE = 28; // px radius
const HEX_W = HEX_SIZE * 2;
const HEX_H = Math.sqrt(3) * HEX_SIZE;

function hexToPixel(q, r) {
  const x = HEX_SIZE * (3 / 2) * q;
  const y = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return { x, y };
}

function hexCorners(cx, cy) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    corners.push([cx + HEX_SIZE * Math.cos(angle), cy + HEX_SIZE * Math.sin(angle)]);
  }
  return corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function hexNeighbors(q, r) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
  return dirs.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

function hexDistance(q1, r1, q2, r2) {
  return (Math.abs(q1-q2) + Math.abs(q1+r1-q2-r2) + Math.abs(r1-r2)) / 2;
}

// ─── BUILD OCTAGONAL 68-HEX GRID ─────────────────────────────────────────────
function buildGrid() {
  const hexes = [];
  // Octagonal shape: radius 5 with corners cut
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      const s = -q - r;
      const dist = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (dist <= 5) {
        // Cut corners (diagonal cut at distance > 4 on two axes)
        const cornerCut = (Math.abs(q) >= 4 && Math.abs(r) >= 4) ||
                          (Math.abs(q) >= 4 && Math.abs(s) >= 4) ||
                          (Math.abs(r) >= 4 && Math.abs(s) >= 4);
        if (!cornerCut) {
          hexes.push({ q, r, id: `${q},${r}` });
        }
      }
    }
  }
  return hexes;
}

const GRID_HEXES = buildGrid();

// ─── SPIRITS DATA ────────────────────────────────────────────────────────────
const SPIRIT_STYLES = {
  Shred:  { color: "#e53e3e", label: "Shred",  icon: "⚡" },
  Groove: { color: "#3182ce", label: "Groove", icon: "🔵" },
  Flair:  { color: "#38a169", label: "Flair",  icon: "✨" },
  Synth:  { color: "#805ad5", label: "Synth",  icon: "🔮" },
};

const INITIAL_SPIRITS = [
  {
    id: "cosmic-ronin",
    name: "Cosmic Ronin",
    style: "Shred",
    vibe: 18, maxVibe: 18,
    speed: 3,
    beats: 3, maxBeats: 3,
    sustain: 0, maxSustain: 6,
    riff: 3, power: 5,
    feedback: false,
    q: -3, r: 0,
    tempoPos: 0,
    color: "#e53e3e",
    brokeMove: "The Hydra",
  },
  {
    id: "intergalactic-0",
    name: "Intergalactic 0",
    style: "Synth",
    vibe: 16, maxVibe: 16,
    speed: 4,
    beats: 4, maxBeats: 4,
    sustain: 0, maxSustain: 6,
    riff: 2, power: 4,
    feedback: false,
    q: 3, r: 0,
    tempoPos: 0,
    color: "#805ad5",
    brokeMove: "Mech Override",
  },
  {
    id: "metal-titan",
    name: "Metal Titan",
    style: "Groove",
    vibe: 24, maxVibe: 24,
    speed: 3,
    beats: 3, maxBeats: 3,
    sustain: 0, maxSustain: 6,
    riff: 2, power: 6,
    feedback: false,
    q: 0, r: -3,
    tempoPos: 0,
    color: "#3182ce",
    brokeMove: "Tectonic Slam",
  },
  {
    id: "flamboyant-g",
    name: "Flamboyant G",
    style: "Flair",
    vibe: 14, maxVibe: 14,
    speed: 4,
    beats: 4, maxBeats: 4,
    sustain: 0, maxSustain: 6,
    riff: 2, power: 3,
    feedback: false,
    q: 0, r: 3,
    tempoPos: 0,
    color: "#38a169",
    brokeMove: "Spotlight Nova",
  },
];

// ─── AMP POSITIONS (pre-placed) ───────────────────────────────────────────────
const INITIAL_AMPS = [
  { id: "amp-1", q: -2, r: -2, pluggedIn: null, overloaded: false },
  { id: "amp-2", q:  2, r: -2, pluggedIn: null, overloaded: false },
  { id: "amp-3", q:  2, r:  2, pluggedIn: null, overloaded: false },
  { id: "amp-4", q: -2, r:  2, pluggedIn: null, overloaded: false },
  { id: "amp-5", q:  0, r:  0, pluggedIn: null, overloaded: false },
];

// ─── RESIDUE TYPES ────────────────────────────────────────────────────────────
const RESIDUE_COLORS = {
  Shatter: "#fc8181",
  Surge:   "#90cdf4",
  Burn:    "#fbd38d",
  Echo:    "#b794f4",
};

// ─── TEMPO TRACK ─────────────────────────────────────────────────────────────
const TEMPO_TRACK_LENGTH = 20;

export default function RLSWSimulator() {
  const [spirits, setSpirits] = useState(INITIAL_SPIRITS);
  const [amps, setAmps] = useState(INITIAL_AMPS);
  const [residues, setResidues] = useState([]);
  const [activeSpirit, setActiveSpirit] = useState("cosmic-ronin");
  const [selectedAction, setSelectedAction] = useState(null);
  const [hoveredHex, setHoveredHex] = useState(null);
  const [log, setLog] = useState(["⚡ Rock Legends: Spirit Wars", "🎸 Game initialized. Cosmic Ronin acts first."]);
  const [phase, setPhase] = useState("action"); // action | targeting

  const addLog = useCallback((msg) => {
    setLog(prev => [msg, ...prev].slice(0, 20));
  }, []);

  // Current acting spirit (furthest back on tempo track)
  const actingSpirit = useMemo(() => {
    return [...spirits].sort((a, b) => a.tempoPos - b.tempoPos)[0];
  }, [spirits]);

  // Map hex ids to spirits / amps
  const spiritByHex = useMemo(() => {
    const map = {};
    spirits.forEach(s => { map[`${s.q},${s.r}`] = s; });
    return map;
  }, [spirits]);

  const ampByHex = useMemo(() => {
    const map = {};
    amps.forEach(a => { map[`${a.q},${a.r}`] = a; });
    return map;
  }, [amps]);

  const residueByHex = useMemo(() => {
    const map = {};
    residues.forEach(r => { map[`${r.q},${r.r}`] = r; });
    return map;
  }, [residues]);

  // ─── ACTIONS ───────────────────────────────────────────────────────────────
  function spendBeats(spiritId, amount, label) {
    setSpirits(prev => prev.map(s => {
      if (s.id !== spiritId) return s;
      const newBeats = s.beats - amount;
      if (newBeats < 0) { addLog("❌ Not enough Beats!"); return s; }
      const newSustain = Math.min(s.maxSustain, s.sustain + amount);
      addLog(`🎵 ${s.name}: ${label} (−${amount} Beats)`);
      return { ...s, beats: newBeats, sustain: newSustain };
    }));
  }

  function moveSpirit(spiritId, toQ, toR) {
    const spirit = spirits.find(s => s.id === spiritId);
    if (!spirit) return;
    const dist = hexDistance(spirit.q, spirit.r, toQ, toR);
    const cost = dist; // 1 beat per hex
    if (spirit.beats < cost) { addLog("❌ Not enough Beats to move!"); return; }
    if (spiritByHex[`${toQ},${toR}`]) { addLog("❌ Hex occupied!"); return; }
    setSpirits(prev => prev.map(s => {
      if (s.id !== spiritId) return s;
      const newBeats = s.beats - cost;
      const newSustain = Math.min(s.maxSustain, s.sustain + cost);
      addLog(`🚶 ${s.name} moved (−${cost} Beat${cost !== 1 ? "s" : ""})`);
      return { ...s, q: toQ, r: toR, beats: newBeats, sustain: newSustain };
    }));
    setSelectedAction(null);
    setPhase("action");
  }

  function attackSpirit(attackerId, targetId, type) {
    const attacker = spirits.find(s => s.id === attackerId);
    const target = spirits.find(s => s.id === targetId);
    if (!attacker || !target) return;
    const cost = type === "power" ? 3 : 2;
    if (attacker.beats < cost) { addLog("❌ Not enough Beats!"); return; }
    const dmg = type === "power" ? attacker.power : attacker.riff;
    const shielded = target.feedback ? Math.max(0, dmg - 1) : dmg;
    setSpirits(prev => prev.map(s => {
      if (s.id === attackerId) {
        const newSustain = Math.min(s.maxSustain, s.sustain + cost);
        return { ...s, beats: s.beats - cost, sustain: newSustain };
      }
      if (s.id === targetId) {
        const newVibe = Math.max(0, s.vibe - shielded);
        const newFeedback = target.feedback ? false : s.feedback;
        addLog(`⚔️ ${attacker.name} hits ${target.name} for ${shielded} Vibe! ${target.feedback ? "(Shield blocked 1)" : ""}`);
        return { ...s, vibe: newVibe, feedback: newFeedback };
      }
      return s;
    }));
    setSelectedAction(null);
    setPhase("action");
  }

  function placeFeedback(spiritId) {
    const spirit = spirits.find(s => s.id === spiritId);
    if (!spirit) return;
    if (spirit.beats < 1) { addLog("❌ Not enough Beats!"); return; }
    setSpirits(prev => prev.map(s => {
      if (s.id !== spiritId) return s;
      addLog(`🛡️ ${s.name} raised Feedback!`);
      return { ...s, feedback: true, beats: s.beats - 1, sustain: Math.min(s.maxSustain, s.sustain + 1) };
    }));
  }

  function endTurn(spiritId) {
    setSpirits(prev => prev.map(s => {
      if (s.id !== spiritId) return s;
      const restCost = s.beats > 0 ? 1 : 0; // unspent beats cost 1 to rest
      const newTempoPos = s.tempoPos + s.maxBeats + restCost;
      addLog(`⏭️ ${s.name} ends turn. Tempo advances +${s.maxBeats + restCost}`);
      return {
        ...s,
        beats: s.maxBeats,
        tempoPos: newTempoPos,
      };
    }));
    setSelectedAction(null);
    setPhase("action");
  }

  function useBrokeMove(spiritId) {
    const spirit = spirits.find(s => s.id === spiritId);
    if (!spirit) return;
    if (spirit.sustain < spirit.maxSustain) { addLog("❌ Sustain not full!"); return; }
    if (spirit.beats < 6) { addLog("❌ Broke Move costs 6 Beats!"); return; }
    addLog(`💥 ${spirit.name} unleashes ${spirit.brokeMove}!!!`);
    setSpirits(prev => prev.map(s => {
      if (s.id !== spiritId) return s;
      return { ...s, beats: s.beats - 6, sustain: 0 };
    }));
    // Add residue around spirit
    const newRes = hexNeighbors(spirit.q, spirit.r)
      .filter(n => GRID_HEXES.find(h => h.q === n.q && h.r === n.r))
      .map(n => ({
        q: n.q, r: n.r,
        type: spirit.style === "Shred" ? "Shatter" :
              spirit.style === "Synth"  ? "Surge"   :
              spirit.style === "Groove" ? "Burn"    : "Echo"
      }));
    setResidues(prev => {
      const filtered = prev.filter(r => !newRes.find(nr => nr.q === r.q && nr.r === r.r));
      return [...filtered, ...newRes];
    });
  }

  // ─── COMPUTE SVG BOUNDS ───────────────────────────────────────────────────
  const { minX, minY, maxX, maxY } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    GRID_HEXES.forEach(({ q, r }) => {
      const { x, y } = hexToPixel(q, r);
      minX = Math.min(minX, x - HEX_SIZE);
      minY = Math.min(minY, y - HEX_SIZE);
      maxX = Math.max(maxX, x + HEX_SIZE);
      maxY = Math.max(maxY, y + HEX_SIZE);
    });
    return { minX, minY, maxX, maxY };
  }, []);

  const vw = maxX - minX + 20;
  const vh = maxY - minY + 20;
  const ox = -minX + 10;
  const oy = -minY + 10;

  // ─── HEX COLORING ────────────────────────────────────────────────────────
  function hexFill(hex) {
    const key = `${hex.q},${hex.r}`;
    if (ampByHex[key]) return "#2d3748";
    if (residueByHex[key]) return RESIDUE_COLORS[residueByHex[key].type] + "55";
    if (hoveredHex === key && selectedAction === "move") return "#4a5568";
    return "#1a202c";
  }

  function hexStroke(hex) {
    const key = `${hex.q},${hex.r}`;
    if (residueByHex[key]) return RESIDUE_COLORS[residueByHex[key].type];
    if (ampByHex[key]) return "#f6ad55";
    if (spiritByHex[key]) return spiritByHex[key].color;
    return "#4a5568";
  }

  const acting = actingSpirit;

  // ─── TEMPO TRACK SORTED SPIRITS ──────────────────────────────────────────
  const sortedByTempo = [...spirits].sort((a, b) => a.tempoPos - b.tempoPos);
  const minTempo = sortedByTempo[0]?.tempoPos ?? 0;
  const maxTempo = (sortedByTempo[sortedByTempo.length - 1]?.tempoPos ?? 0) + TEMPO_TRACK_LENGTH;

  return (
    <div style={{
      fontFamily: "'Share Tech Mono', 'Courier New', monospace",
      background: "#0a0e1a",
      color: "#e2e8f0",
      minHeight: "100vh",
      padding: "12px",
      boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #1a202c; }
        ::-webkit-scrollbar-thumb { background: #4a5568; border-radius: 2px; }
        .hex-cell { cursor: pointer; transition: opacity 0.1s; }
        .hex-cell:hover polygon { opacity: 0.85; }
        .beat-pip { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 1px; }
        .action-btn { background: #1a202c; border: 1px solid #4a5568; color: #e2e8f0;
          padding: 5px 10px; border-radius: 4px; cursor: pointer; font-family: inherit;
          font-size: 11px; transition: background 0.15s; }
        .action-btn:hover { background: #2d3748; }
        .action-btn.active { background: #2b4a7a; border-color: #63b3ed; }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .section-title { font-family: 'Orbitron', sans-serif; font-size: 10px;
          color: #718096; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
        .spirit-card { background: #13192b; border-radius: 6px; padding: 8px 10px;
          border: 1px solid #2d3748; margin-bottom: 6px; cursor: pointer; transition: border-color 0.15s; }
        .spirit-card.acting { border-color: #f6ad55; }
        .spirit-card.selected { border-color: #63b3ed; }
        .bar-bg { background: #2d3748; border-radius: 2px; height: 6px; }
        .bar-fill { height: 6px; border-radius: 2px; transition: width 0.3s; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #2d3748" }}>
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, color: "#f6ad55", letterSpacing: 3 }}>
          ⚡ RLSW
        </div>
        <div style={{ fontSize: 11, color: "#718096" }}>Rock Legends: Spirit Wars — Simulator v0.2</div>
        <div style={{ marginLeft: "auto", fontSize: 11, padding: "3px 10px", background: "#1a202c",
          border: "1px solid #f6ad55", borderRadius: 12, color: "#f6ad55" }}>
          ACTING: {acting?.name}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 220px", gap: 10, alignItems: "start" }}>

        {/* ── LEFT PANEL: SPIRITS ── */}
        <div>
          <div className="section-title">Spirits</div>
          {spirits.map(s => {
            const isActing = s.id === acting?.id;
            return (
              <div key={s.id}
                className={`spirit-card ${isActing ? "acting" : ""} ${activeSpirit === s.id ? "selected" : ""}`}
                onClick={() => setActiveSpirit(s.id)}
                style={{ borderLeft: `3px solid ${s.color}` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.name}</span>
                  {isActing && <span style={{ fontSize: 9, color: "#f6ad55" }}>▶ ACTING</span>}
                </div>
                {/* Vibe bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: "#718096", width: 30 }}>VIBE</span>
                  <div className="bar-bg" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{ width: `${(s.vibe / s.maxVibe) * 100}%`, background: s.vibe > s.maxVibe * 0.4 ? "#68d391" : "#fc8181" }} />
                  </div>
                  <span style={{ fontSize: 9, minWidth: 20, textAlign: "right" }}>{s.vibe}</span>
                </div>
                {/* Sustain bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                  <span style={{ fontSize: 9, color: "#718096", width: 30 }}>SUST</span>
                  <div className="bar-bg" style={{ flex: 1 }}>
                    <div className="bar-fill" style={{ width: `${(s.sustain / s.maxSustain) * 100}%`, background: s.sustain >= s.maxSustain ? "#f6ad55" : "#b794f4" }} />
                  </div>
                  <span style={{ fontSize: 9, minWidth: 20, textAlign: "right" }}>{s.sustain}/{s.maxSustain}</span>
                </div>
                {/* Beat pips */}
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "#718096", marginRight: 3 }}>BEATS</span>
                  {Array.from({ length: s.maxBeats }).map((_, i) => (
                    <span key={i} className="beat-pip"
                      style={{ background: i < s.beats ? "#63b3ed" : "#2d3748", border: "1px solid #4a5568" }} />
                  ))}
                  {s.feedback && <span style={{ fontSize: 9, marginLeft: 4, color: "#90cdf4" }}>🛡</span>}
                </div>
              </div>
            );
          })}

          {/* Actions Panel */}
          <div className="section-title" style={{ marginTop: 14 }}>Actions — {spirits.find(s => s.id === acting?.id)?.beats ?? 0} Beats left</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button className={`action-btn ${selectedAction === "move" ? "active" : ""}`}
              onClick={() => { setSelectedAction(s => s === "move" ? null : "move"); setPhase("targeting"); }}
              disabled={acting?.beats < 1}>
              Move (1/hex)
            </button>
            <button className="action-btn"
              onClick={() => placeFeedback(acting?.id)}
              disabled={acting?.beats < 1 || acting?.feedback}>
              Feedback −1
            </button>
            <button className={`action-btn ${selectedAction === "riff" ? "active" : ""}`}
              onClick={() => { setSelectedAction(s => s === "riff" ? null : "riff"); setPhase("targeting"); }}
              disabled={acting?.beats < 2}>
              Riff −2
            </button>
            <button className={`action-btn ${selectedAction === "power" ? "active" : ""}`}
              onClick={() => { setSelectedAction(s => s === "power" ? null : "power"); setPhase("targeting"); }}
              disabled={acting?.beats < 3}>
              Power −3
            </button>
            <button className="action-btn"
              style={{ background: acting?.sustain >= acting?.maxSustain && acting?.beats >= 6 ? "#7c3aed" : undefined, borderColor: acting?.sustain >= acting?.maxSustain && acting?.beats >= 6 ? "#a78bfa" : undefined }}
              onClick={() => useBrokeMove(acting?.id)}
              disabled={acting?.sustain < acting?.maxSustain || acting?.beats < 6}>
              💥 Broke Move −6
            </button>
            <button className="action-btn"
              style={{ color: "#f6ad55", borderColor: "#f6ad55" }}
              onClick={() => endTurn(acting?.id)}>
              End Turn ⏭
            </button>
          </div>
          {selectedAction && (
            <div style={{ marginTop: 8, fontSize: 10, color: "#f6ad55", padding: "4px 6px", background: "#1a202c", borderRadius: 4, border: "1px solid #744210" }}>
              {selectedAction === "move" ? "Click a hex to move" : `Click a spirit to ${selectedAction}`}
            </div>
          )}
        </div>

        {/* ── CENTER: BOARD ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="section-title">Arena</div>
          <svg
            width="100%"
            viewBox={`0 0 ${vw} ${vh}`}
            style={{ maxWidth: 520, background: "#0d1117", borderRadius: 8, border: "1px solid #2d3748" }}
          >
            {/* Grid hexes */}
            {GRID_HEXES.map(hex => {
              const { x, y } = hexToPixel(hex.q, hex.r);
              const cx = x + ox;
              const cy = y + oy;
              const key = `${hex.q},${hex.r}`;
              const spirit = spiritByHex[key];
              const amp = ampByHex[key];
              const residue = residueByHex[key];

              return (
                <g key={key} className="hex-cell"
                  onClick={() => {
                    if (selectedAction === "move") {
                      moveSpirit(acting?.id, hex.q, hex.r);
                    } else if (selectedAction === "riff" || selectedAction === "power") {
                      if (spirit && spirit.id !== acting?.id) {
                        attackSpirit(acting?.id, spirit.id, selectedAction);
                      }
                    }
                  }}
                  onMouseEnter={() => setHoveredHex(key)}
                  onMouseLeave={() => setHoveredHex(null)}
                >
                  <polygon
                    points={hexCorners(cx, cy)}
                    fill={hexFill(hex)}
                    stroke={hexStroke(hex)}
                    strokeWidth={spirit || amp ? 1.5 : 0.5}
                  />
                  {/* Residue label */}
                  {residue && !spirit && !amp && (
                    <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fill={RESIDUE_COLORS[residue.type]} opacity="0.9">
                      {residue.type.slice(0, 3).toUpperCase()}
                    </text>
                  )}
                  {/* Amp icon */}
                  {amp && !spirit && (
                    <>
                      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="13" fill="#f6ad55">♦</text>
                      <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7" fill="#f6ad55">AMP</text>
                    </>
                  )}
                  {/* Spirit */}
                  {spirit && (
                    <>
                      <circle cx={cx} cy={cy} r={HEX_SIZE * 0.52}
                        fill={spirit.color + "33"} stroke={spirit.color} strokeWidth={acting?.id === spirit.id ? 2 : 1} />
                      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fill={spirit.color} fontWeight="bold">
                        {spirit.name.split(" ").map(w => w[0]).join("")}
                      </text>
                      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8" fill="#a0aec0">
                        {spirit.vibe}hp
                      </text>
                    </>
                  )}
                  {/* Coord debug on hover */}
                  {hoveredHex === key && !spirit && !amp && (
                    <text x={cx} y={cy + 4} textAnchor="middle" fontSize="7" fill="#718096">
                      {hex.q},{hex.r}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Legend */}
          <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 10, color: "#718096" }}>
            <span>♦ Amp</span>
            {Object.entries(RESIDUE_COLORS).map(([k, v]) => (
              <span key={k} style={{ color: v }}>■ {k}</span>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div>
          {/* Tempo Track */}
          <div className="section-title">Tempo Track</div>
          <div style={{ background: "#13192b", borderRadius: 6, padding: 10, border: "1px solid #2d3748", marginBottom: 10 }}>
            <div style={{ position: "relative", height: `${spirits.length * 28 + 10}px`, background: "#0d1117", borderRadius: 4, overflow: "hidden" }}>
              {/* Track lines */}
              {Array.from({ length: 5 }).map((_, i) => {
                const frac = i / 4;
                const trackLen = maxTempo - minTempo || 1;
                const pos = (frac * trackLen / trackLen) * 100;
                return (
                  <div key={i} style={{ position: "absolute", left: `${pos}%`, top: 0, bottom: 0, width: 1, background: "#2d3748" }} />
                );
              })}
              {sortedByTempo.map((s, i) => {
                const trackLen = maxTempo - minTempo || 1;
                const frac = (s.tempoPos - minTempo) / trackLen;
                return (
                  <div key={s.id} style={{
                    position: "absolute",
                    left: `${Math.max(0, Math.min(95, frac * 95))}%`,
                    top: i * 28 + 5,
                    transition: "left 0.4s ease",
                  }}>
                    <div style={{
                      background: s.color,
                      borderRadius: 3,
                      padding: "2px 5px",
                      fontSize: 9,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      border: s.id === acting?.id ? "1px solid #f6ad55" : "none",
                    }}>
                      {s.name.split(" ")[0]}
                    </div>
                    <div style={{ fontSize: 8, color: "#718096", paddingLeft: 2 }}>t={s.tempoPos}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 9, color: "#718096", marginTop: 5 }}>← acts first | waits →</div>
          </div>

          {/* Combat Log */}
          <div className="section-title">Combat Log</div>
          <div style={{
            background: "#13192b", borderRadius: 6, padding: 8, border: "1px solid #2d3748",
            maxHeight: 240, overflowY: "auto", fontSize: 10, lineHeight: 1.7,
          }}>
            {log.map((entry, i) => (
              <div key={i} style={{ color: i === 0 ? "#e2e8f0" : "#718096", borderBottom: i === 0 ? "1px solid #2d3748" : "none", paddingBottom: i === 0 ? 4 : 0 }}>
                {entry}
              </div>
            ))}
          </div>

          {/* Spirit Detail (selected) */}
          {(() => {
            const s = spirits.find(sp => sp.id === activeSpirit);
            if (!s) return null;
            return (
              <div style={{ marginTop: 10, background: "#13192b", borderRadius: 6, padding: 10, border: `1px solid ${s.color}44` }}>
                <div className="section-title" style={{ color: s.color }}>Stats — {s.name}</div>
                <table style={{ width: "100%", fontSize: 10, borderCollapse: "collapse" }}>
                  {[
                    ["Style", SPIRIT_STYLES[s.style]?.label],
                    ["Vibe (HP)", `${s.vibe} / ${s.maxVibe}`],
                    ["Speed", s.speed],
                    ["Riff", s.riff],
                    ["Power", s.power],
                    ["Sustain", `${s.sustain} / ${s.maxSustain}`],
                    ["Feedback", s.feedback ? "ACTIVE" : "—"],
                    ["Broke Move", s.brokeMove],
                    ["Position", `(${s.q}, ${s.r})`],
                    ["Tempo", s.tempoPos],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ color: "#718096", paddingBottom: 3, paddingRight: 8 }}>{k}</td>
                      <td style={{ color: "#e2e8f0" }}>{v}</td>
                    </tr>
                  ))}
                </table>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
