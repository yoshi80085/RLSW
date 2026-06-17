import boardImg from "./board.png";
import boardOutlineImg from "./board_outline.png";
import boardLightningImg from "./board_lightning_animated.png";
import boardStarsImg from "./board_stars_animated.png";
import battleMeterImg from "./Battle_Meter.png";
import battlePickImg from "./battle_pick.png";
import crowdPinkImg from "./crowd_pink.png";   // fan-fare — attacker (left) cheering section
import crowdBlueImg from "./crowd_blue.png";   // fan-fare — defender (right) cheering section
import hydraImg from "./hydra.PNG";            // 🐉 Shredding Ronin — Hydra ability backdrop (3 heads / 3 beams)
import rlCardImg from "./RL_Card.png";
import glamarchy from "./standees/Glamarchy.png";
import glamarchy_mirror from "./standees/Glamarchy_mirror.png";
import cosmic_ronin from "./standees/Cosmic_Ronin.png";
import cosmic_ronin_mirror from "./standees/Cosmic_Ronin_mirror.png";
import intergalactic_0 from "./standees/Intergalactic_0.png";
import intergalactic_0_mirror from "./standees/Intergalactic_0_mirror.png";
import metalness_monster from "./standees/Metalness_Monster.png";
import metalness_monster_mirror from "./standees/Metalness_Monster_mirror.png";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import React from "react";
import bgm1 from "./bgm/bgm_1.mp3";
import bgm2 from "./bgm/bgm_2.mp3";
import bgm3 from "./bgm/bgm_3.mp3";
import bgm4 from "./bgm/bgm_4.mp3";
import bgm5 from "./bgm/bgm_5.mp3";
import bgm6 from "./bgm/bgm_6.mp3";
import bgm7 from "./bgm/bgm_7.mp3";
import bgm8 from "./bgm/bgm_8.mp3";

const BGM_TRACKS = [bgm1, bgm2, bgm3, bgm4, bgm5, bgm6, bgm7, bgm8];

function shuffleBgm(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function makeBgmQueue(excludeFirst = -1) {
  let q = shuffleBgm(BGM_TRACKS.map((_, i) => i));
  if (excludeFirst !== -1 && q[0] === excludeFirst && q.length > 1) {
    const swap = Math.floor(Math.random() * (q.length - 1)) + 1;
    [q[0], q[swap]] = [q[swap], q[0]];
  }
  return q;
}
let bgmQueue = [];
function nextBgmTrack(lastIdx = -1) {
  if (bgmQueue.length === 0) bgmQueue = makeBgmQueue(lastIdx);
  return bgmQueue.shift();
}

// ─── BOARD CONSTANTS ─────────────────────────────────────────────────────────
const IMG_W = 6522;
const IMG_H = 4839;
const HEX_SIZE = 195;
const SCALE = 0.12;
const SVG_W = Math.round(IMG_W * SCALE);
const SVG_H = Math.round(IMG_H * SCALE);
const COL_SPACING = 330;
const ROW_SPACING = 390;

// ─── 111-HEX MAP ──────────────────────────────────────────────────────────────
const COLUMNS = [
  [1,2,3,4,5],
  [6,7,8,9,10,11,12,13],
  [14,15,16,17,18,19,20,21,22],
  [23,24,25,26,27,28,29,30,31,32],
  [33,34,35,36,37,38,39,40,41],
  [42,43,44,45,46,47,48,49,50,51],
  [52,53,54,55,56,57,58,59,60],
  [61,62,63,64,65,66,67,68,69,70],
  [71,72,73,74,75,76,77,78,79],
  [80,81,82,83,84,85,86,87,88,89],
  [90,91,92,93,94,95,96,97,98],
  [99,100,101,102,103,104,105,106],
  [107,108,109,110,111],
];
const COL_TOP_OFFSETS = [4,2,2,1,2,1,2,1,2,1,2,2,4];
const COL0_X = 1275;
const ROW0_Y = 75;

const EDGE_HEX_NUMS = new Set([
  1,2,3,4,5,
  6,13,
  14,22,
  23,32,
  33,41,
  42,51,
  52,60,
  61,70,
  71,79,
  80,89,
  90,98,
  99,100,105,106,
  107,108,109,110,111,
]);

function buildHexMap() {
  const map = {};
  const byQR = {};
  COLUMNS.forEach((col, colIdx) => {
    const offset = COL_TOP_OFFSETS[colIdx];
    const cxImg = COL0_X + colIdx * COL_SPACING;
    const colYOffset = (colIdx % 2 === 1) ? HEX_SIZE : 0;
    col.forEach((num, rowInCol) => {
      const rowAbs = offset + rowInCol;
      const cyImg = ROW0_Y + rowAbs * ROW_SPACING + colYOffset;
      const q = colIdx - 6;
      const r = rowAbs - (colIdx - (colIdx & 1)) / 2;
      const hex = {
        num, q, r: Math.round(r),
        col: colIdx, row: rowAbs,
        px: Math.round(cxImg),
        py: Math.round(cyImg),
        edge: EDGE_HEX_NUMS.has(num),
        stage: num === 56,
      };
      map[num] = hex;
      byQR[`${hex.q},${hex.r}`] = hex;
    });
  });
  return { map, byQR };
}

const { map: HEX_BY_NUM, byQR: HEX_BY_QR } = buildHexMap();
const ALL_HEXES = Object.values(HEX_BY_NUM);

// ─── HEX GEOMETRY ─────────────────────────────────────────────────────────────
function pointyCorners(cx, cy, size) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i);
    return `${(cx + size * Math.cos(a)).toFixed(1)},${(cy + size * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

function axialDist(q1, r1, q2, r2) {
  return (Math.abs(q1-q2) + Math.abs(q1+r1-q2-r2) + Math.abs(r1-r2)) / 2;
}

function axialNeighbors(q, r) {
  return [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]].map(([dq,dr]) => ({ q:q+dq, r:r+dr }));
}

function facingAngle(fromHex, toHex) {
  const dx = toHex.px - fromHex.px;
  const dy = toHex.py - fromHex.py;
  return Math.atan2(dy, dx);
}

function getFlatTopNeighborSlots(originHex) {
  return axialNeighbors(originHex.q, originHex.r)
    .map(({q,r}) => HEX_BY_QR[`${q},${r}`])
    .filter(Boolean);
}

function angleTo(fromHex, toHex) {
  return Math.atan2(toHex.py - fromHex.py, toHex.px - fromHex.px);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

function neighborInDirection(originHex, angle) {
  const neighbors = getFlatTopNeighborSlots(originHex);
  return neighbors.reduce((best, nb) => {
    const diff = angleDiff(angle, angleTo(originHex, nb));
    if (!best || diff < best.diff) return { hex: nb, diff };
    return best;
  }, null)?.hex;
}

// ─── SPIRIT DEFINITIONS ───────────────────────────────────────────────────────
// Drive = attack stat (Power). Feedback = defense stat (was 'Sustain').
// Sustain = max Vibe / damage capacity before Knocked Down. Speed cap 5.
// Style: Shred = high Drive | Flair = high Feedback | Groove = balanced lean-Feedback
// Speed: 4–6 — max hexes of movement per turn
const SPIRIT_DEFS = {
  "cosmic_ronin":      { id:"cosmic_ronin",      name:"Shredding Ronin",      imageSrc:cosmic_ronin,      color:"#4488ff", vibe:5, maxVibe:5, knockedOut:false, style:"Shred",  drive:8, sustain:5, speed:5 },
  "intergalactic_0":   { id:"intergalactic_0",   name:"Intergalactic 0",   imageSrc:intergalactic_0,   color:"#aa55ff", vibe:4, maxVibe:4, knockedOut:false, style:"Groove", drive:6, sustain:7, speed:5 },
  "Metalness_Monster": { id:"Metalness_Monster", name:"Metalness Monster", imageSrc:metalness_monster, color:"#ffcc00", vibe:5, maxVibe:5, knockedOut:false, style:"Shred",  drive:7, sustain:6, speed:4 },
  "Glamarchy":         { id:"Glamarchy",         name:"Glamarchy",         imageSrc:glamarchy,         color:"#ff6600", vibe:4, maxVibe:4, knockedOut:false, style:"Flair",  drive:5, sustain:8, speed:5 },
};

const CORNERS = {
  blue:   { homeNum:7   },
  purple: { homeNum:12  },
  yellow: { homeNum:100 },
  red:    { homeNum:105 },
};

function cornerFacing(homeNum) {
  const home   = HEX_BY_NUM[homeNum];
  const centre = HEX_BY_NUM[56];
  if (!home || !centre) return 0;
  const raw = Math.atan2(centre.py - home.py, centre.px - home.px);
  const neighbors = getFlatTopNeighborSlots(home);
  if (!neighbors.length) return raw;
  return neighbors.reduce((best, nb) => {
    const a = angleTo(home, nb);
    return angleDiff(raw, a) < angleDiff(raw, best) ? a : best;
  }, angleTo(home, neighbors[0]));
}

// ─── CORNER LABELS ────────────────────────────────────────────────────────────
const CORNER_LABELS = {
  blue:   { label:"Blue Corner",   color:"#4488ff" },
  purple: { label:"Purple Corner", color:"#aa55ff" },
  yellow: { label:"Yellow Corner", color:"#ffcc00" },
  red:    { label:"Red Corner",    color:"#ff6600" },
};
const CORNERS_ORDER = ["blue","purple","yellow","red"];
const SPIRIT_OPTIONS = Object.values(SPIRIT_DEFS);

// ─── LOBBY ────────────────────────────────────────────────────────────────────
// ─── TUTORIAL ILLUSTRATED MOCKUPS ────────────────────────────────────────────

function MockNoteHex({ note, type, used, staggered, small }) {
  const sz = small ? 22 : 26;
  const fs = small ? 8 : 9;
  const colors = {
    tritone:      { border:"#ff3300", text:"#ff3300", bg:"#2a0800", shadow:"0 0 6px #ff330077" },
    minorSeventh: { border:"#4499ff", text:"#4499ff", bg:"#051525", shadow:"0 0 5px #4499ff77" },
    majorThird:   { border:"#44ffaa", text:"#44ffaa", bg:"#0a2a1a", shadow:"0 0 5px #44ffaa55" },
    fifth:        { border:"#ff55aa", text:"#ff55aa", bg:"#2a0f1a", shadow:"0 0 5px #ff55aa66" },
    fourth:       { border:"#cc55ff", text:"#cc55ff", bg:"#1a0a2a", shadow:"0 0 5px #cc55ff66" },
    inScale:      { border:"#4488ff", text:"#4488ff", bg:"#0d1f35", shadow:"none" },
    dischord:     { border:"#ff660066", text:"#ff6600", bg:"#1f0d0066", shadow:"none" },
    staggered:    { border:"#ff880066", text:"#ff8800", bg:"#1a0e00", shadow:"none" },
  };
  const c = staggered ? colors.staggered : colors[type] || colors.inScale;
  return (
    <div style={{
      width:sz, height:sz-2, borderRadius:3, fontSize:fs, fontWeight:700,
      display:"flex", alignItems:"center", justifyContent:"center",
      opacity: used ? 0.15 : staggered ? 0.3 : 1,
      border: `1.5px solid ${c.border}`,
      color: c.text, background: c.bg, boxShadow: c.shadow,
    }}>{staggered ? "⚡" : note}</div>
  );
}

function MockBar({ value, max, color }) {
  return (
    <div style={{background:"#0d1a2a", borderRadius:2, height:5, flex:1}}>
      <div style={{width:`${(value/max)*100}%`, height:5, borderRadius:2, background:color, transition:"width .3s"}}/>
    </div>
  );
}

function MockCard({ children, borderColor, glow }) {
  return (
    <div style={{
      background:"#080f1e", borderRadius:5, padding:"7px 9px",
      border:`1px solid ${borderColor||"#1a2a40"}`,
      borderLeft:`3px solid ${borderColor||"#1a2a40"}`,
      boxShadow: glow ? `0 0 10px ${borderColor}44, inset 0 0 10px ${borderColor}11` : "none",
      marginBottom:0,
    }}>{children}</div>
  );
}

function MockSpiritCard({ name, style, drive, sustain, vibe, maxVibe, color, tempDrive, tempSustain, status }) {
  return (
    <MockCard borderColor={color}>
      <div style={{display:"flex", justifyContent:"space-between", marginBottom:3}}>
        <div>
          <span style={{fontSize:10, fontWeight:700, color}}>{name}</span>
          <span style={{fontSize:7, color:"#3a5a7a", marginLeft:5}}>{style}</span>
        </div>
      </div>
      <div style={{display:"flex", gap:4, marginBottom:3}}>
        <div style={{flex:1}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:1}}>
            <span style={{fontSize:7, color:"#ff6644"}}>⚔️ DRIVE</span>
            <span style={{fontSize:7, color:"#ff6644"}}>{drive}{tempDrive ? <span style={{color:"#ffaa44"}}>+{tempDrive}</span> : ""}</span>
          </div>
          <MockBar value={drive} max={10} color="#cc4422"/>
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex", justifyContent:"space-between", marginBottom:1}}>
            <span style={{fontSize:7, color:"#44aaff"}}>🛡️ FEEDBACK</span>
            <span style={{fontSize:7, color:"#44aaff"}}>{sustain}{tempSustain ? <span style={{color:"#88ccff"}}>+{tempSustain}</span> : ""}</span>
          </div>
          <MockBar value={sustain} max={10} color="#2266aa"/>
        </div>
      </div>
      <div style={{display:"flex", alignItems:"center", gap:4, marginBottom: status ? 3 : 0}}>
        <span style={{fontSize:8, color:"#3a5a7a", width:26}}>VIBE</span>
        <MockBar value={vibe} max={maxVibe} color={vibe > maxVibe*.4 ? "#44cc66" : "#ff4444"}/>
        <span style={{fontSize:8, width:22, textAlign:"right"}}>{vibe}/{maxVibe}</span>
      </div>
      {status && <div style={{fontSize:7, color:"#ff8800", marginTop:2, textAlign:"center",
        background:"#1a0e00", border:"1px solid #ff880066", borderRadius:3, padding:"1px 4px"}}>{status}</div>}
      {tempDrive > 0 && <div style={{fontSize:7, padding:"1px 5px", borderRadius:3, marginTop:2,
        background:"#2a0e00", border:"1px solid #ff6644", color:"#ffaa44"}}>⚔️ +{tempDrive} next attack</div>}
    </MockCard>
  );
}

function MockNoteTrack({ notes, rootNote, noteTypes }) {
  // noteTypes: array matching notes, each being a type key
  return (
    <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:5, padding:"6px 8px"}}>
      <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:1, marginBottom:4}}>
        NOTE TRACK <span style={{color:"#ffcc44", marginLeft:6}}>RN: {rootNote}</span>
      </div>
      <div style={{display:"flex", gap:3, flexWrap:"wrap", marginBottom:4}}>
        {notes.map((n, i) => (
          <MockNoteHex key={i} note={n} type={noteTypes?.[i] || "inScale"} />
        ))}
      </div>
    </div>
  );
}

function MockDiceTier({ tier }) {
  const labels = ["D6","D8","D10","D12","D20"];
  const colors  = ["#aaccff","#88ffcc","#ffcc44","#ff8844","#ff44cc"];
  return (
    <div style={{display:"flex", gap:4, alignItems:"center"}}>
      {labels.map((l,i) => (
        <div key={i} style={{
          padding:"2px 8px", borderRadius:3, fontSize:10, fontWeight:700,
          fontFamily:"'Orbitron',sans-serif",
          background: i===tier ? "#1a1200" : "#080f1e",
          border: `1px solid ${i===tier ? colors[i]+"88" : "#1a2a4044"}`,
          color: i===tier ? colors[i] : "#1e3a5f",
          boxShadow: i===tier ? `0 0 8px ${colors[i]}44` : "none",
          transform: i===tier ? "scale(1.12)" : "scale(1)",
          transition:"all .2s",
        }}>{l}</div>
      ))}
    </div>
  );
}

function MockHex({ note, lit, edge, active, small }) {
  const sz = small ? 28 : 36;
  const r  = sz / 2;
  const pts = Array.from({length:6},(_,i)=>{
    const a = Math.PI/180*(60*i - 30);
    return `${r + (r-2)*Math.cos(a)},${r + (r-2)*Math.sin(a)}`;
  }).join(" ");
  const fill = edge ? "#2a1a00" : lit ? "#1a3020" : active ? "#0d1528" : "#0a1020";
  const stroke = edge ? "#ff440066" : lit ? "#44cc8888" : active ? "#4488ff88" : "#1a2a40";
  return (
    <svg width={sz} height={sz} style={{display:"block"}}>
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth="1.5"/>
      {note && <text x={r} y={r+3} textAnchor="middle" fontSize={small?8:9}
        fontFamily="'Share Tech Mono',monospace" fill={lit?"#44ff88":active?"#4488ff":"#3a5a7a"}
        fontWeight="700">{note}</text>}
      {edge && <text x={r} y={r+3} textAnchor="middle" fontSize={8} fill="#ff4400">⚠</text>}
    </svg>
  );
}

function MockFlashBadge({ text, color }) {
  return (
    <div style={{
      display:"inline-block", padding:"4px 12px", borderRadius:4,
      fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700,
      color, textShadow:`0 0 12px ${color}, 0 0 24px ${color}`,
      background:"#050810", border:`1px solid ${color}44`,
    }}>{text}</div>
  );
}

// ─── TUTORIAL SECTION CONTENT ─────────────────────────────────────────────────

function TutSection_Overview() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        Rock Legends: Spirit Wars is a hex-grid battle game driven by music theory.
        Each turn you move your Spirit across the board, build a sequence of notes called
        a <span style={{color:"#aa88ff"}}>Note Track</span>, then unleash a
        <span style={{color:"#f6ad55"}}> Sonic Attack</span> on any enemy in range.
        The patterns you build with your notes determine how powerful your attacks are —
        and what special effects trigger.
      </p>
      {/* Turn flow diagram */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:10}}>TURN FLOW</div>
        <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
          {[
            { label:"Build Note Track", icon:"🎵", color:"#aa55ff" },
            { label:"Commit", icon:"✓", color:"#44ff88" },
            { label:"Move", icon:"🚶", color:"#44cc88" },
            { label:"Sonic Attack", icon:"⚡", color:"#f6ad55" },
          ].map((step, i) => (
            <React.Fragment key={i}>
              <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:3}}>
                <div style={{fontSize:18}}>{step.icon}</div>
                <div style={{fontSize:8, color:step.color, fontFamily:"'Orbitron',sans-serif", textAlign:"center", maxWidth:60}}>{step.label}</div>
              </div>
              {i < 3 && <div style={{color:"#1e3a5f", fontSize:16, marginBottom:12}}>→</div>}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div style={{display:"flex", gap:8}}>
        <MockSpiritCard name="Shredding Ronin" style="Shred" drive={8} sustain={5} vibe={5} maxVibe={5} color="#4488ff"/>
        <MockSpiritCard name="Glamarchy" style="Flair" drive={5} sustain={8} vibe={4} maxVibe={4} color="#ff6600"/>
      </div>
      <p style={{fontSize:10, color:"#6a8a9a", lineHeight:1.6, margin:0}}>
        Each Spirit has <span style={{color:"#44cc66"}}>Vibe</span> (health),
        <span style={{color:"#ff6644"}}> Drive</span> (attack) and
        <span style={{color:"#44aaff"}}> Feedback</span> (defence) stats.
        Lose all Vibe and you're Knocked Down. Run out of stands — KO'd!
        Winning battles earns <span style={{color:"#ffd700"}}>⭐ Fame Points</span> —
        the bigger your winning margin, the more Fame you take. Losers get
        <span style={{color:"#ff8866"}}> knocked back</span>: 1 hex from a Swing,
        up to 3 from a big Sonic defeat.
      </p>
      <div style={{background:"#14110a", border:"1px solid #ffd70044", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ffd700", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:5}}>⭐ FAME — THE WIN CONDITION</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          First spirit to reach the Fame target wins the game. Earn Fame by winning
          battles (bigger margin, bigger Fame), playing legendary riffs, grabbing
          ✨ Fame Sparks scattered across the board (4 sparks forge 1 FP — keep
          moving!), and resolving 🎯 Cadence Objectives: end consecutive turns on
          the right scale degrees (like C → F → G → C for THE FULL RESOLVE) in any
          key. You can still win by holding the Limelight or being the last spirit
          standing — but Fame is the path of legends.
        </p>
      </div>
      <div style={{background:"#0c0a18", border:"1px solid #aa88ff44", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ccaaff", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:5}}>🎼 THE RIFFBOOK</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Hidden in the note system are legendary riffs — from Beethoven's fateful
          knocks to the slyest jazz lick. Place a riff's opening intervals on your
          track (any key works, only the spacing between notes matters) and hit
          CONFIRM: the full riff plays out with its real rhythm and earns bonus Fame.
          First discovery scores big; the Riffbook (📖 in the header) tracks what's
          been found and hints at what hasn't.
        </p>
      </div>
      <div style={{background:"#0c0818", border:"1px solid #ff44dd44", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ff88ee", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:5}}>✨ EVENT SPACES</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          A pink marquee hex pulses somewhere on the board. Step on it to rip a card
          straight from rock history — flaming disc riots, dubious bat snacks, séances,
          payola, stage dives and more. Events can reshape the board, buff or curse
          spirits, or drag <em>everyone</em> into a community dice roll. A triggered
          marquee burns out — a new one lights up elsewhere a few turns later.
        </p>
      </div>
      <div style={{background:"#08140e", border:"1px solid #44cc8844", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#44cc88", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:5}}>🎉 CREW &amp; GEAR</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Skills you unlock — Amps, Roadies, Groupie crews and your Ultimate — appear as
          deployable chips on your Spirit card. Tap a glowing chip to send the crew out:
          heal up, sabotage rival amps, arm a junkyard weapon, or raise a fan wall.
          Deployed crews recharge after a few turns.
        </p>
      </div>
    </div>
  );
}

function TutSection_Board() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        The arena is a hex grid. Spirits move across it each turn.
        Position matters — being on an <span style={{color:"#ff4400"}}>edge hex</span> makes
        you vulnerable to being knocked clean off the board.
      </p>
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:8}}>HEX TYPES</div>
        <div style={{display:"flex", gap:16, alignItems:"flex-start"}}>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
            <MockHex />
            <span style={{fontSize:8, color:"#3a5a7a", textAlign:"center"}}>Normal</span>
          </div>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
            <MockHex active/>
            <span style={{fontSize:8, color:"#4488ff", textAlign:"center"}}>Your<br/>Position</span>
          </div>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
            <MockHex lit/>
            <span style={{fontSize:8, color:"#44cc88", textAlign:"center"}}>Valid<br/>Move</span>
          </div>
          <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:4}}>
            <MockHex edge/>
            <span style={{fontSize:8, color:"#ff4400", textAlign:"center"}}>Edge ⚠<br/>Danger!</span>
          </div>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"10px 0 0", lineHeight:1.6}}>
          After you commit your Note Track, you gain movement equal to the number of notes placed.
          Click a lit hex to move there. Confirm your track before moving.
        </p>
      </div>
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:6}}>BOARD LAYOUT</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(5,36px)", gap:2, justifyContent:"start"}}>
          {[null,"⚠",null,"⚠",null,"⚠","✦","🟦","✦","⚠",null,"✦","✦","✦",null,"⚠","✦","🟥","✦","⚠",null,"⚠",null,"⚠",null].map((c,i)=>{
            const isEdge = c==="⚠";
            const isHome = c==="🟦"||c==="🟥";
            return <MockHex key={i} edge={isEdge} active={isHome} small/>;
          })}
        </div>
        <p style={{fontSize:8, color:"#3a5a7a", margin:"6px 0 0"}}>Simplified. ⚠ = edge hexes. Coloured = home hexes.</p>
      </div>
    </div>
  );
}

function TutSection_NoteTrack() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        Before attacking, you build a <span style={{color:"#aa55ff"}}>Note Track</span> — a
        sequence of musical notes drawn from your Note Stock. The notes you choose
        and the patterns they form determine your combat power and special effects.
      </p>

      {/* Note Stock */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:8}}>NOTE STOCK — your available notes</div>
        <div style={{display:"flex", gap:3, flexWrap:"wrap", marginBottom:8}}>
          {[
            {n:"C", t:"inScale"},{n:"D", t:"inScale"},{n:"E", t:"majorThird"},
            {n:"F", t:"fourth"}, {n:"G", t:"fifth"},  {n:"A", t:"inScale"},
            {n:"Bb",t:"dischord"},{n:"B",t:"inScale"},{n:"F#",t:"tritone"},
            {n:"Eb",t:"dischord"},{n:"Ab",t:"minorSeventh"},{n:"D",t:"inScale"},
          ].map((x,i) => <MockNoteHex key={i} note={x.n} type={x.t}/>)}
        </div>
        <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
          {[
            {color:"#4488ff",  label:"In Scale"},
            {color:"#ff3300",  label:"Tritone"},
            {color:"#44ffaa",  label:"Major 3rd"},
            {color:"#ff55aa",  label:"5th"},
            {color:"#cc55ff",  label:"4th"},
            {color:"#4499ff",  label:"Minor 7th"},
            {color:"#ff6600",  label:"Dischord"},
          ].map((k,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:8,height:8,borderRadius:2,border:`1.5px solid ${k.color}`,background:k.color+"22"}}/>
              <span style={{fontSize:8,color:"#6a8a9a"}}>{k.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assembled track */}
      <MockNoteTrack notes={["C","D","E","F","G"]} rootNote="C"
        noteTypes={["inScale","inScale","majorThird","fourth","fifth"]}/>
      <p style={{fontSize:9, color:"#6a8a9a", lineHeight:1.6, margin:0}}>
        ↑ A clean 5-note track — all in scale. After pressing <span style={{color:"#44ff88"}}>✓ Commit</span>,
        every effect triggers and you gain 5 movement hexes.
      </p>

      {/* Commit button mockup */}
      <div style={{display:"flex", gap:6}}>
        <div style={{flex:1, background:"#0a1020", border:"1px solid #44ff88", borderRadius:3,
          padding:"4px 8px", fontSize:8, color:"#44ff88", textAlign:"center", cursor:"pointer"}}>
          ✓ Commit (5 notes → 5 hex)
        </div>
        <div style={{background:"#0a1020", border:"1px solid #ff4444", borderRadius:3,
          padding:"4px 8px", fontSize:8, color:"#ff4444", cursor:"pointer"}}>✕</div>
      </div>
    </div>
  );
}

function TutSection_HarmonicCharge() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        <span style={{color:"#ffcc44"}}>Harmonic Charge</span> (HC) is your die tier —
        the size of the dice you roll when attacking. Start at D6 and build up by
        playing clean, in-scale patterns. Include Dischord and you'll drop a level.
      </p>

      {/* Tier ladder */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:10}}>HARMONIC CHARGE TIERS</div>
        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          {[
            {die:"D6",  pts:"Start",  color:"#aaccff", desc:"Base tier. Roll 1-6."},
            {die:"D8",  pts:"10 pts", color:"#88ffcc", desc:"Clean tracks. Roll 1-8."},
            {die:"D10", pts:"25 pts", color:"#ffcc44", desc:"Strong harmony. Roll 1-10."},
            {die:"D12", pts:"50 pts", color:"#ff8844", desc:"Sustained mastery. Roll 1-12."},
            {die:"D20", pts:"MAX",    color:"#ff44cc", desc:"Peak Harmonic Charge. Roll 1-20!"},
          ].map((t,i)=>(
            <div key={i} style={{display:"flex", alignItems:"center", gap:10,
              padding:"5px 8px", borderRadius:4,
              background: i===2 ? "#141000" : "#080f1e",
              border: `1px solid ${i===2 ? t.color+"44" : "#1a2a4033"}`}}>
              <div style={{minWidth:36, fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700,
                color:t.color, textShadow: i===2 ? `0 0 8px ${t.color}` : "none"}}>{t.die}</div>
              <div style={{fontSize:8, color:"#3a5a7a", minWidth:40}}>{t.pts}</div>
              <div style={{fontSize:9, color: i===2 ? "#c0d0e0" : "#5a7a8a"}}>{t.desc}</div>
              {i===2 && <span style={{marginLeft:"auto",fontSize:8,color:t.color}}>← you are here</span>}
            </div>
          ))}
        </div>
      </div>

      {/* What earns points */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:8}}>WHAT EARNS HC POINTS</div>
        {[
          {icon:"🎶", label:"End on 4th or 5th",       pts:"+2 pts", color:"#cc55ff"},
          {icon:"🎶", label:"Octave resolution",        pts:"+3 pts + die floor", color:"#44aaff"},
          {icon:"✨", label:"Major 3rd end",            pts:"+1 pt + cleanse", color:"#44ffaa"},
          {icon:"⚔️", label:"Drive overflow (non-stack)",pts:"+varies", color:"#ffaa44"},
          {icon:"🛡️", label:"Feedback overflow (non-stack)",pts:"+varies", color:"#88ccff"},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex", alignItems:"center", gap:8, marginBottom:5}}>
            <span style={{fontSize:13}}>{r.icon}</span>
            <span style={{fontSize:9, color:"#a0b8cc", flex:1}}>{r.label}</span>
            <span style={{fontSize:9, color:r.color, fontWeight:700}}>{r.pts}</span>
          </div>
        ))}
      </div>

      <div style={{display:"flex", flexDirection:"column", gap:6}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2}}>CURRENT TIER DISPLAY (top of Note Track panel)</div>
        <div style={{background:"#050c18", padding:"8px 12px", borderRadius:5, border:"1px solid #1a2a40"}}>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontSize:8, color:"#aa88ff", letterSpacing:1}}>HC</span>
            <MockDiceTier tier={2}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function TutSection_DriveSustain() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <div style={{display:"flex", gap:8}}>
        <MockSpiritCard name="Shredding Ronin" style="Shred" drive={8} sustain={5} vibe={4} maxVibe={5} color="#4488ff" tempDrive={2}/>
        <MockSpiritCard name="Glamarchy" style="Flair" drive={5} sustain={8} vibe={3} maxVibe={4} color="#ff6600" tempSustain={1}/>
      </div>

      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:10}}>DRIVE BOOST — diatonic step runs</div>
        <MockNoteTrack notes={["C","D","E","F","G"]} rootNote="C"
          noteTypes={["inScale","inScale","majorThird","fourth","fifth"]}/>
        <div style={{marginTop:8, display:"flex", gap:6, alignItems:"center"}}>
          <MockFlashBadge text="⚔️ Drive +2" color="#ffaa44"/>
          <div style={{fontSize:9, color:"#6a8a9a"}}>← 5 steps in a row = +3, but 4 here shows +2</div>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"8px 0 0", lineHeight:1.6}}>
          Play notes that step <em>consecutively up or down your scale</em> (C→D→E→F…).
          3 in a row = +1 Drive. 4 = +2. 5 = +3. Bonus is consumed when you next attack.
        </p>
      </div>

      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:10}}>FEEDBACK BOOST — repeat patterns</div>
        <div style={{display:"flex", gap:10}}>
          <div>
            <div style={{fontSize:8, color:"#44aaff", marginBottom:4}}>Type A: Same note</div>
            <MockNoteTrack notes={["G","G","G","G"]} rootNote="C"
              noteTypes={["fifth","fifth","fifth","fifth"]}/>
          </div>
          <div>
            <div style={{fontSize:8, color:"#44aaff", marginBottom:4}}>Type B: Alternating</div>
            <MockNoteTrack notes={["C","F","C","F"]} rootNote="C"
              noteTypes={["inScale","fourth","inScale","fourth"]}/>
          </div>
        </div>
        <div style={{marginTop:8, display:"flex", gap:6, alignItems:"center"}}>
          <MockFlashBadge text="🛡️ Feedback +2" color="#88ccff"/>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"8px 0 0", lineHeight:1.6}}>
          Both patterns must use <em>in-scale notes only</em>. 3 = +1, 4 = +2, 5 = +3.
          Boost is consumed when you're next hit by an attack.
        </p>
      </div>

      <div style={{background:"#0e0c18", border:"1px solid #aa55ff44", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#aa55ff", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:6}}>NON-STACKING RULE</div>
        <div style={{display:"flex", gap:8, alignItems:"center", fontSize:9, color:"#a0b8cc"}}>
          <span style={{color:"#ffaa44"}}>+1 Drive active</span>
          <span style={{color:"#3a5a7a"}}>→ earn</span>
          <span style={{color:"#ffaa44"}}>+2 Drive</span>
          <span style={{color:"#3a5a7a"}}>→</span>
          <span style={{color:"#ffcc44"}}>old +1 → HC points</span>
          <span style={{color:"#3a5a7a"}}>+</span>
          <span style={{color:"#ffaa44"}}>keep +2</span>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"6px 0 0"}}>
          Boosts don't stack — the higher value always wins, and the lower one feeds into Harmonic Charge.
        </p>
      </div>
    </div>
  );
}

function TutSection_Intervals() {
  const intervals = [
    { note:"F",  label:"4th",      color:"#cc55ff", effect:"HC points",         icon:"💜", desc:"Stable interval — scores HC points when ending your track here." },
    { note:"G",  label:"5th",      color:"#ff55aa", effect:"HC points",         icon:"💗", desc:"Strong perfect 5th — also scores HC points at track end." },
    { note:"E",  label:"Maj 3rd",  color:"#44ffaa", effect:"Cleanse status",    icon:"✨", desc:"End on the major 3rd to remove your oldest negative status effect." },
    { note:"Bb", label:"Min 7th",  color:"#4499ff", effect:"Mojo Drain ready",  icon:"🎷", desc:"End here to prepare a Mojo Drain debuff against your next target." },
    { note:"F#", label:"Tritone",  color:"#ff3300", effect:"Feedback ×2",       icon:"🔥", desc:"The devil's interval. Put it anywhere in your track to double attack damage." },
    { note:"C",  label:"Octave",   color:"#44aaff", effect:"Die Floor +2",      icon:"🎶", desc:"Start and end on the same note. Raises the minimum value of your attack die." },
  ];
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        Certain <span style={{color:"#aa88ff"}}>intervals</span> — the musical distance between your
        Root Note and the notes you play — trigger special effects when they appear in (or end) your track.
      </p>
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:8}}>INTERVAL REFERENCE (Root = C)</div>
        <div style={{display:"flex", gap:3, marginBottom:10}}>
          {["C","D","E","F","G","A","Bb","B","F#"].map((n,i)=>{
            const iv = intervals.find(x=>x.note===n);
            return <MockNoteHex key={i} note={n} type={
              n==="F#" ? "tritone" : n==="Bb" ? "minorSeventh" : n==="E" ? "majorThird" :
              n==="F" ? "fourth" : n==="G" ? "fifth" : "inScale"
            }/>;
          })}
        </div>
        {intervals.map((iv,i)=>(
          <div key={i} style={{display:"flex", alignItems:"flex-start", gap:8, marginBottom:7,
            padding:"5px 8px", borderRadius:4, background: iv.color+"0a", border:`1px solid ${iv.color}22`}}>
            <MockNoteHex note={iv.note} type={
              iv.note==="F#" ? "tritone" : iv.note==="Bb" ? "minorSeventh" : iv.note==="E" ? "majorThird" :
              iv.note==="F" ? "fourth" : iv.note==="G" ? "fifth" : "inScale"
            } small/>
            <div style={{flex:1}}>
              <div style={{display:"flex", gap:6, alignItems:"center", marginBottom:2}}>
                <span style={{fontSize:9, color:iv.color, fontWeight:700}}>{iv.label}</span>
                <span style={{fontSize:8, padding:"1px 6px", borderRadius:3,
                  background:iv.color+"22", border:`1px solid ${iv.color}44`, color:iv.color}}>
                  {iv.icon} {iv.effect}
                </span>
              </div>
              <div style={{fontSize:9, color:"#6a8a9a"}}>{iv.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TutSection_Dischord() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        <span style={{color:"#ff6600"}}>Dischord</span> notes are out-of-scale — they don't
        earn Harmonic Charge points. But they're not useless: they can trigger brutal
        combat effects of their own.
      </p>

      {/* Dischord track */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:8}}>CHROMATIC RUN → STAGGER</div>
        <MockNoteTrack notes={["C","C#","D","D#","E"]} rootNote="C"
          noteTypes={["inScale","dischord","inScale","dischord","majorThird"]}/>
        <div style={{marginTop:6, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{fontSize:8, color:"#ff6600", padding:"2px 6px", background:"#1f0d00", borderRadius:3, border:"1px solid #ff660044"}}>
            ⚡ 2 Dischord notes
          </div>
          <MockFlashBadge text="⚡ Chromatic ×3 — Stagger 2t" color="#ff8800"/>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"8px 0 0", lineHeight:1.6}}>
          Three or more consecutive semitone steps triggers <span style={{color:"#ff8800"}}>Stagger</span> on your target —
          hiding 2 of their Note Stock slots for several turns.
        </p>
      </div>

      {/* Stagger card */}
      <MockSpiritCard name="Metalness Monster" style="Shred" drive={7} sustain={6} vibe={3} maxVibe={5} color="#ffcc00"
        status="⚡ STAGGER 2t"/>

      {/* Mojo Drain */}
      <div style={{background:"#050c18", border:"1px solid #1155ff33", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#4499ff", fontFamily:"'Orbitron',sans-serif", letterSpacing:2, marginBottom:8}}>MOJO DRAIN</div>
        <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:6}}>
          <MockNoteHex note="Bb" type="minorSeventh"/>
          <div style={{fontSize:9, color:"#a0b8cc"}}>End your track on the Minor 7th — then attack to apply Mojo Drain to your enemy.</div>
        </div>
        <div style={{fontSize:8, color:"#4499ff", padding:"4px 8px", background:"#05101a", border:"1px solid #1155ff66",
          borderRadius:3, display:"inline-block"}}>💧 MOJO DRAIN 3t</div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"8px 0 0"}}>
          A Mojo Drained Spirit has all their bonuses (Drive, Feedback, etc.) blocked for several turns.
        </p>
      </div>
    </div>
  );
}

function TutSection_Spirits() {
  const spirits = [
    { id:"cosmic_ronin",      name:"Shredding Ronin",      style:"Shred",  drive:8, sustain:5, vibe:5, maxVibe:5, color:"#4488ff",
      lore:"Vai/Satriani meets Rurouni Kenshin. A wandering samurai shredder — hyper-precise, aggressive, and deadly fast." },
    { id:"Metalness_Monster", name:"Metalness Monster", style:"Shred",  drive:7, sustain:6, vibe:5, maxVibe:5, color:"#ffcc00",
      lore:"A trash metal beast. Hits brutally hard and can absorb punishment. Raw power and riff violence above all else." },
    { id:"Glamarchy",         name:"Glamarchy",         style:"Flair",  drive:5, sustain:8, vibe:4, maxVibe:4, color:"#ff6600",
      lore:"Glam meets anarchy. Theatrical and nigh-unkillable — survives everything and strikes at the perfect moment." },
    { id:"intergalactic_0",   name:"Intergalactic 0",   style:"Groove", drive:6, sustain:7, vibe:4, maxVibe:4, color:"#aa55ff",
      lore:"Deltron 3030 and Intergalactic Planetary had a baby. Cosmic hip-hop warrior. Steady, rhythmic, hard to break." },
  ];
  return (
    <div style={{display:"flex", flexDirection:"column", gap:10}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        Four Spirits, each with a distinct musical identity, combat style, and stat balance. Choose wisely.
      </p>
      {spirits.map(s => (
        <div key={s.id} style={{background:"#050c18", border:`1px solid ${s.color}33`,
          borderLeft:`3px solid ${s.color}`, borderRadius:6, padding:"10px 12px"}}>
          <div style={{display:"flex", gap:10, marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:11, color:s.color, marginBottom:2}}>{s.name}</div>
              <div style={{fontSize:8, color:"#5a7a8a", marginBottom:6}}>{s.style} Style</div>
              <div style={{fontSize:9, color:"#8a9aaa", lineHeight:1.55}}>{s.lore}</div>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:4, minWidth:90}}>
              <div style={{display:"flex", alignItems:"center", gap:4}}>
                <span style={{fontSize:8, color:"#ff6644", width:40}}>⚔️ Drive</span>
                <MockBar value={s.drive} max={10} color="#cc4422"/>
                <span style={{fontSize:8, color:"#ff6644", width:14, textAlign:"right"}}>{s.drive}</span>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:4}}>
                <span style={{fontSize:8, color:"#44aaff", width:40}}>🛡️ Sust</span>
                <MockBar value={s.sustain} max={10} color="#2266aa"/>
                <span style={{fontSize:8, color:"#44aaff", width:14, textAlign:"right"}}>{s.sustain}</span>
              </div>
              <div style={{display:"flex", alignItems:"center", gap:4}}>
                <span style={{fontSize:8, color:"#44cc66", width:40}}>❤️ Vibe</span>
                <MockBar value={s.vibe} max={s.maxVibe} color="#44cc66"/>
                <span style={{fontSize:8, color:"#44cc66", width:14, textAlign:"right"}}>{s.vibe}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const TUTORIAL_SECTION_COMPONENTS = {
  overview:         TutSection_Overview,
  board:            TutSection_Board,
  note_track:       TutSection_NoteTrack,
  harmonic_charge:  TutSection_HarmonicCharge,
  drive_sustain:    TutSection_DriveSustain,
  intervals:        TutSection_Intervals,
  dischord:         TutSection_Dischord,
  spirits:          TutSection_Spirits,
};

const TUTORIAL_SECTIONS = [
  { id:"overview",        title:"What Is RLSW?",        icon:"⚡", color:"#f6ad55" },
  { id:"board",           title:"The Board",            icon:"🗺️", color:"#44cc88" },
  { id:"note_track",      title:"The Note Track",       icon:"🎵", color:"#aa55ff" },
  { id:"harmonic_charge", title:"Harmonic Charge",      icon:"🎲", color:"#ffcc44" },
  { id:"drive_sustain",   title:"Drive & Feedback",      icon:"⚔️", color:"#ff6644" },
  { id:"intervals",       title:"Interval Effects",     icon:"🎶", color:"#44aaff" },
  { id:"dischord",        title:"Dischord & Status",    icon:"⚡", color:"#ff8800" },
  { id:"spirits",         title:"The Spirits",          icon:"🌟", color:"#cc55ff" },
];

function Tutorial({ onBack }) {
  const [activeSection, setActiveSection] = useState("overview");
  const section = TUTORIAL_SECTIONS.find(s => s.id === activeSection);
  const SectionContent = TUTORIAL_SECTION_COMPONENTS[activeSection];
  const activeIdx = TUTORIAL_SECTIONS.findIndex(s => s.id === activeSection);

  return (
    <div style={{minHeight:"100vh", background:"#050810", display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Share Tech Mono','Courier New',monospace", padding:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#2d3748;border-radius:2px}
        .bar{background:#0d1a2a;border-radius:2px;height:5px}
        .bar-f{height:5px;border-radius:2px;transition:width .3s}
        .tut-tab{transition:all .15s;cursor:pointer;}
        .tut-tab:hover{background:#0d1528 !important;}
      `}</style>

      <div style={{width:720, maxWidth:"100%", background:"#080f1e", border:"1px solid #1a2a40", borderRadius:10, overflow:"hidden", display:"flex", flexDirection:"column", maxHeight:"96vh"}}>

        {/* Header */}
        <div style={{padding:"16px 24px 12px", borderBottom:"1px solid #1a2a40",
          background:"linear-gradient(135deg, #0a1428 0%, #0d1a30 100%)", flexShrink:0}}>
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:16, color:"#f6ad55", letterSpacing:3}}>📖 HOW TO PLAY</div>
              <div style={{fontSize:8, color:"#3a5a7a", letterSpacing:2, marginTop:2}}>ROCK LEGENDS: SPIRIT WARS</div>
            </div>
            <button onClick={onBack}
              style={{fontFamily:"inherit", cursor:"pointer", background:"#0a1020", border:"1px solid #1e3a5f",
                borderRadius:4, color:"#3a5a7a", fontSize:9, padding:"5px 12px", letterSpacing:1}}>
              ← BACK
            </button>
          </div>
        </div>

        <div style={{display:"flex", flex:1, overflow:"hidden"}}>

          {/* Sidebar */}
          <div style={{width:148, borderRight:"1px solid #1a2a40", overflowY:"auto", flexShrink:0, background:"#060c1a"}}>
            {TUTORIAL_SECTIONS.map(sec => (
              <div key={sec.id} className="tut-tab"
                onClick={() => setActiveSection(sec.id)}
                style={{
                  padding:"9px 12px", cursor:"pointer",
                  background: activeSection===sec.id ? "#0d1528" : "transparent",
                  borderLeft: `3px solid ${activeSection===sec.id ? sec.color : "transparent"}`,
                  borderBottom:"1px solid #0a1525",
                }}>
                <div style={{fontSize:12, marginBottom:2}}>{sec.icon}</div>
                <div style={{fontSize:8, color: activeSection===sec.id ? sec.color : "#3a5a7a",
                  fontFamily:"'Orbitron',sans-serif", letterSpacing:0.5, lineHeight:1.4}}>
                  {sec.title}
                </div>
              </div>
            ))}
          </div>

          {/* Content */}
          <div style={{flex:1, overflowY:"auto", padding:"18px 20px"}}>
            {section && (
              <>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${section.color}22`}}>
                  <span style={{fontSize:20}}>{section.icon}</span>
                  <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:13, color:section.color, letterSpacing:2}}>
                    {section.title}
                  </div>
                </div>
                {SectionContent && <SectionContent/>}
              </>
            )}
          </div>
        </div>

        {/* Footer nav */}
        <div style={{padding:"8px 20px", borderTop:"1px solid #1a2a40", background:"#050810",
          display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0}}>
          <span style={{fontSize:8, color:"#1e3a5f", letterSpacing:1}}>
            {activeIdx + 1} / {TUTORIAL_SECTIONS.length}
          </span>
          <div style={{display:"flex", gap:8}}>
            {activeIdx > 0 && (
              <button onClick={() => setActiveSection(TUTORIAL_SECTIONS[activeIdx-1].id)}
                style={{fontFamily:"inherit", cursor:"pointer", background:"#0a1020", border:"1px solid #1e3a5f",
                  borderRadius:4, color:"#88bbff", fontSize:9, padding:"5px 12px"}}>
                ← Prev
              </button>
            )}
            {activeIdx < TUTORIAL_SECTIONS.length-1 && (
              <button onClick={() => setActiveSection(TUTORIAL_SECTIONS[activeIdx+1].id)}
                style={{fontFamily:"inherit", cursor:"pointer", background:"#0a1020", border:"1px solid #4488ff",
                  borderRadius:4, color:"#88bbff", fontSize:9, padding:"5px 12px"}}>
                Next →
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
// ─── LOBBY ────────────────────────────────────────────────────────────────────
function Lobby({ onStart, onTutorial }) {
  const [playerCount, setPlayerCount] = useState(null);
  const [mode, setMode]               = useState(null);
  const [assignments, setAssignments] = useState({});
  const [step, setStep]               = useState("count");
  const [startingLives, setStartingLives] = useState(3);

  // 2-player: blue (top-left, hex 7) vs red (bottom-right, hex 105) — opposite sides
  const activeCorners = playerCount === 2
    ? ["blue", "red"]
    : playerCount ? CORNERS_ORDER.slice(0, playerCount) : [];
  const usedSpirits   = new Set(Object.values(assignments));
  const allAssigned   = activeCorners.every(c => assignments[c]);

  function assign(corner, spiritId) {
    setAssignments(a => ({ ...a, [corner]: spiritId }));
  }

  function handleStart() {
    const spirits = activeCorners.map(corner => {
      const def = SPIRIT_DEFS[assignments[corner]];
      const { homeNum } = CORNERS[corner];
      const facing = cornerFacing(homeNum);
      const { color: cornerColor } = CORNER_LABELS[corner];
      return { ...def, num: homeNum, facing, corner, color: cornerColor };
    });
    const teams = mode === "team"
      ? { a: activeCorners.slice(0,2), b: activeCorners.slice(2,4) }
      : null;
    onStart({ spirits, mode, teams, startingLives });
  }

  // 🧪 TESTING GROUNDS — one-click sandbox: 4-spirit free-for-all, dev panel on.
  function startTestingGrounds() {
    const ids = Object.keys(SPIRIT_DEFS);
    const spirits = CORNERS_ORDER.map((corner, i) => {
      const def = SPIRIT_DEFS[ids[i % ids.length]];
      const { homeNum } = CORNERS[corner];
      const facing = cornerFacing(homeNum);
      const { color: cornerColor } = CORNER_LABELS[corner];
      return { ...def, num: homeNum, facing, corner, color: cornerColor };
    });
    onStart({ spirits, mode: "ffa", teams: null, startingLives: 3, testMode: true });
  }

  const btnBase = { fontFamily:"inherit", cursor:"pointer", borderRadius:4, padding:"8px 18px", fontSize:11, transition:"all .15s", border:"1px solid" };

  return (
    <div style={{minHeight:"100vh", background:"#050810", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Share Tech Mono','Courier New',monospace"}}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap" rel="stylesheet"/>
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#2d3748}`}</style>
      <button onClick={startTestingGrounds} title="Skip setup — launch a 4-spirit sandbox with the dev panel"
        style={{position:'fixed',bottom:14,right:14,zIndex:50,fontFamily:"'Orbitron',sans-serif",fontSize:10,letterSpacing:1,
          cursor:'pointer',padding:'9px 14px',borderRadius:7,background:'#2a1030',border:'1.5px solid #cc66ff',color:'#e0a0ff',
          boxShadow:'0 0 18px #cc66ff55'}}>
        🧪 TESTING GROUNDS
      </button>

      <div style={{width:520, background:"#080f1e", border:"1px solid #1a2a40", borderRadius:10, padding:32}}>
        <div style={{textAlign:"center", marginBottom:28}}>
          <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:26, color:"#f6ad55", letterSpacing:4, marginBottom:4}}>⚡ RLSW</div>
          <div style={{fontSize:11, color:"#3a5a7a", letterSpacing:2}}>ROCK LEGENDS: SPIRIT WARS</div>
          <button onClick={onTutorial}
            style={{marginTop:14, fontFamily:"inherit", cursor:"pointer", background:"#0a1020",
              border:"1px solid #2a4a6a", borderRadius:4, color:"#5a8aaa", fontSize:9,
              padding:"6px 18px", letterSpacing:2, transition:"all .15s"}}
            onMouseEnter={e => { e.target.style.borderColor="#4488ff"; e.target.style.color="#88bbff"; }}
            onMouseLeave={e => { e.target.style.borderColor="#2a4a6a"; e.target.style.color="#5a8aaa"; }}>
            📖 HOW TO PLAY
          </button>
        </div>

        {/* Player count */}
        <div style={{marginBottom:24}}>
          <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10, fontFamily:"'Orbitron',sans-serif"}}>01 — How Many Players?</div>
          <div style={{display:"flex", gap:8}}>
            {[2,3,4].map(n => (
              <button key={n} onClick={() => { setPlayerCount(n); setAssignments({}); setMode(null); setStep("assign"); }}
                style={{...btnBase, flex:1, background: playerCount===n ? "#1a3560" : "#0a1020",
                  borderColor: playerCount===n ? "#4488ff" : "#1e3a5f", color: playerCount===n ? "#88bbff" : "#c0d0e0"}}>
                {n} Players
              </button>
            ))}
          </div>
        </div>

        {/* Spirit assignment */}
        {playerCount && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10, fontFamily:"'Orbitron',sans-serif"}}>02 — Choose Your Spirit</div>
            {activeCorners.map(corner => {
              const { label, color } = CORNER_LABELS[corner];
              return (
                <div key={corner} style={{marginBottom:10, padding:"10px 12px", background:"#050810", border:`1px solid ${color}33`, borderLeft:`3px solid ${color}`, borderRadius:5}}>
                  <div style={{fontSize:10, color, marginBottom:6, fontWeight:700}}>{label}</div>
                  <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
                    {SPIRIT_OPTIONS.map(sp => {
                      const taken = usedSpirits.has(sp.id) && assignments[corner] !== sp.id;
                      const selected = assignments[corner] === sp.id;
                      return (
                        <button key={sp.id} onClick={() => !taken && assign(corner, sp.id)}
                          disabled={taken}
                          style={{...btnBase, padding:"4px 10px", fontSize:10,
                            background: selected ? color+"33" : "#0a1020",
                            borderColor: selected ? color : "#1e3a5f",
                            color: taken ? "#1e3a5f" : selected ? color : "#c0d0e0",
                            opacity: taken ? 0.4 : 1, cursor: taken ? "not-allowed" : "pointer",
                            display:"flex", flexDirection:"column", alignItems:"center", gap:1}}>
                          <span>{sp.name}</span>
                          <span style={{fontSize:8, color: taken ? "#1e3a5f" : selected ? color+"cc" : "#3a5a7a"}}>
                            {sp.style} · ⚔️{sp.drive} 🛡️{sp.sustain}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Game mode */}
        {allAssigned && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10, fontFamily:"'Orbitron',sans-serif"}}>03 — Game Mode</div>
            <div style={{display:"flex", gap:8}}>
              <button onClick={() => setMode("ffa")}
                style={{...btnBase, flex:1, background: mode==="ffa"?"#1a3560":"#0a1020",
                  borderColor: mode==="ffa"?"#4488ff":"#1e3a5f", color: mode==="ffa"?"#88bbff":"#c0d0e0"}}>
                ⚔️ Free For All
              </button>
              {playerCount === 4 && (
                <button onClick={() => setMode("team")}
                  style={{...btnBase, flex:1, background: mode==="team"?"#1a3560":"#0a1020",
                    borderColor: mode==="team"?"#aa55ff":"#1e3a5f", color: mode==="team"?"#cc99ff":"#c0d0e0"}}>
                  🤝 Team Battle
                  <div style={{fontSize:8, color:"#3a5a7a", marginTop:2}}>Blue+Purple vs Red+Yellow</div>
                </button>
              )}
              {playerCount !== 4 && (
                <div style={{flex:1, padding:"8px 18px", fontSize:10, color:"#1e3a5f", textAlign:"center", border:"1px solid #1e3a5f33", borderRadius:4}}>
                  Team Battle requires 4 players
                </div>
              )}
            </div>
          </div>
        )}

        {/* Starting Lives */}
        {allAssigned && mode && (
          <div style={{marginBottom:24}}>
            <div style={{fontSize:9, color:"#3a5a7a", letterSpacing:2, textTransform:"uppercase", marginBottom:10, fontFamily:"'Orbitron',sans-serif"}}>04 — Knock Downs Before KO</div>
            <div style={{display:"flex", gap:6}}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setStartingLives(n)}
                  style={{...btnBase, flex:1, padding:"6px 4px",
                    background: startingLives===n ? "#301520" : "#0a1020",
                    borderColor: startingLives===n ? "#ff4488" : "#1e3a5f",
                    color: startingLives===n ? "#ff88bb" : "#c0d0e0"}}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{marginTop:6, fontSize:9, color:"#3a5a7a", padding:"6px 10px", background:"#050810", borderRadius:4, border:"1px solid #1a2a40"}}>
              {startingLives === 1 ? "Sudden death — one Knock Down and you're KO'd!" : `${startingLives} Knock Downs = KO. Each Knock Down: skip a turn, −1 FP, then respawn at full Vibe.`}
            </div>
          </div>
        )}

        {allAssigned && mode && (
          <button onClick={handleStart}
            style={{...btnBase, width:"100%", padding:"12px", fontSize:13, fontFamily:"'Orbitron',sans-serif",
              letterSpacing:2, background:"#1a3020", borderColor:"#44cc66", color:"#44ff88", marginTop:4}}>
            ▶ START GAME
          </button>
        )}
      </div>
    </div>
  );
}

// ─── TURN QUEUE ───────────────────────────────────────────────────────────────
function advanceTurnQueue(queue, spirits, mode, teams) {
  const [acted, ...rest] = queue;
  const aliveIds = new Set(spirits.filter(s => !s.knockedOut).map(s => s.id));
  const aliveRest = rest.filter(id => aliveIds.has(id));

  if (mode !== "team" || !teams) {
    return aliveIds.has(acted) ? [...aliveRest, acted] : aliveRest;
  }

  const actedSpirit = spirits.find(s => s.id === acted);
  const actedTeam = actedSpirit
    ? (teams.a.includes(actedSpirit.corner) ? "a" : "b")
    : null;
  const otherTeam = actedTeam === "a" ? "b" : "a";

  if (!aliveIds.has(acted)) return aliveRest;

  const firstOtherIdx = aliveRest.findIndex(id => {
    const sp = spirits.find(s => s.id === id);
    return sp && teams[otherTeam]?.includes(sp.corner);
  });

  if (firstOtherIdx === -1) return [...aliveRest, acted];

  const insertAt = firstOtherIdx + 1;
  return [...aliveRest.slice(0, insertAt), acted, ...aliveRest.slice(insertAt)];
}

// ─── BOARD FX ─────────────────────────────────────────────────────────────────
function BoardFX() {
  return (
    <>
      <image
        href={boardStarsImg}
        x={0} y={0} width={SVG_W} height={SVG_H}
        preserveAspectRatio="xMidYMid meet"
        style={{ mixBlendMode: "screen", pointerEvents: "none" }}
      />
      <image
        href={boardLightningImg}
        x={0} y={0} width={SVG_W} height={SVG_H}
        preserveAspectRatio="xMidYMid slice"
        style={{ mixBlendMode: "screen", pointerEvents: "none" }}
      />
    </>
  );
}

// ─── HUD NEON GLOW BORDERS ────────────────────────────────────────────────────
// Drop <NeonStrikeFX/> inside any position:relative HUD panel. At rare,
// random intervals the panel's border very faintly breathes with a soft
// neon glow, then fades back out. Each glow randomizes its color, subtle
// intensity, and duration, so windows never sync up. `color` biases the
// palette toward the panel owner's hue. `calm` panels glow even more
// rarely and more softly.
const NEON_STRIKE_PALETTE = ["#00eaff", "#4488ff", "#aa55ff", "#ff44dd", "#44ffaa", "#ffd700", "#ff6622"];

function NeonStrikeFX({ color, calm = false, radius = 8 }) {
  const hostRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [strike, setStrike] = useState(null);

  // Measure the parent panel so the SVG perimeter hugs it exactly,
  // even when the panel resizes (collapsing cards, log growth, etc.)
  useEffect(() => {
    const el = hostRef.current?.parentElement;
    if (!el) return;
    const measure = () => setDims({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Rare random glow scheduler — each panel runs its own clock
  useEffect(() => {
    let alive = true;
    let timer;
    const schedule = (first) => {
      const base = calm ? 24000 : 16000;
      const spread = calm ? 36000 : 28000;
      const wait = first ? Math.random() * (base + spread) : base + Math.random() * spread;
      timer = setTimeout(() => {
        if (!alive) return;
        const c = color && Math.random() < 0.6
          ? color
          : NEON_STRIKE_PALETTE[Math.floor(Math.random() * NEON_STRIKE_PALETTE.length)];
        const intensity = (calm ? 0.22 : 0.3) + Math.random() * 0.28; // subtle but noticeable
        const dur = 2200 + Math.random() * 2000; // slow, gentle breath
        setStrike({ key: Math.random(), color: c, dur, intensity });
        timer = setTimeout(() => {
          if (!alive) return;
          setStrike(null);
          schedule(false);
        }, dur + 60);
      }, wait);
    };
    schedule(true);
    return () => { alive = false; clearTimeout(timer); };
  }, [color, calm]);

  const { w, h } = dims;
  const inset = 1;
  const ready = strike && w > 20 && h > 20;
  const k = strike?.intensity ?? 0;
  const glow = 3 + 8 * k;            // soft drop-shadow blur radius
  const peak = 0.26 + 0.5 * k;       // max opacity of the breath — visible, still gentle

  return (
    <div ref={hostRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 30 }}>
      {ready && (
        <svg key={strike.key} width={w} height={h} viewBox={`0 0 ${w} ${h}`}
          style={{ position: "absolute", inset: 0, overflow: "visible", display: "block", opacity: peak }}>
          <rect
            x={inset} y={inset}
            width={Math.max(0, w - inset * 2)}
            height={Math.max(0, h - inset * 2)}
            rx={radius} ry={radius}
            fill="none"
            stroke={strike.color}
            strokeWidth={1.3}
            style={{
              filter: `drop-shadow(0 0 ${glow}px ${strike.color}) drop-shadow(0 0 ${glow * 2}px ${strike.color}44)`,
              animation: `hud-neon-pulse ${strike.dur}ms ease-in-out forwards`,
            }} />
        </svg>
      )}
    </div>
  );
}

// ─── SCORE TRACK OVERLAY ──────────────────────────────────────────────────────
const SCORE_TRACK_CORNERS = {
  blue:   { slots: [{x:138.1,y:175.0},{x:138.1,y:157.8},{x:153.1,y:149.8},{x:153.6,y:132.6},{x:168.6,y:124.3}] },
  yellow: { slots: [{x:641.4,y:175.3},{x:641.3,y:158.3},{x:626.4,y:150.0},{x:626.4,y:132.7},{x:613.7,y:126.6}] },
  purple: { slots: [{x:171.0,y:454.9},{x:154.8,y:446.4},{x:154.8,y:428.2},{x:139.1,y:419.3},{x:139.0,y:400.8}] },
  red:    { slots: [{x:613.2,y:455.5},{x:628.3,y:447.0},{x:628.3,y:429.6},{x:643.6,y:421.0},{x:643.1,y:403.3}] },
};

function ScoreTrackOverlay({ spirits, startingLives }) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {spirits.map(spirit => {
        const track = SCORE_TRACK_CORNERS[spirit.corner];
        if (!track) return null;
        const lives = spirit.lives ?? startingLives;
        if (lives <= 0 || spirit.knockedOut) return null;
        const slotIdx = Math.min(lives - 1, track.slots.length - 1);
        const { x: ox, y: oy } = track.slots[slotIdx];
        const r = 4.5;
        const color = CORNER_LABELS[spirit.corner]?.color ?? "#ffffff";
        const isLow = lives <= 1;
        return (
          <g key={spirit.id}>
            <circle cx={ox} cy={oy} r={r + 3} fill="none"
              stroke={isLow ? "#ff2222" : color} strokeWidth={1}
              opacity={0.35}
              style={{ animation: isLow ? "life-pulse 0.7s ease-in-out infinite alternate" : "life-pulse 2s ease-in-out infinite alternate" }}
            />
            <circle cx={ox} cy={oy} r={r}
              fill={isLow ? "#ff2222" : color}
              opacity={0.92}
              filter={`drop-shadow(0 0 ${isLow ? 5 : 3}px ${isLow ? "#ff0000" : color})`}
            />
            <circle cx={ox - r * 0.28} cy={oy - r * 0.28} r={r * 0.38}
              fill="#ffffff" opacity={0.7}
            />
          </g>
        );
      })}
      <style>{`
        @keyframes life-pulse {
          from { opacity: 0.25; }
          to   { opacity: 0.7; }
        }
      `}</style>
    </g>
  );
}

// ─── NOTE SYSTEM ──────────────────────────────────────────────────────────────
// Chromatic pool — 12 pitch classes. Sharp-side default; contextual spelling
// applied at render time based on the active Root Note + mode.
const NOTE_POOL = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Pitch class index lookup — works for both sharp and flat spellings
const PITCH_INDEX = {
  'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'Fb':4,'F':5,'E#':5,
  'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11,'Cb':11,'B#':0,
};

// Roots that prefer flat spellings for their note pool, keyed by mode.
// Major flat keys: F, Bb, Eb, Ab, Db
// Minor flat keys: D, G, C, F, Bb, Eb, Ab (relative majors are all flat keys)
const FLAT_ROOTS = {
  major: new Set(['F','Bb','Eb','Ab','Db']),
  minor: new Set(['D','G','C','F','Bb','Eb','Ab']),
};

// Split roots — canonical spelling depends on mode chosen
// e.g. G# → Ab major, G# minor
const SPLIT_ROOT_SPELLING = {
  'G#': { major:'Ab', minor:'G#' },
  'Ab': { major:'Ab', minor:'G#' },
  'C#': { major:'Db', minor:'C#' },
  'Db': { major:'Db', minor:'C#' },
};

// Enharmonic respell map — applied when a raw note becomes a new Root Note
// before mode is known (split roots resolved after pivot choice)
const ENHARMONIC_RESPELL = {
  'A#':'Bb', 'D#':'Eb', 'E#':'F', 'B#':'C', 'Cb':'B', 'Fb':'E', 'Gb':'F#',
  // G# and C# are intentionally NOT here — they resolve via SPLIT_ROOT_SPELLING
};

// Returns the canonical Root Note spelling given raw note + mode
function canonicalRoot(rawNote, mode) {
  if (SPLIT_ROOT_SPELLING[rawNote]) return SPLIT_ROOT_SPELLING[rawNote][mode];
  if (ENHARMONIC_RESPELL[rawNote])  return ENHARMONIC_RESPELL[rawNote];
  return rawNote;
}

// Returns the correctly spelled 12-note chromatic pool for a given root + mode.
// The root context determines sharp vs flat naming for ALL notes.
function getSpelledPool(rootNote, mode) {
  const root = canonicalRoot(rootNote, mode);
  const flatSet = FLAT_ROOTS[mode] ?? FLAT_ROOTS.major;
  const useFlats = flatSet.has(root);
  return [
    'C',
    useFlats ? 'Db' : 'C#',
    'D',
    useFlats ? 'Eb' : 'D#',
    'E',
    'F',
    'F#',   // Always F# in RLSW — never Gb (rock bias)
    'G',
    useFlats ? 'Ab' : 'G#',
    'A',
    useFlats ? 'Bb' : 'A#',
    'B',
  ];
}

// Converts a note name to pitch-class index (0–11), robust to either spelling
function pitchIndex(note) {
  return PITCH_INDEX[note] ?? NOTE_POOL.indexOf(note);
}

// Returns note N semitones above root, spelled correctly for the current context
function semitonesUpSpelled(root, mode, n) {
  const pool = getSpelledPool(root, mode);
  const rootIdx = pitchIndex(root);
  if (rootIdx === -1) return null;
  return pool[(rootIdx + n) % 12];
}

// Build scale notes from root + mode using interval formula, correctly spelled
function buildScale(rootNote, mode) {
  const intervals = mode === 'major'
    ? [0,2,4,5,7,9,11]   // W W H W W W H
    : [0,2,3,5,7,8,10];  // W H W W H W W (natural minor)
  const pool = getSpelledPool(rootNote, mode);
  const rootIdx = pitchIndex(rootNote);
  if (rootIdx === -1) return [];
  return intervals.map(n => pool[(rootIdx + n) % 12]);
}

// All 12 major and minor scales — generated programmatically from buildScale.
// F# major uses F as its maj7 (E# displayed as F — single enharmonic exception).
const MAJOR_SCALES = Object.fromEntries(
  ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B']
    .map(r => [r, buildScale(r,'major')])
);
const MINOR_SCALES = Object.fromEntries(
  ['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B']
    .map(r => [r, buildScale(r,'minor')])
);

// Every root now has both a major and minor scale — all roots are pivot candidates.
// The original A/E/B set is kept for backward compat but pivot logic is now universal.
const PIVOT_NOTES = new Set([
  'C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B',
  'C#','G#',  // split roots
]);

// ── HARMONIC CHARGE UPGRADE SYSTEM ───────────────────────────────────────────
// Every 8 HC points → player chooses one upgrade from up to 3 categories.
// Points carry over after crossing a threshold.
const HC_UPGRADE_THRESHOLD = 8;

// ── AMP / DICE SYSTEM ────────────────────────────────────────────────────────
// Dice tier is determined dynamically by how many amps the acting Spirit is
// within range of (<=4 hexes). Owning an amp upgrade places a physical amp token.
// 0 amps in range = d6, 1 = d8, 2 = d9, 3 = d12.
const AMP_RANGE      = 4;             // hex distance at which a Spirit is "plugged in"
const AMP_DICE       = ['d6','d8','d9','d12']; // index = amps in range (0-3)
const AMP_UPGRADE_MAX = 3;            // max amp upgrades (tokens) per spirit
// Legacy aliases so existing DICE_TIERS/DICE_TIERS_MAX refs still compile
const DICE_TIERS     = AMP_DICE;
const DICE_TIERS_MAX = AMP_UPGRADE_MAX;
// ── LIMELIGHT SYSTEM ─────────────────────────────────────────────────────────
const LIMELIGHT_HEX    = 56;   // centre stage hex
const LIMELIGHT_TO_WIN = 3;    // pose turns needed for instant Limelight victory
const FAME_TO_WIN      = 25;   // ⭐ Fame Points needed for a Fame Legend victory
const SPARK_MAX        = 6;    // ✨ max Fame Sparks on the board at once
const SPARKS_PER_FP    = 4;    // collect this many sparks to forge 1 Fame Point

// ── FAN ECONOMY ──────────────────────────────────────────────────────────────
// Fans never convert to Fame — they MULTIPLY the Fame every deed is worth.
// Two bands: Diehards (loyal core, stable) and Casuals (fickle, volatile).
// Crowds grow only by PERFORMING a clean track in the centre rings, decay at the
// edges, and scatter when you're demolished in the spotlight.
// Crowds grow by PERFORMING a clean track in the inner zones, sit steady in the
// neutral mid-floor, and only get bored after lingering on the outer edge.
//   • main  (d0) — the Limelight: top gain, hardens Diehards, recruits Unsure, demolition risk
//   • pit   (d1) — hugging the stage: still heavy (hardens, recruits, risk), slightly less gain
//   • floor (d2–3) — NEUTRAL territory: an average trickle, but no hardening, recruiting, or risk
//   • back  (d4+) — the cheap seats: no gain, and after a few turns out here fans drift off
const FAN_DIEHARD_WEIGHT  = 0.18;  // multiplier added per Diehard
const FAN_CASUAL_WEIGHT   = 0.07;  // multiplier added per Casual
const FAN_MULT_CAP        = 3.0;   // hard ceiling on the crowd multiplier
const FAN_DIEHARD_CAP     = 6;
const FAN_CASUAL_CAP      = 14;
const FAN_DIEHARD_START   = 2;
const FAN_CASUAL_START    = 0;
const FAN_GAIN_BY_RING    = { main: 2, pit: 1, floor: 1, back: 0 }; // casuals gained on a clean commit, by zone
const FAN_DECAY           = 2;     // casuals bored off per turn once the outer-edge grace runs out
const FAN_BORED_AFTER     = 3;     // consecutive turns in the OUTER ring before fans start drifting off
const FAN_PROMOTE_EVERY   = 3;     // consecutive centre-perform turns to harden 1 casual → diehard
const FAN_RECOVERY_LAG    = 3;     // your turns locked out of crowd-gain after a demolition
const FAN_FLEE_MIN        = 7;     // casuals that scatter on a demolition (low end)
const FAN_FLEE_MAX        = 10;    // (high end)
const FAN_DEFECT_TO_VICTOR = 2;    // of the fled casuals, how many swing straight to the demolisher

// Which centre ring a hex sits in, measured from the Limelight (hex 56).
function hexRingFromCenter(num) {
  const here = HEX_BY_NUM[num], hub = HEX_BY_NUM[LIMELIGHT_HEX];
  if (!here || !hub) return 'back';
  const d = axialDist(here.q, here.r, hub.q, hub.r);
  if (d === 0) return 'main';   // the Mainstage itself
  if (d === 1) return 'pit';    // the Pit — 6 hexes hugging the stage
  if (d <= 3) return 'floor';   // the Floor
  return 'back';                // Backstage / edges
}

// Crowd multiplier from a spirit's two fan bands.
function crowdMultiplier(diehards = FAN_DIEHARD_START, casuals = 0) {
  return Math.min(
    FAN_MULT_CAP,
    1 + FAN_DIEHARD_WEIGHT * diehards + FAN_CASUAL_WEIGHT * casuals
  );
}

// ── SPOTLIGHT SYSTEM ─────────────────────────────────────────────────────────
// A roaming searchlight that heals +1 Vibe to any spirit ending their turn on it.
// Moves to a new hex every full round (once all spirits have taken a turn).
const SPOTLIGHT_POOL = ALL_HEXES
  .filter(h => !h.edge && h.num !== 56)
  .map(h => h.num);

// ── EVENT SPACES ─────────────────────────────────────────────────────────────
// Marquee hexes scattered on the board. Step on one to rip a card from rock
// history — board chaos, buffs, curses, dice duels, and community rolls.
// A triggered event hex burns out and a new one lights up elsewhere.
const EVENT_HEX_COUNT     = 1;  // one marquee hex live at a time
const EVENT_RESPAWN_TURNS = 3;  // turns after a trigger before a new marquee lights up
const EVENT_HEX_POOL  = ALL_HEXES
  .filter(h => !h.edge && h.num !== LIMELIGHT_HEX)
  .map(h => h.num);

const EVENT_DECK = [
  {
    id: 'disco_inferno', icon: '🔥💿', title: 'DISCO INFERNO', color: '#ff6622',
    flavor: '"Disco sucks!" The crowd storms the field and torches a crate of records. Flaming discs rain down across the stage.',
    rules: '6 flaming discs land on random hexes for 2 full rounds. Step on one — or get pushed into one — and take 1 Vibe damage.',
    kind: 'board',
  },
  {
    id: 'bat_snack', icon: '🦇', title: 'BAT SNACK', color: '#aa55ff',
    flavor: 'Something leathery sails out of the crowd and lands at your feet. It looks... rubber? Only one way to find out.',
    rules: 'Roll d6. On 4+ — legendary confidence: +2 Vibe and +1 Drive for your next battle. On 1–3 — infection: lose all temp boosts and 1 Vibe.',
    kind: 'roll',
  },
  {
    id: 'satanic_panic', icon: '😈', title: 'SATANIC PANIC', color: '#ff3355',
    flavor: 'A televangelist plays your records backwards on national TV. EVERY spirit stands accused of backmasking demon-summoning lyrics.',
    rules: 'Community roll — every spirit rolls d6. Highest roller is acquitted WITH STYLE: +2 Drive for their next battle. Anyone rolling a 1 is convicted: Mojo Drain 1 turn.',
    kind: 'community',
  },
  {
    id: 'spinal_tap', icon: '🎚️', title: 'THESE GO TO ELEVEN', color: '#ffcc44',
    flavor: 'A mysterious tech rewires your rig. The knobs now go one louder. Where can you go from ten? Nowhere. Exactly.',
    rules: 'Your amps go to eleven: for your next 2 turns your dice tier counts +1 amp in range (caps at d12). No amps? You still feel one louder: die floor +1 next roll.',
    kind: 'auto',
  },
  {
    id: 'seance_27', icon: '🕯️', title: '27 CLUB SÉANCE', color: '#88ddff',
    flavor: 'The lights dip. A cold wind crosses the stage. Someone left a candle, a crossroads map, and a left-handed guitar...',
    rules: 'Roll d6. On 6 — the legends answer: +3 Harmonic Charge. On 2–5 — a faint whisper: +1 HC. On 1 — spooked: 2 stock slots frozen for 1 turn.',
    kind: 'roll',
  },
  {
    id: 'hotel_trash', icon: '📺', title: 'TRASH THE SUITE', color: '#44cc88',
    flavor: 'Checkout time. The TV is already airborne and the pool is six floors down. Everyone nearby scatters from the splash zone.',
    rules: 'All adjacent rivals are shoved 1 hex directly away from you. No rivals adjacent? Pure catharsis: +1 Vibe.',
    kind: 'auto',
  },
  {
    id: 'payola', icon: '💰', title: 'PAYOLA SCANDAL', color: '#ffaa22',
    flavor: 'A brown envelope changes hands at the radio station. Your single is suddenly in heavy rotation... or you are suddenly in the headlines.',
    rules: 'Roll d6. Even — your single charts: +2 Harmonic Charge. Odd — busted: lose 2 HC progress.',
    kind: 'roll',
  },
  {
    id: 'stage_dive', icon: '🤸', title: 'STAGE DIVE', color: '#ff88ff',
    flavor: 'You lock eyes with your nearest rival, point at the crowd, and leap. Whose fans love them more?',
    rules: 'You and your nearest rival both roll d6. Winner steals 1 Vibe from the loser. Tie — the crowd carries you both: +1 Vibe each.',
    kind: 'duel',
  },
  {
    id: 'backstage_pass', icon: '🎟️', title: 'BACKSTAGE PASS', color: '#44aaff',
    flavor: 'A laminated all-access pass glints on the floor. Whatever is behind that door, it is yours now.',
    rules: 'Draw a Mod Card immediately.',
    kind: 'auto',
  },
  {
    id: 'divine_mission', icon: '😎🕶️', title: 'DIVINE MISSION', color: '#1a1a1a',
    flavor: 'Black suit. Black hat. Black shades. You are on a mission from God — and you are putting the band back together. The faithful who scattered come marching home.',
    rules: 'Reassemble the band: every fan in the Unsure pool returns to YOU as Casuals, and your demolition lockout clears. +1 Vibe of righteous purpose. Plus a blessing — you shrug off the NEXT demolition or hazard that would hit you.',
    kind: 'auto',
  },
  {
    id: 'back_to_past', icon: '🎸⏰', title: 'BACK TO THE PAST', color: '#d97b29',
    flavor: 'Wrong decade, right guitar. The crowd wants a slow one — so give them the slow one. Then play them something they are NOT ready for yet... but their kids are gonna love it.',
    rules: 'A two-part PLAY CHALLENGE. Stage 1 — match SLOW-DANCE ANGEL for Harmonic Charge. Stage 2 — rip DUCKWALK DYNAMO for a wave of new fans. Fumble a note and you flicker out of existence: each missed note costs 1 Vibe — but the fade can NEVER knock you out. Stage 2 happens no matter how Stage 1 goes.',
    kind: 'riff_challenge',
  },
];
const EVENT_BY_ID = Object.fromEntries(EVENT_DECK.map(e => [e.id, e]));

// ── BACK TO THE PAST — two-stage PLAY CHALLENGE (its own mini riff engine) ────
// Stages are scale-degree sequences (degree 0 = A3, A-natural-minor) so they
// reuse the Note-Track letter/pitch system. All naturals → no Shift needed.
const BTTP_STAGES = {
  angel: {
    name: 'SLOW-DANCE ANGEL', icon: '💫', accent: '#7fb0ff', view: 'piano',
    blurb: 'Read the lit keys and play each chord — no labels, no second guesses.',
    // Doo-wop changes: Am – F – C – G – Am (all natural triads → white keys)
    chords: [['a','c','e'], ['f','a','c'], ['c','e','g'], ['g','b','d'], ['a','c','e']],
    window: 3000, gap: 320, reward: 'hc', pbLit: 560, pbGap: 170,
  },
  goode: {
    name: 'DUCKWALK DYNAMO', icon: '🦆', accent: '#ff9a3c', view: 'piano',
    blurb: 'Same piano, faster changes — find the power chords by feel.',
    // Berry-style power chords (root + fifth): A5 A5 C5 A5 D5 E5 A5
    chords: [['a','e'], ['a','e'], ['c','g'], ['a','e'], ['d','a'], ['e','b'], ['a','e']],
    window: 2200, gap: 220, reward: 'fans', pbLit: 320, pbGap: 110,
  },
};
const BTTP_PASS_RATIO = 0.6; // share of chords nailed CLEANLY to "nail" a stage
const BTTP_NAT_DEG = { a:0, b:1, c:2, d:3, e:4, f:5, g:6 }; // keystroke → scale degree
function bttpLetterFreq(letter) { return riffDegreeFreq(BTTP_NAT_DEG[letter] ?? 0, false); }
function bttpStageData(key) {
  const st = BTTP_STAGES[key];
  const rhythm = st.chords.map((_, i) => ({ window: st.window, gap: i === 0 ? 0 : st.gap }));
  return { ...st, key, rhythm };
}

// ── 🧪 Signature-skill test registry — Ronin & Monster (the two built so far) ──
// Each entry unlocks the named skill (+ any prereqs) for its spirit; `fire`
// marks the ones with a self-contained trigger we can run on the spot.
const SIGNATURE_TESTS = {
  cosmic_ronin: { name: 'Shredding Ronin', color: '#4488ff', skills: [
    { id:'psycho_bushido', label:'🌀 Psycho Bushido', pre:[] },
    { id:'e_rush',         label:'🎴 E-Rush',         pre:[] },
    { id:'thousand_beats', label:'⚡ Thousand Beats',  pre:[], fire:'thousand' },
    { id:'hydra',          label:'🐉 Hydra',           pre:['amp_1','amp_2','amp_3'], fire:'hydra' },
  ]},
  Metalness_Monster: { name: 'Metalness Monster', color: '#ffcc00', skills: [
    { id:'master_moshpits', label:'🤘 Master of Moshpits', pre:[] },
    { id:'riff_slayer',     label:'🗡️ Riff Slayer',        pre:[] },
    { id:'paranoia',        label:'🌀 Paranoia',           pre:['discord_1'] },
    { id:'azrael',          label:'💀 Azrael',             pre:[] },
  ]},
};
const FLAMING_DISC_COUNT  = 6;
const FLAMING_DISC_ROUNDS = 2;
const GROUPIE_COOLDOWN    = 3; // own turns before a deployed groupie crew is ready again

// ─── RIFF LIBRARY ─────────────────────────────────────────────────────────────
// Legendary riffs hidden in the note system. Place the riff's opening interval
// pattern (any key — only the intervals matter) on your track, hit CONFIRM, and
// the full riff plays out with real rhythm. First discovery = full Fame bonus;
// replays earn 1 FP. Patterns are public-domain classics + timeless theory moves.
//
// notes: [semitoneOffsetFromFirstNote, durationInBeats, restAfterInBeats?]
// triggerLen: how many opening notes must appear on the track (interval-matched)
const RIFF_LIBRARY = [
  { id:'fate_knocks', name:'FATE KNOCKS', fp:4, bpm:100, triggerLen:4, icon:'🚪',
    hint:'Three short, one looong — destiny at the door.',
    flavor:'Beethoven\'s Fifth — the most famous four notes ever written.',
    notes:[[0,.6],[0,.6],[0,.6],[-4,2.6,.4],[-2,.6],[-2,.6],[-2,.6],[-5,3]] },
  { id:'ode_to_joy', name:'ODE TO JOY', fp:3, bpm:132, triggerLen:5, icon:'🕊️',
    hint:'Two repeated notes step up, hold hands, and walk back down.',
    flavor:'Beethoven\'s Ninth — the anthem of anthems.',
    notes:[[0,1],[0,1],[1,1],[3,1],[3,1],[1,1],[0,1],[-2,1.8]] },
  { id:'toccata_doom', name:'TOCCATA OF DOOM', fp:5, bpm:84, triggerLen:5, icon:'🦇',
    hint:'An organ wail, a dramatic pause, then a plunge into darkness.',
    flavor:'Bach\'s Toccata in D minor — the haunted-castle special.',
    notes:[[0,.4],[-2,.4],[0,1.6,.5],[-2,.45],[-4,.45],[-5,.45],[-7,.45],[-8,2.2]] },
  { id:'mountain_king', name:'MOUNTAIN KING', fp:4, bpm:120, triggerLen:5, icon:'🏔️',
    hint:'A sneaky stepwise climb that wants to start running.',
    flavor:'Grieg\'s hall-creeping classic. It only gets faster from here.',
    notes:[[0,.5],[2,.5],[3,.5],[5,.5],[7,.5],[3,.5],[7,1.6]] },
  { id:'fur_elise', name:'FÜR ELISE', fp:4, bpm:120, triggerLen:5, icon:'🌹',
    hint:'Two notes trembling a half-step apart, again and again.',
    flavor:'Beethoven\'s bagatelle — the ringtone of the 1800s.',
    notes:[[0,.5],[-1,.5],[0,.5],[-1,.5],[0,.5],[-5,.5],[-2,.5],[-4,.5],[-9,1.6]] },
  { id:'dies_irae', name:'DIES IRAE', fp:3, bpm:80, triggerLen:4, icon:'💀',
    hint:'The medieval chant of wrath. Doom metal\'s great-grandfather.',
    flavor:'Day of wrath — quoted by every horror score ever made.',
    notes:[[0,1],[-1,.8],[0,.8],[-3,1.2],[-1,.8],[-5,.8],[-3,1.2],[-3,1.6]] },
  { id:'valkyries', name:'RIDE OF THE VALKYRIES', fp:4, bpm:100, triggerLen:4, icon:'🐎',
    hint:'A galloping leap up a minor chord, then back to charge again.',
    flavor:'Wagner\'s war cry. Smells like victory.',
    notes:[[0,.7],[5,.3],[8,1],[5,.3],[8,.7],[0,1.8]] },
  { id:'william_tell', name:'WILLIAM TELL GALLOP', fp:5, bpm:152, triggerLen:6, icon:'🏹',
    hint:'Da-da-DUM, da-da-DUM, da-da-DUM-DUM-DUM.',
    flavor:'Rossini\'s overture — hi-ho and away.',
    notes:[[0,.33],[0,.33],[5,.66],[0,.33],[0,.33],[5,.66],[0,.33],[0,.33],[5,.45],[7,.45],[9,1.4]] },
  { id:'new_world', name:'NEW WORLD LARGO', fp:3, bpm:76, triggerLen:4, icon:'🌅',
    hint:'A gentle rise of a third, held, then easing home.',
    flavor:'Dvořák\'s Largo — goin\' home, goin\' home.',
    notes:[[0,1],[3,1.4],[3,1],[0,1],[-2,.8],[-4,1.4],[-2,2]] },
  { id:'eine_kleine', name:'EINE KLEINE', fp:3, bpm:120, triggerLen:5, icon:'🎻',
    hint:'A bold call bouncing between root and the note below... twice.',
    flavor:'Mozart\'s little night music — big powdered-wig energy.',
    notes:[[0,.5,.25],[-5,.5,.25],[0,.5,.25],[-5,.5,.25],[0,.4],[4,.4],[7,1.4]] },
  { id:'canon_groove', name:'CANON GROOVE', fp:4, bpm:96, triggerLen:5, icon:'🔁',
    hint:'Eight bass notes that secretly power half of all pop music.',
    flavor:'Pachelbel\'s Canon progression — it never lets go.',
    notes:[[0,1],[-5,1],[-3,1],[-8,1],[-7,1],[0,1],[-7,1],[-5,1.5]] },
  { id:'bumblebee', name:'FLIGHT OF THE BUMBLEBEE', fp:5, bpm:160, triggerLen:6, icon:'🐝',
    hint:'A chromatic blur — down four half-steps and buzzing back up.',
    flavor:'Rimsky-Korsakov\'s shred étude. Finger cramps included.',
    notes:[[0,.25],[-1,.25],[-2,.25],[-3,.25],[-2,.25],[-1,.25],[0,.25],[-1,.6]] },
  { id:'moonlight', name:'MOONLIGHT ARPEGGIO', fp:4, bpm:80, triggerLen:6, icon:'🌙',
    hint:'Three notes rolling like waves, twice over.',
    flavor:'Beethoven\'s Moonlight Sonata — slow triplets forever.',
    notes:[[0,.66],[5,.66],[8,.66],[0,.66],[5,.66],[8,1.4]] },
  { id:'power_stance', name:'POWER STANCE', fp:2, bpm:140, triggerLen:4, icon:'🤘',
    hint:'Root, fifth, root, fifth. The oldest move in rock.',
    flavor:'Two notes. Infinite attitude.',
    notes:[[0,.5],[7,.5],[0,.5],[7,1]] },
  { id:'penta_strut', name:'PENTA STRUT', fp:3, bpm:112, triggerLen:5, icon:'🕶️',
    hint:'Climb the five sacred steps of the minor pentatonic.',
    flavor:'The scale every guitar hero learned first.',
    notes:[[0,.5],[3,.5],[5,.5],[7,.5],[10,1.2]] },
  { id:'blues_crawl', name:'BLUES CRAWL', fp:3, bpm:104, triggerLen:5, icon:'🎩',
    hint:'Pentatonic climb with a sly chromatic squeeze in the middle.',
    flavor:'The blue note — the most expensive half-step in music.',
    notes:[[0,.6],[3,.6],[5,.6],[6,.6],[7,1],[10,.6],[0,1.2]] },
  { id:'the_lick', name:'THE LICK™', fp:5, bpm:126, triggerLen:5, icon:'😏',
    hint:'THE jazz cliché. If you know, you know.',
    flavor:'Played at every jam session since the dawn of time.',
    notes:[[0,.5],[2,.5],[3,.5],[5,.5],[2,1],[-2,.5],[0,1.4]] },
  { id:'andalusian', name:'ANDALUSIAN SLIDE', fp:2, bpm:92, triggerLen:4, icon:'💃',
    hint:'Four steps down the Spanish staircase.',
    flavor:'The flamenco descent — drama in four notes.',
    notes:[[0,1],[-2,1],[-4,1],[-5,1.8]] },
  { id:'tritone_summon', name:'TRITONE SUMMONING', fp:3, bpm:66, triggerLen:4, icon:'😈',
    hint:'The devil\'s interval, tolled like a bell.',
    flavor:'Diabolus in musica — banned in church, beloved on stage.',
    notes:[[0,1],[6,1],[0,1],[6,1.8]] },
  { id:'dream_drift', name:'DREAM SEQUENCE', fp:3, bpm:110, triggerLen:5, icon:'💭',
    hint:'Whole steps only — gravity politely declines to apply.',
    flavor:'The whole-tone float. Cue the wavy flashback screen.',
    notes:[[0,.6],[2,.6],[4,.6],[6,.6],[8,1.4]] },
  { id:'circle_rider', name:'CIRCLE RIDER', fp:3, bpm:100, triggerLen:4, icon:'🎡',
    hint:'Leap by fifths, three times in a row.',
    flavor:'Riding the circle of fifths like a carousel.',
    notes:[[0,.7],[7,.7],[2,.7],[9,1.4]] },
  { id:'chromatic_meltdown', name:'CHROMATIC MELTDOWN', fp:2, bpm:140, triggerLen:5, icon:'🫠',
    hint:'Five half-steps straight down. No survivors.',
    flavor:'Every note between here and despair.',
    notes:[[0,.3],[-1,.3],[-2,.3],[-3,.3],[-4,1.2]] },
  { id:'spy_twang', name:'SPY TWANG', fp:3, bpm:108, triggerLen:5, icon:'🕵️',
    hint:'A slinky harmonic-minor crawl. Trust no one.',
    flavor:'Surf reverb sold separately.',
    notes:[[0,.5],[1,.5],[4,.5],[5,.5],[7,1.4]] },
  // ── HOMAGE WING — original riffs in legendary styles. The names wink at
  // rock history; the melodies are ours. Recognition lives in the lore. ──
  { id:'sweet_riff', name:"SWEET RIFF O' MINE", fp:5, bpm:122, triggerLen:6, icon:'🎩',
    hint:'A string-skipping arpeggio exercise that refuses to stay a warm-up.',
    flavor:'Legend says the most famous intro ever started as a finger exercise. This one is still auditioning.',
    notes:[[0,.5],[4,.5],[11,.5],[7,.5],[4,.5],[11,.5],[9,.5],[7,1.6]] },
  { id:'beast_gallop', name:'GALLOP OF THE BEAST', fp:5, bpm:168, triggerLen:8, icon:'🐴',
    hint:'Da-da-dum hooves on the root, climbing one scream at a time.',
    flavor:'Two minutes to midnight, eight notes to glory. Up the irons.',
    notes:[[0,.25],[0,.25],[0,.5],[3,.5],[0,.25],[0,.25],[0,.5],[5,.5],[0,.25],[0,.25],[0,.5],[7,1.2]] },
  { id:'clean_spirit', name:'SMELLS LIKE CLEAN SPIRIT', fp:4, bpm:92, triggerLen:6, icon:'🧼',
    hint:'Four sludgy steps that flunked music school on purpose.',
    flavor:'Flannel not included. Tune down, look down, melt faces.',
    notes:[[0,.8],[3,.8],[2,.8],[0,.8],[-2,.8],[0,1.6]] },
  { id:'disco_lightning', name:'DISCO BALL LIGHTNING', fp:3, bpm:116, triggerLen:6, icon:'🪩',
    hint:'A bassline that walks down to the dance floor and back.',
    flavor:'Survived the Demolition. The groove is immortal.',
    notes:[[0,.25],[0,.25],[-2,.5],[0,.25],[-5,.5],[0,.25],[-2,.5],[0,1]] },
  { id:'surf_apocalypse', name:"SURF'S APOCALYPSE", fp:4, bpm:152, triggerLen:6, icon:'🌊',
    hint:'A harmonic-minor wipeout, tremolo-picked all the way down.',
    flavor:'Hang ten on the wave at the end of the world.',
    notes:[[0,.3],[-1,.3],[-4,.3],[-5,.3],[-7,.3],[-8,.3],[0,1.4]] },
  { id:'punks_not_debt', name:"PUNK'S NOT DEBT", fp:3, bpm:184, triggerLen:6, icon:'🧷',
    hint:'Three chords, zero patience, all downstrokes.',
    flavor:'Recorded in one take because the second take costs money.',
    notes:[[0,.25],[0,.25],[0,.25],[0,.25],[5,.25],[5,.25],[7,.25],[7,.5]] },
  { id:'funk_trunk', name:'FUNK IN THE TRUNK', fp:4, bpm:104, triggerLen:6, icon:'🦆',
    hint:'A sixteenth-note strut with one filthy chromatic squeeze.',
    flavor:'The one. It is always about the one.',
    notes:[[0,.25],[3,.25],[5,.25],[6,.25],[5,.25],[3,.25],[0,.5],[-2,1]] },
  { id:'stadium_stomper', name:'STADIUM STOMPER', fp:4, bpm:120, triggerLen:6, icon:'🏟️',
    hint:'A pentatonic anthem built for 80,000 voices.',
    flavor:'Clap. Clap. Sing the next part even if you don\'t know the words.',
    notes:[[0,.75],[3,.75],[0,.75],[5,.75],[0,.75],[7,1],[5,.75],[3,1.6]] },
  { id:'neon_lords', name:'SYNTH LORDS OF NEON', fp:4, bpm:132, triggerLen:6, icon:'🌆',
    hint:'A minor arpeggio with a ninth, gliding through the rain.',
    flavor:'The year is always 1984 somewhere.',
    notes:[[0,.5],[3,.5],[7,.5],[2,.5],[7,.5],[3,.5],[0,1.4]] },
  { id:'one_band_army', name:'ONE-BAND ARMY', fp:4, bpm:124, triggerLen:6, icon:'🥁',
    hint:'A lone swaggering stomp the whole stadium hums anyway.',
    flavor:'Two members. One riff. Zero mercy.',
    notes:[[0,.75],[3,.5],[0,.75],[-2,.5],[-4,.75],[-5,.75],[0,1.6]] },
  { id:'sludge_commandment', name:'SLUDGE COMMANDMENT', fp:3, bpm:60, triggerLen:5, icon:'🌫️',
    hint:'Five doom-laden tones, slower than continental drift.',
    flavor:'What is this that stands before me? ...A very heavy riff.',
    notes:[[0,1.5],[3,1.5],[0,1.5],[6,1.5],[5,2.5]] },
];
const RIFF_BY_ID = Object.fromEntries(RIFF_LIBRARY.map(r => [r.id, r]));
// Genre wing of each riff — used by the Riffbook's Legacy Codex
const RIFF_GENRE = {
  fate_knocks:'classical', ode_to_joy:'classical', toccata_doom:'classical',
  mountain_king:'classical', fur_elise:'classical', dies_irae:'classical',
  valkyries:'classical', william_tell:'classical', new_world:'classical',
  eine_kleine:'classical', canon_groove:'classical', bumblebee:'classical',
  moonlight:'classical',
  power_stance:'theory', penta_strut:'theory', blues_crawl:'theory',
  the_lick:'theory', andalusian:'theory', tritone_summon:'theory',
  dream_drift:'theory', circle_rider:'theory', chromatic_meltdown:'theory',
  spy_twang:'theory',
  sweet_riff:'homage', beast_gallop:'homage', clean_spirit:'homage',
  disco_lightning:'homage', surf_apocalypse:'homage', punks_not_debt:'homage',
  funk_trunk:'homage', stadium_stomper:'homage', neon_lords:'homage',
  one_band_army:'homage', sludge_commandment:'homage',
};
const RIFF_GENRE_META = {
  classical: { label:'CLASSICAL', color:'#88ddff' },
  theory:    { label:'THEORY',    color:'#44cc88' },
  homage:    { label:'HOMAGE',    color:'#ff88ff' },
};
// Canonical playback name for each pitch class (PITCH_INDEX convention, C = 0)
const PC_PLAY_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Interval signature (consecutive pitch-class diffs, mod 12) of a riff's trigger
function riffTriggerDiffs(riff) {
  const offs = riff.notes.slice(0, riff.triggerLen).map(n => n[0]);
  const d = [];
  for (let i = 0; i < offs.length - 1; i++) d.push(((offs[i + 1] - offs[i]) % 12 + 12) % 12);
  return d;
}

// Scan a note track for any riff trigger. Key-agnostic: only the interval
// pattern matters. Returns { riff, rootPc } of the best match (longest trigger,
// ties broken by FP) or null.
function detectRiff(noteTrack) {
  if (!noteTrack || noteTrack.length < 3) return null;
  const pcs = noteTrack.map(n => pitchIndex(n)).filter(p => p >= 0);
  if (pcs.length < 3) return null;
  const diffs = [];
  for (let i = 0; i < pcs.length - 1; i++) diffs.push(((pcs[i + 1] - pcs[i]) % 12 + 12) % 12);
  let best = null;
  for (const riff of RIFF_LIBRARY) {
    const td = riffTriggerDiffs(riff);
    if (td.length > diffs.length) continue;
    for (let s = 0; s + td.length <= diffs.length; s++) {
      let ok = true;
      for (let k = 0; k < td.length; k++) {
        if (diffs[s + k] !== td[k]) { ok = false; break; }
      }
      if (ok) {
        const cand = { riff, rootPc: pcs[s], len: td.length };
        if (!best || cand.len > best.len || (cand.len === best.len && riff.fp > best.riff.fp)) best = cand;
        break;
      }
    }
  }
  return best;
}

// ─── CADENCE OBJECTIVES ──────────────────────────────────────────────────────
// Multi-turn music-theory goals: the LAST note of your confirmed track each
// turn is your "final". String the right finals together across consecutive
// turns — in any key — and you resolve a cadence for Fame. Degrees are
// semitone offsets from the root you establish on the run's first final.
const CADENCE_OBJECTIVES = [
  { id:'amen', name:'AMEN CADENCE', formula:'I → IV → I', degrees:[0,5,0], fp:2, icon:'🙏',
    desc:'End three consecutive turns on the root, the 4th, then home again. The gospel resolve.' },
  { id:'deceptive', name:'DECEPTIVE CADENCE', formula:'I → V → vi', degrees:[0,7,9], fp:3, icon:'🎭',
    desc:'Promise a resolution... then swerve to the relative minor. The audience gasps.' },
  { id:'authentic', name:'THE FULL RESOLVE', formula:'I → IV → V → I', degrees:[0,5,7,0], fp:4, icon:'👑',
    desc:'The king of cadences: root, 4th, 5th, and triumphantly home. Four turns of destiny.' },
  { id:'circle', name:'CIRCLE OF RESOLUTION', formula:'I → vi → ii → V → I', degrees:[0,9,2,7,0], fp:6, icon:'🌀',
    desc:'The grand tour — five turns of jazz-approved voice leading. Maximum sophistication.' },
];
const CADENCE_BY_ID = Object.fromEntries(CADENCE_OBJECTIVES.map(c => [c.id, c]));

// ── CADENCE HINTS ────────────────────────────────────────────────────────────
// Given the finals trail, work out which ending note(s) would advance (or
// resolve) each off-cooldown cadence. For each cadence, find the LONGEST tail
// of the trail that matches the start of its degree pattern (the first final
// of the run sets the root), then report the next required pitch class.
function cadenceHints(trail, cooldowns = {}) {
  if (!trail || trail.length === 0) return [];
  const hints = [];
  for (const obj of CADENCE_OBJECTIVES) {
    if ((cooldowns[obj.id] ?? 0) > 0) continue;
    const d = obj.degrees;
    let matched = 0;
    for (let k = Math.min(d.length - 1, trail.length); k >= 1; k--) {
      const start = trail.length - k;
      const root = trail[start];
      let ok = true;
      for (let i = 1; i < k; i++) {
        if (((root + d[i]) % 12) !== trail[start + i]) { ok = false; break; }
      }
      if (ok) { matched = k; break; } // longest partial match wins
    }
    if (matched >= 1) {
      const root   = trail[trail.length - matched];
      const nextPc = (root + d[matched]) % 12;
      hints.push({
        cadence:  obj,
        matched,                       // finals already in place
        total:    d.length,
        nextPc,                        // pitch class to end on next turn
        nextNote: PC_PLAY_NAMES[nextPc],
        rootNote: PC_PLAY_NAMES[root],
        resolves: matched === d.length - 1, // next final completes it!
      });
    }
  }
  // Most-progressed first, then biggest Fame payout
  hints.sort((a, b) => (b.matched / b.total) - (a.matched / a.total) || b.cadence.fp - a.cadence.fp);
  return hints;
}

// ── AMP KNOB ─────────────────────────────────────────────────────────────────
// Rotary amp-panel knob (0–1).
//   · Drag in ANY direction — up or right turns it clockwise, down or left back
//   · Hold SHIFT while dragging for fine control (¼ speed)
//   · Scroll wheel over the knob nudges it
//   · Double-click resets to default
function AmpKnob({ label, value, onChange, onCommit, defaultValue = 0.5, color = "#ffcc44", title }) {
  const angle = -135 + value * 270;
  const knobRef  = useRef(null);
  // Live refs so native/window listeners always read fresh values
  const valueRef = useRef(value);                 valueRef.current = value;
  const cbRef    = useRef({ onChange, onCommit }); cbRef.current   = { onChange, onCommit };

  function onPointerDown(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    const startX = e.clientX, startY = e.clientY;
    const startV = valueRef.current;
    const move = ev => {
      // Up OR right = clockwise; both axes combine so circular drags feel natural
      const delta = (startY - ev.clientY) + (ev.clientX - startX);
      const speed = ev.shiftKey ? 480 : 120; // shift = fine adjustment
      cbRef.current.onChange(Math.max(0, Math.min(1, startV + delta / speed)));
    };
    const up = ev => {
      try { el.releasePointerCapture(ev.pointerId); } catch (_) {}
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (cbRef.current.onCommit) cbRef.current.onCommit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // Scroll wheel nudges the knob — native non-passive listener so the page
  // doesn't scroll while you're dialing in a tone
  useEffect(() => {
    const el = knobRef.current;
    if (!el) return;
    let commitT = null;
    const onWheel = e => {
      e.preventDefault(); e.stopPropagation();
      const step = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.015 : 0.06);
      cbRef.current.onChange(Math.max(0, Math.min(1, valueRef.current + step)));
      clearTimeout(commitT);
      commitT = setTimeout(() => { if (cbRef.current.onCommit) cbRef.current.onCommit(); }, 350);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); clearTimeout(commitT); };
  }, []);

  // Value arc ticks (11 dots around the sweep, lit up to current value)
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const tA = (-135 + (i / 10) * 270) * (Math.PI / 180);
    const lit = value >= i / 10 - 0.02;
    return { x: 19 + Math.sin(tA) * 21, y: 19 - Math.cos(tA) * 21, lit };
  });
  return (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:1, userSelect:"none"}} title={title}>
      <div style={{position:"relative", width:38, height:38}}>
        {ticks.map((t, i) => (
          <div key={i} style={{position:"absolute", left:t.x-1, top:t.y-1, width:2.5, height:2.5,
            borderRadius:"50%", background: t.lit ? color : "#22304a",
            boxShadow: t.lit ? `0 0 3px ${color}` : "none", transition:"background .1s"}}/>
        ))}
        <div
          ref={knobRef}
          onPointerDown={onPointerDown}
          onDoubleClick={() => { onChange(defaultValue); if (onCommit) onCommit(); }}
          style={{
            position:"absolute", left:4, top:4, width:30, height:30, borderRadius:"50%",
            background:"radial-gradient(circle at 35% 28%, #344560, #0a0e1a 70%)",
            border:"1.5px solid #283850",
            boxShadow:"0 2px 5px #000000aa, inset 0 1px 2px #ffffff22",
            cursor:"grab", touchAction:"none",
          }}>
          {/* indicator line */}
          <div style={{position:"absolute", inset:0, transform:`rotate(${angle}deg)`}}>
            <div style={{position:"absolute", left:"50%", top:2, width:2.5, height:10, marginLeft:-1.25,
              background:color, borderRadius:2, boxShadow:`0 0 4px ${color}`}}/>
          </div>
        </div>
      </div>
      <span style={{fontSize:6, color:"#7a90aa", letterSpacing:1, fontFamily:"'Orbitron',sans-serif"}}>{label}</span>
    </div>
  );
}

// Check whether the tail of a finals trail completes any cadence (skipping
// objectives on cooldown). Longest pattern wins.
function detectCadence(trail, cooldowns = {}) {
  if (!trail || trail.length < 3) return null;
  let best = null;
  for (const obj of CADENCE_OBJECTIVES) {
    if ((cooldowns[obj.id] ?? 0) > 0) continue;
    const d = obj.degrees;
    if (d.length > trail.length) continue;
    const tail = trail.slice(trail.length - d.length);
    const root = tail[0];
    let ok = true;
    for (let i = 1; i < d.length; i++) {
      if (((root + d[i]) % 12) !== tail[i]) { ok = false; break; }
    }
    if (ok && (!best || d.length > best.degrees.length)) best = obj;
  }
  return best;
}

// Three tiers, each unlocking / boosting random on-hit physical effects.
// Effects roll independently on a successful swing hit.
const SWING_UPGRADE_TIERS = [
  {
    id: 'swing_1',
    label: 'Wild Swing',
    icon: '🌀',
    desc: 'On hit: 20% chance to TRIP — target\'s movement halved next turn.',
    maxLevel: 1,
  },
  {
    id: 'swing_2',
    label: 'Reckless Abandon',
    icon: '💥',
    desc: 'Trip chance → 35%. Adds DROP INSTRUMENT (20%) — target loses 1 Drive until recovered.',
    prereq: 'swing_1',
    maxLevel: 1,
  },
  {
    id: 'swing_3',
    label: 'Dazed & Confused',
    icon: '😵',
    desc: 'Adds DAZED (15%) — target\'s next move goes to a random wrong hex. All chances bumped.',
    prereq: 'swing_2',
    maxLevel: 1,
  },
];

// Chance tables per upgrade tier (cumulative unlocks)
// { trip, drop, dazed } — each 0–1 probability
const SWING_EFFECT_CHANCES = {
  swing_1: { trip: 0.20, drop: 0,    dazed: 0    },
  swing_2: { trip: 0.35, drop: 0.20, dazed: 0    },
  swing_3: { trip: 0.40, drop: 0.25, dazed: 0.15 },
};

// Vintage dance-craze names flashed on a plain swing (no upgrade effect landed).
// Picked once per battle (stored on battleState) so it stays stable across renders.
const SWING_DANCE_NAMES = [
  'TWIST','MASHED POTATO','THE JERK','WATUSI','THE HUSTLE','FUNKY CHICKEN',
  'THE PONY','THE SWIM','THE FRUG','SHIMMY','CHARLESTON','JITTERBUG',
  'THE MONKEY','HAND JIVE','THE STROLL','THE MADISON','THE SHAG','BOOGIE',
];
function pickDanceName() {
  return SWING_DANCE_NAMES[Math.floor(Math.random() * SWING_DANCE_NAMES.length)];
}

// Hexes away from own amp before it auto-unplugs
const AMP_UNPLUG_DIST = 3;

// ── DISCORD UPGRADE PATH ─────────────────────────────────────────────────────
// Three tiers unlocked via the HC upgrade system. Once a tier is unlocked,
// those interval notes:
//   • Are colored (no longer gray)
//   • Do NOT count against Harmonic structure (discordCount not incremented)
//   • CAN contribute to HC points
//   • Keep all existing special effects (tritone feedback, m7 mojo drain, etc.)
// Before unlock: grayed out, same rules as any other discord note.
const DISCORD_UPGRADE_TIERS = [
  {
    id: 'discord_1',
    label: 'Blues Lick',
    icon: '🎷',
    desc: "Flat 7th (minor 7th) no longer discord in Major scales. End your track on it to inflict Mojo Drain on next attack target.",
    notesByMode: { major: ['minorSeventh'], minor: [] },
  },
  {
    id: 'discord_2',
    label: 'Borrowed Chord',
    icon: '✨',
    desc: "Major 3rd no longer discord in Minor scales. End your track on it to cleanse your oldest status effect.",
    notesByMode: { major: [], minor: ['majorThird'] },
  },
  {
    id: 'discord_3',
    label: "Devil's Interval",
    icon: '🔥',
    desc: "Tritone never breaks harmony in either mode. End on it to trigger Feedback Overload — 1 Vibe damage to all rivals within 3 hexes, -1 Vibe to yourself.",
    notesByMode: { major: ['tritone'], minor: ['tritone'] },
  },
  {
    id: 'discord_4',
    label: 'Chromatic Climb',
    icon: '⚡',
    desc: "A chromatic run of 3+ notes no longer causes discord. Out-of-scale notes stay grey but the run is clean. Unlocks Stagger.",
    notesByMode: { major: [], minor: [] },
  },
];
// ── SKILL TREE ────────────────────────────────────────────────────────────────
// Four routes. Skills within a gated chain require the previous skill first.
// PA sub-chain (mic/pedal/mixer/powerchords) requires amp_1 first.
// Groupies, Stage Effects, and the "hero_pose" CQC terminal are standalone.
const SKILL_TREE = {
  routes: [
    {
      id: 'groupies',
      label: 'Groupies',
      icon: '🎉',
      color: '#44cc88',
      desc: 'Rally your fans for support, disruption, and protection.',
      skills: [
        { id:'fans_4eva',      label:'Fans 4Eva',           icon:'💚', hcCost:8,  gated:false,
          desc:'Deployable crew — restore 2 Vibe. Your loyal fans patch you up. Recharges in 3 turns.' },
        { id:'pranksta',       label:'Bust Out Pranksta',   icon:'🪤', hcCost:8,  gated:false,
          desc:'Deployable crew — disconnect up to 2 rival amps within 4 hexes. Recharges in 3 turns.' },
        { id:'junkyard_dog',   label:'Junkyard Dog',        icon:'🔩', hcCost:8,  gated:false,
          desc:'Deployable crew — arm a junkyard weapon: +2 on your next Swing roll. Recharges in 3 turns.' },
        { id:'fandom_army',    label:'Several Fandom Army', icon:'🛡️', hcCost:8,  gated:false,
          desc:'Deployable crew — +2 Feedback for your next battle. Fans form a wall around you. Recharges in 3 turns.' },
      ],
    },
    {
      id: 'cqc',
      label: 'CQC',
      icon: '🥊',
      color: '#ff6644',
      desc: 'Close Quarters Combat — brutal melee upgrades and finishing moves.',
      skills: [
        { id:'shank_skank',    label:'Shank Skank',         icon:'🗡️',  hcCost:8,  gated:true,  prereq:null,
          desc:'20% slip: rival loses 2 notes next turn.' },
        { id:'cosmic_boogaloo',label:'Cosmic Boogaloo',     icon:'🌀', hcCost:12, gated:true,  prereq:'shank_skank',
          desc:'25% slip + 15% dazed (33% chance moves go wrong direction).' },
        { id:'moon_shuffle',   label:'Moon Shuffle',        icon:'🌙', hcCost:16, gated:true,  prereq:'cosmic_boogaloo',
          desc:'30% slip + 18% dazed + 12% drop (instrument kicked 3 spaces, -½ Drive until retrieved).' },
        { id:'baki_gravity',   label:'Baki Gravity',        icon:'💫', hcCost:20, gated:true,  prereq:'moon_shuffle',
          desc:'35% slip + 23% dazed + 18% drop + 10% confused (rival hurts themselves: d6 1-3=1dmg, 4-5=2dmg, 6=3dmg).' },
        { id:'hero_pose',      label:'Hero Pose',           icon:'🌟', hcCost:20, gated:false, prereq:null,
          desc:'Stand on the centre hex and pose for 2 turns (not consecutive). Win the Limelight — win the game.' },
      ],
    },
    {
      id: 'electric',
      label: 'Electric',
      icon: '⚡',
      color: '#ffcc44',
      desc: 'Amps, Roadies, Discord mastery, and the full PA system.',
      // Sub-chains within Electric — each is independently gated
      subChains: [
        {
          id: 'amps',
          label: 'Amp Chain',
          skills: [
            { id:'amp_1', label:'Amp I',   icon:'🔊', hcCost:8,  gated:true, prereq:null,
              desc:'Place Amp 1 on an adjacent hex. Within range: d6→d8.' },
            { id:'amp_2', label:'Amp II',  icon:'🔊', hcCost:12, gated:true, prereq:'amp_1',
              desc:'Place Amp 2. Within range of both: d8→d10.' },
            { id:'amp_3', label:'Amp III', icon:'🔊', hcCost:20, gated:true, prereq:'amp_2',
              desc:'Place Amp 3. Within range of all three: d10→d12.' },
          ],
        },
        {
          id: 'roadies',
          label: 'Roadie Chain',
          skills: [
            { id:'roadie_1', label:'Roadie I',   icon:'🔧', hcCost:8,  gated:true, prereq:null,
              desc:'Hire Roadie 1. Can move your amp 2 hexes once every 2 turns.' },
            { id:'roadie_2', label:'Roadie II',  icon:'🔧', hcCost:12, gated:true, prereq:'roadie_1',
              desc:'Hire Roadie 2. Two roadies on the field simultaneously.' },
            { id:'roadie_3', label:'Roadie III', icon:'🔧', hcCost:16, gated:true, prereq:'roadie_2',
              desc:'Hire Roadie 3. Three roadies — full amp mobility.' },
          ],
        },
        {
          id: 'discord',
          label: 'Discord Chain',
          skills: [
            { id:'discord_1', label:'Blues Lick',       icon:'🎷', hcCost:8,  gated:true, prereq:null,
              desc:'Flat 7th non-discord in Major. Last note → Mojo Drain on next attack target.' },
            { id:'discord_2', label:'Borrowed Chord',   icon:'✨', hcCost:12, gated:true, prereq:'discord_1',
              desc:'Major 3rd non-discord in Minor. Last note → Cleanse your oldest status effect.' },
            { id:'discord_3', label:"Devil's Interval", icon:'🔥', hcCost:16, gated:true, prereq:'discord_2',
              desc:'Tritone non-discord both modes. Last note → Feedback Overload (1 Vibe dmg to rivals within 3 hexes, -1 to self).' },
            { id:'discord_4', label:'Chromatic Climb',  icon:'🎸', hcCost:20, gated:true, prereq:'discord_3',
              desc:'Chromatic run of 3+ notes = no discord. Unlocks Stagger.' },
          ],
        },
        {
          id: 'pa',
          label: 'PA System',
          requiresFirst: 'amp_1', // entire PA chain locked until amp_1 is bought
          skills: [
            { id:'mic',           label:'Mic',             icon:'🎤', hcCost:12, gated:true, prereq:null,
              desc:'Voice roll d6 — on 4+ add a bonus note to your track.' },
            { id:'pedal_dist',    label:'Pedal Distortion',icon:'🎛️', hcCost:16, gated:true, prereq:'mic',
              desc:'Distortion pedal: +1 Drive on Sonic Attacks.' },
            { id:'mixer',         label:'Mixer',           icon:'🎚️', hcCost:12, gated:true, prereq:null,
              desc:'Mixer unlocks parallel note track — play 2 notes simultaneously once per turn.' },
            { id:'power_chords',  label:'Power Chords',    icon:'🤘', hcCost:16, gated:true, prereq:'mixer',
              desc:'Power Chords: +2 Drive on Sonic Attacks when 2+ amps in range.' },
            { id:'ultimate',      label:'Ultimate Ability',icon:'💀', hcCost:0,  gated:true,
              prereq:'__all_pa__', // special: requires mic + pedal + amp_1 + mixer + spirit sequence
              desc:'Requires Mic, Pedal, Amp I & Mixer. ENCORE APOCALYPSE: once per game, 2 Vibe damage + Stagger to all rivals within 4 hexes.' },
          ],
        },
      ],
    },
    {
      id: 'shredding_ronin',
      label: 'Shredding Ronin',
      icon: '🗡️',
      color: '#4488ff',
      desc: 'The way of the blade meets the way of the riff. An exclusive arsenal only the Ronin can wield.',
      spiritOnly: 'cosmic_ronin', // route hidden from every other Spirit
      skills: [
        { id:'psycho_bushido', label:'Psycho Bushido', icon:'🌀', hcCost:10, gated:false,
          desc:'In CQC, when your swing die lands a 5 or 6 the rival is stunned by your pure speed and gives up — their die is forced to a 1.' },
        { id:'e_rush',         label:'いいラッシュ (E-Rush)', icon:'🎴', hcCost:12, gated:false,
          desc:'End a note track on an E, then face a rival in a riff-off that turn: every one of their answer notes spawns a ghost note. BOTH keys must be hit in the window or the note misses.' },
        { id:'thousand_beats', label:'Thousand Beats', icon:'⚡', hcCost:14, gated:false,
          desc:'Commit a full 8-note track to unleash the barrage: mash SPACE for 5 seconds to forge Fame Sparks (4 sparks = 1 FP). 2-turn cooldown.' },
        { id:'hydra',          label:'Hydra',          icon:'🐉', hcCost:16, gated:true, prereq:'amp_3',
          desc:'CAPSTONE — requires Amp III. With 3 amps in range, your Sonic Attack roars from three heads: roll 3d6 instead of d12, firing three beams as the Hydra looms behind you.' },
      ],
    },
    {
      id: 'metalness',
      label: 'Metalness Monster',
      icon: '🤘',
      color: '#ffcc00',
      desc: 'Trash-metal violence. An exclusive arsenal only the Monster can wield.',
      spiritOnly: 'Metalness_Monster', // route is hidden from every other Spirit
      skills: [
        { id:'master_moshpits', label:'Master of Moshpits', icon:'🎸', hcCost:10, gated:false,
          desc:'On ANY battle win, if you have a banked note: burn it for +1 Vibe damage (can finish a knockdown). The pit floods the board and rocks the battered rival.' },
        { id:'riff_slayer',     label:'Riff Slayer',         icon:'🗡️', hcCost:12, gated:false,
          desc:'Commit a SKIP-CLIMB (3+ notes leaping by thirds, one direction) to arm it. If a riff-off breaks out that same turn, the rival cracks — 2–3 of their notes glitch and lurch mid-flight.' },
        { id:'paranoia',        label:'Paranoia',            icon:'🌀', hcCost:14, gated:true,  prereq:'discord_1',
          desc:'Supercharges your Mojo Drain (Blues Lick): now lasts 3 turns AND freezes 2 of the rival\u2019s note slots. They can\u2019t think — or play — straight.' },
        { id:'azrael',          label:'Azrael',              icon:'💀', hcCost:16, gated:false,
          desc:'Each rival you knock down feeds you Fame equal to your current knockdown streak (1st \u2192 1 FP, 2nd \u2192 2 FP\u2026). The streak resets the moment YOU are knocked down.' },
      ],
    },
    {
      id: 'stage_effects',
      label: 'Stage Effects',
      icon: '🎆',
      color: '#aa44ff',
      desc: 'Dazzle the crowd. Environmental effects triggered in battle.',
      skills: [
        { id:'laser_show',   label:'Laser Show',     icon:'🔴', hcCost:12, gated:false,
          desc:'33% chance in battle: rival\'s dice roll is halved.' },
        { id:'stage_light',  label:'Stage Lighting', icon:'💡', hcCost:12, gated:false,
          desc:'33% chance in battle: +1 saved Vibe. If you won, +1 Vibe on top.' },
        { id:'fog_machine',  label:'Fog Machine',    icon:'🌫️', hcCost:12, gated:false,
          desc:'33% chance on rival\'s entrance: -1 Drive and -1 Feedback for that battle.' },
        { id:'pyrotechnics', label:'Pyrotechnics',   icon:'🔥', hcCost:16, gated:true,
          prereq:'__all_stage_3__', // requires all three above
          desc:'Requires Laser, Lighting & Fog. 33% chance: add a d6 roll on top of your Drive roll.' },
      ],
    },
  ],
};

// Flat lookup: skillId → skill def (including which route/chain it belongs to)
const SKILL_BY_ID = (() => {
  const map = {};
  for (const route of SKILL_TREE.routes) {
    if (route.skills) {
      for (const sk of route.skills) map[sk.id] = { ...sk, routeId: route.id };
    }
    if (route.subChains) {
      for (const chain of route.subChains) {
        for (const sk of chain.skills) map[sk.id] = { ...sk, routeId: route.id, chainId: chain.id };
      }
    }
  }
  return map;
})();

// Upgrade category definitions (legacy — kept for any residual references)
const UPGRADE_CATEGORIES = [
  { id:'amp',          label:'Amp',              icon:'🔊', desc:'Place an Amp on an adjacent hex.', maxLevel:3 },
  { id:'roadie',       label:'Hire a Roadie',    icon:'🔧', desc:'Get a Roadie who can move your amp 2 hexes.', maxLevel:3 },
  { id:'close_combat', label:'Close Combat',     icon:'🥊', desc:'Upgrade Swing attacks.', maxLevel:3 },
  { id:'discord_1',    label:'Blues Lick',       icon:'🎷', desc:'Flat 7th non-discord in Major.', maxLevel:1 },
  { id:'discord_2',    label:'Borrowed Chord',   icon:'✨', desc:'Major 3rd non-discord in Minor.', maxLevel:1 },
  { id:'discord_3',    label:"Devil's Interval", icon:'🔥', desc:'Tritone non-discord both modes.', maxLevel:1 },
  { id:'discord_4',    label:'Chromatic Climb',  icon:'⚡', desc:'Chromatic run 3+ = no discord.', maxLevel:1 },
];

// Returns the note that is N semitones above root (chromatic, sharp-pool default)
function semitonesUp(root, n) {
  const idx = pitchIndex(root);
  if (idx === -1) return null;
  return NOTE_POOL[(idx + n) % 12];
}
// Interval helpers — contextually spelled for current root + mode
// 4th=5, 5th=7, tritone=6, major3rd=4, minorSeventh=10
function getIntervalNotes(root, mode = 'major') {
  return {
    fourth:       semitonesUpSpelled(root, mode, 5),
    fifth:        semitonesUpSpelled(root, mode, 7),
    tritone:      semitonesUpSpelled(root, mode, 6),
    majorThird:   semitonesUpSpelled(root, mode, 4),
    minorSeventh: semitonesUpSpelled(root, mode, 10),
  };
}
// Keep getFourthFifth as a convenience alias
function getFourthFifth(root, mode = 'major') {
  const i = getIntervalNotes(root, mode);
  return { fourth: i.fourth, fifth: i.fifth };
}

// ── CHROMATIC RUN DETECTION ──────────────────────────────────────────────────
// Returns the length of the longest chromatic run (consecutive semitones) in the track
function detectChromaticRun(track) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;
  let i = 0;
  while (i < track.length) {
    let runLen = 1;
    let dir = 0; // +1 ascending, -1 descending
    while (i + runLen < track.length) {
      const a = pitchIndex(track[i + runLen - 1]);
      const b = pitchIndex(track[i + runLen]);
      if (a === -1 || b === -1) break;
      // Wrap-around chromatic distance
      let step = b - a;
      if (step > 6) step -= 12;
      if (step < -6) step += 12;
      if (Math.abs(step) !== 1) break;
      if (dir === 0) dir = step;
      else if (step !== dir) break;
      runLen++;
    }
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }
  return maxRun;
}

// Stagger duration from chromatic run length
function staggerDuration(runLen) {
  if (runLen >= 5) return 3;
  if (runLen === 4) return 2;
  if (runLen === 3) return 1;
  return 0;
}

// ── DRIVE BOOST: diatonic step runs ──────────────────────────────────────────
// Returns the longest run of consecutive ascending OR descending diatonic steps
// (adjacent indices in currentScale) found in the track.
// Only notes IN the scale count — out-of-scale notes break the run.
function detectDiatonicRun(track, currentScale) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;
  let i = 0;
  while (i < track.length) {
    let runLen = 1;
    let dir = 0; // +1 ascending, -1 descending
    while (i + runLen < track.length) {
      const a = currentScale.indexOf(track[i + runLen - 1]);
      const b = currentScale.indexOf(track[i + runLen]);
      if (a === -1 || b === -1) break;
      const step = b - a;
      if (Math.abs(step) !== 1) break;
      if (dir === 0) dir = step;
      else if (step !== dir) break;
      runLen++;
    }
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }
  return maxRun;
}

function driveBoostFromRun(runLen) {
  if (runLen >= 5) return 3;
  if (runLen === 4) return 2;
  if (runLen >= 3) return 1;
  return 0;
}

// ── SKIP CLIMB DETECTION (Riff Slayer) ───────────────────────────────────────
// A "skip climb" leaps by THIRDS instead of stepping: consecutive notes whose
// scale-degree indices change by exactly +2 or -2, all in the SAME direction.
// e.g. C-E-G-B (up) or B-G-E-C (down). Out-of-scale notes break the run.
// Returns the length of the longest such run (min 3 to count).
function detectSkipClimb(track, currentScale) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;
  let i = 0;
  while (i < track.length) {
    let runLen = 1;
    let dir = 0; // +2 ascending skips, -2 descending skips
    while (i + runLen < track.length) {
      const a = currentScale.indexOf(track[i + runLen - 1]);
      const b = currentScale.indexOf(track[i + runLen]);
      if (a === -1 || b === -1) break;
      const step = b - a;
      if (Math.abs(step) !== 2) break;
      if (dir === 0) dir = step;
      else if (step !== dir) break;
      runLen++;
    }
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }
  return maxRun;
}

// ── FEEDBACK BOOST: repeat patterns ───────────────────────────────────────────
// A) Same note consecutive: C-C-C (min 3, both notes must be in scale)
// B) Alternating pair A-B-A-B (min 4 notes, both notes in scale)
// Returns the longest qualifying run length found.
function detectRepeatPattern(track, currentScale) {
  if (!track || track.length < 3) return 0;
  let maxRun = 0;

  // A) Consecutive repeats
  let i = 0;
  while (i < track.length) {
    if (!currentScale.includes(track[i])) { i++; continue; }
    let runLen = 1;
    while (i + runLen < track.length && track[i + runLen] === track[i]) runLen++;
    if (runLen >= 3) maxRun = Math.max(maxRun, runLen);
    i += Math.max(1, runLen);
  }

  // B) Alternating pair A-B-A-B
  let k = 0;
  while (k < track.length - 3) {
    const a = track[k], b = track[k + 1];
    if (a === b || !currentScale.includes(a) || !currentScale.includes(b)) { k++; continue; }
    let patLen = 2;
    while (k + patLen < track.length) {
      const expected = patLen % 2 === 0 ? a : b;
      if (track[k + patLen] !== expected) break;
      patLen++;
    }
    if (patLen >= 4) maxRun = Math.max(maxRun, patLen);
    k += Math.max(1, patLen);
  }

  return maxRun;
}

function sustainBoostFromPattern(patLen) {
  if (patLen >= 5) return 3;
  if (patLen === 4) return 2;
  if (patLen >= 3) return 1;
  return 0;
}

// ── HC SCORING ───────────────────────────────────────────────────────────────
// Layer 1 (HC points — feeds upgrade counter):
//   Step A: floor(totalNotes / 2)  — all notes including last
//   Step B: ending bonus — 4th=+4, 5th=+5, Octave=+2
// Layer 2 (Drive/Sustain patterns) runs in confirmNoteTrack and is untouched.
function scoreTrackHC(track, fourthNote, fifthNote) {
  if (!track || track.length === 0) return { points: 0, breakdown: [] };
  const breakdown = [];
  let points = 0;

  // Step A — placement points
  const placementPts = Math.floor(track.length / 2);
  if (placementPts > 0) {
    breakdown.push(`${track.length} notes → +${placementPts}`);
    points += placementPts;
  }

  // Step B — ending bonus (clean tracks only — caller guards this)
  const last = track[track.length - 1];
  const first = track[0];
  const isOctave = track.length >= 2 && first === last;
  if (last === fifthNote)       { breakdown.push(`5th end +5`);    points += 5; }
  else if (last === fourthNote) { breakdown.push(`4th end +4`);    points += 4; }
  else if (isOctave)            { breakdown.push(`octave end +2`); points += 2; }

  return { points, breakdown };
}

// analyseTrack still exists for Drive/Sustain pattern detection display in log
// (diatonic run scoring and repeat pattern scoring feed tempDrive/tempSustain only,
//  they no longer produce HC points directly — overflow from non-stacking still does)
function analyseTrack(track, currentScale, fourthNote, fifthNote) {
  // Kept for log/breakdown compatibility — returns 0 pts, patterns noted
  if (!track || track.length === 0) return { points: 0, breakdown: [] };
  return { points: 0, breakdown: [] };
}

// Given current HC points + new points earned, return:
//   { newHCPoints, upgradeTriggered }
// upgradeTriggered = true if threshold crossed (max 1 per turn as agreed)
// advanceHC: progress hcPoints toward a dynamic target cost.
// Returns whether the target was reached this increment.
function advanceHC(hcPoints, earned, targetCost) {
  const cost  = targetCost ?? HC_UPGRADE_THRESHOLD; // default 8 for first pick
  const total = hcPoints + earned;
  if (total >= cost) {
    return { newHCPoints: total - cost, upgradeTriggered: true };
  }
  return { newHCPoints: total, upgradeTriggered: false };
}

function randomNote(rootNote, mode) {
  const pool = rootNote ? getSpelledPool(rootNote, mode) : NOTE_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}
function refillStock(rootNote, mode) {
  return Array.from({length: 8}, () => randomNote(rootNote, mode));
}

// ─── MIRROR SPRITES ───────────────────────────────────────────────────────────
const MIRROR_SPRITES = {
  "Glamarchy":         glamarchy_mirror,
  "cosmic_ronin":      cosmic_ronin_mirror,
  "intergalactic_0":   intergalactic_0_mirror,
  "Metalness_Monster": metalness_monster_mirror,
};

// ─── RIFF-OFF ────────────────────────────────────────────────────────────────
// When two plugged-in Spirits clash with a Sonic Attack while facing each
// other (each standing in the other's beam), the battle becomes a RIFF-OFF:
// a call-and-response rhythm duel. The attacker lays down a riff; the
// defender answers with a musically transformed version of it (inversion,
// modulation, twisted notes, or a phrase resolution). Letters flash on
// screen — hit the matching key the instant it appears. CAPITAL letters are
// SHARPS (hold Shift). Highest accuracy wins; reaction time breaks ties.
const RIFF_LEN          = 6;
const RIFF_NOTE_WINDOW  = 1100;  // ms the player has to hit a steady note
const RIFF_QUICK_WINDOW = 850;   // ms window on a rushed note
const RIFF_GAP_NORMAL   = 350;   // ms breath before a steady note
const RIFF_GAP_QUICK    = 120;   // rushed note — barely any heads-up
const RIFF_GAP_REST     = 900;   // a rest — the riff holds its breath
const RIFF_PERFECT_MS   = 300;   // reaction-grade thresholds
const RIFF_GOOD_MS      = 600;
const RIFF_NATURALS     = ['a','b','c','d','e','f','g'];
const RIFF_SHARPABLE    = new Set(['a','c','d','f','g']);  // no B♯ / E♯
const RIFF_NAT_SEMIS    = [0, 2, 3, 5, 7, 8, 10];          // a b c d e f g — A natural minor

// ── RIFF AUDIO — synthesized in Web Audio, no sample files needed ────────────
let riffAudioCtx = null;
function getRiffAudio() {
  try {
    if (!riffAudioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      riffAudioCtx = new AC();
    }
    if (riffAudioCtx.state === 'suspended') riffAudioCtx.resume();
    return riffAudioCtx;
  } catch { return null; }
}

// Pitch comes from the UNWRAPPED scale degree, so an ascending run truly
// climbs across octaves instead of wrapping g→a back down. Degree 0 = A3.
function riffDegreeFreq(degree, sharp) {
  const idx = ((degree % 7) + 7) % 7;
  const oct = Math.floor(degree / 7);
  let semis = RIFF_NAT_SEMIS[idx] + oct * 12
    + (sharp && RIFF_SHARPABLE.has(RIFF_NATURALS[idx]) ? 1 : 0);
  semis = Math.max(-17, Math.min(29, semis)); // ~E2 growl up to ~D6 scream
  return 220 * Math.pow(2, semis / 12);
}

// Wrong key still makes a sound — the note they actually pressed, bending
// sourly downward. The mistake is audible, like a real fumbled riff.
function playRiffWrong(letter) {
  const ctx = getRiffAudio(); if (!ctx) return;
  const idx  = RIFF_NATURALS.indexOf(letter.toLowerCase());
  const base = idx >= 0
    ? 220 * Math.pow(2, (RIFF_NAT_SEMIS[idx] + (letter === letter.toUpperCase() ? 1 : 0)) / 12)
    : 180;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator(); osc.type = 'square';
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.3);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(f); f.connect(g); g.connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.4);
}

// 🗡️ RIFF SLAYER — pick a riff note DIFFERENT from the current one, plus its
// frequency, so a glitched note both looks and sounds like a different target.
function pickGlitchRiffNote(current) {
  // Build the pool of valid riff note tokens (naturals + sharpable uppercase)
  const pool = [];
  RIFF_NATURALS.forEach(n => {
    pool.push(n);
    if (RIFF_SHARPABLE.has(n)) pool.push(n.toUpperCase());
  });
  const choices = pool.filter(n => n !== current);
  const letter  = choices[Math.floor(Math.random() * choices.length)] ?? current;
  const idx     = RIFF_NATURALS.indexOf(letter.toLowerCase());
  const freq    = idx >= 0
    ? 220 * Math.pow(2, (RIFF_NAT_SEMIS[idx] + (letter === letter.toUpperCase() ? 1 : 0)) / 12)
    : 180;
  return { letter, freq };
}

// Timed-out note: a muted string scrape (filtered noise burst)
function playRiffMiss() {
  const ctx = getRiffAudio(); if (!ctx) return;
  const len = 0.18;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.value = 0.22;
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start();
}

// ── BEAM-CLASH SFX (Kamehameha) — synthesized through the riff audio path ──
// playBeamClash: rising detuned whine + swelling crackle + sub rumble as the
// two beams meet. playBeamSurge: a "power up" riser for the Round 2 escalation.
// playBeamBreak: the overpower explosion when one beam breaks through.
function playBeamClash(intense = false) {
  const ctx = getRiffAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const dur = intense ? 1.5 : 1.2;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.exponentialRampToValueAtTime(intense ? 0.5 : 0.36, t + 0.18);
  master.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  master.connect(ctx.destination);
  // Two detuned saws sweeping UP as the beams collide
  [0, 7].forEach((det) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const base = (intense ? 220 : 160) + det;
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * (intense ? 4.2 : 3.2), t + 0.5);
    const g = ctx.createGain(); g.gain.value = 0.18;
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur);
  });
  // Crackling energy — bandpassed noise that swells
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.4 + 0.6 * (i / d.length));
  const src = ctx.createBufferSource(); src.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(2600, t + dur); bp.Q.value = 0.7;
  const ng = ctx.createGain(); ng.gain.value = intense ? 0.5 : 0.38;
  src.connect(bp); bp.connect(ng); ng.connect(master);
  src.start(t);
  // Low rumble bed
  const sub = ctx.createOscillator(); sub.type = 'sine';
  sub.frequency.setValueAtTime(intense ? 70 : 55, t);
  const subG = ctx.createGain(); subG.gain.value = 0.4;
  sub.connect(subG); subG.connect(master);
  sub.start(t); sub.stop(t + dur);
}

function playBeamSurge() {
  const ctx = getRiffAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 1.2);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3500, t + 1.2);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  o.connect(f); f.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + 1.45);
  const o2 = ctx.createOscillator(); o2.type = 'triangle';
  o2.frequency.setValueAtTime(600, t);
  o2.frequency.exponentialRampToValueAtTime(1800, t + 1.2);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.0001, t);
  g2.gain.exponentialRampToValueAtTime(0.16, t + 0.4);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  o2.connect(g2); g2.connect(ctx.destination);
  o2.start(t); o2.stop(t + 1.35);
}

function playBeamBreak(intense = false) {
  const ctx = getRiffAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const len = intense ? 1.4 : 1.0;
  // Explosion: lowpassed noise burst with long decay
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.6);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
  lp.frequency.setValueAtTime(intense ? 1800 : 1400, t);
  lp.frequency.exponentialRampToValueAtTime(140, t + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(intense ? 0.7 : 0.55, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(lp); lp.connect(g); g.connect(ctx.destination);
  src.start(t);
  // Downward boom sweep
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  o.frequency.setValueAtTime(intense ? 320 : 240, t);
  o.frequency.exponentialRampToValueAtTime(40, t + (intense ? 0.7 : 0.5));
  const og = ctx.createGain();
  og.gain.setValueAtTime(intense ? 0.55 : 0.4, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + (intense ? 0.8 : 0.6));
  o.connect(og); og.connect(ctx.destination);
  o.start(t); o.stop(t + 0.9);
}

// The riff's GROOVE: each note gets a feel — steady, rushed (short heads-up,
// tighter window), or preceded by a rest. The first note is always steady.
function generateRiffRhythm() {
  return Array.from({ length: RIFF_LEN }, (_, i) => {
    if (i === 0) return { window: RIFF_NOTE_WINDOW, gapBefore: 0, feel: 'steady' };
    const roll = Math.random();
    if (roll < 0.28) return { window: RIFF_QUICK_WINDOW, gapBefore: RIFF_GAP_QUICK, feel: 'rushed' };
    if (roll < 0.48) return { window: RIFF_NOTE_WINDOW,  gapBefore: RIFF_GAP_REST,  feel: 'rest' };
    return { window: RIFF_NOTE_WINDOW, gapBefore: RIFF_GAP_NORMAL, feel: 'steady' };
  });
}

// Round 2 is FASTER and more BRUTAL: tighter hit-windows, shorter gaps, and no
// restful breathers — the riff comes at you relentlessly. Windows are floored
// so it stays hard-but-fair rather than humanly impossible.
function speedUpRiffRhythm(rhythm, factor = 0.6) {
  const minWin = 460;
  return rhythm.map((b, i) => ({
    window:    Math.max(minWin, Math.round((b.window ?? RIFF_NOTE_WINDOW) * factor)),
    gapBefore: i === 0 ? 0 : Math.round((b.gapBefore ?? RIFF_GAP_NORMAL) * factor * 0.8),
    feel:      b.feel === 'rest' ? 'rushed' : b.feel,   // breathers become rushes
  }));
}

const RIFF_CONTOUR_LABELS = {
  climb:   'ASCENDING RUN',
  descent: 'DESCENDING RUN',
  arch:    'RISE & FALL',
  valley:  'DIP & CLIMB',
  zigzag:  'ZIGZAG LICK',
};
const RIFF_ANSWER_LABELS = {
  inversion:  { name: 'INVERSION',       desc: 'mirrors the riff — every climb becomes a fall' },
  modulation: { name: 'MODULATION',      desc: 'same shape, shifted to a new key' },
  variation:  { name: 'TWISTED NOTES',   desc: 'the riff returns with notes bent out of place' },
  resolution: { name: 'PHRASE FINISHER', desc: 'starts the same — then resolves the phrase home' },
};

// Degrees walk the natural scale (0=a … 6=g, wrapping); sharps[i] marks ♯
function riffDegreesToNotes(degrees, sharps) {
  return degrees.map((d, i) => {
    const letter = RIFF_NATURALS[((d % 7) + 7) % 7];
    return (sharps[i] && RIFF_SHARPABLE.has(letter)) ? letter.toUpperCase() : letter;
  });
}

// Attacker riff: walk the scale along a melodic contour, then sprinkle
// 1-2 sharps on sharpable notes for spice.
function generateAttackerRiff() {
  const contours = Object.keys(RIFF_CONTOUR_LABELS);
  const contour  = contours[Math.floor(Math.random() * contours.length)];
  const degrees  = [Math.floor(Math.random() * 7)];
  for (let i = 1; i < RIFF_LEN; i++) {
    const step = 1 + Math.floor(Math.random() * 2); // move 1-2 scale steps
    let dir = 1;
    if (contour === 'descent')      dir = -1;
    else if (contour === 'arch')    dir = i < RIFF_LEN / 2 ?  1 : -1;
    else if (contour === 'valley')  dir = i < RIFF_LEN / 2 ? -1 :  1;
    else if (contour === 'zigzag')  dir = i % 2 === 1 ? 1 : -1;
    degrees.push(degrees[i - 1] + dir * step);
  }
  const sharps  = new Array(RIFF_LEN).fill(false);
  let toPlace   = 1 + Math.floor(Math.random() * 2);
  const order   = degrees.map((_, i) => i).sort(() => Math.random() - 0.5);
  for (const i of order) {
    if (toPlace <= 0) break;
    const letter = RIFF_NATURALS[((degrees[i] % 7) + 7) % 7];
    if (RIFF_SHARPABLE.has(letter)) { sharps[i] = true; toPlace--; }
  }
  return { degrees, sharps, contour, rhythm: generateRiffRhythm() };
}

// Defender riff: a musical ANSWER built from the attacker's call.
function generateDefenderRiff(atk) {
  const kinds   = Object.keys(RIFF_ANSWER_LABELS);
  const kind    = kinds[Math.floor(Math.random() * kinds.length)];
  const degrees = [...atk.degrees];
  const sharps  = [...atk.sharps];
  const rhythm  = atk.rhythm.map(r => ({ ...r }));  // the answer keeps the call's groove
  if (kind === 'inversion') {
    // Mirror every interval around the root — climbs become falls
    const root = degrees[0];
    for (let i = 0; i < degrees.length; i++) degrees[i] = root - (degrees[i] - root);
  } else if (kind === 'modulation') {
    // Shift the whole phrase to a new key — same shape, new notes
    const shifts = [1, 2, -1, -2];
    const shift  = shifts[Math.floor(Math.random() * shifts.length)];
    for (let i = 0; i < degrees.length; i++) degrees[i] += shift;
  } else if (kind === 'variation') {
    // Bend 2 notes out of place: nudge a degree or flip its sharp
    const order = degrees.map((_, i) => i).filter(i => i > 0).sort(() => Math.random() - 0.5);
    order.slice(0, 2).forEach(i => {
      if (Math.random() < 0.5) sharps[i] = !sharps[i];
      else degrees[i] += Math.random() < 0.5 ? 1 : -1;
    });
  } else {
    // resolution — keep the first half, walk the back half home to the root
    const half = Math.ceil(RIFF_LEN / 2);
    const root = degrees[0];
    let cur = degrees[half - 1];
    for (let i = half; i < RIFF_LEN; i++) {
      const remaining = RIFF_LEN - i;
      const dist = root - cur;
      if (dist === 0)           cur += remaining > 1 ? (Math.random() < 0.5 ? 1 : -1) : 0;
      else if (remaining === 1) cur += dist; // land the phrase on the root
      else cur += Math.sign(dist) * Math.min(2, Math.max(1, Math.ceil(Math.abs(dist) / remaining)));
      degrees[i] = cur;
      sharps[i]  = false; // resolve clean — no accidentals on the way home
      rhythm[i]  = { window: RIFF_NOTE_WINDOW, gapBefore: RIFF_GAP_NORMAL, feel: 'steady' }; // settle the groove too
    }
  }
  return { degrees, sharps, kind, rhythm };
}

function isMirrorFacing(facingAngleRad) {
  const a = ((facingAngleRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return a > Math.PI / 2 && a < (3 * Math.PI) / 2;
}

// ─── APP ──────────────────────────────────────────────────────────────────────
const mobileColorStyle = {
  filter: "saturate(0.82) brightness(0.93) hue-rotate(-5deg)",
};

export default function RLSWSimulator() {
  const [gameState, setGameState] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);

  if (showTutorial) {
    return <div style={isMobile ? mobileColorStyle : {}}><Tutorial onBack={() => setShowTutorial(false)} /></div>;
  }
  if (!gameState) {
    return <div style={isMobile ? mobileColorStyle : {}}><Lobby onStart={gs => setGameState(gs)} onTutorial={() => setShowTutorial(true)} /></div>;
  }
  return <div style={isMobile ? mobileColorStyle : {}}><Game key={JSON.stringify(gameState.spirits.map(s=>s.num))} gameState={gameState} onReturnToLobby={() => setGameState(null)} /></div>;
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
function Game({ gameState, onReturnToLobby }) {
  const { mode, teams } = gameState;
  const startingLives = gameState.startingLives ?? 3;

  const [spirits, setSpirits] = useState(() =>
    gameState.spirits.map(s => ({ ...s, lives: startingLives }))
  );
  const [action, setAction]   = useState(null); // "move" | "swing" | null
  // ── BATTLE STATE ─────────────────────────────────────────────────────────────
  // actionTokenUsed: has the acting spirit used their action token this turn
  const [actionTokenUsed, setActionTokenUsed] = useState(false);
  // startedOnLimelight: tracks which spirits began their turn on the limelight hex
  const [startedOnLimelight, setStartedOnLimelight] = useState({});
  // battleState: the full in-progress battle, null when no battle
  // { phase: 'rolling_attack'|'rolling_defense'|'result'
  //          |'retaliation_prompt'|'retaliation_spin'|'retaliation_settling'|'retaliation_result'
  //   attackerId, defenderId,
  //   atkRoll, defRoll, atkTotal, defTotal,
  //   margin, attackerWon, damage,
  //   // counter ("Part 2"): counterRoll, vibeBonus, counterTotal, counterTarget,
  //   //   counterSuccess, counterFace, counterReady, counterDmg, counterMargin }
  const [battleState, setBattleState] = useState(null);
  const battleStateRef = useRef(null); // mirrors battleState for use in async callbacks
  // Keep ref in sync so async callbacks can read latest state without closure issues
  useEffect(() => { battleStateRef.current = battleState; }, [battleState]);

  // Fresh-state mirrors for async combat callbacks (Master of Moshpits crowd
  // mob & Azrael streak both fire on timeouts AFTER damage/knockdown settle).
  const spiritsRef = useRef(null);
  useEffect(() => { spiritsRef.current = spirits; }, [spirits]);

  // 🤘 MASTER OF MOSHPITS — spiritId → mob key. While set, the crowd PNGs
  // swarm that rival's hex on the board and "rock" them. Cleared after a beat.
  const [moshpitTargets, setMoshpitTargets] = useState({});

  // ⚡ THOUSAND BEATS — the spacebar-mash minigame overlay.
  // { phase:'mash'|'result', spiritId, secondsLeft, clicks, sparksAwarded, fpForged }
  const [thousandBeats, setThousandBeats] = useState(null);
  const thousandClicksRef = useRef(0);

  // RIFF-OFF engine ref — timing-critical bookkeeping for the currently
  // flashing note lives here (not in React state) so reaction times are
  // measured against the real flash timestamp, not a render cycle.
  const riffEngineRef = useRef(null);
  // 🎸⏰ Back to the Past timing ref — fresh flash timestamp lives here, not in state.
  const bttpEngineRef = useRef(null);
  // Chosen instrument for the challenge + its input-window multiplier (guitar gets
  // more leeway since reading a fretboard cold is harder than the piano).
  const bttpModeRef = useRef({ view: 'piano', winMult: 1 });
  // 🎸⏰ Back to the Past — overlay state (declared here, before its input effect)
  const [bttpChallenge, setBttpChallenge] = useState(null);

  // RIFF-OFF keyboard listener — only armed while a note is flashing.
  // e.key gives 'a' for plain press, 'A' for Shift+A — exactly our sharp rule.
  useEffect(() => {
    if (!battleState?.riffOff || battleState.phase !== 'riff_play') return;
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key.length !== 1 || !/[a-gA-G]/.test(e.key)) return; // only note keys count
      const eng = riffEngineRef.current;
      if (!eng || eng.resolved) return;
      const bs = battleStateRef.current;
      if (!bs?.riffOff) return;
      const side   = eng.turn === 'attacker' ? bs.atkRiff : bs.defRiff;
      const target = side.notes[eng.idx];

      // ── 🎴 いいラッシュ / E-RUSH — this note carries a GHOST. Both the real key
      //    and the ghost key must land within the window or the note misses. ──
      if (eng.needBoth) {
        if (e.key === eng.mainKey) eng.hitMain = true;
        else if (e.key === eng.ghostKey) eng.hitGhost = true;
        else { e.preventDefault(); return; } // wrong key — ignored, window keeps running
        // ring whichever just landed
        playNoteSound(null, { freq: side.freqs?.[eng.idx], holdTime:0.3, fadeTime:0.35, volume:0.16 });
        setBattleState(p => p?.riffOff ? { ...p, ghostHit: { idx: eng.idx, main: eng.hitMain, ghost: eng.hitGhost } } : p);
        if (!(eng.hitMain && eng.hitGhost)) { e.preventDefault(); return; } // need both — keep waiting
        // both down → resolve as a hit, graded on the SECOND press's reaction
        clearTimeout(eng.timeoutId);
        eng.resolved = true;
        const rt2   = Math.round(performance.now() - eng.shownAt);
        const grade2 = rt2 <= RIFF_PERFECT_MS ? 'perfect' : rt2 <= RIFF_GOOD_MS ? 'good' : 'ok';
        riffRecordResult(eng.turn, { hit: true, rt: rt2, grade: grade2 });
        const gap2 = side.rhythm?.[eng.idx + 1]?.gapBefore ?? RIFF_GAP_NORMAL;
        setTimeout(() => riffNextNote(eng.turn, eng.idx + 1), gap2);
        e.preventDefault();
        return;
      }

      clearTimeout(eng.timeoutId);
      clearTimeout(eng.glitchTimeoutId);
      eng.resolved = true;
      const rt    = Math.round(performance.now() - eng.shownAt);
      const hit   = e.key === target;
      const grade = !hit ? 'wrong'
        : rt <= RIFF_PERFECT_MS ? 'perfect'
        : rt <= RIFF_GOOD_MS    ? 'good'
        : 'ok';
      // ── the note RINGS through the player's own amp — same distorted
      //    guitar voice (and 🎛️ knob settings) as the Note Track. A wrong
      //    key plays the sour bent note they actually hit.
      if (hit) playNoteSound(null, {
        freq: side.freqs?.[eng.idx],
        holdTime: grade === 'perfect' ? 0.5 : grade === 'good' ? 0.42 : 0.34,
        fadeTime: 0.4,
        volume:   grade === 'perfect' ? 0.22 : grade === 'good' ? 0.18 : 0.14,
      });
      else playRiffWrong(e.key);
      riffRecordResult(eng.turn, { hit, rt: hit ? rt : null, grade });
      const nextGap = side.rhythm?.[eng.idx + 1]?.gapBefore ?? RIFF_GAP_NORMAL;
      setTimeout(() => riffNextNote(eng.turn, eng.idx + 1), nextGap);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [battleState?.riffOff, battleState?.phase, battleState?.turn, battleState?.noteIdx]);

  // ⚡ THOUSAND BEATS — spacebar masher. Distinct presses only (no auto-repeat).
  useEffect(() => {
    if (!thousandBeats || thousandBeats.phase !== 'mash') return;
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        thousandClicksRef.current += 1;
        const c = thousandClicksRef.current;
        setThousandBeats(p => (p && p.phase === 'mash') ? { ...p, clicks: c } : p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [thousandBeats?.phase]);

  // 🎸⏰ BACK TO THE PAST — note input listener (armed only while a note flashes).
  useEffect(() => {
    if (!bttpChallenge || bttpChallenge.phase !== 'play') return;
    const onKey = (e) => {
      if (e.repeat) return;
      if (e.key.length !== 1 || !/[a-gA-G]/.test(e.key)) return;
      const eng = bttpEngineRef.current;
      if (!eng || eng.resolved) return;
      bttpInput(e.key.toLowerCase());
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bttpChallenge?.phase, bttpChallenge?.idx, bttpChallenge?.stageKey]);
  // diceDisplay: { atk: null|number, def: null|number, rolling: 'atk'|'def'|null }
  const [diceDisplay, setDiceDisplay] = useState(null);
  // retaliationTimer: countdown seconds remaining
  const [retaliationTimer, setRetaliationTimer] = useState(null);
  const [moveStepsLeft, setMoveStepsLeft] = useState(0);
  const [movedThisTurn, setMovedThisTurn] = useState(false);
  const [turnQueue, setTurnQueue] = useState(() => gameState.spirits.map(s => s.id));
  // 🧪 TESTING GROUNDS — dev panel (only when the sandbox was launched from the menu)
  const testMode = !!gameState.testMode;
  const [devOpen, setDevOpen] = useState(false);
  const [devEventId, setDevEventId] = useState('back_to_past');
  const [winner, setWinner]   = useState(null);
  const [hovered, setHovered] = useState(null);
  const [slideOffAnimations, setSlideOffAnimations] = useState({});
  const [respawnFlashes, setRespawnFlashes]         = useState({});
  const [rumblingIds, setRumblingIds] = useState(new Set());
  const [floatingDmg, setFloatingDmg] = useState([]);
  // 💥 Status-effect board VFX — { key, spiritId, icon, label, color }
  const [effectFlashes, setEffectFlashes] = useState([]);
  const [cameraView, setCameraView]   = useState(null);
  const [manualZoomActive, setManualZoomActive] = useState(false);
  const [log, setLog] = useState(["⚡ RLSW v3.0 — Note Track System", "🎵 Build your Note Track → Confirm → Move"]);

  // ─── NOTE SYSTEM STATE (per-character) ─────────────────────────────────────
  function makeInitialNoteState() {
    // Pick a random raw note, respell to a canonical root in major context first
    const rawRoot = NOTE_POOL[Math.floor(Math.random() * NOTE_POOL.length)];
    // Default to major for initial respelling; split roots default to major spelling
    const initMode = 'major';
    const root = canonicalRoot(rawRoot, initMode);
    // All roots are pivot candidates — always prompt for major/minor on first turn
    return {
      noteStock:       refillStock(root, initMode),
      noteTrack:       [],
      usedStockIdx:    new Set(),
      rootNote:        root,
      scaleMode:       initMode,
      pivotPending:    true, // always prompt major/minor at start
      diceTier:        0,
      tierPoints:      0,
      discordCount:    0,
      hasConfirmed:    false,
      feedbackBoost:   false,
      dieFloorBoost:   0,
      statusEffects:   [],
      stagger:         null,
      mojoDrain:       0,
      tempDrive:       0,
      tempSustain:     0,
      hcPoints:        0,
      totalHC:         0,
      upgradesPending: 0,      // 1 = needs to pick next target skill
      skillRoute:      null,
      unlockedSkills:  [],
      targetSkillId:   null,   // skill currently being saved toward
      diceLevel:       0,
      ampOwned:        false,
      roadies:         [],
      bankedNote:      null,  // { note } — 1 note max banked from overflow
      // 🤘 Metalness Monster exclusive-tree bookkeeping
      knockStreak:     0,     // 💀 Azrael — rivals knocked down since he last fell
      riffSlayerArmed: false, // 🗡️ Riff Slayer — skip-climb committed this turn
      pendingParanoia: false, // 🌀 Paranoia — next Mojo Drain is supercharged
      eRushArmed:      false, // 🎴 いいラッシュ — track ended on E this turn
      thousandBeatsCd: 0,     // ⚡ Thousand Beats — turns remaining on cooldown
      discordUnlocks:  [],    // discord tier ids unlocked: 'discord_1','discord_2','discord_3'
      swingUpgrades:   [],    // swing tier ids unlocked: 'swing_1','swing_2','swing_3'
      // Physical combat debuffs (from swing effects)
      tripped:         false, // movement halved this turn
      instrumentDropped: false, // Drive reduced by 1 until recovered (roadie or start of own turn)
      dazed:           false, // next move goes to a random neighbour instead of chosen hex
      modCards:        [],
      // ── Crew & Gear deployables ──
      groupieCooldowns: {},    // skillId → own-turns until ready again (0/undefined = ready)
      junkyardArmed:    false, // Junkyard Dog weapon armed — +2 on next Swing roll
      ultimateUsed:     false, // once-per-game Ultimate fired
      mixerUsedThisTurn: false,// Mixer doubles one stock note per turn
      elevenTurns:      0,     // "goes to eleven" — dice tier counts +1 amp for N of your turns
      fame:             0,     // ⭐ Fame Points — earned by winning battles, scaled by margin
      sparks:           0,     // ✨ Fame Sparks toward the next forged FP
      finalsTrail:      [],    // 🎯 pitch classes of recent turn-ending notes (cadence objectives)
      cadenceCooldowns: {},    // objectiveId → own-turns before it can be completed again
      // ── 🎤 FAN ECONOMY ──
      diehards:         FAN_DIEHARD_START, // loyal core (stable, amplifies hard)
      casuals:          FAN_CASUAL_START,  // fickle fringe (volatile, plentiful)
      centerStreak:     0,     // consecutive centre-perform turns (drives promotion)
      outerStreak:      0,     // consecutive turns ended on the outer edge (drives delayed boredom)
      fanLag:           0,     // turns locked out of crowd-gain after a demolition
      fanActedThisTurn: false, // performed a clean centre track this turn? (keeps the promote streak alive)
    };
  }

  const [noteStates, setNoteStates] = useState(() => {
    const map = {};
    gameState.spirits.forEach(s => { map[s.id] = makeInitialNoteState(); });
    return map;
  });


  // ─── BGM ────────────────────────────────────────────────────────────────────
  const audioRef           = useRef(null);
  const currentTrackIdxRef = useRef(-1);
  const [bgmMuted, setBgmMuted]     = useState(false);
  const [bgmVolume, setBgmVolume]   = useState(0.4);
  const [bgmTrackNum, setBgmTrackNum] = useState(0);

  // Manual zoom/pan
  const manualVBRef  = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef  = useRef(null);
  const svgRef       = useRef(null);
  const boardDivRef  = useRef(null);

  const addLog = useCallback(m => setLog(p => [m, ...p].slice(0, 40)), []);

  // Spawn initial board cards on game start
  useEffect(() => {
    setBoardCards(spawnBoardCards([], gameState.spirits, []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── POINTS FLASH STATE ──────────────────────────────────────────────────────
  const [pointsFlash, setPointsFlash] = useState(null);
  // pointsFlash: { lines: ['...','...'], key: Date.now() } — clears after animation

  const [pulsingHex, setPulsingHex] = useState(null); // hex num that glows on turn start
  // amps: array of { id, ownerId, ownerColor, hexNum, connected }
  const [amps, setAmps] = useState([]);
  // boardCards: [{ id, hexNum, spawnTurn }] — face-down cards on the board
  const [boardCards, setBoardCards] = useState([]);
  // cardRespawnIn: turns until next spawn attempt (counts down in endTurn)
  const [cardRespawnIn, setCardRespawnIn] = useState(1);
  // pendingCardPickup: { spiritId, cardType, cardId } — waiting for keep/replace/discard choice
  const [pendingCardPickup, setPendingCardPickup] = useState(null);
  // roadieAction: { spiritId, roadieId, phase:'selectHex'|'selectDir', adjHexNum? }
  const [roadieAction, setRoadieAction] = useState(null);
  // roadieAnimations: active roadie token slide animations on the SVG board
  const [roadieAnimations, setRoadieAnimations] = useState([]);
  // ampPlacing: spiritId waiting to click a neighbor hex to drop their new amp
  const [ampPlacing, setAmpPlacing] = useState(null);
  // limelightScores: { [spiritId]: number } — accumulated pose turns (never resets)
  const [limelightScores, setLimelightScores] = useState({});
  // posing: { [spiritId]: boolean } — currently posing this turn end
  const [posing, setPosing] = useState({});

  // 🎤 Unsure crowd — fans that fled a demolition, pooled on the centre, up for grabs.
  const [unsurePool, setUnsurePool] = useState(0);

  // 🎤 Transient fan reaction at a Spirit's home corner — a gain burst or a scatter.
  const [fanFx, setFanFx] = useState({});
  // Spotlight: roaming searchlight hex that heals +1 Vibe on landing
  const [spotlightHex, setSpotlightHex] = useState(
    () => SPOTLIGHT_POOL[Math.floor(Math.random() * SPOTLIGHT_POOL.length)]
  );
  const [turnCount, setTurnCount] = useState(0);

  // ─── EVENT SPACES STATE ──────────────────────────────────────────────────────
  // eventHexes: hex numbers currently lit as marquee event spaces
  const [eventHexes, setEventHexes] = useState(() => {
    const startHexes = new Set(gameState.spirits.map(s => s.num));
    const pool = EVENT_HEX_POOL.filter(n => !startHexes.has(n));
    const picked = [];
    for (let i = 0; i < EVENT_HEX_COUNT && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  });
  // activeEvent: { spiritId, eventId, phase:'reveal'|'result', resultLines:[], rolls? }
  const [activeEvent, setActiveEvent] = useState(null);
  // eventRespawnIn: turns until a new marquee hex lights up after one is triggered (0 = none pending)
  const [eventRespawnIn, setEventRespawnIn] = useState(0);
  // flamingHexes: { hexes:[nums], roundsLeft } — Disco Inferno board hazard
  const [flamingHexes, setFlamingHexes] = useState({ hexes: [], roundsLeft: 0 });

  // ─── FAME SPARKS ─────────────────────────────────────────────────────────────
  // ✨ Tiny fame tokens scattered on the board — fractional FP that rewards
  // moving around. Collect SPARKS_PER_FP sparks to forge a full Fame Point.
  const [sparkHexes, setSparkHexes] = useState(() => {
    const startHexes = new Set(gameState.spirits.map(s => s.num));
    const pool = ALL_HEXES.filter(h => !startHexes.has(h.num) && h.num !== LIMELIGHT_HEX).map(h => h.num);
    const picked = [];
    for (let i = 0; i < SPARK_MAX && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  });

  // ─── RIFF STATE ──────────────────────────────────────────────────────────────
  // riffBook: global discoveries — riffId → spiritId of the first player to find it
  const [riffBook, setRiffBook] = useState({});
  // riffBanner: { riffId, spiritId, fp, isNew } — toast after a riff fires
  const [riffBanner, setRiffBanner] = useState(null);
  const [showRiffbook, setShowRiffbook] = useState(false);
  // 🗡️ Signature-abilities reference overlay — holds the spiritId being viewed.
  const [signatureSpirit, setSignatureSpirit] = useState(null);
  // 'discoveries' = player view (hidden riffs stay ???) · 'legacy' = full designer codex
  const [riffbookTab, setRiffbookTab] = useState('discoveries');
  const [legacyPlayingId, setLegacyPlayingId] = useState(null); // riff currently auditioning in the codex
  // cadenceToast: { cadenceId, spiritId, fp } — toast after resolving a cadence objective
  const [cadenceToast, setCadenceToast] = useState(null);

  // ─── BGM SETUP ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const idx = nextBgmTrack();
    currentTrackIdxRef.current = idx;
    setBgmTrackNum(idx + 1);
    const audio = new Audio(BGM_TRACKS[idx]);
    audio.volume = bgmVolume;
    audio.loop = false;
    audioRef.current = audio;
    audio.play().catch(() => {});
    function handleEnded() {
      const next = nextBgmTrack(currentTrackIdxRef.current);
      currentTrackIdxRef.current = next;
      setBgmTrackNum(next + 1);
      audio.src = BGM_TRACKS[next];
      audio.play().catch(() => {});
    }
    audio.addEventListener("ended", handleEnded);
    return () => { audio.removeEventListener("ended", handleEnded); audio.pause(); };
  }, []); // eslint-disable-line

  useEffect(() => { if (audioRef.current) audioRef.current.muted = bgmMuted; }, [bgmMuted]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = bgmVolume; }, [bgmVolume]);

  const bgmSkip = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = nextBgmTrack(currentTrackIdxRef.current);
    currentTrackIdxRef.current = next;
    setBgmTrackNum(next + 1);
    audio.src = BGM_TRACKS[next];
    if (!bgmMuted) audio.play().catch(() => {});
  }, [bgmMuted]);

  // Attach wheel listener as non-passive
  useEffect(() => {
    const div = boardDivRef.current;
    if (!div) return;
    const handler = (evt) => handleBoardWheel(evt);
    div.addEventListener("wheel", handler, { passive: false });
    return () => div.removeEventListener("wheel", handler);
  });

  // ─── DERIVED STATE ────────────────────────────────────────────────────────────
  const acting = useMemo(() => {
    for (const id of turnQueue) {
      const sp = spirits.find(s => s.id === id && !s.knockedOut);
      if (sp) return sp;
    }
    return null;
  }, [turnQueue, spirits]);

  // ── RECOVER FROM KNOCK DOWN ───────────────────────────────────────────────
  // A Spirit that was Knocked Down loses its next turn. When the queue reaches
  // it, clear the flag and advance past it once.
  useEffect(() => {
    if (!acting) return;
    if (!noteStates[acting.id]?.recovering) return;
    const recoveringName = acting.name;
    setNoteStates(prev => prev[acting.id]
      ? { ...prev, [acting.id]: { ...prev[acting.id], recovering: false } }
      : prev);
    addLog(`😵 ${recoveringName} is still recovering from the Knock Down — turn skipped!`);
    setTurnQueue(q => {
      const newQ = advanceTurnQueue(q, spirits, mode, teams);
      const nextId = newQ[0];
      if (nextId) {
        startNewTurnNotes(nextId);
        const nextSpirit = spirits.find(s => s.id === nextId);
        if (nextSpirit) { setPulsingHex(nextSpirit.num); setTimeout(() => setPulsingHex(null), 1800); }
      }
      return newQ;
    });
  }, [acting?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convenience: pull the acting character's note state (falls back to empty defaults)
  const actingNoteState = acting ? (noteStates[acting.id] ?? makeInitialNoteState()) : null;
  const noteStock    = actingNoteState?.noteStock    ?? [];
  const noteTrack    = actingNoteState?.noteTrack    ?? [];
  const usedStockIdx = actingNoteState?.usedStockIdx ?? new Set();
  const rootNote     = actingNoteState?.rootNote     ?? 'C';
  const scaleMode    = actingNoteState?.scaleMode    ?? 'major';
  const pivotPending  = actingNoteState?.pivotPending ?? false;
  // Dice tier = number of amps acting Spirit is within AMP_RANGE hexes of
  // Dice tier counts ONLY your own, plugged-in amps. Rival amps power nothing
  // for you — you can't borrow someone else's rig.
  const ampsInRange = acting ? amps.filter(amp => {
    if (amp.ownerId !== acting.id || amp.unplugged) return false;
    const spiritHex = HEX_BY_NUM[acting.num];
    const ampHex    = HEX_BY_NUM[amp.hexNum];
    if (!spiritHex || !ampHex) return false;
    return axialDist(spiritHex.q, spiritHex.r, ampHex.q, ampHex.r) <= AMP_RANGE;
  }).length : 0;
  // "Goes to eleven" event boost — counts as +1 amp in range while active
  const elevenBoost = (actingNoteState?.elevenTurns ?? 0) > 0 ? 1 : 0;
  const diceTier = AMP_DICE[Math.min(ampsInRange + elevenBoost, 3)];
  const hcPoints      = actingNoteState?.hcPoints      ?? 0;
  const upgradesPending = actingNoteState?.upgradesPending ?? 0;
  const discordCount  = actingNoteState?.discordCount  ?? 0;
  const hasConfirmed  = actingNoteState?.hasConfirmed  ?? false;
  // Speed, banking, discord unlocks
  const actingSpeed     = Math.min(5, acting?.speed ?? 5); // Speed caps at 5
  const bankedNote      = actingNoteState?.bankedNote ?? null;
  const discordUnlocks  = actingNoteState?.discordUnlocks ?? [];
  // Which interval keys are currently unlocked for this spirit
  // Mode-aware interval unlocks: each tier specifies which interval keys are
  // unlocked per mode (major/minor). Only keys relevant to the current scaleMode count.
  const unlockedIntervalKeys = new Set(
    DISCORD_UPGRADE_TIERS
      .filter(t => discordUnlocks.includes(t.id))
      .flatMap(t => (t.notesByMode?.[scaleMode] ?? t.notes ?? []))
  );

  function setNoteField(id, patch) {
    setNoteStates(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  const currentScale = buildScale(rootNote, scaleMode);
  const intervals = getIntervalNotes(rootNote, scaleMode);
  const { fourth: fourthNote, fifth: fifthNote,
          tritone: tritoneNote, majorThird: majorThirdNote,
          minorSeventh: minorSeventhNote } = intervals;

  // Returns the interval key name for a given note, or null if not an interval note
  function getIntervalKey(note) {
    const pc = pitchIndex(note);
    if (pc === pitchIndex(tritoneNote))      return 'tritone';
    if (pc === pitchIndex(majorThirdNote))   return 'majorThird';
    if (pc === pitchIndex(minorSeventhNote)) return 'minorSeventh';
    if (pc === pitchIndex(fourthNote))       return 'fourth';
    if (pc === pitchIndex(fifthNote))        return 'fifth';
    return null;
  }
  // Is a given note "playable" (not discord) given current scale + unlocks?
  function isNotePlayable(note) {
    if (currentScale.includes(note)) return true;
    const key = getIntervalKey(note);
    if (!key) return false;
    if (key === 'tritone') return unlockedIntervalKeys.has('tritone');
    return unlockedIntervalKeys.has(key); // interval notes: playable once unlocked
  }
  const feedbackBoost  = actingNoteState?.feedbackBoost  ?? false;
  const dieFloorBoost  = actingNoteState?.dieFloorBoost  ?? 0;
  const statusEffects  = actingNoteState?.statusEffects  ?? [];
  const stagger        = actingNoteState?.stagger        ?? null;
  const mojoDrain      = actingNoteState?.mojoDrain      ?? 0;
  const staggeredSlots = stagger?.slots ?? [];

  const spiritByNum = useMemo(() => {
    const m = {};
    spirits.forEach(s => { if (!s.knockedOut) m[s.num] = s; });
    return m;
  }, [spirits]);

  const spiritById = useMemo(() => {
    const m = {};
    spirits.forEach(s => { m[s.id] = s; });
    return m;
  }, [spirits]);

  const queuedSpirits = turnQueue.map(id => spiritById[id]).filter(Boolean).filter(s => !s.knockedOut);

  // Reachable hexes for movement: immediate neighbors only, step by step
  const reachable = useMemo(() => {
    if (action !== "move" || !acting || moveStepsLeft < 1) return new Set();
    const from = HEX_BY_NUM[acting.num];
    if (!from) return new Set();
    return new Set(
      axialNeighbors(from.q, from.r)
        .map(({ q, r }) => HEX_BY_QR[`${q},${r}`])
        .filter(h => {
          if (!h) return false;
          if (spiritByNum[h.num]) return false;
          return true;
        })
        .map(h => h.num)
    );
  }, [action, acting, moveStepsLeft, spiritByNum]);

  // ─── NOTE SOUND (distorted guitar) ───────────────────────────────────────────
  const audioCtxRef = useRef(null);

  // ── 🎛️ AMP KNOBS — player-adjustable tone for note playback ────────────────
  // drive: distortion amount · tone: brightness · echo: slapback level/repeats
  // verb: reverb wet level. Defaults match the original baked-in sound.
  const TONE_KNOB_DEFAULTS = { drive: 0.45, tone: 0.35, echo: 0.55, verb: 0.18, voice: 'saw' };
  // 🎙️ VOICE — the oscillator character. Each voice swaps the waveforms (and
  // tweaks how hard it drives) for a genuinely different timbre, cycling order:
  const TONE_VOICE_ORDER = ['saw', 'square', 'triangle', 'sine', 'fuzz'];
  const TONE_VOICES = {
    saw:      { label: 'LEAD',   osc1: 'sawtooth', osc2: 'sawtooth', sub: 'square',   driveMul: 1.0,  octave: false },
    square:   { label: 'BUZZ',   osc1: 'square',   osc2: 'square',   sub: 'square',   driveMul: 0.9,  octave: false },
    triangle: { label: 'MELLOW', osc1: 'triangle', osc2: 'triangle', sub: 'sine',     driveMul: 0.7,  octave: false },
    sine:     { label: 'CLEAN',  osc1: 'sine',     osc2: 'sine',     sub: 'sine',     driveMul: 0.5,  octave: false },
    fuzz:     { label: 'FUZZ',   osc1: 'square',   osc2: 'sawtooth', sub: 'square',   driveMul: 1.5,  octave: true  },
  };
  const [toneKnobs, setToneKnobs] = useState(TONE_KNOB_DEFAULTS);
  const toneKnobsRef = useRef(TONE_KNOB_DEFAULTS);
  useEffect(() => { toneKnobsRef.current = toneKnobs; }, [toneKnobs]);

  // Cached noise impulse response for the reverb convolver (built once per ctx)
  const reverbImpulseRef = useRef(null);
  function getReverbImpulse(ctx) {
    if (reverbImpulseRef.current && reverbImpulseRef.current.sampleRate === ctx.sampleRate) {
      return reverbImpulseRef.current;
    }
    const len = Math.floor(ctx.sampleRate * 1.7);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
      }
    }
    reverbImpulseRef.current = buf;
    return buf;
  }

  function getAudioCtx() {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }

  const NOTE_FREQS = {
    'C':3,'C#':4,'Db':4,'D':5,'D#':6,'Eb':6,'E':7,'F':8,'F#':9,'Gb':9,
    'G':10,'G#':11,'Ab':11,'A':0,'A#':1,'Bb':1,'B':2,
  };
  const PC_FREQ_BASE = [
    440.00,  // A
    466.16,  // A#/Bb
    493.88,  // B
    261.63,  // C
    277.18,  // C#/Db
    293.66,  // D
    311.13,  // D#/Eb
    329.63,  // E
    349.23,  // F
    369.99,  // F#/Gb
    392.00,  // G
    415.30,  // G#/Ab
  ];

  // Waveshaper curve for hard clipping distortion
  function makeDistortionCurve(ctx, amount = 300) {
    const samples = 256;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  function playNoteSound(note, opts = {}) {
    try {
      const ctx = getAudioCtx();
      let freq = opts.freq; // optional raw-frequency override (riff-off octave contours)
      if (freq == null) {
        const pc = NOTE_FREQS[note];
        if (pc === undefined) return;
        freq = PC_FREQ_BASE[pc];
      }
      const now = ctx.currentTime;
      const holdTime  = opts.holdTime  ?? 1.1;   // how long it stays loud
      const fadeTime  = opts.fadeTime  ?? 0.8;   // release fade duration
      const volume    = opts.volume    ?? 0.18;
      const totalTime = holdTime + fadeTime;
      // 🎛️ Amp knob settings (live — read from ref so timeouts get fresh values)
      const kn = toneKnobsRef.current ?? TONE_KNOB_DEFAULTS;

      // 🎙️ VOICE — wave character (defaults to the classic saw lead)
      const V = TONE_VOICES[kn.voice] ?? TONE_VOICES.saw;

      // Two detuned oscillators for thickness — waveform set by the VOICE
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = V.osc1;
      osc2.type = V.osc2;
      osc1.frequency.setValueAtTime(freq,         now);
      osc2.frequency.setValueAtTime(freq * 1.008, now); // slight detune

      // Sub oscillator one octave down for body
      const sub = ctx.createOscillator();
      sub.type = V.sub;
      sub.frequency.setValueAtTime(freq / 2, now);

      // Optional octave-UP oscillator — gives FUZZ its searing bite
      let oct = null, octGain = null;
      if (V.octave) {
        oct = ctx.createOscillator(); oct.type = 'square';
        oct.frequency.setValueAtTime(freq * 2, now);
        octGain = ctx.createGain(); octGain.gain.value = 0.16;
        oct.connect(octGain);
      }

      // Mix oscillators
      const oscGain1 = ctx.createGain(); oscGain1.gain.value = 0.5;
      const oscGain2 = ctx.createGain(); oscGain2.gain.value = 0.5;
      const subGain  = ctx.createGain(); subGain.gain.value  = 0.2;
      osc1.connect(oscGain1); osc2.connect(oscGain2); sub.connect(subGain);

      // Pre-distortion gain — DRIVE knob, scaled by the voice (1× clean → ~11× scorching)
      const drive = ctx.createGain(); drive.gain.value = (1 + kn.drive * 10) * V.driveMul;
      oscGain1.connect(drive); oscGain2.connect(drive); subGain.connect(drive);
      if (octGain) octGain.connect(drive);

      // Waveshaper distortion — curve hardness follows DRIVE (wider, gnarlier range)
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(ctx, 20 + kn.drive * 900 * V.driveMul);
      shaper.oversample = '4x';
      drive.connect(shaper);

      // Tone stack — TONE knob opens the lowpass (1.2kHz dark → 6.5kHz bright)
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 1200 + kn.tone * 5300; lp.Q.value = 0.9;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 120;
      shaper.connect(lp); lp.connect(hp);

      // Presence mid boost — a touch more presence as TONE opens up
      const mid = ctx.createBiquadFilter();
      mid.type = 'peaking'; mid.frequency.value = 1800;
      mid.gain.value = 3 + kn.tone * 4; mid.Q.value = 1.2;
      hp.connect(mid);

      // Hotter drive compensation — a gentle backoff; the master limiter below
      // catches the peaks, so DRIVE can roar much harder than before
      const comp = ctx.createGain();
      comp.gain.value = 1 - kn.drive * 0.12;
      mid.connect(comp);

      // 🔊 MASTER LIMITER — tames peaks so cranked drive/voices stay punchy
      // without clipping the output. Everything (dry + echo + verb) feeds it.
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -16; master.knee.value = 22;
      master.ratio.value = 5; master.attack.value = 0.003; master.release.value = 0.25;
      master.connect(ctx.destination);

      // Amp envelope: sharp pick → hold at volume → slow fade
      const ampEnv = ctx.createGain();
      ampEnv.gain.setValueAtTime(0,              now);
      ampEnv.gain.linearRampToValueAtTime(volume,            now + 0.008);      // pick attack
      ampEnv.gain.linearRampToValueAtTime(volume * 0.82,     now + 0.06);       // slight settle
      ampEnv.gain.setValueAtTime(volume * 0.82,              now + holdTime);   // hold
      ampEnv.gain.exponentialRampToValueAtTime(0.001,        now + totalTime);  // slow release

      // ECHO knob — slapback delay level + regenerating repeats (lusher range)
      const delayNode  = ctx.createDelay(0.7);
      delayNode.delayTime.value = 0.19;
      const delayGain  = ctx.createGain();
      delayGain.gain.value = kn.echo * 0.68;
      const delayFb    = ctx.createGain();           // feedback — repeats grow with knob
      delayFb.gain.value = Math.min(0.72, kn.echo * 0.7);
      const delayFade  = ctx.createGain();
      delayFade.gain.setValueAtTime(1,  now + 0.19);
      delayFade.gain.exponentialRampToValueAtTime(0.001, now + totalTime + 0.6 + kn.echo * 1.6);

      comp.connect(ampEnv);
      // Dry path
      ampEnv.connect(master);
      // Wet delay path (with feedback loop for repeats)
      if (kn.echo > 0.02) {
        ampEnv.connect(delayNode);
        delayNode.connect(delayFb);
        delayFb.connect(delayNode);
        delayNode.connect(delayGain);
        delayGain.connect(delayFade);
        delayFade.connect(master);
      }
      // VERB knob — convolution reverb wet path
      if (kn.verb > 0.02) {
        const convolver = ctx.createConvolver();
        convolver.buffer = getReverbImpulse(ctx);
        const revGain = ctx.createGain();
        revGain.gain.value = kn.verb * 0.85;
        ampEnv.connect(convolver);
        convolver.connect(revGain);
        revGain.connect(master);
      }

      osc1.start(now); osc2.start(now); sub.start(now);
      if (oct) oct.start(now);
      const tail = 0.35 + kn.echo * 1.6; // let echo repeats ring out
      osc1.stop(now + totalTime + tail);
      osc2.stop(now + totalTime + tail);
      sub.stop(now + totalTime + tail);
      if (oct) oct.stop(now + totalTime + tail);
    } catch (_) { /* audio unavailable — silent fail */ }
  }

  function playTrackSequence(track) {
    // The committed track plays as a real MELODY, not a slop of evenly
    // spaced notes. Each commit rolls a fresh groove: a mix of eighths,
    // quarters and dotted notes, the occasional breath between phrases,
    // a couple of random accents — and the final note rings out long,
    // because every phrase deserves a resolution.
    let tMs = 60;
    track.forEach((note, i) => {
      const last = i === track.length - 1;
      const roll = Math.random();
      const dur  = last ? 0.95
        : roll < 0.30 ? 0.22   // eighth — skips along
        : roll < 0.75 ? 0.40   // quarter — the walking pulse
        : 0.62;                // dotted — leans on the note
      const breath = !last && Math.random() < 0.18 ? 150 : 0; // phrase break
      const accent = last || Math.random() < 0.22;
      setTimeout(() => playNoteSound(note, {
        holdTime: dur,
        fadeTime: last ? 0.9 : 0.35,
        volume: accent ? 0.19 : 0.14,
      }), tMs);
      tMs += dur * 580 + 90 + breath; // longer notes breathe longer before the next
    });
  }

  // ─── RIFF PLAYBACK ───────────────────────────────────────────────────────────
  // Plays a riff with its real rhythm — durations and rests, not a slop of
  // evenly spaced notes. Transposed to whatever pitch the player started on.
  // Returns total playback length in ms.
  function playRiffSequence(riff, rootPc) {
    const spb = 60 / (riff.bpm ?? 110); // seconds per beat
    let t = 0.08;
    riff.notes.forEach(([off, beats, gap]) => {
      const pc   = ((rootPc + off) % 12 + 12) % 12;
      const name = PC_PLAY_NAMES[pc];
      const dur  = (beats ?? 1) * spb;
      setTimeout(() => playNoteSound(name, {
        holdTime: Math.max(0.18, dur * 0.85),
        fadeTime: 0.4,
        volume: 0.2,
      }), t * 1000);
      t += dur + (gap ? gap * spb : 0);
    });
    return t * 1000;
  }

  // ─── NOTE TRACK FUNCTIONS ─────────────────────────────────────────────────────
  function clickNoteStock(idx) {
    if (!acting) return;
    // ── 🎚️ MIXER — once per turn, tap an already-played note to layer it again ──
    if (usedStockIdx.has(idx)) {
      const hasMixer  = (actingNoteState?.unlockedSkills ?? []).includes('mixer');
      const mixerUsed = actingNoteState?.mixerUsedThisTurn ?? false;
      if (!hasMixer || mixerUsed || hasConfirmed || noteTrack.length >= 8 || pivotPending) return;
      if (staggeredSlots.includes(idx)) { addLog('⚡ Staggered — that slot is unavailable this turn.'); return; }
      const note     = noteStock[idx];
      const playable = isNotePlayable(note);
      const newTrack = [...noteTrack, note];
      playNoteSound(note);
      setNoteField(acting.id, {
        noteTrack:         newTrack,
        discordCount:      playable ? discordCount : discordCount + 1,
        mixerUsedThisTurn: true,
      });
      addLog(`🎚️ MIXER — ${acting.name} layers ${note} a second time! (${newTrack.length} notes)`);
      return;
    }
    // Transpose card intercept: clicking a note picks the new root
    if (actingNoteState?.transposeCardPending) { resolveTransposeCard(idx); return; }
    if (noteTrack.length >= 8) return;
    if (hasConfirmed) { addLog('✓ Already confirmed this turn — end your turn to continue.'); return; }
    if (staggeredSlots.includes(idx)) { addLog('⚡ Staggered — that slot is unavailable this turn.'); return; }
    // Pivot must be declared before building can start (if Root Note is A/E/B)
    if (pivotPending) { addLog('⚡ Declare Major or Minor for your Root Note before building!'); return; }
    const note = noteStock[idx];
    const isTritone      = pitchIndex(note) === pitchIndex(tritoneNote);
    const intervalKey    = getIntervalKey(note);
    const isUnlocked     = intervalKey ? unlockedIntervalKeys.has(intervalKey) : false;
    const playable       = isNotePlayable(note);
    const newTrack       = [...noteTrack, note];
    const newDiscord     = playable ? discordCount : discordCount + 1;
    playNoteSound(note);
    setNoteField(acting.id, {
      noteTrack:    newTrack,
      usedStockIdx: new Set([...usedStockIdx, idx]),
      discordCount: newDiscord,
    });
    const noteLabel = isTritone && !isUnlocked ? '🔥 TRITONE — discord'
                    : isTritone && isUnlocked  ? '🔥 TRITONE — unlocked'
                    : playable                 ? 'in scale'
                    : intervalKey && !isUnlocked ? `🔒 ${intervalKey} — locked (discord)`
                    : '⚡ discord';
    addLog(`🎵 ${note} → track (${noteLabel}) · ${newTrack.length} notes`);
  }

  function declarePivot(newMode) {
    if (!acting) return;
    // Resolve canonical spelling now that mode is known (handles G#/Ab, C#/Db splits)
    const respelledRoot = canonicalRoot(rootNote, newMode);
    // Respell the existing stock to match the new root context
    const respelledStock = (actingNoteState?.noteStock ?? []).map(n => {
      const pool = getSpelledPool(respelledRoot, newMode);
      const idx = pitchIndex(n);
      return idx !== -1 ? pool[idx] : n;
    });

    // ── MODE BONUS ────────────────────────────────────────────────────────────
    // Major → +1 HC point (bright momentum, major scales favour harmonic runs)
    // Minor → +1 tempSustain (dark resolve, defensive edge)
    const isMojoDrained = (actingNoteState?.mojoDrain ?? 0) > 0;
    let bonusPatch = {};
    let bonusMsg = '';
    if (newMode === 'major') {
      const targetSkill = actingNoteState?.targetSkillId ? SKILL_BY_ID[actingNoteState.targetSkillId] : null;
      const targetCost  = targetSkill?.hcCost ?? HC_UPGRADE_THRESHOLD;
      const { newHCPoints, upgradeTriggered } = advanceHC(actingNoteState?.hcPoints ?? 0, 1, targetCost);
      const newUpgradesPending = upgradeTriggered
        ? (actingNoteState?.upgradesPending ?? 0) + 1
        : (actingNoteState?.upgradesPending ?? 0);
      bonusPatch = { hcPoints: newHCPoints, upgradesPending: newUpgradesPending,
        totalHC: (actingNoteState?.totalHC ?? 0) + 1 };
      bonusMsg = upgradeTriggered
        ? ` · ☀️ Major bonus: +1 HC → 🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!`
        : ` · ☀️ Major bonus: +1 HC [${newHCPoints}/${targetCost}]`;
    } else {
      if (!isMojoDrained) {
        const prevDrive = actingNoteState?.tempDrive ?? 0;
        const newDrive = prevDrive + 1;
        bonusPatch = { tempDrive: newDrive };
        bonusMsg = ` · 🌑 Minor bonus: +1 Drive (now +${newDrive})`;
      } else {
        bonusMsg = ' · 🌑 Minor (Mojo Drained — Drive bonus blocked)';
      }
    }

    setNoteField(acting.id, {
      scaleMode:   newMode,
      rootNote:    respelledRoot,
      pivotPending: false,
      noteStock:   respelledStock,
      ...bonusPatch,
    });
    addLog(`🎸 ${respelledRoot} ${newMode} — scale set, start building!${bonusMsg}`);
    // If Major bonus triggered an upgrade, award the skill
    if (bonusPatch.upgradesPending > (actingNoteState?.upgradesPending ?? 0) && actingNoteState?.targetSkillId) {
      setTimeout(() => awardTargetSkill(acting.id), 60);
    }
  }

  function clearNoteTrack() {
    if (!acting) return;
    setNoteField(acting.id, {
      noteTrack: [],
      usedStockIdx: new Set(),
      discordCount: 0,
      // pivotPending intentionally NOT cleared — must still be resolved if active
    });
    addLog('✕ Note track cleared');
  }

  // Player taps "Use Bank" — adds banked note to track as a free extra note
  function useBankedNote() {
    if (!acting || !bankedNote) return;
    if (hasConfirmed) { addLog('✓ Already confirmed — cannot use bank this turn.'); return; }
    if (pivotPending) { addLog('⚡ Declare Major/Minor before using the banked note.'); return; }
    const note = bankedNote.note;
    const playable = isNotePlayable(note);
    const newTrack = [...noteTrack, note];
    const newDiscord = playable ? discordCount : discordCount + 1;
    setNoteField(acting.id, {
      noteTrack:    newTrack,
      discordCount: newDiscord,
      bankedNote:   null,  // consumed
    });
    addLog(`💾 Banked note ${note} → track (${playable ? 'playable' : '⚡ discord'}) · ${newTrack.length} notes`);
  }

  function confirmNoteTrack() {
    if (!acting) return;
    const baseTrack = actingNoteState?.noteTrack ?? [];
    if (baseTrack.length === 0) { addLog('❌ No notes in track!'); return; }
    // ── 🎤 MIC — voice roll: d6, on 4+ a bonus in-scale note joins the track ──
    // (shadows the outer derived noteTrack so all scoring below includes the bonus)
    let noteTrack = baseTrack;
    if ((actingNoteState?.unlockedSkills ?? []).includes('mic')) {
      const voiceRoll = Math.floor(Math.random() * 6) + 1;
      if (voiceRoll >= 4) {
        const scaleNotes = buildScale(rootNote, scaleMode);
        const bonusNote  = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
        noteTrack = [...baseTrack, bonusNote];
        addLog(`🎤 Voice roll ${voiceRoll} — your vocals land! Bonus note ${bonusNote} joins the track.`);
      } else {
        addLog(`🎤 Voice roll ${voiceRoll} — the crowd drowns you out. No bonus note.`);
      }
    }
    // ── 🎼 RIFF DETECTION — does this track hide a legendary riff? ──
    // If the opening intervals of a riff are on the track (any key), the FULL
    // riff plays out with real rhythm instead of the plain arpeggio.
    const riffMatch = detectRiff(noteTrack);
    if (riffMatch) {
      const { riff, rootPc } = riffMatch;
      const isNew = !riffBook[riff.id];
      const fp = isNew ? riff.fp : 1;
      if (isNew) {
        setRiffBook(prev => ({ ...prev, [riff.id]: acting.id }));
        addLog(`🎼✨ RIFF DISCOVERED — ${riff.name}! ${acting.name} writes it into the Riffbook!`);
      } else {
        addLog(`🎼 ${acting.name} plays ${riff.name}!`);
      }
      playRiffSequence(riff, rootPc);
      setRiffBanner({ riffId: riff.id, spiritId: acting.id, fp, isNew });
      setTimeout(() => setRiffBanner(prev => (prev && prev.riffId === riff.id ? null : prev)), 5600);
      setTimeout(() => grantFame(acting.id, fp, `🎼 ${riff.name}`), 500);
    } else {
      playTrackSequence(noteTrack);
    }

    // ── 🎯 CADENCE OBJECTIVES — your track's FINAL note is this turn's "final" ──
    // String the right finals across consecutive turns (any key) to resolve a
    // cadence for Fame. e.g. THE FULL RESOLVE: end on C, then F, then G, then C.
    {
      const lastPc = pitchIndex(noteTrack[noteTrack.length - 1]);
      if (lastPc >= 0) {
        const newTrail = [...(actingNoteState?.finalsTrail ?? []), lastPc].slice(-6);
        const cooldowns = actingNoteState?.cadenceCooldowns ?? {};
        const cadence = detectCadence(newTrail, cooldowns);
        if (cadence) {
          setNoteField(acting.id, {
            finalsTrail: [lastPc], // resolution note starts a fresh run
            cadenceCooldowns: { ...cooldowns, [cadence.id]: 3 },
          });
          addLog(`🎯✨ ${acting.name} resolves ${cadence.name} (${cadence.formula})!`);
          setCadenceToast({ cadenceId: cadence.id, spiritId: acting.id, fp: cadence.fp });
          setTimeout(() => setCadenceToast(prev => (prev && prev.cadenceId === cadence.id ? null : prev)), 5600);
          setTimeout(() => grantFame(acting.id, cadence.fp, `🎯 ${cadence.name}`), 700);
        } else {
          setNoteField(acting.id, { finalsTrail: newTrail });
        }
      }
    }
    // Overdrive card: pardon one discord note (reduce effective discord by 1)
    const overdriveActive = actingNoteState?.overdriveActive ?? false;
    const effectiveDiscord = overdriveActive ? Math.max(0, discordCount - 1) : discordCount;
    // chromClimbActive: if discord_4 unlocked and a chromatic run of 3+ is present,
    // treat the track as non-discord for scoring (individual grey notes are cosmetic only)
    // Note: chromClimbActive is set after the discord upgrade flags below — forward ref is fine
    // because we only use it after those lines. We declare it here as a let and assign below.
    let allInScale     = effectiveDiscord === 0;
    const lastNote     = noteTrack[noteTrack.length - 1];
    const firstNote    = noteTrack[0];
    // pivotPending is now set at the START of the next turn (in startNewTurnNotes),
    // not here at the end of scoring — so the key choice is a start-of-round decision.
    const newPivotPending = false; // will be set true when next turn begins
    // Carry forward current mode as default; player can change at pivot prompt
    const newMode = scaleMode;
    // Respell the new root note using enharmonic map (split roots resolve at next pivot)
    const newRootRaw = ENHARMONIC_RESPELL[lastNote] ?? lastNote;

    // ── SPEED & BANKING ───────────────────────────────────────────────────────
    // Total notes placed = movement potential, capped at Spirit's Speed
    const totalNotes    = noteTrack.length;
    const usableMoves   = Math.min(totalNotes, actingSpeed);
    const overflow      = totalNotes - usableMoves; // notes beyond speed cap
    // If overflow >= 1 AND bank is empty, auto-bank the last overflow note
    const existingBank  = actingNoteState?.bankedNote ?? null;
    const canBank       = overflow >= 1 && !existingBank;
    const newBankedNote = canBank ? { note: noteTrack[totalNotes - 1] } : existingBank;

    const hexes    = usableMoves;
    const intervals = getIntervalNotes(rootNote, scaleMode);
    const isMojoDrained = (actingNoteState?.mojoDrain ?? 0) > 0;

    // ── INTERVAL EFFECTS ──────────────────────────────────────────────────────
    // Tritone: anywhere in track → feedbackBoost (works even with Dischord)
    const trackHasTritone   = noteTrack.includes(intervals.tritone);
    // Octave resolution: first and last note identical
    const isOctaveResolution = hexes >= 2 && firstNote === lastNote;
    // Major 3rd end: clean only
    const hasBlues      = (actingNoteState?.discordUnlocks ?? []).includes('discord_1');
    const hasBorrowed   = (actingNoteState?.discordUnlocks ?? []).includes('discord_2');
    const hasTritoneUp  = (actingNoteState?.discordUnlocks ?? []).includes('discord_3');
    const hasChromClimb = (actingNoteState?.discordUnlocks ?? []).includes('discord_4');

    // Minor 7th end — only fires if Blues Lick (discord_1) is unlocked, major scale only
    const isMinorSeventhEnd  = hasBlues && scaleMode === 'major' && lastNote === intervals.minorSeventh;
    // Major 3rd end — only fires if Borrowed Chord (discord_2) is unlocked, minor scale only
    const isMajorThirdEnd    = hasBorrowed && scaleMode === 'minor' && allInScale && lastNote === intervals.majorThird;
    // Tritone end — only fires if Devil's Interval (discord_3) is unlocked
    const isTritoneEnd       = hasTritoneUp && lastNote === intervals.tritone;
    // Chromatic run: detect longest run; discord only if discord_4 not unlocked
    const chromRunLen        = detectChromaticRun(noteTrack);
    const chromStagger       = hasChromClimb ? staggerDuration(chromRunLen) : 0;
    // If discord_4 unlocked and a chrom run of 3+ exists, the whole track is treated as non-discord
    const chromClimbActive   = hasChromClimb && chromRunLen >= 3;
    if (chromClimbActive) allInScale = true;

    // ── FEEDBACK OVERLOAD (Tritone last note, discord_3 unlocked) ─────────────
    // Deals 1 Vibe to all rivals within 3 hexes, -1 Vibe to self.
    // Applied immediately on commit (before move).
    let feedbackOverloadMsg = '';
    if (isTritoneEnd && !isMojoDrained) {
      const actingHex = HEX_BY_NUM[acting.num];
      const hitRivals = spirits.filter(s => {
        if (s.id === acting.id || s.knockedOut) return false;
        const sh = HEX_BY_NUM[s.num];
        if (!sh || !actingHex) return false;
        return axialDist(actingHex.q, actingHex.r, sh.q, sh.r) <= 3;
      });
      if (hitRivals.length > 0) {
        // Route through applyVibeDamage so knockdowns / respawns register
        hitRivals.forEach((r, i) => {
          setTimeout(() => applyVibeDamage(r.id, 1, 'Feedback Overload'), 120 + i * 80);
          setTimeout(() => triggerEffectFlash(r.id, '🔥', 'FEEDBACK!', '#ff3300'), 120 + i * 80);
        });
        feedbackOverloadMsg = ` · 🔥 FEEDBACK OVERLOAD — hit ${hitRivals.map(r=>r.name).join(', ')} for 1 Vibe!`;
        addLog(`🔥 ${acting.name} unleashes FEEDBACK OVERLOAD! ${hitRivals.map(r=>r.name).join(', ')} take 1 Vibe damage!`);
      }
      // Self-damage (also through applyVibeDamage for knockdown handling)
      setTimeout(() => applyVibeDamage(acting.id, 1, 'feedback'), 400);
      addLog(`🔊 ${acting.name} takes 1 Vibe feedback damage!`);
    }

    // ── DRIVE BOOST: diatonic step runs (scale-only, blocked by Mojo Drain) ──
    const diatonicRunLen   = detectDiatonicRun(noteTrack, currentScale);

    // ── 🗡️ RIFF SLAYER (Metalness) — a skip-climb (3+ notes leaping by thirds,
    // one direction) ARMS the intimidation for this turn. If a riff-off breaks
    // out before the turn ends, the rival's notes will glitch.
    const ownsRiffSlayer = (actingNoteState?.unlockedSkills ?? []).includes('riff_slayer');
    const skipClimbLen   = detectSkipClimb(noteTrack, currentScale);
    const riffSlayerArm  = ownsRiffSlayer && skipClimbLen >= 3;

    // ── 🌀 PARANOIA (Metalness) — supercharges Mojo Drain (Blues Lick). When the
    // m7 ending charges a drain, Paranoia stretches it to 3 turns AND charges a
    // 2-slot note freeze on the same hit.
    const ownsParanoia   = (actingNoteState?.unlockedSkills ?? []).includes('paranoia');

    // ── 🎴 いいラッシュ / E-RUSH (Shredding Ronin) — ending a track on an E arms
    // the ghost-note barrage for any riff-off that breaks out this turn.
    const ownsERush      = (actingNoteState?.unlockedSkills ?? []).includes('e_rush');
    const eRushArm       = ownsERush && lastNote === 'E';

    // ── ⚡ THOUSAND BEATS (Shredding Ronin) — committing a full 8-note track
    // unleashes the Fame-Spark mash (unless on cooldown).
    const ownsThousand   = (actingNoteState?.unlockedSkills ?? []).includes('thousand_beats');
    const thousandCd     = actingNoteState?.thousandBeatsCd ?? 0;
    const thousandFire    = ownsThousand && totalNotes >= 8 && thousandCd <= 0;
    const rawDriveBoost    = !isMojoDrained ? driveBoostFromRun(diatonicRunLen) : 0;
    const prevTempDrive    = actingNoteState?.tempDrive ?? 0;
    let newTempDrive       = prevTempDrive;
    let driveOverflowToHC  = 0; // lower-value discard feeds Harmonic Charge
    if (rawDriveBoost > 0) {
      if (rawDriveBoost > prevTempDrive) {
        driveOverflowToHC = prevTempDrive; // discard lower into HC
        newTempDrive = rawDriveBoost;
      } else {
        driveOverflowToHC = rawDriveBoost; // new one is lower — discard it
        // prevTempDrive stays
      }
    }

    // ── FEEDBACK BOOST: repeat patterns (scale-only, blocked by Mojo Drain) ───
    const repeatPatLen      = detectRepeatPattern(noteTrack, currentScale);
    const rawSustainBoost   = !isMojoDrained ? sustainBoostFromPattern(repeatPatLen) : 0;
    const prevTempSustain   = actingNoteState?.tempSustain ?? 0;
    let newTempSustain      = prevTempSustain;
    let sustainOverflowToHC = 0;
    if (rawSustainBoost > 0) {
      if (rawSustainBoost > prevTempSustain) {
        sustainOverflowToHC = prevTempSustain;
        newTempSustain = rawSustainBoost;
      } else {
        sustainOverflowToHC = rawSustainBoost;
      }
    }

    // Total overflow fed to Harmonic Charge as bonus points
    const hcOverflow = driveOverflowToHC + sustainOverflowToHC;

    // ── APPLY SELF EFFECTS (blocked by Mojo Drain) ───────────────────────────
    const newFeedbackBoost = !isMojoDrained && trackHasTritone;
    const newDieFloorBoost = !isMojoDrained && isOctaveResolution ? 2 : 0;

    // ── MAJOR 3RD: cleanse oldest status effect ───────────────────────────────
    // Cleanses one ACTIVE debuff — the game's real debuffs are individual flags
    // (mojoDrain / stagger / tripped / dazed / instrumentDropped), so check those
    // first; the legacy statusEffects list is kept as a fallback.
    let newStatusEffects = [...(actingNoteState?.statusEffects ?? [])];
    let majorThirdMsg = '';
    let cleansePatch = {};
    if (isMajorThirdEnd) {
      if ((actingNoteState?.mojoDrain ?? 0) > 0)   { cleansePatch.mojoDrain = 0;             majorThirdMsg = ' · ✨ Maj3 — cleansed Mojo Drain'; }
      else if (actingNoteState?.stagger)           { cleansePatch.stagger = null;            majorThirdMsg = ' · ✨ Maj3 — cleansed Stagger'; }
      else if (actingNoteState?.tripped)           { cleansePatch.tripped = false;           majorThirdMsg = ' · ✨ Maj3 — cleansed Tripped'; }
      else if (actingNoteState?.dazed)             { cleansePatch.dazed = false;             majorThirdMsg = ' · ✨ Maj3 — cleansed Dazed'; }
      else if (actingNoteState?.instrumentDropped) { cleansePatch.instrumentDropped = false; majorThirdMsg = ' · ✨ Maj3 — recovered instrument'; }
      else if (newStatusEffects.length > 0) {
        const removed = newStatusEffects.shift();
        majorThirdMsg = ` · ✨ Maj3 — cleansed "${removed}"`;
      } else {
        majorThirdMsg = ' · ✨ Maj3 end (nothing to cleanse)';
      }
      if (Object.keys(cleansePatch).length > 0) {
        addLog(`✨ ${acting.name}'s Borrowed Chord rings out —${majorThirdMsg.replace(' · ✨ Maj3 — ', ' ')}!`);
        triggerEffectFlash(acting.id, '✨', 'CLEANSED!', '#44ffaa');
      }
    }

    // ── HC SCORING ────────────────────────────────────────────────────────────
    // Unlocked discord notes no longer break harmony — treat allInScale as true
    // for scoring purposes if discordCount is 0 (which it will be once unlocked notes
    // no longer increment it). The existing allInScale check handles this correctly.
    let earned = 0;
    let breakdown = [];
    if (allInScale) {
      const result = scoreTrackHC(noteTrack, fourthNote, fifthNote);
      earned = result.points;
      breakdown = result.breakdown;
    }
    // Drive/Sustain overflow feeds HC points (non-stacking rule)
    const earnedTotal = earned + hcOverflow;

    // Check upgrade threshold against target skill cost
    const targetSkill = actingNoteState?.targetSkillId ? SKILL_BY_ID[actingNoteState.targetSkillId] : null;
    const targetCost  = targetSkill?.hcCost ?? HC_UPGRADE_THRESHOLD;
    const { newHCPoints, upgradeTriggered } = advanceHC(hcPoints, earnedTotal, targetCost);
    const newUpgradesPending = upgradeTriggered
      ? (actingNoteState?.upgradesPending ?? 0) + 1
      : (actingNoteState?.upgradesPending ?? 0);

    // ── POINTS FLASH ─────────────────────────────────────────────────────────
    const flashLines = [];
    if (allInScale && earned > 0) {
      flashLines.push(`+${earned} HC pts`);
      breakdown.forEach(b => flashLines.push(b));
      if (upgradeTriggered) flashLines.push(`🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!`);
    }
    if (rawDriveBoost > 0)    flashLines.push(`⚔️ Drive +${newTempDrive}${driveOverflowToHC > 0 ? ` (↑HC +${driveOverflowToHC})` : ''}`);
    if (rawSustainBoost > 0)  flashLines.push(`🛡️ Feedback +${newTempSustain}${sustainOverflowToHC > 0 ? ` (↑HC +${sustainOverflowToHC})` : ''}`);
    if (trackHasTritone)      flashLines.push('🔥 Tritone — Feedback ×2');
    if (isOctaveResolution)   flashLines.push('🎶 Octave — HC +2');
    if (isMajorThirdEnd)      flashLines.push('✨ Borrowed Chord — Cleanse!');
    if (isMinorSeventhEnd)    flashLines.push(ownsParanoia ? '🌀 PARANOIA — drain 3t + 2 slots frozen!' : '🎷 Blues Lick — Mojo Drain!');
    if (riffSlayerArm)        flashLines.push(`🗡️ RIFF SLAYER ARMED — skip-climb ×${skipClimbLen}!`);
    if (eRushArm)             flashLines.push('🎴 いいラッシュ ARMED — ghost barrage ready!');
    if (thousandFire)         flashLines.push('⚡ THOUSAND BEATS — mash for Fame Sparks!');
    if (ownsThousand && totalNotes >= 8 && thousandCd > 0) flashLines.push(`⚡ Thousand Beats on cooldown (${thousandCd})`);
    if (isTritoneEnd)         flashLines.push('🔥 Feedback Overload!');
    if (chromStagger > 0)     flashLines.push(`⚡ Chromatic Climb ×${chromRunLen} — Stagger ${chromStagger}t`);
    if (chromClimbActive && discordCount > 0) flashLines.push(`⚡ Chromatic Climb — discord pardoned`);
    if (canBank)              flashLines.push(`💾 Banked: ${newBankedNote.note}`);
    if (totalNotes > actingSpeed && !canBank) flashLines.push(`⚠️ ${totalNotes - actingSpeed} note(s) discarded (bank full)`);
    if (!allInScale && flashLines.length === 0) flashLines.push(`⚡ ${discordCount} Dischord`);
    if (flashLines.length > 0) {
      setPointsFlash({ lines: flashLines, key: Date.now() });
      setTimeout(() => setPointsFlash(null), 4500);
    }

    // ── LOG ───────────────────────────────────────────────────────────────────
    const scoreStr = allInScale
      ? ` · 🎯 +${earned}pts (${breakdown.join(', ')})${hcOverflow > 0 ? ` +${hcOverflow}HC overflow` : ''}${upgradeTriggered ? ` · 🎸 ${targetSkill?.label ?? 'UPGRADE'} UNLOCKED!` : ` · HC [${newHCPoints}/${targetCost}]`}`
      : ` · ⚡ ${discordCount} Dischord — no points`;
    const driveMsg   = rawDriveBoost > 0   ? ` · ⚔️ Drive +${newTempDrive}` : '';
    const sustMsg    = rawSustainBoost > 0  ? ` · 🛡️ Feedback +${newTempSustain}` : '';
    const triMsg     = trackHasTritone      ? ' · 🔥 Feedback ×2'          : '';
    const octMsg     = isOctaveResolution   ? ' · 🎶 Octave HC+2'           : '';
    const m7Msg      = isMinorSeventhEnd    ? (ownsParanoia ? ' · 🌀 Paranoia ready (3t + freeze)' : ' · 🎷 Mojo Drain ready') : '';
    const rsMsg      = riffSlayerArm        ? ' · 🗡️ Riff Slayer ARMED' : '';
    const tritoneEndMsg = isTritoneEnd      ? ' · 🔥 Feedback Overload!'         : '';
    const chrMsg     = chromStagger > 0     ? ` · ⚡ Stagger ${chromStagger}t`   : '';
    const chromClimbMsg = (chromClimbActive && discordCount > 0) ? ' · ⚡ Chrom Climb — no discord' : '';
    const speedMsg   = totalNotes > actingSpeed
      ? ` · SPD ${actingSpeed}/${totalNotes}${canBank ? ` · 💾 ${newBankedNote.note} banked` : ' · bank full'}`
      : ` · SPD ${hexes}/${actingSpeed}`;
    addLog(`✓ Committed · ${hexes} hexes${scoreStr}${driveMsg}${sustMsg}${triMsg}${octMsg}${majorThirdMsg}${m7Msg}${tritoneEndMsg}${chrMsg}${chromClimbMsg}${feedbackOverloadMsg}${rsMsg}${speedMsg} · Next RN: ${newRootRaw} (pick Major/Minor)`);

    setNoteField(acting.id, {
      noteTrack:       [],
      discordCount:    0,
      pivotPending:    newPivotPending,
      rootNote:        newRootRaw,
      scaleMode:       newMode,
      hcPoints:        newHCPoints,
      totalHC:         (actingNoteState?.totalHC ?? 0) + earnedTotal,
      upgradesPending: newUpgradesPending,
      hasConfirmed:    true,
      feedbackBoost:   newFeedbackBoost,
      dieFloorBoost:   newDieFloorBoost,
      statusEffects:   newStatusEffects,
      tempDrive:       newTempDrive,
      tempSustain:     newTempSustain,
      bankedNote:      newBankedNote,
      pendingMojoDrain: isMinorSeventhEnd ? (ownsParanoia ? 3 : 2) : (actingNoteState?.pendingMojoDrain ?? 0),
      pendingStagger:  (isMinorSeventhEnd && ownsParanoia) ? 3
                       : (chromStagger > 0 ? chromStagger : (actingNoteState?.pendingStagger ?? 0)),
      pendingParanoia: (isMinorSeventhEnd && ownsParanoia) ? true : false,
      riffSlayerArmed: riffSlayerArm ? true : (actingNoteState?.riffSlayerArmed ?? false),
      eRushArmed:      eRushArm ? true : (actingNoteState?.eRushArmed ?? false),
      // Thousand Beats fires now → start its 2-turn cooldown (counts the Ronin's own turns)
      thousandBeatsCd: thousandFire ? 2 : Math.max(0, thousandCd),
      overdriveActive: false,
      transposeCardPending: null,
      ...cleansePatch, // Borrowed Chord (Maj3 end) — clears one active debuff
    });
    // If a skill was just earned, award it now (adds to unlockedSkills, fires side-effects).
    // Small timeout so the state update above settles before awardTargetSkill reads noteStates.
    if (upgradeTriggered && actingNoteState?.targetSkillId) {
      setTimeout(() => awardTargetSkill(acting.id), 60);
    }
    setMoveStepsLeft(hexes);
    // Apply trip debuff — halve movement if the spirit was tripped last turn.
    // (tripped is still true at commit time; it clears at the START of this spirit's NEXT turn)
    if (actingNoteState?.tripped) {
      const halved = Math.max(1, Math.floor(hexes / 2));
      setMoveStepsLeft(halved);
      addLog(`🌀 ${acting?.name} is TRIPPED — movement halved this turn! (${halved} hex${halved !== 1 ? 'es' : ''})`);
    }
    setMovedThisTurn(false);
    setAction('move');
    // 🎤 FAN ECONOMY — a clean track in the centre rings pulls a crowd to you.
    gainFans(acting.id, acting.num, allInScale);
    // ⚡ THOUSAND BEATS — a full 8-note commit unleashes the Fame-Spark barrage.
    if (thousandFire) {
      addLog(`⚡🗡️ THOUSAND BEATS! ${acting.name} unleashes the barrage — MASH SPACE!`);
      setTimeout(() => launchThousandBeats(acting.id), 600);
    }
  }

  // Called when this character's turn begins — replenish only the used slots.
  // pivotPending is preserved so the Major/Minor prompt appears before building starts.
  // Also clears per-turn debuffs: tripped (movement halved), dazed, instrumentDropped.
  function startNewTurnNotes(spiritId) {
    // Record whether this spirit starts their turn on the limelight hex
    const nextSpirit = spirits.find(s => s.id === spiritId);
    if (nextSpirit) {
      setStartedOnLimelight(prev => ({
        ...prev,
        [spiritId]: nextSpirit.num === LIMELIGHT_HEX,
      }));
    }
    setNoteStates(prev => {
      const ns = prev[spiritId];
      if (!ns) return prev;

      // Replenish only used slots, spelled correctly for current root+mode
      const newStock = ns.noteStock.map((note, idx) => {
        if (!ns.usedStockIdx.has(idx)) return note;
        return randomNote(ns.rootNote, ns.scaleMode);
      });

      // NOTE: mojoDrain / stagger / tripped / dazed / instrumentDropped are NO
      // LONGER ticked or cleared here. Clearing them at the start of your own
      // turn meant they expired before they could ever affect you (the bug that
      // made CQC slip/daze/drop and Stagger feel like they never fired).
      // They now tick down / clear at the END of your own turn — see endTurn().

      return {
        ...prev,
        [spiritId]: {
          ...ns,
          noteStock:    newStock,
          noteTrack:    [],
          usedStockIdx: new Set(),
          discordCount: 0,
          hasConfirmed: false,
          dieFloorBoost: 0,
          // Tick down roadie cooldowns
          roadies: (ns.roadies ?? []).map(r =>
            r.cooldownTurns > 0 ? { ...r, cooldownTurns: r.cooldownTurns - 1 } : r
          ),
          // Tick down groupie crew cooldowns
          groupieCooldowns: Object.fromEntries(
            Object.entries(ns.groupieCooldowns ?? {}).map(([k, v]) => [k, Math.max(0, v - 1)])
          ),
          // Tick down cadence objective cooldowns
          cadenceCooldowns: Object.fromEntries(
            Object.entries(ns.cadenceCooldowns ?? {}).map(([k, v]) => [k, Math.max(0, v - 1)])
          ),
          // Tick down "goes to eleven" boost
          elevenTurns: Math.max(0, (ns.elevenTurns ?? 0) - 1),
          // Mixer recharges every turn
          mixerUsedThisTurn: false,
          // Refresh modulation cards (exhausted resets each turn)
          modCards: (ns.modCards ?? []).map(c => ({ ...c, exhausted: false })),
          // Prompt major/minor choice at the START of this spirit's turn
          pivotPending: true,
          // 🗡️ Riff Slayer only lives for the turn it was armed — disarm on next turn
          riffSlayerArmed: false,
          // 🎴 E-Rush likewise only lives for the turn it was armed
          eRushArmed: false,
          // ⚡ Thousand Beats cooldown ticks down on the Ronin's own turns
          thousandBeatsCd: Math.max(0, (ns.thousandBeatsCd ?? 0) - 1),
        },
      };
    });
  }

  // Called when an attack hits — apply pendingMojoDrain / pendingStagger to target.
  // (Blues Lick charges Mojo Drain, Chromatic Climb charges Stagger; both land
  // on the next attack target, swing or sonic.)
  function applyPendingCombatEffects(attackerId, targetId) {
    // Read current state up-front so we can log outside the updater
    const atkNow = noteStates[attackerId] ?? {};
    const tgtNow = noteStates[targetId] ?? {};
    const willDrain   = (atkNow.pendingMojoDrain ?? 0) > 0 && (tgtNow.mojoDrain ?? 0) === 0;
    const willStagger = (atkNow.pendingStagger ?? 0) > 0 && !tgtNow.stagger;
    const isParanoia  = !!atkNow.pendingParanoia && willDrain;
    const atkName = spirits.find(s => s.id === attackerId)?.name;
    const tgtName = spirits.find(s => s.id === targetId)?.name;
    if (isParanoia) {
      addLog(`🌀 ${atkName}'s PARANOIA grips ${tgtName} — Mojo Drained ${atkNow.pendingMojoDrain} turns AND 2 note slots frozen. They can't play straight!`);
    } else {
      if (willDrain)
        addLog(`💧 ${atkName}'s Blues Lick lands — ${tgtName} is MOJO DRAINED for ${atkNow.pendingMojoDrain} turn${atkNow.pendingMojoDrain !== 1 ? 's' : ''}!`);
      if (willStagger)
        addLog(`⚡ ${atkName}'s attack STAGGERS ${tgtName} — 2 note slots frozen for ${atkNow.pendingStagger} turn${atkNow.pendingStagger !== 1 ? 's' : ''}!`);
    }
    // 💥 Board VFX — staggered after any CQC flashes already queued
    if (isParanoia) {
      setTimeout(() => triggerEffectFlash(targetId, '🌀', 'PARANOIA!', '#aa55ff'), 150);
    } else {
      if (willDrain)   setTimeout(() => triggerEffectFlash(targetId, '💧', 'MOJO DRAINED!', '#4499ff'), 150);
      if (willStagger) setTimeout(() => triggerEffectFlash(targetId, '⚡', 'STAGGERED!', '#ff8800'), willDrain ? 650 : 150);
    }

    setNoteStates(prev => {
      const atk = prev[attackerId];
      const tgt = prev[targetId];
      if (!atk || !tgt) return prev;

      let newAtk = { ...atk, pendingMojoDrain: 0, pendingStagger: 0, pendingParanoia: false, feedbackBoost: false };
      let newTgt = { ...tgt };

      // Mojo Drain: strip boosts + silence for 2 turns (blocked if already drained)
      if ((atk.pendingMojoDrain ?? 0) > 0 && (tgt.mojoDrain ?? 0) === 0) {
        newTgt = {
          ...newTgt,
          mojoDrain:      atk.pendingMojoDrain,
          feedbackBoost:  false,
          dieFloorBoost:  0,
          // statusEffects preserved — Mojo Drain silences future boosts, doesn't cleanse past debuffs
        };
      }

      // Stagger: pick 2 random stock slots, freeze them for N turns (doesn't stack)
      if ((atk.pendingStagger ?? 0) > 0 && !(tgt.stagger)) {
        const allSlots = Array.from({ length: 8 }, (_, i) => i);
        // Shuffle and pick 2
        for (let i = allSlots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
        }
        const frozenSlots = allSlots.slice(0, 2);
        newTgt = {
          ...newTgt,
          stagger: { slots: frozenSlots, turnsLeft: atk.pendingStagger },
        };
      }

      return { ...prev, [attackerId]: newAtk, [targetId]: newTgt };
    });
  }

  // ─── INITIAL SKILL PICK — open skill tree overlay at the very start of a spirit's first turn ───
  // Triggers once per spirit when they have never chosen a skill target.
  useEffect(() => {
    if (!acting) return;
    const ns = noteStates[acting.id] ?? {};
    const hasTarget   = !!ns.targetSkillId;
    const hasSkills   = (ns.unlockedSkills?.length ?? 0) > 0;
    const hasPending  = (ns.upgradesPending ?? 0) > 0;
    const alreadyPrompted = !!ns.initialPickDone;
    // Only prompt once, and only if they have nothing yet
    if (!hasTarget && !hasSkills && !hasPending && !alreadyPrompted) {
      setNoteStates(prev => ({
        ...prev,
        [acting.id]: {
          ...prev[acting.id],
          upgradesPending: 1,
          initialPickDone: true,
        }
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acting?.id]);
  function move(toNum) {
    const s = spirits.find(sp => sp.id === acting.id);
    const ns = noteStates[acting.id] ?? {};

    // Dazed: each move step has a 33% chance to be redirected to a random
    // *different* neighbour (matches CQC desc: "33% chance moves go wrong
    // direction"). Dazed persists for the whole turn — cleared in endTurn().
    let actualTarget = toNum;
    if (ns.dazed && Math.random() < 0.33) {
      const fromHex = HEX_BY_NUM[s.num];
      const neighbours = fromHex ? getFlatTopNeighborSlots(fromHex).filter(n => n.num !== toNum) : [];
      if (neighbours.length > 0) {
        const wrongHex = neighbours[Math.floor(Math.random() * neighbours.length)];
        actualTarget = wrongHex.num;
        addLog(`😵 ${s.name} is DAZED & CONFUSED — stumbles to #${actualTarget} instead of #${toNum}!`);
      }
    }

    const from = HEX_BY_NUM[s.num], to = HEX_BY_NUM[actualTarget];
    if (!to) return; // safety: off-board redirect
    const newFacing = facingAngle(from, to);
    const newSteps = moveStepsLeft - 1;
    setSpirits(p => p.map(sp => sp.id !== acting.id ? sp : {
      ...sp, num: actualTarget, facing: newFacing,
    }));
    setMoveStepsLeft(newSteps);
    if (!ns.dazed) addLog(`🚶 ${s.name} → #${actualTarget} (${newSteps} step${newSteps !== 1 ? "s" : ""} left)`);
    else addLog(`🚶 ${s.name} → #${actualTarget} (${newSteps} step${newSteps !== 1 ? "s" : ""} left)`);
    if (to.edge) addLog(`⚠️ ${s.name} is on the EDGE — knockback risk!`);
    if (newSteps <= 0) setAction(null);
    // Check amp plug state after moving
    checkAmpUnplug(acting.id, actualTarget);
    checkAmpReplug(acting.id, actualTarget);
    // Check if spirit landed on a board card
    checkCardPickup(acting.id, actualTarget);
    // Flaming disc hazard (Disco Inferno)
    checkFlamingDisc(acting.id, actualTarget);
    // ✨ Fame Spark pickup
    checkSparkPickup(acting.id, actualTarget);
    // Marquee event hex
    checkEventTrigger(acting.id, actualTarget);
  }

  // ─── SKILL TREE — TARGET SELECTION & AWARD ───────────────────────────────────
  // New flow:
  //   1. Player picks a target skill → stored as targetSkillId, hcCost stored as target cost
  //   2. Every HC earned counts toward hcPoints (resets at targetCost, carries overflow)
  //   3. When threshold hit → upgradesPending=1, skill awarded automatically, overlay opens to pick next
  //   4. Player picks next target → overlay closes, cycle repeats

  function applySkillEffects(spiritId, skillId) {
    // Pure side-effects only (state mutations outside noteStates)
    // noteStates.unlockedSkills is updated by the caller
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    const skill  = SKILL_BY_ID[skillId];

    if (skillId === 'fans_4eva')    addLog(`💚 ${spirit?.name} — Fans 4Eva! Crew ready to deploy from your HUD: restore 2 Vibe.`);
    if (skillId === 'pranksta')     addLog(`🪤 ${spirit?.name} — Bust Out Pranksta! Crew ready to deploy: disconnect up to 2 rival amps.`);
    if (skillId === 'junkyard_dog') addLog(`🔩 ${spirit?.name} — Junkyard Dog! Crew ready to deploy: arm a junkyard weapon (+2 on next Swing).`);
    if (skillId === 'fandom_army')  addLog(`🛡️ ${spirit?.name} — Several Fandom Army! Crew ready to deploy: +2 Feedback for your next battle.`);
    if (skillId === 'hero_pose')    addLog(`🌟 ${spirit?.name} — HERO POSE unlocked! Pose on centre hex for 2 turns to win.`);
    if (skillId === 'master_moshpits') addLog(`🤘 ${spirit?.name} — MASTER OF MOSHPITS! Win a battle with a banked note to burn it for +1 Vibe and flood the pit.`);
    if (skillId === 'riff_slayer')  addLog(`🗡️ ${spirit?.name} — RIFF SLAYER! Commit a skip-climb (notes leaping by thirds) to rattle a rival in any riff-off that turn.`);
    if (skillId === 'paranoia')     addLog(`🌀 ${spirit?.name} — PARANOIA! Your Mojo Drain now lasts 3 turns AND freezes 2 of the rival's note slots.`);
    if (skillId === 'azrael')       addLog(`💀 ${spirit?.name} — AZRAEL! Every rival you knock down feeds Fame equal to your knockdown streak. Resets when you go down.`);
    if (skillId === 'psycho_bushido') addLog(`🌀 ${spirit?.name} — PSYCHO BUSHIDO! A CQC swing of 5–6 forces the rival's die to a 1.`);
    if (skillId === 'e_rush')       addLog(`🎴 ${spirit?.name} — いいラッシュ unlocked! End on an E, then a riff-off that turn buries the rival under ghost notes.`);
    if (skillId === 'thousand_beats') addLog(`⚡ ${spirit?.name} — THOUSAND BEATS! Commit 8 notes to mash for Fame Sparks. 2-turn cooldown.`);
    if (skillId === 'hydra')        addLog(`🐉 ${spirit?.name} — HYDRA! With 3 amps, your Sonic Attack rolls 3d6 and fires three beams.`);

    const CQC_SWING_MAP = { shank_skank:'swing_1', cosmic_boogaloo:'swing_2', moon_shuffle:'swing_3', baki_gravity:'swing_3' };
    if (CQC_SWING_MAP[skillId]) {
      const tier = SWING_UPGRADE_TIERS.find(t => t.id === CQC_SWING_MAP[skillId]);
      addLog(`🥊 ${spirit?.name} unlocks ${skill?.label}! ${tier?.desc ?? ''}`);
      // PERMANENT +1 DRIVE — practising the CQC arts makes the Spirit stronger
      // over the game. Idempotent: each CQC skill grants its +1 only once.
      const alreadyBuffed = (ns.driveBuffsApplied ?? []).includes(skillId);
      if (!alreadyBuffed) {
        setSpirits(prev => prev.map(s => s.id === spiritId ? { ...s, drive: (s.drive ?? 6) + 1 } : s));
        setNoteStates(prev => {
          const ns2 = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: {
            ...ns2, driveBuffsApplied: [...(ns2.driveBuffsApplied ?? []), skillId]
          }};
        });
        addLog(`💪 ${spirit?.name}'s CQC training pays off — permanent +1 Drive! (now ${(spirit?.drive ?? 6) + 1})`);
      }
    }
    if (['amp_1','amp_2','amp_3'].includes(skillId)) {
      const ownedCount = amps.filter(a => a.ownerId === spiritId).length;
      if (ownedCount < AMP_UPGRADE_MAX) {
        // Don't enter click-to-place mode here — the skill overlay is open and
        // swallows board clicks (this is what made placement feel broken).
        // The glowing "Place Amp" chip in CREW & GEAR handles placement anytime.
        addLog(`🔊 ${spirit?.name} — Amp ${ownedCount + 1} ready! Deploy it from CREW & GEAR on your spirit card.`);
      }
    }
    if (['roadie_1','roadie_2','roadie_3'].includes(skillId)) {
      const newRoadie = { id:`roadie-${spiritId}-${Date.now()}`, cooldownTurns:0, onBoard:false, boardHex:null };
      setNoteStates(prev => ({ ...prev, [spiritId]: {
        ...prev[spiritId], roadies: [...(prev[spiritId]?.roadies ?? []), newRoadie]
      }}));
      addLog(`🔧 ${spirit?.name} hires Roadie ${(ns.roadies?.length ?? 0) + 1}!`);
    }
    if (['discord_1','discord_2','discord_3','discord_4'].includes(skillId)) {
      const tier = DISCORD_UPGRADE_TIERS.find(t => t.id === skillId);
      addLog(`${tier?.icon ?? '🎵'} ${spirit?.name} unlocks ${tier?.label}! ${tier?.desc ?? ''}`);
      // Also update discordUnlocks so confirmNoteTrack applies the new interval rules
      setNoteStates(prev => {
        const ns2 = prev[spiritId] ?? {};
        const existing = ns2.discordUnlocks ?? [];
        if (existing.includes(skillId)) return prev;
        return { ...prev, [spiritId]: { ...ns2, discordUnlocks: [...existing, skillId] } };
      });
    }
    if (skillId === 'mic')          addLog(`🎤 ${spirit?.name} — Mic! Voice roll d6 bonus note.`);
    if (skillId === 'pedal_dist')   addLog(`🎛️ ${spirit?.name} — Pedal Distortion! +1 Drive on Sonic Attacks.`);
    if (skillId === 'mixer')        addLog(`🎚️ ${spirit?.name} — Mixer! Play 2 notes simultaneously once per turn.`);
    if (skillId === 'power_chords') addLog(`🤘 ${spirit?.name} — Power Chords! +2 Drive on Sonic when 2+ amps.`);
    if (skillId === 'ultimate')     addLog(`💀 ${spirit?.name} — ULTIMATE ABILITY UNLOCKED!`);
    if (skillId === 'laser_show')   addLog(`🔴 ${spirit?.name} — Laser Show! 33% chance: rival dice halved.`);
    if (skillId === 'stage_light')  addLog(`💡 ${spirit?.name} — Stage Lighting! 33% chance: +1 Vibe on win.`);
    if (skillId === 'fog_machine')  addLog(`🌫️ ${spirit?.name} — Fog Machine! 33% chance: rival -1 Drive/-1 Feedback.`);
    if (skillId === 'pyrotechnics') addLog(`🔥 ${spirit?.name} — PYROTECHNICS! 33% chance: +d6 to Drive roll.`);
  }

  // Called when player selects a skill to target (from the overlay).
  // The previously awarded skill is already in unlockedSkills — just set the new target.
  function setSkillTarget(spiritId, skillId) {
    const ns    = noteStates[spiritId] ?? {};
    const skill = SKILL_BY_ID[skillId];
    if (!skill) return;

    const unlocked = ns.unlockedSkills ?? [];
    if (unlocked.includes(skillId)) return;

    // Prereq checks
    if (skill.prereq && skill.prereq !== '__all_pa__' && skill.prereq !== '__all_stage_3__') {
      if (!unlocked.includes(skill.prereq)) {
        addLog(`❌ Requires ${SKILL_BY_ID[skill.prereq]?.label} first.`); return;
      }
    }
    if (skill.prereq === '__all_pa__') {
      const need = ['mic','pedal_dist','amp_1','mixer'];
      const missing = need.filter(id => !unlocked.includes(id));
      if (missing.length) { addLog(`❌ Ultimate requires: ${missing.join(', ')}`); return; }
    }
    if (skill.prereq === '__all_stage_3__') {
      const need = ['laser_show','stage_light','fog_machine'];
      const missing = need.filter(id => !unlocked.includes(id));
      if (missing.length) { addLog(`❌ Pyrotechnics requires: ${missing.join(', ')}`); return; }
    }
    if (skill.chainId === 'pa' && skill.id !== 'amp_1' && !unlocked.includes('amp_1')) {
      addLog(`❌ PA system requires Amp I first.`); return;
    }

    setNoteStates(prev => ({
      ...prev,
      [spiritId]: {
        ...prev[spiritId],
        targetSkillId:       skillId,
        pendingAwardSkillId: null,
        upgradesPending:     0,
        skillRoute:          ns.skillRoute,
        hcPoints:            prev[spiritId]?.hcPoints ?? 0,
      }
    }));

    const spirit = spirits.find(s => s.id === spiritId);
    addLog(`🎯 ${spirit?.name} is saving toward: ${skill.icon} ${skill.label} (${skill.hcCost} HC)`);
  }

  // Called when advanceHC fires upgradeTriggered — awards the target skill & opens overlay.
  function awardTargetSkill(spiritId) {
    let awardedSkillId = null;
    // Functional update reads fresh state even when called from a stale setTimeout closure
    setNoteStates(prev => {
      const ns      = prev[spiritId] ?? {};
      const skillId = ns.targetSkillId;
      if (!skillId) {
        return { ...prev, [spiritId]: { ...ns, upgradesPending: 1 } };
      }
      awardedSkillId = skillId;
      const unlocked    = ns.unlockedSkills ?? [];
      const newUnlocked = unlocked.includes(skillId) ? unlocked : [...unlocked, skillId];
      return {
        ...prev,
        [spiritId]: {
          ...ns,
          unlockedSkills:      newUnlocked,
          upgradesPending:     1,
          pendingAwardSkillId: skillId,
          targetSkillId:       null,
        }
      };
    });
    // Side-effects run after state settles — use a second timeout so React has batched the update
    setTimeout(() => {
      if (awardedSkillId) {
        const skill = SKILL_BY_ID[awardedSkillId];
        addLog(`🏆 ${spirits.find(s => s.id === spiritId)?.name} earned: ${skill?.icon} ${skill?.label}!`);
        applySkillEffects(spiritId, awardedSkillId);
      }
    }, 60);
  }

  // Legacy alias
  function purchaseSkill(spiritId, skillId) { setSkillTarget(spiritId, skillId); }
  function chooseUpgrade(spiritId, categoryId) {
    const legacyMap = { amp:'amp_1', roadie:'roadie_1', close_combat:'shank_skank',
      discord_1:'discord_1', discord_2:'discord_2', discord_3:'discord_3', discord_4:'discord_4' };
    setSkillTarget(spiritId, legacyMap[categoryId] ?? categoryId);
  }

  // Player clicked a hex while ampPlacing — drop the amp there if valid
  function placeAmp(hexNum) {
    if (!ampPlacing) return;
    const spiritId = ampPlacing;
    const spirit = spirits.find(s => s.id === spiritId);
    if (!spirit) { setAmpPlacing(null); return; }
    const spiritHex = HEX_BY_NUM[spirit.num];
    if (!spiritHex) { setAmpPlacing(null); return; }
    // Must be an immediate neighbor
    const isNeighbor = getFlatTopNeighborSlots(spiritHex).some(n => n.num === hexNum);
    if (!isNeighbor) { addLog('🔊 Place the Amp on an adjacent hex.'); return; }
    // Cannot place on occupied hex
    const occupiedBySpirit = spirits.some(s => s.num === hexNum && !s.knockedOut);
    const occupiedByAmp    = amps.some(a => a.hexNum === hexNum);
    if (occupiedBySpirit || occupiedByAmp) {
      addLog('🔊 That hex is occupied — choose a different adjacent hex.');
      return;
    }
    const newAmp = {
      id: `amp-${spiritId}-${Date.now()}`,
      ownerId: spiritId,
      ownerColor: spirit.color,
      hexNum,
      connected: false,
    };
    setAmps(prev => [...prev, newAmp]);
    setAmpPlacing(null);
    addLog(`🔊 ${spirit.name} places an Amp on hex #${hexNum}!`);
    // Only reopen the "pick next target" overlay if this placement came from a skill-award flow
    setNoteStates(prev => {
      const ns = prev[spiritId] ?? {};
      if (!ns.pendingAwardSkillId) return prev; // manual placement — no overlay needed
      return {
        ...prev,
        [spiritId]: {
          ...ns,
          upgradesPending:     1,
          pendingAwardSkillId: null,
        }
      };
    });
  }

  // Amp connection is now automatic — determined by axialDist at derived-state time.
  // Kept as a no-op for any residual UI references.
  function connectAmp() {}

  // ─── CREW & GEAR DEPLOYABLES ─────────────────────────────────────────────────
  // Groupie crews are one-tap abilities in the HUD. Each deployment puts that
  // crew on a GROUPIE_COOLDOWN (own turns) before it can be sent out again.
  function deployGroupie(spiritId, skillId) {
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    if (!spirit || spirit.knockedOut) return;
    if (!(ns.unlockedSkills ?? []).includes(skillId)) return;
    if ((ns.groupieCooldowns?.[skillId] ?? 0) > 0) {
      addLog(`🎉 That crew is still recovering — ${ns.groupieCooldowns[skillId]} turn(s) left.`);
      return;
    }

    const startCooldown = () => setNoteStates(prev => ({
      ...prev,
      [spiritId]: {
        ...prev[spiritId],
        groupieCooldowns: { ...(prev[spiritId]?.groupieCooldowns ?? {}), [skillId]: GROUPIE_COOLDOWN },
      },
    }));

    if (skillId === 'fans_4eva') {
      if (spirit.vibe >= spirit.maxVibe) { addLog(`💚 ${spirit.name} is already at full Vibe — save the fans for later!`); return; }
      setSpirits(prev => prev.map(s => s.id === spiritId
        ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 2) } : s));
      addLog(`💚 ${spirit.name} crowd-surfs into their fans — +2 Vibe restored!`);
      startCooldown();
      return;
    }

    if (skillId === 'pranksta') {
      const spiritHex = HEX_BY_NUM[spirit.num];
      if (!spiritHex) return;
      // Up to 2 nearest live rival amps within 4 hexes
      const targets = amps
        .filter(a => a.ownerId !== spiritId && !a.unplugged)
        .map(a => {
          const ah = HEX_BY_NUM[a.hexNum];
          return ah ? { amp: a, dist: axialDist(spiritHex.q, spiritHex.r, ah.q, ah.r) } : null;
        })
        .filter(t => t && t.dist <= 4)
        .sort((x, y) => x.dist - y.dist)
        .slice(0, 2);
      if (targets.length === 0) { addLog(`🪤 No live rival amps within 4 hexes — the pranksters shrug.`); return; }
      const hitIds = new Set(targets.map(t => t.amp.id));
      setAmps(prev => prev.map(a => hitIds.has(a.id)
        ? { ...a, unplugged: true, unpluggerId: spiritId } : a));
      targets.forEach(t => {
        const owner = spirits.find(s => s.id === t.amp.ownerId);
        addLog(`🪤 Pranksters yank the cable on ${owner?.name ?? 'a rival'}'s amp at #${t.amp.hexNum}!`);
      });
      startCooldown();
      return;
    }

    if (skillId === 'junkyard_dog') {
      if (ns.junkyardArmed) { addLog(`🔩 ${spirit.name} is already holding a junkyard weapon!`); return; }
      setNoteStates(prev => ({
        ...prev,
        [spiritId]: { ...prev[spiritId], junkyardArmed: true },
      }));
      addLog(`🔩 The fans pass ${spirit.name} something rusty over the barricade — next Swing gets +2!`);
      startCooldown();
      return;
    }

    if (skillId === 'fandom_army') {
      setNoteStates(prev => {
        const cur = prev[spiritId] ?? {};
        return {
          ...prev,
          [spiritId]: { ...cur, tempSustain: Math.max(cur.tempSustain ?? 0, 2) },
        };
      });
      addLog(`🛡️ ${spirit.name}'s fandom forms a human wall — +2 Feedback for the next battle!`);
      startCooldown();
      return;
    }
  }

  // ENCORE APOCALYPSE — the Ultimate. Once per game: 2 Vibe damage + 1-turn
  // Stagger to every rival within 4 hexes.
  function fireUltimate(spiritId) {
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    if (!spirit || spirit.knockedOut) return;
    if (!(ns.unlockedSkills ?? []).includes('ultimate') || ns.ultimateUsed) return;
    const spiritHex = HEX_BY_NUM[spirit.num];
    if (!spiritHex) return;
    const victims = spirits.filter(s => {
      if (s.id === spiritId || s.knockedOut) return false;
      const sh = HEX_BY_NUM[s.num];
      return sh && axialDist(spiritHex.q, spiritHex.r, sh.q, sh.r) <= 4;
    });
    if (victims.length === 0) { addLog(`💀 No rivals within 4 hexes — don't waste the Encore!`); return; }
    setNoteStates(prev => {
      let next = { ...prev, [spiritId]: { ...prev[spiritId], ultimateUsed: true } };
      victims.forEach(v => {
        const vNs = next[v.id] ?? {};
        if (!vNs.stagger) {
          const slots = Array.from({ length: 8 }, (_, i) => i);
          for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
          }
          next = { ...next, [v.id]: { ...vNs, stagger: { slots: slots.slice(0, 2), turnsLeft: 1 } } };
        }
      });
      return next;
    });
    addLog(`💀⚡ ${spirit.name} unleashes ENCORE APOCALYPSE! The whole venue shakes!`);
    victims.forEach((v, i) => {
      triggerRumble(v.id);
      setTimeout(() => applyVibeDamage(v.id, 2, 'Encore Apocalypse'), 120 + i * 80);
      setTimeout(() => triggerEffectFlash(v.id, '⚡', 'STAGGERED!', '#ff8800'), 250 + i * 120);
      addLog(`💀 ${v.name} takes 2 Vibe damage and is STAGGERED!`);
    });
  }

  // ── LIMELIGHT / POSE ─────────────────────────────────────────────────────────
  function togglePose() {
    if (!acting) return;
    if (!(noteStates[acting.id]?.unlockedSkills ?? []).includes('hero_pose')) {
      addLog(`🌟 Unlock HERO POSE (CQC route) before striking a winning pose!`);
      return;
    }
    if (acting.num !== LIMELIGHT_HEX) {
      addLog(`🎤 ${acting.name} is not on the centre stage hex!`);
      return;
    }
    if (!hasConfirmed) {
      addLog(`🎤 Build and confirm your Note Track before posing.`);
      return;
    }
    setPosing(prev => {
      const current = !!prev[acting.id];
      addLog(current
        ? `🎤 ${acting.name} stops posing.`
        : `🎤 ${acting.name} STRIKES A POSE! ✨ In the Limelight!`);
      return { ...prev, [acting.id]: !current };
    });
  }

  // Roadie action flow
  function startRoadieAction(spiritId, roadieId) {
    setRoadieAction({ spiritId, roadieId, phase: 'selectHex' });
    addLog(`🔧 Roadie activated — click a hex adjacent to your Amp`);
  }


  // ─── MODULATION CARDS ────────────────────────────────────────────────────────
  // MOD_CARD_DEFS: definitions for all card types
  const MOD_CARD_DEFS = {
    chromatic_shift: {
      icon: '🎼',
      name: 'Chromatic Shift',
      desc: 'Rewrite all discord notes in your stock into in-scale notes for your chosen mode.',
      color: '#44ffaa',
      usableWhen: 'after-pivot', // after choosing major/minor, before building
    },
    transpose: {
      icon: '🔄',
      name: 'Transpose',
      desc: 'Re-draw your Root Note from any note in your current stock — you choose.',
      color: '#ffcc44',
      usableWhen: 'during-pivot', // instead of accepting assigned root
    },
    overdrive: {
      icon: '⚡',
      name: 'Overdrive',
      desc: 'One discord note in your track counts as in-scale for HC scoring this turn.',
      color: '#ff8844',
      usableWhen: 'before-commit', // before committing the note track
    },
  };

  function playModCard(cardId) {
    if (!acting) return;
    const ns = actingNoteState;
    const card = (ns?.modCards ?? []).find(c => c.id === cardId);
    if (!card || card.exhausted) return;
    const def = MOD_CARD_DEFS[card.type];
    if (!def) return;

    if (card.type === 'chromatic_shift') {
      if (pivotPending) { addLog('🎼 Declare Major or Minor first, then play Chromatic Shift.'); return; }
      // Replace all out-of-scale notes in stock with random in-scale notes
      const newStock = (ns.noteStock ?? []).map((note, idx) => {
        if (ns.usedStockIdx?.has(idx)) return note; // already used — leave it
        if (currentScale.includes(note)) return note; // already in scale — leave it
        // Out of scale — replace with a random in-scale note
        const inScalePool = currentScale;
        return inScalePool[Math.floor(Math.random() * inScalePool.length)];
      });
      setNoteField(acting.id, {
        noteStock: newStock,
        modCards: (ns.modCards ?? []).map(c => c.id === cardId ? { ...c, exhausted: true } : c),
      });
      addLog(`🎼 Chromatic Shift — all discord notes rewritten to ${rootNote} ${scaleMode}!`);
    }

    else if (card.type === 'transpose') {
      // Open a "pick your new root" overlay — set a pending state
      setNoteField(acting.id, {
        transposeCardPending: cardId,
        modCards: (ns.modCards ?? []).map(c => c.id === cardId ? { ...c, exhausted: true } : c),
      });
      addLog('🔄 Transpose — click any note in your stock to use it as your new Root Note.');
    }

    else if (card.type === 'overdrive') {
      if (hasConfirmed) { addLog('⚡ Overdrive must be played before committing your track.'); return; }
      setNoteField(acting.id, {
        overdriveActive: true,
        modCards: (ns.modCards ?? []).map(c => c.id === cardId ? { ...c, exhausted: true } : c),
      });
      addLog('⚡ Overdrive active — one discord note will count as in-scale this commit!');
    }
  }

  function resolveTransposeCard(noteIdx) {
    if (!acting) return;
    const ns = actingNoteState;
    if (!ns?.transposeCardPending) return;
    const newRoot = ns.noteStock[noteIdx];
    if (!newRoot) return;
    const canonRoot = canonicalRoot(newRoot, scaleMode);
    // Respell stock
    const pool = getSpelledPool(canonRoot, scaleMode);
    const newStock = (ns.noteStock ?? []).map(n => {
      const idx = pitchIndex(n);
      return idx !== -1 ? pool[idx] : n;
    });
    setNoteField(acting.id, {
      rootNote: canonRoot,
      noteStock: newStock,
      pivotPending: true, // re-prompt for major/minor with new root
      transposeCardPending: null,
    });
    addLog(`🔄 Transpose — new Root Note: ${canonRoot}. Choose Major or Minor.`);
  }

  // ─── SKILL EFFECT HELPERS ─────────────────────────────────────────────────────

  // Returns any battle modifiers granted by the attacker's/defender's unlocked skills.
  // Called at the start of initiateSwing / initiateSonicAttack stat setup.
  function getBattleSkillMods(attackerId, defenderId) {
    const nsA = noteStates[attackerId] ?? {};
    const nsD = noteStates[defenderId] ?? {};
    const atkSkills = nsA.unlockedSkills ?? [];
    const defSkills = nsD.unlockedSkills ?? [];

    let extraAtkDrive    = 0;
    let halveDef         = false;
    let fogActive        = false;
    let pyroBonus        = 0;
    let laserActive      = false;
    let stageLightActive = false;

    // Laser Show (attacker owns it — affects defender's die)
    if (atkSkills.includes('laser_show') && Math.random() < 0.33) {
      halveDef = true;
      laserActive = true;
    }
    // Stage Lighting (attacker owns it — heals on win)
    if (atkSkills.includes('stage_light') && Math.random() < 0.33) {
      stageLightActive = true;
    }
    // Fog Machine (attacker owns it — fires on defender entrance)
    if (atkSkills.includes('fog_machine') && Math.random() < 0.33) {
      fogActive = true;
    }
    // Pyrotechnics (attacker owns it — requires all 3 stage effects)
    if (atkSkills.includes('pyrotechnics') && Math.random() < 0.33) {
      pyroBonus = Math.floor(Math.random() * 6) + 1;
    }
    // Pedal Distortion / Power Chords handled in initiateSonicAttack

    return { halveDef, laserActive, fogActive, pyroBonus, extraAtkDrive, stageLightActive };
  }

  // ─── SWING EFFECTS (extended for full CQC skill chain) ────────────────────────
  // Builds a chance table from the attacker's unlockedSkills CQC chain.
  function getCQCChances(atkNs) {
    const skills = atkNs.unlockedSkills ?? [];
    // Base chances per CQC skill unlocked (cumulative — later tiers include earlier)
    if (skills.includes('baki_gravity'))   return { slip:0.35, dazed:0.23, drop:0.18, confused:0.10 };
    if (skills.includes('moon_shuffle'))   return { slip:0.30, dazed:0.18, drop:0.12, confused:0     };
    if (skills.includes('cosmic_boogaloo'))return { slip:0.25, dazed:0.15, drop:0,    confused:0     };
    if (skills.includes('shank_skank'))    return { slip:0.20, dazed:0,    drop:0,    confused:0     };
    return null;
  }

  // ─── SWING EFFECT INFO (shared by the roll, the result banner & the apply) ────
  // Human-readable description of what each status effect does AFTER the battle
  // (i.e. once the overlay closes and the defender has been pushed back). Keep
  // the `after` text aligned with what applySwingEffects actually does below.
  const SWING_FX_INFO = {
    slip:     { icon:'🌀', label:'Slip',     color:'#44ddff', after:'loses 2 note slots on their next turn' },
    trip:     { icon:'🌀', label:'Trip',     color:'#aaffaa', after:'movement halved on their next turn' },
    drop:     { icon:'🎸', label:'Drop',     color:'#ff4444', after:'drops their instrument — −1 Drive until they recover it' },
    dazed:    { icon:'😵', label:'Dazed',    color:'#ff66ff', after:'33% of their moves go the wrong way next turn' },
    confused: { icon:'💫', label:'Confused', color:'#ffaa44', after:'hurts itself for Vibe damage right after the push' },
  };
  // Friendly name of the highest swing/CQC upgrade the attacker owns.
  function swingUpgradeName(atkNs) {
    const skills = atkNs?.unlockedSkills ?? [];
    if (skills.includes('baki_gravity'))    return 'Baki Gravity';
    if (skills.includes('moon_shuffle'))    return 'Moon Shuffle';
    if (skills.includes('cosmic_boogaloo')) return 'Cosmic Boogaloo';
    if (skills.includes('shank_skank'))     return 'Shank Skank';
    const up = atkNs?.swingUpgrades ?? [];
    if (up.includes('swing_3')) return 'Dazed & Confused';
    if (up.includes('swing_2')) return 'Reckless Abandon';
    if (up.includes('swing_1')) return 'Dirty Boots';
    return 'Swing Upgrade';
  }

  // ─── ROLL SWING EFFECTS (pure — no state changes) ─────────────────────────────
  // Rolls the attacker's swing/CQC status-effect chances ONCE and freezes the
  // outcome so the result overlay can tell the player exactly what will happen
  // before they close it. Returns null when the attacker has no swing upgrade
  // (or the attack is Sonic — CQC is melee only). When it returns an object,
  // `effects` is the list that actually landed (empty array = rolled but missed).
  function rollSwingEffects(attackerId, sonicAttack) {
    if (sonicAttack) return null; // CQC = melee only
    const atkNs = noteStates[attackerId] ?? {};
    const cqcChances = getCQCChances(atkNs);
    const swingUpgrades = atkNs.swingUpgrades ?? [];
    if (!cqcChances && swingUpgrades.length === 0) return null;

    const chances = cqcChances ?? (() => {
      const highestTier = ['swing_3','swing_2','swing_1'].find(t => swingUpgrades.includes(t));
      return highestTier ? SWING_EFFECT_CHANCES[highestTier] : null;
    })();
    if (!chances) return null;

    const effects = [];
    if (chances.slip  > 0 && Math.random() < chances.slip)        effects.push('slip');
    if (chances.trip  > 0 && Math.random() < (chances.trip ?? 0)) effects.push('trip');
    if (chances.drop  > 0 && Math.random() < chances.drop)        effects.push('drop');
    if (chances.dazed > 0 && Math.random() < chances.dazed)       effects.push('dazed');
    if (chances.confused > 0 && Math.random() < chances.confused) effects.push('confused');

    // GUARANTEE: an upgraded CQC swing ALWAYS lands at least one effect on a hit.
    // The per-effect % now decides *which* / *how many* stack; if the independent
    // rolls all missed, force one in, weighted by this tier's chances.
    let guaranteed = false;
    if (effects.length === 0) {
      const pool = ['slip','trip','drop','dazed','confused']
        .map(k => [k, chances[k] ?? 0]).filter(([, w]) => w > 0);
      if (pool.length) {
        const total = pool.reduce((a, [, w]) => a + w, 0);
        let r = Math.random() * total, chosen = pool[0][0];
        for (const [k, w] of pool) { if (r < w) { chosen = k; break; } r -= w; }
        effects.push(chosen);
        guaranteed = true;
      }
    }

    // Pre-roll the Confused self-damage so the preview number matches what lands.
    let confusedDmg = 0;
    if (effects.includes('confused')) {
      const r = Math.floor(Math.random() * 6) + 1;
      confusedDmg = r <= 3 ? 1 : r <= 5 ? 2 : 3;
    }

    return { upgradeName: swingUpgradeName(atkNs), effects, confusedDmg, guaranteed };
  }

  // ─── SWING EFFECTS ────────────────────────────────────────────────────────────
  // Applies the status effects of a swing/CQC upgrade to the defender. Pass the
  // pre-rolled result from rollSwingEffects() so the board does exactly what the
  // result overlay promised; if omitted, it rolls fresh (legacy fallback).
  // Fires after the overlay closes — same beat as the knockback / push-back.
  function applySwingEffects(attackerId, defenderId, prerolled) {
    const roll = prerolled !== undefined ? prerolled : rollSwingEffects(attackerId, false);
    if (!roll) return; // attacker has no swing upgrade

    const attacker = spirits.find(s => s.id === attackerId);
    const defender = spirits.find(s => s.id === defenderId);
    const effects = roll.effects ?? [];

    // Rolled, but nothing landed — tell the player so the upgrade never feels
    // silently broken.
    if (effects.length === 0) {
      addLog(`🗡️ ${attacker?.name}'s ${roll.upgradeName} rolled for a status effect on ${defender?.name} — but none landed this time.`);
      return;
    }

    // 💥 Board VFX — fire a shockwave flash on the victim for each landed
    // effect, staggered 0.5s apart so multiple procs read clearly. These land
    // the moment the hit resolves (same beat as the damage number).
    const FX_DEFS = {
      slip:     { icon:'🌀', label:'SLIPPED!',  color:'#44ddff' },
      trip:     { icon:'🌀', label:'TRIPPED!',  color:'#aaffaa' },
      drop:     { icon:'🎸', label:'DROPPED!',  color:'#ff4444' },
      dazed:    { icon:'😵', label:'DAZED!',    color:'#ff66ff' },
      confused: { icon:'💫', label:'CONFUSED!', color:'#ffaa44' },
    };
    effects.forEach((fx, i) => {
      const def = FX_DEFS[fx];
      if (def) setTimeout(() => triggerEffectFlash(defenderId, def.icon, def.label, def.color), i * 500);
    });

    setNoteStates(prev => {
      const tgt = prev[defenderId] ?? {};
      const updates = {};
      if (effects.includes('slip')) {
        // CQC SLIP: rival loses 2 notes next turn — freeze 2 random stock
        // slots for 1 turn (reuses the Stagger slot-freeze; ticks at the
        // end of the defender's own turn). Doesn't stack on an existing Stagger.
        if (!tgt.stagger) {
          const allSlots = Array.from({ length: 8 }, (_, i) => i);
          for (let i = allSlots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allSlots[i], allSlots[j]] = [allSlots[j], allSlots[i]];
          }
          updates.stagger = { slots: allSlots.slice(0, 2), turnsLeft: 1 };
          addLog(`🌀 ${attacker?.name} SLIPS ${defender?.name}! They lose 2 notes next turn.`);
        } else {
          addLog(`🌀 ${attacker?.name} slips ${defender?.name} — but they're already staggered.`);
        }
      }
      if (effects.includes('trip')) {
        updates.tripped = true;
        addLog(`🌀 ${attacker?.name} TRIPS ${defender?.name}! Movement halved next turn.`);
      }
      if (effects.includes('drop')) {
        updates.instrumentDropped = true;
        addLog(`💥 ${defender?.name} DROPS their instrument! -1 Drive until recovered.`);
      }
      if (effects.includes('dazed')) {
        updates.dazed = true;
        addLog(`😵 ${defender?.name} is DAZED & CONFUSED! Their moves next turn have a 33% chance of going the wrong way!`);
      }
      if (effects.includes('confused')) {
        // Baki Gravity confused: self-damage to defender. Use the value rolled
        // up-front (and shown in the result overlay) so the board matches.
        const confDmg = roll.confusedDmg ?? 1;
        addLog(`💫 ${defender?.name} is CONFUSED — hurts themselves for ${confDmg} Vibe dmg!`);
        // Apply self-damage after state update
        setTimeout(() => applyVibeDamage(defenderId, confDmg, 'confusion'), 200);
      }
      return { ...prev, [defenderId]: { ...tgt, ...updates } };
    });
  }

  // ─── AMP UNPLUG SYSTEM ────────────────────────────────────────────────────────
  // Check if the acting spirit has walked >AMP_UNPLUG_DIST hexes from their own amp.
  // Called after every move step.
  function checkAmpUnplug(spiritId, newHexNum) {
    const spiritHex = HEX_BY_NUM[newHexNum];
    if (!spiritHex) return;
    setAmps(prev => prev.map(amp => {
      if (amp.ownerId !== spiritId) return amp;
      const ampHex = HEX_BY_NUM[amp.hexNum];
      if (!ampHex) return amp;
      const dist = axialDist(spiritHex.q, spiritHex.r, ampHex.q, ampHex.r);
      if (dist > AMP_UNPLUG_DIST && !amp.unplugged) {
        const spirit = spirits.find(s => s.id === spiritId);
        addLog(`🔌 ${spirit?.name} wanders too far — Amp on #${amp.hexNum} is UNPLUGGED! (${dist} hexes away)`);
        return { ...amp, unplugged: true };
      }
      return amp;
    }));
  }

  // Re-plug own amp if you move back within range
  function checkAmpReplug(spiritId, newHexNum) {
    const spiritHex = HEX_BY_NUM[newHexNum];
    if (!spiritHex) return;
    setAmps(prev => prev.map(amp => {
      if (amp.ownerId !== spiritId || !amp.unplugged) return amp;
      const ampHex = HEX_BY_NUM[amp.hexNum];
      if (!ampHex) return amp;
      const dist = axialDist(spiritHex.q, spiritHex.r, ampHex.q, ampHex.r);
      if (dist <= AMP_UNPLUG_DIST) {
        const spirit = spirits.find(s => s.id === spiritId);
        addLog(`🔌 ${spirit?.name} plugs back in — Amp on #${amp.hexNum} is LIVE again!`);
        return { ...amp, unplugged: false };
      }
      return amp;
    }));
  }

  // Unplug a rival's amp — must be adjacent to the amp hex
  function unplugRivalAmp(ampId) {
    const spirit = spirits.find(s => s.id === acting?.id);
    if (!spirit) return;
    const spiritHex = HEX_BY_NUM[spirit.num];
    setAmps(prev => prev.map(amp => {
      if (amp.id !== ampId) return amp;
      if (amp.ownerId === acting?.id) { addLog(`🔌 That's your own amp!`); return amp; }
      if (amp.unplugged) { addLog(`🔌 That amp is already unplugged.`); return amp; }
      const ampHex = HEX_BY_NUM[amp.hexNum];
      const neighbors = getFlatTopNeighborSlots(spiritHex);
      const isAdjacent = neighbors.some(n => n.num === amp.hexNum) || spirit.num === amp.hexNum;
      if (!isAdjacent) { addLog(`🔌 You need to be adjacent to the amp to unplug it!`); return amp; }
      const owner = spirits.find(s => s.id === amp.ownerId);
      addLog(`🔌 ${spirit.name} UNPLUGS ${owner?.name ?? 'rival'}'s amp on #${amp.hexNum}! They drop to d6 until a Roadie fixes it.`);
      return { ...amp, unplugged: true, unpluggerId: acting?.id };
    }));
  }

  // Roadie re-plugs an amp — called as part of roadie action
  function roadieReplugAmp(spiritId, ampId) {
    const spirit = spirits.find(s => s.id === spiritId);
    setAmps(prev => prev.map(amp => {
      if (amp.id !== ampId || !amp.unplugged) return amp;
      addLog(`🔧 ${spirit?.name}'s Roadie re-plugs the amp on #${amp.hexNum} — back in the mix!`);
      return { ...amp, unplugged: false, unpluggerId: null };
    }));
  }


  // ─── BOARD CARD SYSTEM ───────────────────────────────────────────────────────
  const MOD_CARD_TYPES = ['chromatic_shift', 'transpose', 'overdrive'];

  function pickRandomCardType() {
    return MOD_CARD_TYPES[Math.floor(Math.random() * MOD_CARD_TYPES.length)];
  }

  function spawnBoardCards(currentCards, currentSpirits, currentAmps) {
    const needed = 2 - currentCards.length;
    if (needed <= 0) return currentCards;
    // Build occupied hex set
    const occupied = new Set([
      ...currentSpirits.filter(s => !s.knockedOut).map(s => s.num),
      ...currentAmps.map(a => a.hexNum),
      ...currentCards.map(c => c.hexNum),
    ]);
    const candidates = ALL_HEXES.filter(h => !occupied.has(h.num));
    if (candidates.length === 0) return currentCards;
    const newCards = [...currentCards];
    for (let i = 0; i < needed; i++) {
      if (candidates.length === 0) break;
      const idx = Math.floor(Math.random() * candidates.length);
      const hex = candidates.splice(idx, 1)[0];
      newCards.push({ id: `bc-${Date.now()}-${i}`, hexNum: hex.num });
    }
    return newCards;
  }

  // Called from move() — check if spirit stepped on a card hex
  function checkCardPickup(spiritId, hexNum) {
    const card = boardCards.find(c => c.hexNum === hexNum);
    if (!card) return;
    const cardType = pickRandomCardType();
    // Remove card from board immediately
    setBoardCards(prev => prev.filter(c => c.id !== card.id));
    // Open pickup modal
    setPendingCardPickup({ spiritId, cardType, cardId: card.id });
    addLog(`🃏 ${spirits.find(s=>s.id===spiritId)?.name} steps on a Mod Card!`);
  }

  function resolveCardPickup(choice) {
    // choice: 'take' | 'replace-idx-N' | 'discard'
    if (!pendingCardPickup) return;
    const { spiritId, cardType } = pendingCardPickup;
    const spirit = spirits.find(s => s.id === spiritId);
    const ns = noteStates[spiritId];
    const cards = ns?.modCards ?? [];
    const def = { chromatic_shift:'🎼 Chromatic Shift', transpose:'🔄 Transpose', overdrive:'⚡ Overdrive' }[cardType] ?? cardType;

    if (choice === 'discard') {
      addLog(`🃏 ${spirit?.name} discards the ${def}.`);
    } else if (choice === 'take') {
      // Hand not full — just add
      const newCard = { id: `card-${Date.now()}`, type: cardType, exhausted: false };
      setNoteField(spiritId, { modCards: [...cards, newCard] });
      addLog(`🃏 ${spirit?.name} picks up ${def}!`);
    } else if (choice.startsWith('replace-')) {
      const replaceIdx = parseInt(choice.split('-')[1], 10);
      const replaced = cards[replaceIdx];
      const replacedDef = { chromatic_shift:'🎼 Chromatic Shift', transpose:'🔄 Transpose', overdrive:'⚡ Overdrive' }[replaced?.type] ?? replaced?.type;
      const newCards = cards.map((c, i) =>
        i === replaceIdx ? { id: `card-${Date.now()}`, type: cardType, exhausted: false } : c
      );
      setNoteField(spiritId, { modCards: newCards });
      addLog(`🃏 ${spirit?.name} replaces ${replacedDef} with ${def}!`);
    }
    setPendingCardPickup(null);
  }

  // ─── EVENT SPACES SYSTEM ─────────────────────────────────────────────────────
  // Spawn a fresh marquee hex at a random unoccupied spot
  function spawnEventHex() {
    setEventHexes(prev => {
      const occupied = new Set([
        ...spirits.filter(s => !s.knockedOut).map(s => s.num),
        ...amps.map(a => a.hexNum),
        ...boardCards.map(c => c.hexNum),
        ...prev,
        spotlightHex,
      ]);
      const pool = EVENT_HEX_POOL.filter(n => !occupied.has(n));
      if (pool.length === 0) return prev;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      addLog(`🎪 A new marquee hex lights up at #${pick}!`);
      return [...prev, pick];
    });
  }

  // Called from move() — stepping on a marquee hex rips a card from the deck
  function checkEventTrigger(spiritId, hexNum) {
    if (!eventHexes.includes(hexNum)) return;
    if (activeEvent) return; // one at a time
    const ev = EVENT_DECK[Math.floor(Math.random() * EVENT_DECK.length)];
    const spirit = spirits.find(s => s.id === spiritId);
    addLog(`🎪 ${spirit?.name} steps on a marquee hex — EVENT: ${ev.title}!`);
    // Marquee burns out — a new one lights up after the cooldown
    setEventHexes(prev => prev.filter(n => n !== hexNum));
    setEventRespawnIn(EVENT_RESPAWN_TURNS);
    setActiveEvent({ spiritId, eventId: ev.id, phase: 'reveal', resultLines: [], rolls: null });
  }

  // Flaming disc hazard — called whenever a spirit ENTERS a hex (move or push)
  function checkFlamingDisc(spiritId, hexNum) {
    if (!(flamingHexes.roundsLeft > 0) || !flamingHexes.hexes.includes(hexNum)) return;
    const spirit = spirits.find(s => s.id === spiritId);
    // 😎 DIVINE MISSION blessing — the flames part. Blessing is then spent.
    if (noteStates[spiritId]?.divineShield) {
      setNoteField(spiritId, { divineShield: 0 });
      addLog(`🛡️ The flaming disc fizzles at ${spirit?.name}'s feet — divine blessing spent.`);
      return;
    }
    addLog(`🔥💿 ${spirit?.name} hits a flaming disc on #${hexNum} — 1 Vibe damage!`);
    triggerRumble(spiritId);
    applyVibeDamage(spiritId, 1, 'Disco Inferno');
  }

  // ✨ Fame Spark pickup — called whenever a spirit enters a hex during a move
  function checkSparkPickup(spiritId, hexNum) {
    if (!sparkHexes.includes(hexNum)) return;
    setSparkHexes(prev => prev.filter(n => n !== hexNum));
    const sp  = spirits.find(s => s.id === spiritId);
    const cur = (noteStates[spiritId]?.sparks ?? 0) + 1;
    if (cur >= SPARKS_PER_FP) {
      setNoteStates(prev => ({ ...prev, [spiritId]: { ...prev[spiritId], sparks: 0 } }));
      addLog(`✨ ${sp?.name} grabs a Fame Spark — ${SPARKS_PER_FP} sparks forged into a Fame Point!`);
      setTimeout(() => grantFame(spiritId, 1, `✨ ${SPARKS_PER_FP} Fame Sparks`), 80);
    } else {
      setNoteStates(prev => ({ ...prev, [spiritId]: { ...prev[spiritId], sparks: cur } }));
      addLog(`✨ ${sp?.name} grabs a Fame Spark (${cur}/${SPARKS_PER_FP})`);
    }
  }

  // ✨ Award N Fame Sparks at once (used by Thousand Beats). Forges 1 FP for
  // every SPARKS_PER_FP collected and carries the remainder, mirroring pickup.
  function awardSparks(spiritId, n) {
    if (n <= 0) return { fp: 0, carry: (noteStates[spiritId]?.sparks ?? 0) };
    const start = noteStates[spiritId]?.sparks ?? 0;
    const total = start + n;
    const fp    = Math.floor(total / SPARKS_PER_FP);
    const carry = total % SPARKS_PER_FP;
    setNoteStates(prev => ({ ...prev, [spiritId]: { ...prev[spiritId], sparks: carry } }));
    if (fp > 0) setTimeout(() => grantFame(spiritId, fp, `✨ Thousand Beats — ${fp} FP forged`), 80);
    return { fp, carry };
  }

  // ⚡ THOUSAND BEATS — open the 5-second mash overlay. Clicks are tallied in a
  // ref (timing-critical), then converted to Fame Sparks on resolve.
  function launchThousandBeats(spiritId) {
    thousandClicksRef.current = 0;
    setThousandBeats({ phase: 'mash', spiritId, secondsLeft: 5, clicks: 0 });
    // Countdown — tick the visible seconds; resolve at zero.
    let s = 5;
    const iv = setInterval(() => {
      s -= 1;
      if (s > 0) {
        setThousandBeats(p => p && p.phase === 'mash' ? { ...p, secondsLeft: s } : p);
      } else {
        clearInterval(iv);
        resolveThousandBeats(spiritId);
      }
    }, 1000);
  }

  function resolveThousandBeats(spiritId) {
    const clicks = thousandClicksRef.current;
    // Curve (playtest dial): 1 spark per ~10 clicks, capped at 4 (one full FP).
    const sparks = Math.max(0, Math.min(4, Math.floor(clicks / 10)));
    const sp = spirits.find(s => s.id === spiritId);
    const { fp } = awardSparks(spiritId, sparks);
    addLog(`⚡ ${sp?.name} hammered ${clicks} beats → ${sparks} Fame Spark${sparks !== 1 ? 's' : ''}${fp > 0 ? ` · forged ${fp} FP!` : ''}`);
    setThousandBeats({ phase: 'result', spiritId, secondsLeft: 0, clicks, sparksAwarded: sparks, fpForged: fp });
    setTimeout(() => setThousandBeats(null), 2600);
  }

  // Resolve the active event (fired by the modal's ROLL / RESOLVE button)
  function resolveActiveEvent() {
    if (!activeEvent || activeEvent.phase !== 'reveal') return;
    const { spiritId, eventId } = activeEvent;
    const spirit = spirits.find(s => s.id === spiritId);
    const ns     = noteStates[spiritId] ?? {};
    const lines  = [];
    let rolls    = null;
    const d6 = () => Math.floor(Math.random() * 6) + 1;

    if (eventId === 'disco_inferno') {
      const occupied = new Set([
        ...spirits.filter(s => !s.knockedOut).map(s => s.num),
        ...amps.map(a => a.hexNum),
        ...eventHexes, LIMELIGHT_HEX,
      ]);
      const pool = ALL_HEXES.filter(h => !occupied.has(h.num)).map(h => h.num);
      const discs = [];
      for (let i = 0; i < FLAMING_DISC_COUNT && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        discs.push(pool.splice(idx, 1)[0]);
      }
      setFlamingHexes({ hexes: discs, roundsLeft: FLAMING_DISC_ROUNDS });
      lines.push(`🔥 ${discs.length} flaming discs crash down on hexes ${discs.map(n => '#' + n).join(', ')}.`);
      lines.push(`They burn for ${FLAMING_DISC_ROUNDS} full rounds — entering one costs 1 Vibe.`);
      addLog(`🔥💿 DISCO INFERNO — ${discs.length} flaming discs litter the board for ${FLAMING_DISC_ROUNDS} rounds!`);
    }

    else if (eventId === 'bat_snack') {
      const roll = d6();
      rolls = { you: roll };
      if (roll >= 4) {
        setSpirits(prev => prev.map(s => s.id === spiritId
          ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 2) } : s));
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, tempDrive: Math.max(cur.tempDrive ?? 0, 1) } };
        });
        lines.push(`🦇 Rolled ${roll} — DOWN THE HATCH. Absolute legend behavior.`);
        lines.push(`+2 Vibe restored and +1 Drive for your next battle.`);
        addLog(`🦇 ${spirit?.name} eats the bat — LEGENDARY! +2 Vibe, +1 Drive next battle.`);
      } else {
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, tempDrive: 0, tempSustain: 0 } };
        });
        applyVibeDamage(spiritId, 1, 'Bat Snack');
        lines.push(`🦇 Rolled ${roll} — that bat was NOT rubber.`);
        lines.push(`Infection: all temp boosts lost and -1 Vibe. Rabies shots are no joke.`);
        addLog(`🦇 ${spirit?.name} gets an infection from the Bat Snack — boosts lost, -1 Vibe!`);
      }
    }

    else if (eventId === 'satanic_panic') {
      const alive = spirits.filter(s => !s.knockedOut);
      const allRolls = alive.map(s => ({ id: s.id, name: s.name, color: s.color, roll: d6() }));
      rolls = { community: allRolls };
      const best = Math.max(...allRolls.map(r => r.roll));
      const winners = allRolls.filter(r => r.roll === best);
      const convicted = allRolls.filter(r => r.roll === 1);
      setNoteStates(prev => {
        let next = { ...prev };
        winners.forEach(w => {
          const cur = next[w.id] ?? {};
          next = { ...next, [w.id]: { ...cur, tempDrive: Math.max(cur.tempDrive ?? 0, 2) } };
        });
        convicted.forEach(c => {
          const cur = next[c.id] ?? {};
          if ((cur.mojoDrain ?? 0) === 0) {
            next = { ...next, [c.id]: { ...cur, mojoDrain: 1 } };
            setTimeout(() => triggerEffectFlash(c.id, '💧', 'MOJO DRAINED!', '#4499ff'), 200);
          }
        });
        return next;
      });
      lines.push(`😈 The congressional hearing convenes. Everyone rolls...`);
      lines.push(`Acquitted WITH STYLE (${best}): ${winners.map(w => w.name).join(', ')} — +2 Drive next battle.`);
      if (convicted.length > 0) lines.push(`CONVICTED of backmasking: ${convicted.map(c => c.name).join(', ')} — Mojo Drain 1 turn.`);
      else lines.push(`Nobody rolled a 1 — the moral panic fizzles on live TV.`);
      addLog(`😈 SATANIC PANIC! ${winners.map(w => w.name).join(', ')} acquitted with style (+2 Drive).${convicted.length ? ` ${convicted.map(c => c.name).join(', ')} convicted — Mojo Drain!` : ''}`);
    }

    else if (eventId === 'spinal_tap') {
      const ownsAmp = amps.some(a => a.ownerId === spiritId);
      if (ownsAmp) {
        setNoteStates(prev => ({
          ...prev, [spiritId]: { ...(prev[spiritId] ?? {}), elevenTurns: 2 },
        }));
        lines.push(`🎚️ Your rig now goes to ELEVEN.`);
        lines.push(`For your next 2 turns, your dice tier counts +1 amp in range.`);
        addLog(`🎚️ ${spirit?.name}'s amps go to ELEVEN — dice tier +1 amp for 2 turns!`);
      } else {
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, dieFloorBoost: Math.max(cur.dieFloorBoost ?? 0, 1) } };
        });
        lines.push(`🎚️ You don't own an amp... but you FEEL one louder.`);
        lines.push(`Die floor +1 on your next roll.`);
        addLog(`🎚️ ${spirit?.name} feels one louder — die floor +1 next roll!`);
      }
    }

    else if (eventId === 'seance_27') {
      const roll = d6();
      rolls = { you: roll };
      if (roll === 6) {
        grantHC(spiritId, 3);
        lines.push(`🕯️ Rolled 6 — the legends ANSWER. A chord you've never heard rings out.`);
        lines.push(`+3 Harmonic Charge.`);
        addLog(`🕯️ The 27 Club answers ${spirit?.name}'s séance — +3 HC!`);
      } else if (roll === 1) {
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          if (cur.stagger) return prev;
          const slots = Array.from({ length: 8 }, (_, i) => i);
          for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
          }
          // turnsLeft: 2 — this stagger is applied mid-way through the spirit's
          // OWN turn, and stagger now ticks down at the end of your own turn,
          // so 2 here = frozen for exactly 1 full upcoming turn.
          return { ...prev, [spiritId]: { ...cur, stagger: { slots: slots.slice(0, 2), turnsLeft: 2 } } };
        });
        lines.push(`🕯️ Rolled 1 — the candle blows out by itself. Something touched your fretting hand.`);
        lines.push(`Spooked: 2 stock slots frozen for 1 turn.`);
        addLog(`🕯️ ${spirit?.name} is SPOOKED by the séance — 2 slots frozen!`);
        setTimeout(() => triggerEffectFlash(spiritId, '⚡', 'SPOOKED!', '#ff8800'), 200);
      } else {
        grantHC(spiritId, 1);
        lines.push(`🕯️ Rolled ${roll} — a faint whisper of a melody drifts through.`);
        lines.push(`+1 Harmonic Charge.`);
        addLog(`🕯️ A faint whisper reaches ${spirit?.name} — +1 HC.`);
      }
    }

    else if (eventId === 'hotel_trash') {
      const sHex = HEX_BY_NUM[spirit?.num];
      const adj = sHex ? spirits.filter(r => {
        if (r.id === spiritId || r.knockedOut) return false;
        const rh = HEX_BY_NUM[r.num];
        return rh && axialDist(sHex.q, sHex.r, rh.q, rh.r) === 1;
      }) : [];
      if (adj.length === 0) {
        setSpirits(prev => prev.map(s => s.id === spiritId
          ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
        lines.push(`📺 The TV hits the pool. Nobody around to see it. Somehow that's even better.`);
        lines.push(`Pure catharsis: +1 Vibe.`);
        addLog(`📺 ${spirit?.name} trashes the suite in private — +1 Vibe of pure catharsis!`);
      } else {
        const moved = [];
        setSpirits(prev => {
          let next = [...prev];
          adj.forEach(rival => {
            const rh = HEX_BY_NUM[rival.num];
            if (!rh || !sHex) return;
            const away = angleTo(sHex, rh); // direction from actor toward rival = push direction
            const dest = neighborInDirection(rh, away);
            if (!dest) return;
            const occupied = next.some(s => !s.knockedOut && s.id !== rival.id && s.num === dest.num)
                          || amps.some(a => a.hexNum === dest.num);
            if (occupied) return;
            next = next.map(s => s.id === rival.id ? { ...s, num: dest.num } : s);
            moved.push({ id: rival.id, name: rival.name, to: dest.num });
            // Pushed into the inferno?
            setTimeout(() => checkFlamingDisc(rival.id, dest.num), 100);
            // Knocked off the limelight?
            if (rival.num === LIMELIGHT_HEX) setPosing(p => ({ ...p, [rival.id]: false }));
          });
          return next;
        });
        lines.push(`📺 SPLASH ZONE! Everyone adjacent scatters from the falling television.`);
        lines.push(moved.length > 0
          ? `Shoved away: ${moved.map(m => `${m.name} → #${m.to}`).join(', ')}.`
          : `Rivals brace against the walls — nobody could be moved.`);
        addLog(`📺 ${spirit?.name} TRASHES THE SUITE!${moved.length ? ` ${moved.map(m => m.name).join(', ')} shoved away!` : ' Rivals hold their ground.'}`);
      }
    }

    else if (eventId === 'payola') {
      const roll = d6();
      rolls = { you: roll };
      if (roll % 2 === 0) {
        grantHC(spiritId, 2);
        lines.push(`💰 Rolled ${roll} — the envelope works. Your single is in HEAVY rotation.`);
        lines.push(`+2 Harmonic Charge.`);
        addLog(`💰 Payola pays off for ${spirit?.name} — +2 HC!`);
      } else {
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: { ...cur, hcPoints: Math.max(0, (cur.hcPoints ?? 0) - 2) } };
        });
        lines.push(`💰 Rolled ${roll} — BUSTED. Your face is on the evening news next to the word "scandal."`);
        lines.push(`-2 Harmonic Charge progress.`);
        addLog(`💰 ${spirit?.name} caught in the Payola Scandal — -2 HC progress!`);
      }
    }

    else if (eventId === 'stage_dive') {
      const sHex = HEX_BY_NUM[spirit?.num];
      const rivals = spirits.filter(r => r.id !== spiritId && !r.knockedOut);
      if (rivals.length === 0 || !sHex) {
        setSpirits(prev => prev.map(s => s.id === spiritId
          ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
        lines.push(`🤸 You dive. The crowd catches you. There was never any doubt. +1 Vibe.`);
        addLog(`🤸 ${spirit?.name} stage dives into adoring fans — +1 Vibe!`);
      } else {
        const nearest = rivals
          .map(r => { const rh = HEX_BY_NUM[r.num]; return rh ? { r, d: axialDist(sHex.q, sHex.r, rh.q, rh.r) } : null; })
          .filter(Boolean)
          .sort((a, b) => a.d - b.d)[0].r;
        const yourRoll  = d6();
        const theirRoll = d6();
        rolls = { duel: { you: { name: spirit?.name, roll: yourRoll }, them: { name: nearest.name, roll: theirRoll } } };
        if (yourRoll > theirRoll) {
          setSpirits(prev => prev.map(s =>
            s.id === spiritId ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
          applyVibeDamage(nearest.id, 1, 'Stage Dive');
          lines.push(`🤸 ${yourRoll} vs ${theirRoll} — YOUR crowd goes wild and carries you like royalty.`);
          lines.push(`Steal 1 Vibe from ${nearest.name}.`);
          addLog(`🤸 ${spirit?.name} out-dives ${nearest.name} (${yourRoll} vs ${theirRoll}) — steals 1 Vibe!`);
        } else if (theirRoll > yourRoll) {
          setSpirits(prev => prev.map(s =>
            s.id === nearest.id ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
          applyVibeDamage(spiritId, 1, 'Stage Dive');
          lines.push(`🤸 ${yourRoll} vs ${theirRoll} — their fans surge forward... and yours part like the sea.`);
          lines.push(`${nearest.name} steals 1 Vibe from you. The floor says hello.`);
          addLog(`🤸 ${nearest.name}'s crowd loves them more (${theirRoll} vs ${yourRoll}) — steals 1 Vibe from ${spirit?.name}!`);
        } else {
          setSpirits(prev => prev.map(s =>
            (s.id === spiritId || s.id === nearest.id)
              ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
          lines.push(`🤸 ${yourRoll} vs ${theirRoll} — TIE. The whole venue crowd-surfs you both. +1 Vibe each.`);
          addLog(`🤸 Stage dive TIE (${yourRoll}) — ${spirit?.name} and ${nearest.name} both ride the crowd, +1 Vibe each!`);
        }
      }
    }

    else if (eventId === 'backstage_pass') {
      lines.push(`🎟️ The pass is real. The door opens. There's a Mod Card on the table with your name on it.`);
      addLog(`🎟️ ${spirit?.name} flashes the Backstage Pass — free Mod Card!`);
      setActiveEvent(null);
      setTimeout(() => {
        setPendingCardPickup({ spiritId, cardType: pickRandomCardType(), cardId: `event-${Date.now()}` });
      }, 80);
      return; // hands off to the existing card pickup modal
    }

    else if (eventId === 'divine_mission') {
      const recalled = unsurePool;
      if (recalled > 0) {
        setUnsurePool(0);
        setNoteStates(prev => {
          const cur = prev[spiritId] ?? {};
          return { ...prev, [spiritId]: {
            ...cur,
            casuals: Math.min(FAN_CASUAL_CAP, (cur.casuals ?? 0) + recalled),
            fanLag: 0,
            divineShield: 1,
          } };
        });
        flashFanFx(spiritId, 'gain', recalled);
      } else {
        setNoteField(spiritId, { fanLag: 0, divineShield: 1 });
      }
      setSpirits(prev => prev.map(s => s.id === spiritId
        ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s));
      lines.push(`😎 The band is back together. You are on a mission from God.`);
      lines.push(recalled > 0
        ? `${recalled} Unsure fan${recalled !== 1 ? 's' : ''} march home as Casuals · lockout cleared · +1 Vibe.`
        : `No strays on the centre to recall, but the lockout clears and you stand renewed: +1 Vibe.`);
      lines.push(`🛡️ Blessing: you shrug off the next demolition or hazard against you.`);
      addLog(`😎 ${spirit?.name} — DIVINE MISSION! ${recalled > 0 ? `${recalled} fans recalled, ` : ''}lockout cleared, blessed against the next hit, +1 Vibe.`);
    }

    else if (eventId === 'back_to_past') {
      setActiveEvent(null);
      setTimeout(() => launchBackToPast(spiritId), 80);
      return; // hands off to the dedicated play-challenge overlay
    }

    setActiveEvent(prev => prev ? { ...prev, phase: 'result', resultLines: lines, rolls } : prev);
  }

  // ─── 🎸⏰ BACK TO THE PAST — engine ─────────────────────────────────────────
  // Self-contained mini riff challenge (never touches battleState). Stage 1 pays
  // Harmonic Charge, Stage 2 pays fans. Every fumbled note shaves 1 Vibe, but the
  // fade floors at 1 — it can NEVER knock a spirit out. Stage 2 always runs.
  function launchBackToPast(spiritId) {
    const sp = spirits.find(s => s.id === spiritId);
    addLog(`🎸⏰ ${sp?.name} grabs an instrument in the wrong decade — BACK TO THE PAST!`);
    bttpEngineRef.current = null;
    bttpModeRef.current = { view: 'piano', winMult: 1 };
    setBttpChallenge({
      spiritId, stageKey: 'angel', phase: 'choose', view: 'piano',
      idx: -1, hits: 0, misses: 0, flash: null, lastGrade: null,
      tally: { hc: 0, casuals: 0, vibeLost: 0 }, lines: [],
    });
  }

  // Player picks piano (standard) or guitar (harder read → more leeway time).
  function bttpChoose(spiritId, view) {
    const winMult = view === 'guitar' ? 1.5 : 1;
    bttpModeRef.current = { view, winMult };
    setBttpChallenge(prev => prev ? { ...prev, view, phase: 'countdown' } : prev);
    setTimeout(() => bttpStartStage(spiritId, 'angel'), 1200);
  }

  function bttpStartStage(spiritId, stageKey) {
    const mode = bttpModeRef.current;
    // Carry the chosen instrument + leeway onto the stage data the engine threads through.
    const data = { ...bttpStageData(stageKey), view: mode.view, winMult: mode.winMult };
    setBttpChallenge(prev => prev ? {
      ...prev, stageKey, view: mode.view, phase: 'play', idx: 0, hits: 0, misses: 0, flash: null, lastGrade: null,
    } : prev);
    setTimeout(() => bttpFlashChord(spiritId, stageKey, 0, data), 350);
  }

  // Sound a whole chord at once (a tiny roll so it reads as a chord, not a blip).
  function bttpSoundChord(letters, volume = 0.2) {
    letters.forEach((ltr, k) => setTimeout(() =>
      playNoteSound(null, { freq: bttpLetterFreq(ltr), holdTime: 0.5, fadeTime: 0.5, volume }), k * 16));
  }

  // INPUT — light the chord's keys (no labels). Player presses all of them within
  // the window. Individual presses are SILENT; only once the chord is complete does
  // it sound. A miss/clam drains 1 Vibe (floored at 1).
  function bttpFlashChord(spiritId, stageKey, idx, data) {
    if (idx >= data.chords.length) {
      // Whole progression entered — now play it back, in rhythm.
      setBttpChallenge(prev => prev ? { ...prev, phase: 'playback', idx: 0, flash: null, lastGrade: null } : prev);
      setTimeout(() => bttpPlayback(spiritId, stageKey, 0, data), 650);
      return;
    }
    const chord = data.chords[idx];
    const win = Math.round((data.rhythm[idx]?.window ?? 2400) * (data.winMult ?? 1));
    bttpEngineRef.current = {
      spiritId, stageKey, idx, need: new Set(chord), got: new Set(), wrong: false,
      shownAt: performance.now(), window: win, resolved: false, timeoutId: null,
    };
    setBttpChallenge(prev => prev ? { ...prev, idx, flash: { idx, chord, got: [] }, lastGrade: null } : prev);
    bttpEngineRef.current.timeoutId = setTimeout(() => {
      const eng = bttpEngineRef.current;
      if (!eng || eng.resolved || eng.idx !== idx || eng.stageKey !== stageKey) return;
      bttpResolveChord(false, data);
    }, win);
  }

  // Shared input — keyboard + on-screen pads. Silent per key; the chord only sounds
  // once every required note is in. A wrong key clams the chord (no clean credit).
  function bttpInput(letter) {
    const eng = bttpEngineRef.current;
    if (!eng || eng.resolved) return;
    const data = bttpStageData(eng.stageKey);
    if (eng.need.has(letter)) {
      if (!eng.got.has(letter)) {
        eng.got.add(letter);
        const got = [...eng.got];
        setBttpChallenge(prev => prev && prev.flash ? { ...prev, flash: { ...prev.flash, got } } : prev);
      }
      if (eng.got.size === eng.need.size) {
        bttpSoundChord([...eng.need]);     // the payoff: the chord rings out, in full
        bttpResolveChord(true, data);
      }
    } else {
      eng.wrong = true; // a clam — the chord can still be completed but won't be clean
      setBttpChallenge(prev => prev ? { ...prev, lastGrade: 'clam' } : prev);
    }
  }

  function bttpResolveChord(complete, data) {
    const eng = bttpEngineRef.current;
    if (!eng || eng.resolved) return;
    eng.resolved = true;
    clearTimeout(eng.timeoutId);
    const { spiritId, stageKey, idx } = eng;
    const clean = complete && !eng.wrong;
    if (clean) {
      setBttpChallenge(prev => prev ? { ...prev, hits: prev.hits + 1, lastGrade: 'clean' } : prev);
    } else {
      let drained = 0;
      setSpirits(prev => prev.map(s => {
        if (s.id !== spiritId) return s;
        const v = s.vibe ?? 1;
        if (v <= 1) return s;
        drained = 1;
        return { ...s, vibe: v - 1 };
      }));
      playRiffMiss();
      triggerRumble(spiritId);
      setBttpChallenge(prev => prev ? {
        ...prev, misses: prev.misses + 1, lastGrade: complete ? 'clam' : 'miss',
        tally: { ...prev.tally, vibeLost: prev.tally.vibeLost + drained },
      } : prev);
    }
    const gap = data.rhythm[idx + 1]?.gap ?? 300;
    setTimeout(() => bttpFlashChord(spiritId, stageKey, idx + 1, data), gap);
  }

  // PLAYBACK — the progression as it should sound: each chord rings in rhythm and
  // lights the keys. Then the stage resolves.
  function bttpPlayback(spiritId, stageKey, idx, data) {
    if (idx >= data.chords.length) { bttpEndStage(spiritId, stageKey, data); return; }
    const chord = data.chords[idx];
    const lit = data.pbLit ?? 500, gap = data.pbGap ?? 140;
    setBttpChallenge(prev => prev ? { ...prev, idx, flash: { idx, chord, got: chord } } : prev);
    bttpSoundChord(chord, 0.2);
    setTimeout(() => {
      setBttpChallenge(prev => prev ? { ...prev, flash: null } : prev);
      setTimeout(() => bttpPlayback(spiritId, stageKey, idx + 1, data), gap);
    }, lit);
  }

  function bttpEndStage(spiritId, stageKey, data) {
    bttpEngineRef.current = null;
    const sp = spirits.find(s => s.id === spiritId);
    setBttpChallenge(prev => {
      if (!prev) return prev;
      const total  = data.chords.length;
      const passed = prev.hits >= Math.ceil(total * BTTP_PASS_RATIO);
      const lines  = [...prev.lines];
      const tally  = { ...prev.tally };
      if (data.reward === 'hc') {
        const gain = passed ? 3 : 1;
        tally.hc += gain;
        setTimeout(() => grantHC(spiritId, gain), 60);
        lines.push(passed
          ? `💫 SLOW-DANCE ANGEL — ${prev.hits}/${total} chords clean. The floor sways. +${gain} Harmonic Charge.`
          : `💫 SLOW-DANCE ANGEL — ${prev.hits}/${total} clean. Shaky, but you got through it. +${gain} Harmonic Charge.`);
      } else {
        const gain = passed ? 5 : 2;
        tally.casuals += gain;
        setNoteStates(nsAll => {
          const cur = nsAll[spiritId] ?? {};
          let casuals  = Math.min(FAN_CASUAL_CAP, (cur.casuals ?? 0) + gain);
          let diehards = cur.diehards ?? FAN_DIEHARD_START;
          if (passed && casuals > 0 && diehards < FAN_DIEHARD_CAP) { casuals -= 1; diehards += 1; }
          return { ...nsAll, [spiritId]: { ...cur, casuals, diehards } };
        });
        flashFanFx(spiritId, 'gain', gain);
        lines.push(passed
          ? `🦆 DUCKWALK DYNAMO — ${prev.hits}/${total} chords clean. The kids go wild! +${gain} Casuals (one hardens into a Diehard).`
          : `🦆 DUCKWALK DYNAMO — ${prev.hits}/${total} clean. A few heads turn. +${gain} Casuals.`);
      }
      return { ...prev, phase: stageKey === 'angel' ? 'stageclear' : 'done', flash: null, lines, tally };
    });
    addLog(`🎸⏰ ${sp?.name} finishes ${data.name}.`);
    if (stageKey === 'angel') {
      setTimeout(() => bttpStartStage(spiritId, 'goode'), 1600); // Stage 2 always runs
    }
  }

  // ─── 🧪 TESTING GROUNDS — dev helpers ──────────────────────────────────────
  // The acting spirit (front of the turn queue, skipping any KO'd).
  function devCurrentSpiritId() {
    return turnQueue.find(id => !spiritById[id]?.knockedOut) ?? turnQueue[0];
  }
  // Fire ANY event on demand for the acting spirit — works for every entry in
  // EVENT_DECK, so new events become testable the moment you add them.
  function devFireEvent(eventId) {
    if (activeEvent || bttpChallenge) { addLog('🧪 Finish the current event before firing another.'); return; }
    const spiritId = devCurrentSpiritId();
    if (!spiritId) return;
    const ev = EVENT_BY_ID[eventId];
    addLog(`🧪 TEST → ${ev?.title} on ${spiritById[spiritId]?.name}`);
    setActiveEvent({ spiritId, eventId, phase: 'reveal', resultLines: [], rolls: null });
    setDevOpen(false);
  }
  // Quick resource grants to the acting spirit. Add a case here + a button below
  // to expose a new lever for testing.
  function devGrant(kind) {
    const id = devCurrentSpiritId(); if (!id) return;
    const nm = spiritById[id]?.name;
    if (kind === 'hc')       { grantHC(id, 3); addLog(`🧪 +3 HC → ${nm}`); }
    else if (kind === 'cas') { setNoteStates(ns => ({ ...ns, [id]: { ...ns[id], casuals: Math.min(FAN_CASUAL_CAP, (ns[id]?.casuals ?? 0) + 5) } })); flashFanFx(id, 'gain', 5); addLog(`🧪 +5 Casuals → ${nm}`); }
    else if (kind === 'die') { setNoteStates(ns => ({ ...ns, [id]: { ...ns[id], diehards: Math.min(FAN_DIEHARD_CAP, (ns[id]?.diehards ?? FAN_DIEHARD_START) + 1) } })); addLog(`🧪 +1 Diehard → ${nm}`); }
    else if (kind === 'uns') { setUnsurePool(p => p + 5); addLog('🧪 +5 to the Unsure pool'); }
    else if (kind === 'vup') { setSpirits(prev => prev.map(s => s.id === id ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + 1) } : s)); addLog(`🧪 +1 Vibe → ${nm}`); }
    else if (kind === 'vdn') { setSpirits(prev => prev.map(s => s.id === id ? { ...s, vibe: Math.max(0, (s.vibe ?? 0) - 1) } : s)); addLog(`🧪 −1 Vibe → ${nm}`); }
  }

  // Unlock a signature skill (and any prereqs) for a specific spirit, applying
  // the same side-effects the skill tree would.
  function devUnlockSkill(spiritId, skillId, pre = []) {
    [...pre, skillId].forEach(id => {
      setNoteStates(prev => {
        const ns = prev[spiritId] ?? {};
        if ((ns.unlockedSkills ?? []).includes(id)) return prev;
        return { ...prev, [spiritId]: { ...ns, unlockedSkills: [...(ns.unlockedSkills ?? []), id] } };
      });
      applySkillEffects(spiritId, id);
    });
  }

  // Some signature skills have a self-contained trigger we can fire for testing.
  function devFireSignature(spiritId, skill) {
    devUnlockSkill(spiritId, skill.id, skill.pre);
    if (skill.fire === 'thousand') {
      if (!spirits.some(s => s.id === spiritId)) { addLog('🧪 Ronin is not in this game.'); return; }
      setTimeout(() => launchThousandBeats(spiritId), 60);
      setDevOpen(false);
    } else if (skill.fire === 'hydra') {
      devSetupHydra();
    }
  }

  // 🐉 Unlock Hydra and deploy 3 of the Ronin's amps within range, so a Sonic
  // Attack at range will roll 3d6. (Then attack a rival to see it.)
  function devSetupHydra() {
    const id = 'cosmic_ronin';
    const ronin = spirits.find(s => s.id === id);
    if (!ronin) { addLog('🧪 Ronin is not in this game.'); return; }
    const home = HEX_BY_NUM[ronin.num];
    if (!home) return;
    const occupied = new Set([...spirits.map(s => s.num), ...amps.map(a => a.hexNum)]);
    const spots = Object.keys(HEX_BY_NUM).map(Number).filter(num => {
      const h = HEX_BY_NUM[num];
      const d = axialDist(home.q, home.r, h.q, h.r);
      return !occupied.has(num) && d >= 1 && d <= AMP_RANGE;
    }).slice(0, 3);
    if (spots.length < 3) { addLog('🧪 Not enough free hexes near the Ronin for 3 amps.'); return; }
    setAmps(prev => [...prev, ...spots.map((num, i) => ({
      id: `amp-${id}-dev-${Date.now()}-${i}`, ownerId: id, ownerColor: ronin.color, hexNum: num, connected: false,
    }))]);
    addLog('🐉 TEST: Hydra unlocked + 3 amps deployed near the Ronin. Attack a rival at range to see the 3d6!');
    setDevOpen(false);
  }

  // Add raw Harmonic Charge toward the spirit's current target skill.
  // Crossing the threshold awards the skill exactly like a committed track would.
  function grantHC(spiritId, amount) {
    const ns         = noteStates[spiritId] ?? {};
    const targetCost = ns.targetSkillId ? (SKILL_BY_ID[ns.targetSkillId]?.hcCost ?? HC_UPGRADE_THRESHOLD) : HC_UPGRADE_THRESHOLD;
    const { newHCPoints, upgradeTriggered } = advanceHC(ns.hcPoints ?? 0, amount, targetCost);
    setNoteStates(prev => ({
      ...prev,
      [spiritId]: {
        ...prev[spiritId],
        hcPoints: newHCPoints,
        totalHC: (prev[spiritId]?.totalHC ?? 0) + amount,
      },
    }));
    if (upgradeTriggered && ns.targetSkillId) {
      setTimeout(() => awardTargetSkill(spiritId), 80);
    }
  }


  // ─── BATTLE SYSTEM ───────────────────────────────────────────────────────────

  // Damage table: margin → Vibe damage (softened — wider bands, lower ceiling)
  function marginToDamage(margin) {
    if (margin <= 3)  return 1;
    if (margin <= 6)  return 2;
    if (margin <= 9)  return 3;
    if (margin <= 12) return 4;
    return 5;
  }

  // ─── FAME POINTS ──────────────────────────────────────────────────────────────
  // Winning a battle earns Fame. Bigger margins, bigger legend.
  function fameFromMargin(margin) {
    if (margin <= 3) return 1;
    if (margin <= 6) return 2;
    return 3;
  }
  // Core Fame grant — every FP in the game flows through here.
  // Hitting FAME_TO_WIN triggers the Fame Legend victory.
  function grantFame(spiritId, fp, reason, amplify = true) {
    if (fp <= 0) return;
    const sp = spirits.find(s => s.id === spiritId);
    const ns = noteStates[spiritId] ?? {};
    // 🎤 Fans amplify the value of every deed (wins, riffs, cadences). The crowd
    // doesn't convert TO Fame — it multiplies the Fame you earn. Pass amplify=false
    // for non-deed awards (e.g. the future Rock Gods finale payout) to skip this.
    const mult    = amplify ? crowdMultiplier(ns.diehards ?? FAN_DIEHARD_START, ns.casuals ?? 0) : 1;
    const finalFp = amplify ? Math.max(fp, Math.round(fp * mult)) : fp;
    const newFame = (ns.fame ?? 0) + finalFp;
    setNoteStates(prev => ({
      ...prev,
      [spiritId]: { ...prev[spiritId], fame: (prev[spiritId]?.fame ?? 0) + finalFp },
    }));
    const crowdStr = (amplify && finalFp !== fp) ? ` (${fp} ×🎤${mult.toFixed(2)} crowd)` : '';
    addLog(`⭐ ${sp?.name} earns ${finalFp} Fame Point${finalFp !== 1 ? 's' : ''}${crowdStr}${reason ? ` — ${reason}` : ''}! (${Math.min(newFame, FAME_TO_WIN)}/${FAME_TO_WIN})`);
    if (newFame >= FAME_TO_WIN) {
      addLog(`🌟🌟🌟 ${sp?.name} reaches ${FAME_TO_WIN} Fame — A LEGEND IS BORN! 🌟🌟🌟`);
      setTimeout(() => setWinner(spiritId), 600);
    }
  }
  function awardFame(spiritId, margin) {
    grantFame(spiritId, fameFromMargin(margin), `won by ${margin}`);
    gainFansFromWin(spiritId, margin); // 🎤 beating a rival is a prime way to win a crowd
  }

  // ─── 🎤 FAN ECONOMY HELPERS ───────────────────────────────────────────────
  // Grow a crowd by committing a CLEAN track in the centre rings. Recruits from
  // the Unsure pool first (fans a fallen rival left behind), then organic gain.
  function gainFans(spiritId, hexNum, clean) {
    const ring = hexRingFromCenter(hexNum);
    const inCentre   = ring === 'main' || ring === 'pit';        // hardens Diehards, recruits Unsure
    const inGainZone = inCentre || ring === 'floor';             // floor = neutral trickle
    const ns = noteStates[spiritId];
    if (!ns) return;
    // No gain if the track was discordant, you're out in the cheap seats, or you're
    // still shaken from a recent demolition. (Boredom decay is handled by position
    // in tickFans now, not here.)
    if (!clean || !inGainZone || (ns.fanLag ?? 0) > 0) return;

    const base = FAN_GAIN_BY_RING[ring] ?? 0;
    // Only the spotlight (main/pit) wins over the undecided crowd left on the centre.
    const recruit = inCentre ? Math.min(unsurePool, base) : 0;
    if (recruit > 0) setUnsurePool(p => Math.max(0, p - recruit));
    let casuals  = Math.min(FAN_CASUAL_CAP, (ns.casuals ?? 0) + base + recruit);
    let diehards = ns.diehards ?? FAN_DIEHARD_START;
    // Sustained centre play hardens a Casual into a Diehard — neutral ground doesn't.
    let streak = ns.centerStreak ?? 0;
    let promoted = false;
    if (inCentre) {
      streak += 1;
      if (streak % FAN_PROMOTE_EVERY === 0 && casuals > 0 && diehards < FAN_DIEHARD_CAP) {
        casuals -= 1; diehards += 1; promoted = true;
      }
    }
    setNoteField(spiritId, { casuals, diehards, centerStreak: streak, fanActedThisTurn: inCentre });
    flashFanFx(spiritId, 'gain', base + recruit);
    const nm = spirits.find(s => s.id === spiritId)?.name;
    const gainedStr = recruit > 0 ? `+${base} (+${recruit} won over)` : `+${base}`;
    const where = ring === 'main' ? 'the Mainstage' : ring === 'pit' ? 'the Pit' : 'the neutral floor';
    addLog(`🎤 ${nm} works ${where} — casuals ${gainedStr} → ♥${diehards}·👥${casuals} (×${crowdMultiplier(diehards, casuals).toFixed(2)})`);
    if (promoted) addLog(`🎤 A casual hardens into a Diehard for ${nm}! (${diehards}♥)`);
  }

  // Fire a transient reaction at a Spirit's home corner: a rising gain burst or a scatter.
  function flashFanFx(spiritId, kind, n) {
    if (!n || n <= 0) return;
    const key = `${spiritId}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setFanFx(prev => ({ ...prev, [spiritId]: { kind, n, key } }));
    setTimeout(() => setFanFx(prev => (prev[spiritId]?.key === key ? { ...prev, [spiritId]: null } : prev)), 1300);
  }

  // End-of-turn fan tick — boredom is now POSITIONAL: fans only drift off after a
  // spirit has lingered in the outer ring for FAN_BORED_AFTER turns in a row. The
  // inner zones (and the neutral floor) keep the crowd; only the centre keeps the
  // hardening streak alive.
  function tickFans(spiritId, hexNum) {
    const spirit = spirits.find(s => s.id === spiritId);
    const zone = (hexNum != null) ? hexRingFromCenter(hexNum)
               : (spirit ? hexRingFromCenter(spirit.num) : 'back');
    setNoteStates(prev => {
      const ns = prev[spiritId]; if (!ns) return prev;
      let casuals      = ns.casuals ?? 0;
      let centerStreak = ns.centerStreak ?? 0;
      let outerStreak  = ns.outerStreak ?? 0;
      const lag        = Math.max(0, (ns.fanLag ?? 0) - 1);

      if (zone === 'main' || zone === 'pit') {
        outerStreak = 0;
        if (!ns.fanActedThisTurn) centerStreak = 0; // idle in the spotlight breaks the streak
      } else if (zone === 'floor') {
        outerStreak = 0;      // neutral ground — no boredom
        centerStreak = 0;     // ...but you're not building loyalty out here
      } else {
        // Outer edge — patience runs out only after several turns in a row.
        outerStreak += 1;
        centerStreak = 0;
        if (outerStreak >= FAN_BORED_AFTER && casuals > 0) {
          const before = casuals;
          casuals = Math.max(0, casuals - FAN_DECAY);
          const lost = before - casuals;
          const nm = spirit?.name;
          setTimeout(() => addLog(`💤 ${nm} has been out in the cheap seats too long — ${lost} casual fan${lost !== 1 ? 's' : ''} drift off.`), 0);
        }
      }
      return { ...prev, [spiritId]: { ...ns, casuals, centerStreak, outerStreak, fanLag: lag, fanActedThisTurn: false } };
    });
  }

  // Demolition — a public beating in the centre scatters the crowd.
  function demolishFans(targetId, attackerId, hexNum) {
    const ring = hexRingFromCenter(hexNum);
    if (ring !== 'main' && ring !== 'pit') return; // only humiliations in the spotlight count
    const ns = noteStates[targetId];
    if (!ns) return;
    // 😎 DIVINE MISSION blessing — shrug off this demolition, then the blessing is spent.
    if (ns.divineShield) {
      setNoteField(targetId, { divineShield: 0 });
      const blessed = spirits.find(s => s.id === targetId)?.name;
      addLog(`🛡️ ${blessed} is on a mission from God — the demolition just bounces off. Blessing spent.`);
      flashFanFx(targetId, 'gain', 0);
      return;
    }
    let diehards = ns.diehards ?? FAN_DIEHARD_START;
    let casuals  = ns.casuals ?? 0;
    // Shake up to 2 Diehards down into Casuals — their faith wavers.
    const shaken = Math.min(2, diehards);
    diehards -= shaken; casuals += shaken;
    // 7–10 Casuals flee.
    const flee = Math.min(casuals, FAN_FLEE_MIN + Math.floor(Math.random() * (FAN_FLEE_MAX - FAN_FLEE_MIN + 1)));
    casuals -= flee;
    // Some defect straight to the demolisher; the rest pool as Unsure on the centre.
    const toVictor = (attackerId && attackerId !== targetId) ? Math.min(FAN_DEFECT_TO_VICTOR, flee) : 0;
    const toUnsure = flee - toVictor;
    setNoteStates(prev => {
      const next = { ...prev, [targetId]: { ...prev[targetId], diehards, casuals, centerStreak: 0, fanLag: FAN_RECOVERY_LAG } };
      if (toVictor > 0 && prev[attackerId]) {
        next[attackerId] = { ...prev[attackerId], casuals: Math.min(FAN_CASUAL_CAP, (prev[attackerId].casuals ?? 0) + toVictor) };
      }
      return next;
    });
    if (toUnsure > 0) setUnsurePool(p => p + toUnsure);
    const tgtName = spirits.find(s => s.id === targetId)?.name;
    addLog(`💔 ${tgtName} is humiliated centre-stage! ${flee} fans bail (${shaken}♥ shaken) — ${toUnsure} go Unsure${toVictor ? `, ${toVictor} defect to the victor` : ''}.`);
    flashFanFx(targetId, 'scatter', flee);
    if (toVictor > 0) flashFanFx(attackerId, 'gain', toVictor);
  }

  // A battle win wins you a crowd — scaled by how big the win was, with a bonus
  // for doing it in the centre where the whole arena is watching. A win also
  // reasserts you: it clears demolition lag (beating someone is how you bounce
  // back) and, in the centre, builds toward hardening a Diehard.
  function gainFansFromWin(winnerId, margin) {
    const winner = spirits.find(s => s.id === winnerId);
    if (!winner) return;
    const ring = hexRingFromCenter(winner.num);
    const inCentre = ring === 'main' || ring === 'pit';
    const base        = margin >= 6 ? 3 : margin >= 3 ? 2 : 1;     // bigger margin → more fans
    const centreBonus = ring === 'main' ? 2 : ring === 'pit' ? 1 : ring === 'floor' ? 1 : 0;
    const gain = base + centreBonus;
    setNoteStates(prev => {
      const ns = prev[winnerId]; if (!ns) return prev;
      let casuals  = Math.min(FAN_CASUAL_CAP, (ns.casuals ?? 0) + gain);
      let diehards = ns.diehards ?? FAN_DIEHARD_START;
      let streak   = ns.centerStreak ?? 0;
      let promoted = false;
      if (inCentre) {
        streak += 1;
        if (streak % FAN_PROMOTE_EVERY === 0 && casuals > 0 && diehards < FAN_DIEHARD_CAP) {
          casuals -= 1; diehards += 1; promoted = true;
        }
      }
      if (promoted) setTimeout(() => addLog(`🎤 A casual hardens into a Diehard for ${winner.name}! (${diehards}♥)`), 0);
      return { ...prev, [winnerId]: { ...ns, casuals, diehards, centerStreak: streak, fanActedThisTurn: true, fanLag: 0 } };
    });
    const where = ring === 'main' ? ' on the Mainstage' : ring === 'pit' ? ' in the Pit' : ring === 'floor' ? ' on the floor' : '';
    const size  = margin >= 6 ? 'a CRUSHING' : margin >= 3 ? 'a solid' : 'a';
    addLog(`🎤 ${winner.name} wins the crowd with ${size} victory${where} — +${gain} casual fan${gain !== 1 ? 's' : ''}!`);
    flashFanFx(winnerId, 'gain', gain);
  }

  // Total committed crowd across the arena — the gauge that will summon the
  // Rock Gods finale once that boss layer is built. (No trigger wired yet.)
  function arenaFans() {
    return Object.values(noteStates).reduce((sum, ns) =>
      sum + (ns?.diehards ?? 0) + (ns?.casuals ?? 0), unsurePool);
  }

  // ─── BATTLE KNOCKBACK ─────────────────────────────────────────────────────────
  // The loser is sent skidding away from the winner, one hex at a time
  // (animated steps). Stops early at occupied hexes or the stage edge.
  // Swing defeats: 1 hex. Sonic defeats: margin 1-2 = 1, 3-4 = 2, 5+ = 3.
  function knockbackSpaces(bs, margin) {
    const m = margin ?? bs?.margin ?? 1;
    return bs?.sonicAttack ? Math.min(3, Math.max(1, Math.ceil(m / 2))) : 1;
  }
  function battleKnockback(fromId, targetId, spaces) {
    const fromSp = spirits.find(s => s.id === fromId);
    const target = spirits.find(s => s.id === targetId);
    if (!fromSp || !target || target.knockedOut || spaces <= 0) return;
    const fromHex = HEX_BY_NUM[fromSp.num];
    const tgtHex  = HEX_BY_NUM[target.num];
    if (!fromHex || !tgtHex) return;
    const angle = fromSp.num === target.num ? (fromSp.facing ?? 0) : angleTo(fromHex, tgtHex);
    addLog(`💢 ${target.name} is KNOCKED BACK ${spaces} hex${spaces !== 1 ? 'es' : ''}!`);
    triggerRumble(targetId);
    let curNum = target.num;
    let step = 0;
    const stepOnce = () => {
      const curHex = HEX_BY_NUM[curNum];
      if (!curHex) return;
      const nextHex = neighborInDirection(curHex, angle);
      if (!nextHex) {
        addLog(`💥 ${target.name} slams into the edge of the stage at #${curNum}!`);
        return;
      }
      const occupied = spirits.some(s => !s.knockedOut && s.id !== targetId && s.num === nextHex.num)
                    || amps.some(a => a.hexNum === nextHex.num);
      if (occupied) {
        addLog(`💥 ${target.name} crashes to a stop at #${curNum}!`);
        return;
      }
      const fromNum = curNum;
      let aborted = false;
      // Fresh-state guard: if the target was KO'd, respawned, or relocated since
      // the previous step (e.g. the battle damage just knocked them down), abort
      // the slide instead of dragging their respawned standee across the board.
      setSpirits(prev => {
        const t = prev.find(s => s.id === targetId);
        if (!t || t.knockedOut || (t.vibe ?? 0) <= 0 || t.num !== fromNum) {
          aborted = true;
          return prev;
        }
        return prev.map(s => s.id === targetId ? { ...s, num: nextHex.num } : s);
      });
      curNum = nextHex.num;
      step++;
      setTimeout(() => {
        if (aborted) return;
        if (fromNum === LIMELIGHT_HEX) {
          setPosing(prev => ({ ...prev, [targetId]: false }));
          addLog(`🎤 ${target.name} knocked off the Limelight!`);
        }
        if (nextHex.edge) addLog(`⚠️ ${target.name} skids onto the EDGE — #${nextHex.num}!`);
        checkFlamingDisc(targetId, nextHex.num);
        if (step < spaces) stepOnce();
      }, 240);
    };
    setTimeout(stepOnce, 180);
  }

  // Roll a d12
  function rollD12() { return Math.floor(Math.random() * 12) + 1; }

  // Returns hex nums in the forward attack cone of a spirit
  // Cone = forward hex + 2 diagonal-forward hexes (120° arc)
  function getSwingCone(spirit) {
    const hex = HEX_BY_NUM[spirit.num];
    if (!hex) return new Set();
    const neighbors = getFlatTopNeighborSlots(hex);
    const cone = new Set();
    neighbors.forEach(nb => {
      const angle = angleTo(hex, nb);
      const diff  = angleDiff(angle, spirit.facing ?? 0);
      if (diff <= Math.PI / 2.2) cone.add(nb.num); // ~80° half-arc = forward 3 hexes
    });
    return cone;
  }

  // Returns rival spirits in the attacker's swing cone
  function getRivalsInCone(attacker) {
    const cone = getSwingCone(attacker);
    return spirits.filter(s =>
      !s.knockedOut &&
      s.id !== attacker.id &&
      cone.has(s.num)
    );
  }

  // Returns hex nums in the Sonic Attack beam.
  // STRAIGHT LINE ONLY: exactly the 3 hexes directly in front of the spirit,
  // stepping along the facing axis. No cone, no splash — aim with your facing.
  function getSonicBeam(spirit) {
    const originHex = HEX_BY_NUM[spirit.num];
    if (!originHex) return new Set();
    // Lock in the axial step from the first forward neighbour, then repeat it —
    // this guarantees a perfectly straight line (no staircase drift)
    const first = neighborInDirection(originHex, spirit.facing ?? 0);
    if (!first) return new Set();
    const dq = first.q - originHex.q;
    const dr = first.r - originHex.r;
    const beam = new Set();
    let q = originHex.q, r = originHex.r;
    for (let depth = 0; depth < 3; depth++) {
      q += dq; r += dr;
      const hex = HEX_BY_QR[`${q},${r}`];
      if (!hex) break; // beam runs off the edge of the stage
      beam.add(hex.num);
    }
    return beam;
  }

  // Returns rivals in the sonic beam
  function getRivalsInBeam(attacker) {
    const beam = getSonicBeam(attacker);
    return spirits.filter(s =>
      !s.knockedOut &&
      s.id !== attacker.id &&
      beam.has(s.num)
    );
  }

  // Apply damage to a spirit — handles KD/KO.
  // attackerId (optional): the Spirit credited with this hit. Drives Azrael's
  // knockdown-streak Fame for Metalness Monster.
  function applyVibeDamage(targetId, dmg, sourceLabel, attackerId) {
    setSpirits(prev => prev.map(s => {
      if (s.id !== targetId) return s;
      const newVibe = Math.max(0, s.vibe - dmg);
      return { ...s, vibe: newVibe };
    }));
    // Check for knock-down after state settles
    setTimeout(() => {
      setSpirits(prev => {
        const tgt = prev.find(s => s.id === targetId);
        if (!tgt || tgt.vibe > 0) return prev;
        // Vibe is 0 — KD
        const newLives = (tgt.lives ?? 1) - 1;
        addLog(`💥 ${tgt.name} is KNOCKED DOWN! (${newLives} life${newLives !== 1 ? 's' : ''} left)`);

        // 🎤 FAN ECONOMY — a knockdown in the spotlight scatters the crowd. tgt.num
        // is still the hex they fell on (respawn moves them after this).
        setTimeout(() => demolishFans(targetId, attackerId, tgt.num), 0);

        // 💀 AZRAEL — credit the attacker's knockdown streak (Metalness only).
        // A rival going down feeds Metalness Fame equal to his running streak.
        if (attackerId && attackerId !== targetId) {
          setTimeout(() => {
            setNoteStates(nsPrev => {
              const atkNs = nsPrev[attackerId] ?? {};
              if (!(atkNs.unlockedSkills ?? []).includes('azrael')) return nsPrev;
              const newStreak = (atkNs.knockStreak ?? 0) + 1;
              const atkName = spirits.find(s => s.id === attackerId)?.name;
              // Grant Fame + log AFTER this updater settles (grantFame also setstates)
              setTimeout(() => {
                addLog(`💀 AZRAEL — ${atkName} feeds on the fallen! Knockdown streak ${newStreak} → +${newStreak} FP.`);
                triggerEffectFlash(attackerId, '💀', `AZRAEL ×${newStreak}`, '#ff2244');
                grantFame(attackerId, newStreak, `Azrael streak ${newStreak}`);
              }, 0);
              return { ...nsPrev, [attackerId]: { ...atkNs, knockStreak: newStreak } };
            });
          }, 120);
        }

        if (newLives <= 0) {
          // True KO
          setTimeout(() => knockOut(targetId, null, undefined), 200);
          return prev;
        }
        // Respawn at corner with full Vibe
        const homeNum = tgt.corner ? CORNERS[tgt.corner]?.homeNum : tgt.num;
        const newFacing = tgt.corner ? cornerFacing(homeNum) : tgt.facing;
        // Knock Down penalties: lose 1 FP (never below 0) and lose the next turn
        // to recover. Vibe is restored to full (Sustain) on getting back up.
        // 💀 AZRAEL — if MetalNess himself is downed, his streak resets to zero.
        setNoteStates(nsPrev => {
          const ns = nsPrev[targetId] ?? {};
          return { ...nsPrev, [targetId]: {
            ...ns,
            fame:       Math.max(0, (ns.fame ?? 0) - 1),
            recovering: true,
            knockStreak: 0,
          }};
        });
        addLog(`💸 ${tgt.name} loses 1 FP and must recover — they'll skip their next turn.`);
        // Flash respawn
        setRespawnFlashes(rf => ({ ...rf, [targetId]: true }));
        setTimeout(() => setRespawnFlashes(rf => ({ ...rf, [targetId]: false })), 1200);
        return prev.map(s => s.id !== targetId ? s : {
          ...s, lives: newLives, num: homeNum, facing: newFacing, vibe: s.maxVibe,
        });
      });
    }, 80);
  }

  // 🤘 MASTER OF MOSHPITS — wrap a battle WIN's damage. If the winner owns the
  // skill and has a banked note, the note is burned for +1 Vibe (folded into the
  // hit so it can finish a knockdown), and the pit floods the board to rock the
  // rival (only if they survive the blow). attackerId is threaded to applyVibeDamage
  // so Azrael can credit the knockdown.
  function resolveWinDamage(winnerId, loserId, baseDmg, sourceLabel) {
    const wNs   = noteStates[winnerId] ?? {};
    const armed = (wNs.unlockedSkills ?? []).includes('master_moshpits') && !!wNs.bankedNote;
    let dmg = baseDmg;
    if (armed) {
      dmg = baseDmg + 1;
      const burned = wNs.bankedNote?.note;
      setNoteStates(prev => ({ ...prev, [winnerId]: { ...prev[winnerId], bankedNote: null } }));
      addLog(`🤘 MASTER OF MOSHPITS! ${spirits.find(s=>s.id===winnerId)?.name} burns the banked ${burned} — the pit erupts for +1 Vibe!`);
      // Crowd swarms once the hit (and any knockdown) has settled — only if the
      // rival is still standing to be rocked.
      setTimeout(() => triggerMoshpit(loserId), 460);
    }
    applyVibeDamage(loserId, dmg, sourceLabel, winnerId);
  }

  // Flood the board around a battered rival with moshing fans for a few seconds.
  function triggerMoshpit(loserId) {
    const loser = (spiritsRef.current ?? spirits).find(s => s.id === loserId);
    if (!loser || loser.knockedOut || (loser.vibe ?? 0) <= 0) return; // nobody left to rock
    const key = Date.now();
    setMoshpitTargets(m => ({ ...m, [loserId]: key }));
    addLog(`🎸🤘 The moshpit floods the stage and ROCKS ${loser.name} where they stand!`);
    triggerRumble(loserId);
    setTimeout(() => {
      setMoshpitTargets(m => {
        if (m[loserId] !== key) return m; // a newer mob superseded this one
        const next = { ...m }; delete next[loserId]; return next;
      });
    }, 2800);
  }

  // Push defender 1 hex in the attacker's facing direction
  function pushDefender(attackerId, defenderId) {
    const attacker = spirits.find(s => s.id === attackerId);
    const defender = spirits.find(s => s.id === defenderId);
    if (!attacker || !defender) return;
    const defHex = HEX_BY_NUM[defender.num];
    if (!defHex) return;
    // Find neighbor in the direction the attacker is facing
    const pushHex = neighborInDirection(defHex, attacker.facing ?? 0);
    if (!pushHex) return;
    // Can't push onto an occupied hex or off the map
    const occupied = spirits.some(s => !s.knockedOut && s.id !== defenderId && s.num === pushHex.num)
                  || amps.some(a => a.hexNum === pushHex.num);
    if (occupied) {
      addLog(`💢 No room to push — ${defender.name} holds position!`);
      return;
    }
    setSpirits(prev => prev.map(s =>
      s.id !== defenderId ? s : { ...s, num: pushHex.num }
    ));
    addLog(`💢 ${defender.name} pushed to hex #${pushHex.num}!${pushHex.edge ? ' ⚠️ EDGE!' : ''}`);
    // Pushed into the Disco Inferno?
    setTimeout(() => checkFlamingDisc(defenderId, pushHex.num), 100);
    // Clear pose if pushed off limelight
    if (defender.num === LIMELIGHT_HEX && pushHex.num !== LIMELIGHT_HEX) {
      setPosing(prev => ({ ...prev, [defenderId]: false }));
      addLog(`🎤 ${defender.name} knocked off the Limelight!`);
    }
  }

  // Main entry point — attacker initiates a Swing against target
  // Cinematic sequence:
  // enter_attacker → flash_drive → pick_drive_slide →
  // enter_defender → flash_sustain → pick_sustain_slide →
  // atk_die_spin → [click] → pick_atk_slide →
  // def_die_spin → [click] → pick_def_slide → result
  function initiateSwing(targetId) {
    if (!acting) return;
    if (actionTokenUsed) { addLog('⚔️ Already used your Action Token this turn!'); return; }
    const attacker = spirits.find(s => s.id === acting.id);
    const defender = spirits.find(s => s.id === targetId);
    if (!attacker || !defender) return;

    if (moveStepsLeft < 2) {
      addLog(`⚔️ Not enough Action Points — Swing costs 2 AP. Move steps left: ${moveStepsLeft}`);
      return;
    }

    setMoveStepsLeft(prev => Math.max(0, prev - 2));
    setActionTokenUsed(true);
    setAction(null);

    const nsA = noteStates[attacker.id] ?? {};
    const nsD = noteStates[targetId]    ?? {};

    // ── Stage Effects / skill mods ────────────────────────────────────────────
    const skillMods = getBattleSkillMods(attacker.id, targetId);
    if (skillMods.laserActive)  addLog(`🔴 Laser Show fires! Defender's die will be halved.`);
    if (skillMods.fogActive)    addLog(`🌫️ Fog Machine fires! Defender -1 Drive, -1 Feedback this battle.`);
    if (skillMods.pyroBonus > 0)addLog(`🔥 Pyrotechnics! +${skillMods.pyroBonus} bonus added to Drive roll.`);

    // ── 🔩 Junkyard weapon — armed by the Junkyard Dog crew, consumed on this swing ──
    const junkBonus = nsA.junkyardArmed ? 2 : 0;
    if (junkBonus) {
      addLog(`🔩 ${attacker.name} swings the junkyard weapon — +2 to the attack!`);
      setNoteStates(prev => ({
        ...prev,
        [attacker.id]: { ...prev[attacker.id], junkyardArmed: false },
      }));
    }

    const atkBase  = (attacker.drive ?? 6) + (nsA.instrumentDropped ? -1 : 0) + skillMods.pyroBonus + junkBonus;
    const atkBonus = nsA.tempDrive ?? 0;
    const atkStat  = atkBase + atkBonus;
    const defBase  = (defender.sustain ?? 5) - (skillMods.fogActive ? 1 : 0);
    const defBonus = nsD.tempSustain ?? 0;
    const defStat  = defBase + defBonus;
    const defenderPosing = posing[targetId];

    // Pre-roll dice (d6 — matches the d6 die faces shown in the overlay)
    const atkRoll = randD6();
    const rawDefRoll = defenderPosing ? 0 : randD6();
    let defRoll = defenderPosing ? 0
      : skillMods.halveDef ? Math.max(1, Math.floor(rawDefRoll / 2)) : rawDefRoll;

    // 🌀 PSYCHO BUSHIDO (Shredding Ronin) — attacker-only. A blistering 5 or 6
    // stuns the rival into giving up: their die collapses to a 1.
    const psychoBushido = (nsA.unlockedSkills ?? []).includes('psycho_bushido')
      && !defenderPosing && atkRoll >= 5;
    if (psychoBushido) {
      defRoll = 1;
      addLog(`🌀 PSYCHO BUSHIDO! ${attacker.name} explodes with a ${atkRoll} — ${defender.name} is stunned by the pure speed and folds. Their die drops to a 1!`);
    }

    // NOTE: fog's -1 Feedback is already baked into defBase above — do NOT
    // subtract it again here (it used to, making the displayed equation off by 1)
    const atkTotal = atkStat + atkRoll;
    const defTotal = defenderPosing ? 0 : defStat + defRoll;
    const attackerWon = atkTotal > defTotal;
    const margin = Math.abs(atkTotal - defTotal);
    const damage = marginToDamage(margin);

    if (nsA.instrumentDropped) addLog(`🎸💥 ${attacker.name} playing on a dropped instrument — Drive -1!`);
    addLog(`⚔️ ${attacker.name} SWINGS at ${defender.name}!${defenderPosing ? ' — caught posing!' : ''}`);

    // pickPos: 0 = center. Negative = toward attacker (left). Positive = toward defender (right).
    setBattleState({
      phase: 'enter_attacker',
      attackerId: acting.id, defenderId: targetId,
      atkStat, defStat, atkBase, atkBonus, defBase, defBonus,
      atkRoll, defRoll, atkTotal, defTotal,
      attackerWon, margin, damage,
      posing: defenderPosing,
      pickPos: 0,
      spinFaceAtk: 1, spinFaceDef: 1,
      atkDieReady: false, defDieReady: false,
      skillMods, // stage effects, pyro, laser, fog flags
      // Freeze the swing/CQC status-effect roll now so the result overlay can
      // tell the player exactly what lands before they close it (melee only).
      swingEffectRoll: rollSwingEffects(acting.id, false),
      // Stable dance-craze name shown when a plain swing connects (no effect).
      danceName: pickDanceName(),
      psychoBushido, // 🌀 forced the rival's die to 1
    });
    if (psychoBushido) setTimeout(() => triggerEffectFlash(targetId, '🌀', 'BUSHIDO!', '#4488ff'), 200);
    setDiceDisplay({ atk: null, def: null, rolling: null });

    const T = (fn, ms) => setTimeout(fn, ms);

    // 1.2s: Flash Drive stat
    T(() => setBattleState(p => p ? { ...p, phase: 'flash_drive' } : p), 1200);

    // 2.6s: Pick slides toward attacker by atkStat slots
    T(() => setBattleState(p => p ? { ...p, phase: 'pick_drive_slide', pickPos: -atkStat } : p), 2600);

    // 5.2s: Defender slides in (pick slide takes ~2.2s to feel weighty)
    T(() => setBattleState(p => p ? { ...p, phase: 'enter_defender' } : p), 5200);

    // 6.4s: Flash Sustain stat
    T(() => setBattleState(p => p ? { ...p, phase: 'flash_sustain' } : p), 6400);

    // 7.8s: Pick slides right by defStat from where it landed
    T(() => setBattleState(p => p ? { ...p, phase: 'pick_sustain_slide', pickPos: -atkStat + defStat } : p), 7800);

    // 10.4s: Attacker die appears spinning — waits for click
    T(() => {
      setBattleState(p => p ? { ...p, phase: 'atk_die_spin' } : p);
      // Spin random d6 faces
      const spinI = setInterval(() => {
        setBattleState(p => {
          if (!p || p.phase !== 'atk_die_spin') { clearInterval(spinI); return p; }
          return { ...p, spinFaceAtk: Math.floor(Math.random() * 6) + 1 };
        });
      }, 80);
    }, 10400);
    // Note: clicking the die triggers handleAtkDieClick (defined below)
  }

  // Random d6 face (1-6) — used during spin animation
  function randD6() { return Math.floor(Math.random() * 6) + 1; }

  // ── SONIC ATTACK ─────────────────────────────────────────────────────────────
  // Available when attacker is connected to ≥1 amp.
  // Die: 1 amp = d8, 2 amps = d10, 3 amps = d12.
  // Range: narrow 3-hex forward beam. Unplugged defender cannot retaliate.
  const SONIC_DICE = { 1: 8, 2: 10, 3: 12 };

  function initiateSonicAttack(targetId) {
    if (!acting) return;
    if (actionTokenUsed) { addLog('🔊 Already used your Action Token this turn!'); return; }
    if (ampsInRange < 1) { addLog('🔊 Sonic Attack requires at least 1 connected Amp!'); return; }

    const attacker = spirits.find(s => s.id === acting.id);
    const defender = spirits.find(s => s.id === targetId);
    if (!attacker || !defender) return;

    if (moveStepsLeft < 2) {
      addLog(`🔊 Not enough Action Points — Sonic Attack costs 2 AP.`);
      return;
    }

    setMoveStepsLeft(prev => Math.max(0, prev - 2));
    setActionTokenUsed(true);
    setAction(null);

    // ── RIFF-OFF TRIGGER ─────────────────────────────────────────────────────
    // If the defender is ALSO plugged in (their own live amp in range) and the
    // attacker stands inside the defender's sonic beam — i.e. the two Spirits
    // are connected, in line of sight, and facing each other down the same
    // line — the Sonic Attack escalates into a head-to-head RIFF-OFF.
    // (AP + Action Token were already spent above, same cost as a Sonic Attack.)
    const riffDefHex = HEX_BY_NUM[defender.num];
    const riffDefPlugged = riffDefHex ? amps.some(amp => {
      const ampHex = HEX_BY_NUM[amp.hexNum];
      return ampHex && !amp.unplugged && amp.ownerId === targetId &&
        axialDist(riffDefHex.q, riffDefHex.r, ampHex.q, ampHex.r) <= AMP_RANGE;
    }) : false;
    if (riffDefPlugged && !posing[targetId] && getSonicBeam(defender).has(attacker.num)) {
      startRiffOff(attacker, defender);
      return;
    }

    const nsA     = noteStates[attacker.id] ?? {};
    const nsD     = noteStates[targetId]    ?? {};

    // ── Stage Effects / skill mods ────────────────────────────────────────────
    const skillMods = getBattleSkillMods(attacker.id, targetId);
    if (skillMods.laserActive)  addLog(`🔴 Laser Show fires! Defender's die will be halved.`);
    if (skillMods.fogActive)    addLog(`🌫️ Fog Machine fires! Defender -1 Drive, -1 Feedback this battle.`);
    if (skillMods.pyroBonus > 0)addLog(`🔥 Pyrotechnics! +${skillMods.pyroBonus} bonus added to Drive roll.`);

    // Amp count caps at 3 ("goes to eleven" event boost counts as +1 amp)
    // NOTE: declared BEFORE powerBonus below — referencing it earlier crashed the game
    const ampCount    = Math.min(ampsInRange + elevenBoost, 3);
    const dieSides    = SONIC_DICE[ampCount];

    // PA skill bonuses for Sonic Attack
    const atkSkills    = nsA.unlockedSkills ?? [];
    const pedalBonus   = atkSkills.includes('pedal_dist') ? 1 : 0;
    const powerBonus   = (atkSkills.includes('power_chords') && ampCount >= 2) ? 2 : 0;
    if (pedalBonus)  addLog(`🎛️ Pedal Distortion! +1 Drive on Sonic Attack.`);
    if (powerBonus)  addLog(`🤘 Power Chords! +2 Drive (${ampCount} amps in range).`);

    const atkBase  = (attacker.drive ?? 6) + (nsA.instrumentDropped ? -1 : 0)
                   + skillMods.pyroBonus + pedalBonus + powerBonus;
    const atkBonus = nsA.tempDrive ?? 0;
    const atkStat  = atkBase + atkBonus;
    const defBase  = (defender.sustain ?? 5) - (skillMods.fogActive ? 1 : 0);
    const defBonus = nsD.tempSustain ?? 0;
    const defStat  = defBase + defBonus;
    const defenderPosing = posing[targetId];

    // Check if defender is plugged in (within range of one of THEIR OWN live amps)
    const defHex = HEX_BY_NUM[defender.num];
    const defenderPluggedIn = defHex ? amps.some(amp => {
      const ampHex = HEX_BY_NUM[amp.hexNum];
      return ampHex && !amp.unplugged && amp.ownerId === targetId &&
        axialDist(defHex.q, defHex.r, ampHex.q, ampHex.r) <= AMP_RANGE;
    }) : false;

    // Is the target at range (not directly adjacent)?
    const atkHex    = HEX_BY_NUM[attacker.num];
    const isAtRange = atkHex && defHex
      ? axialDist(atkHex.q, atkHex.r, defHex.q, defHex.r) > 1
      : false;

    // Unplugged defender cannot retaliate against a plugged-in ranged attacker
    const retaliationBlocked = isAtRange && !defenderPluggedIn;

    // Roll — attacker uses d-dieSides, defender uses d6 as normal
    // 🐉 HYDRA (Shredding Ronin capstone) — at 3 amps, the three heads roar:
    // roll 3d6 (summed) instead of a single d12, and fire three beams.
    const hydraActive = ampCount === 3 && (atkSkills.includes('hydra'));
    const hydraDice   = hydraActive ? [randD6(), randD6(), randD6()] : null;
    const atkRoll  = hydraActive
      ? hydraDice[0] + hydraDice[1] + hydraDice[2]
      : Math.floor(Math.random() * dieSides) + 1;
    if (hydraActive) addLog(`🐉 HYDRA AWAKENS! ${attacker.name} rolls 3d6 [${hydraDice.join(' + ')}] = ${atkRoll} — three beams scream out!`);
    const rawDefRoll = defenderPosing ? 0 : randD6();
    const defRoll  = defenderPosing ? 0
      : skillMods.halveDef ? Math.max(1, Math.floor(rawDefRoll / 2)) : rawDefRoll;
    const atkTotal = atkStat + atkRoll;
    const defTotal = defenderPosing ? 0 : defStat + defRoll;
    const attackerWon = atkTotal > defTotal;
    const margin  = Math.abs(atkTotal - defTotal);
    const damage  = marginToDamage(margin);

    if (nsA.instrumentDropped) addLog(`🎸💥 ${attacker.name} playing on dropped instrument — Drive -1!`);
    addLog(`🔊 ${attacker.name} launches SONIC ATTACK at ${defender.name}! (d${dieSides} — ${ampCount} amp${ampCount > 1 ? 's' : ''})${retaliationBlocked ? ' — UNPLUGGED TARGET CANNOT RETALIATE!' : ''}`);

    setBattleState({
      phase: 'enter_attacker',
      attackerId: acting.id, defenderId: targetId,
      atkStat, defStat, atkBase, atkBonus, defBase, defBonus,
      atkRoll, defRoll, atkTotal, defTotal,
      attackerWon, margin, damage,
      posing: defenderPosing,
      pickPos: 0,
      spinFaceAtk: 1, spinFaceDef: 1,
      atkDieReady: false, defDieReady: false,
      sonicAttack: true,
      ampCount,
      dieSides,
      hydra: hydraActive,        // 🐉 three-head Sonic Attack
      hydraDice,                 // [d6,d6,d6] for the 3-dice display
      retaliationBlocked,
      skillMods,
      pedalBonus,
      powerBonus,
      swingEffectRoll: null, // Sonic = ranged, no CQC status effects
    });
    setDiceDisplay({ atk: null, def: null, rolling: null });

    const T = (fn, ms) => setTimeout(fn, ms);
    T(() => setBattleState(p => p ? { ...p, phase: 'flash_drive' }                                         : p), 1200);
    T(() => setBattleState(p => p ? { ...p, phase: 'pick_drive_slide', pickPos: -atkStat }                 : p), 2600);
    T(() => setBattleState(p => p ? { ...p, phase: 'enter_defender' }                                      : p), 5200);
    T(() => setBattleState(p => p ? { ...p, phase: 'flash_sustain' }                                       : p), 6400);
    T(() => setBattleState(p => p ? { ...p, phase: 'pick_sustain_slide', pickPos: -atkStat + defStat }      : p), 7800);
    T(() => {
      setBattleState(p => p ? { ...p, phase: 'atk_die_spin' } : p);
      const spinI = setInterval(() => {
        setBattleState(p => {
          if (!p || p.phase !== 'atk_die_spin') { clearInterval(spinI); return p; }
          if (p.hydra) {
            return { ...p, spinFaceAtk: Math.floor(Math.random() * dieSides) + 1,
              hydraSpin: [randD6(), randD6(), randD6()] };
          }
          return { ...p, spinFaceAtk: Math.floor(Math.random() * dieSides) + 1 };
        });
      }, 80);
    }, 10400);
  }

  // ── RIFF-OFF ENGINE ──────────────────────────────────────────────────────────
  // Sequential call-and-response on a shared keyboard: the attacker plays
  // their riff first, results are logged, the keyboard is passed, and the
  // defender answers with a transformed riff. Accuracy decides the winner;
  // average reaction time breaks ties.
  function startRiffOff(attacker, defender) {
    const atk = generateAttackerRiff();
    const def = generateDefenderRiff(atk);
    addLog(`🎸🔥 RIFF-OFF! ${attacker.name} and ${defender.name} lock eyes — both plugged in, beams crossed!`);
    addLog(`🎶 ${attacker.name} calls a ${RIFF_CONTOUR_LABELS[atk.contour]} — ${defender.name} must answer with a ${RIFF_ANSWER_LABELS[def.kind].name}.`);

    // 🗡️ RIFF SLAYER — if the attacker armed a skip-climb this turn, the rival
    // cracks under pressure: pick 2–3 of their answer notes to glitch mid-flight.
    const atkNs = noteStates[attacker.id] ?? {};
    let defGlitch = [];
    if ((atkNs.unlockedSkills ?? []).includes('riff_slayer') && atkNs.riffSlayerArmed) {
      const defLen   = def.degrees.length;
      const glitchN  = 2 + Math.floor(Math.random() * 2); // 2 or 3
      const idxPool  = Array.from({ length: defLen }, (_, i) => i);
      for (let i = idxPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idxPool[i], idxPool[j]] = [idxPool[j], idxPool[i]];
      }
      defGlitch = idxPool.slice(0, Math.min(glitchN, defLen)).sort((a, b) => a - b);
      addLog(`🗡️ RIFF SLAYER! ${attacker.name}'s menace rattles ${defender.name} — ${defGlitch.length} of their notes will LURCH mid-riff. They're on edge!`);
      // consume the arm so it can't carry into another riff-off
      setNoteStates(prev => ({ ...prev, [attacker.id]: { ...prev[attacker.id], riffSlayerArmed: false } }));
    }

    // 🎴 いいラッシュ / E-RUSH — if the Ronin ended on an E this turn, every one
    // of the rival's answer notes spawns a GHOST (a distinct second key). Both
    // must be hit in the window or the note misses.
    const defNotesArr = riffDegreesToNotes(def.degrees, def.sharps);
    let defGhosts = null;
    if ((atkNs.unlockedSkills ?? []).includes('e_rush') && atkNs.eRushArmed) {
      defGhosts = defNotesArr.map(n => pickGlitchRiffNote(n).letter);
      addLog(`🎴 いいラッシュ! ${attacker.name}'s E-Rush buries ${defender.name} under a ghost barrage — every answer note now demands TWO keys!`);
      setNoteStates(prev => ({ ...prev, [attacker.id]: { ...prev[attacker.id], eRushArmed: false } }));
    }

    riffEngineRef.current = null;
    setBattleState({
      riffOff: true, sonicAttack: true,   // sonicAttack → sonic-scale knockback
      phase: 'riff_intro',
      attackerId: attacker.id, defenderId: defender.id,
      atkRiff: { notes: riffDegreesToNotes(atk.degrees, atk.sharps),
                 freqs: atk.degrees.map((d, i) => riffDegreeFreq(d, atk.sharps[i])),
                 rhythm: atk.rhythm, contour: atk.contour },
      defRiff: { notes: defNotesArr,
                 freqs: def.degrees.map((d, i) => riffDegreeFreq(d, def.sharps[i])),
                 rhythm: def.rhythm, kind: def.kind },
      defGlitch, glitchAt: null,
      defGhosts, ghostHit: null,
      turn: 'attacker', noteIdx: -1, countdown: 3, round: 1,
      atkResults: [], defResults: [], feedback: null,
    });
    setDiceDisplay(null);
  }

  function riffBeginTurn(turn) {
    getRiffAudio(); getAudioCtx(); // unlock both audio paths on this user gesture (SFX + amp)
    const round = battleStateRef.current?.round ?? 1;
    const cdStep = round >= 2 ? 520 : 800; // Round 2 counts in faster — less breathing room
    setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_countdown', turn, countdown: 3, noteIdx: -1, feedback: null } : p);
    let c = 3;
    const iv = setInterval(() => {
      c--;
      if (!battleStateRef.current?.riffOff) { clearInterval(iv); return; }
      if (c > 0) setBattleState(p => p?.riffOff ? { ...p, countdown: c } : p);
      else { clearInterval(iv); riffNextNote(turn, 0); }
    }, cdStep);
  }

  function riffNextNote(turn, idx) {
    const bs = battleStateRef.current;
    if (!bs?.riffOff) return;
    const side  = turn === 'attacker' ? bs.atkRiff : bs.defRiff;
    const notes = side.notes;
    if (idx >= notes.length) { riffEndTurn(turn); return; }
    const win = side.rhythm?.[idx]?.window ?? RIFF_NOTE_WINDOW;
    riffEngineRef.current = { turn, idx, shownAt: performance.now(), resolved: false, timeoutId: null, glitchTimeoutId: null, window: win };
    setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_play', turn, noteIdx: idx, glitchAt: null, ghostHit: null } : p);

    // 🎴 いいラッシュ / E-RUSH — this defender note carries a ghost: require BOTH
    // the real key and the ghost key within the window.
    if (turn === 'defender' && bs.defGhosts && bs.defGhosts[idx]) {
      const eng = riffEngineRef.current;
      eng.needBoth  = true;
      eng.mainKey   = notes[idx];
      eng.ghostKey  = bs.defGhosts[idx];
      eng.hitMain   = false;
      eng.hitGhost  = false;
      // a ghosted note is given a little more breathing room (×1.5) since it
      // demands two presses — long windows are still very hard at riff speed
      const ghostWin = Math.round(win * 1.5);
      riffEngineRef.current.window = ghostWin;
    }

    // 🗡️ RIFF SLAYER — if this defender note is flagged, it LURCHES partway
    // through its window: the displayed letter and the real target both swap to
    // a different note, so the rattled rival's muscle-memory press misfires.
    if (turn === 'defender' && (bs.defGlitch ?? []).includes(idx)) {
      const swapAt = Math.round(win * (0.34 + Math.random() * 0.18)); // ~34–52% in
      riffEngineRef.current.glitchTimeoutId = setTimeout(() => {
        const eng = riffEngineRef.current;
        if (!eng || eng.resolved || eng.turn !== turn || eng.idx !== idx) return;
        const cur = battleStateRef.current;
        if (!cur?.riffOff) return;
        const curNote = cur.defRiff?.notes?.[idx];
        const { letter, freq } = pickGlitchRiffNote(curNote);
        setBattleState(p => {
          if (!p?.riffOff) return p;
          const notes2 = [...p.defRiff.notes]; notes2[idx] = letter;
          const freqs2 = [...(p.defRiff.freqs ?? [])]; freqs2[idx] = freq;
          return { ...p, defRiff: { ...p.defRiff, notes: notes2, freqs: freqs2 }, glitchAt: idx };
        });
        playRiffWrong(curNote || 'a'); // a sour stab as the note lurches
      }, swapAt);
    }

    // Window expires with no press → miss (muted string scrape)
    riffEngineRef.current.timeoutId = setTimeout(() => {
      const eng = riffEngineRef.current;
      if (!eng || eng.resolved || eng.turn !== turn || eng.idx !== idx) return;
      eng.resolved = true;
      clearTimeout(eng.glitchTimeoutId);
      playRiffMiss();
      riffRecordResult(turn, { hit: false, rt: null, grade: 'miss' });
      const nextGap = side.rhythm?.[idx + 1]?.gapBefore ?? RIFF_GAP_NORMAL;
      setTimeout(() => riffNextNote(turn, idx + 1), nextGap);
    }, riffEngineRef.current.window);
  }

  function riffRecordResult(turn, res) {
    setBattleState(p => {
      if (!p?.riffOff) return p;
      const key = turn === 'attacker' ? 'atkResults' : 'defResults';
      return { ...p, [key]: [...p[key], res], feedback: { ...res, noteIdx: p.noteIdx, turn } };
    });
  }

  function riffEndTurn(turn) {
    riffEngineRef.current = null;
    if (turn === 'attacker') {
      setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_handoff', feedback: null } : p);
    } else {
      riffResolve();
    }
  }

  // Replay a riff-off performance through the in-game amp — same voice the
  // player heard while striking, groove (gaps + rests) intact.
  function playRiffOffPlayback(freqs, rhythm) {
    if (!freqs) return;
    let tMs = 0;
    freqs.forEach((fr, i) => {
      tMs += i === 0 ? 0 : 280 + (rhythm?.[i]?.gapBefore ?? RIFF_GAP_NORMAL);
      setTimeout(() => playNoteSound(null, { freq: fr, holdTime: 0.4, fadeTime: 0.38, volume: 0.17 }), tMs);
    });
  }

  function riffStats(results) {
    const hits  = results.filter(r => r.hit).length;
    const rts   = results.filter(r => r.hit).map(r => r.rt);
    const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null;
    return { hits, avgRt };
  }

  function riffResolve() {
    const bs = battleStateRef.current;
    if (!bs?.riffOff) return;
    const round = bs.round ?? 1;
    const A = riffStats(bs.atkResults);
    const D = riffStats(bs.defResults);
    let attackerWon = false, margin = 0, tie = false, decidedBy = 'accuracy';
    if (A.hits !== D.hits) {
      attackerWon = A.hits > D.hits;
      margin = Math.abs(A.hits - D.hits) * 2;              // each note of accuracy = 2 margin
    } else if (A.hits === 0) {
      tie = true;                                          // both whiffed everything
    } else if (A.avgRt !== D.avgRt) {
      decidedBy   = 'reaction';
      attackerWon = A.avgRt < D.avgRt;
      margin      = Math.abs(A.avgRt - D.avgRt) >= 150 ? 2 : 1; // big speed gap = margin 2
    } else {
      tie = true;
    }
    // Round 2 is sudden death — it settles the duel. A dead-even Round 2 falls
    // back to whoever had the edge in Round 1; only a double dead-heat ties.
    if (round >= 2) {
      if (tie && !bs.r1Tie) {
        tie = false;
        attackerWon = bs.r1Won;
        decidedBy = 'Round 1 edge';
        margin = Math.max(1, bs.r1Margin ?? 1);
      }
      if (!tie) { margin += 1; decidedBy += ' · Round 2'; } // stakes climbed
    }
    const damage  = tie ? 0 : marginToDamage(margin + (round >= 2 ? 1 : 0));
    const atkName = spirits.find(s => s.id === bs.attackerId)?.name;
    const defName = spirits.find(s => s.id === bs.defenderId)?.name;
    if (tie) addLog(`🎸 RIFF-OFF R${round}: dead heat at ${A.hits}/${RIFF_LEN} apiece — the crowd can't pick a winner!`);
    else addLog(`🎸 RIFF-OFF R${round}: ${attackerWon ? atkName : defName} takes it on ${decidedBy}! (${A.hits}/${RIFF_LEN}${A.avgRt != null ? ` · ${A.avgRt}ms` : ''} vs ${D.hits}/${RIFF_LEN}${D.avgRt != null ? ` · ${D.avgRt}ms` : ''})`);
    setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_clash', round, clashStage: 'charge',
      clashWinner: null, attackerWon, margin, damage, tie, decidedBy, atkStats: A, defStats: D } : p);
  }

  // ── BEAM CLASH ("Kamehameha") — DBZ-style finale to the riff-off ──────────
  // Both Spirits fire a beam from their end; the beams collide in the middle.
  // The better-performed riff (already decided in riffResolve) owns the clash:
  // a decisive margin lets its beam overpower and sweep the loser off the stage.
  // If the duel is too close to break, the beams lock and SURGE into a higher-
  // stakes Round 2 (bigger beams, more damage). Capped at 2 rounds for now —
  // round 2 always resolves, even a dead-even one as a cancel-out dead heat.
  function fireBeamClash() {
    const bs = battleStateRef.current;
    if (!bs?.riffOff || bs.phase !== 'riff_clash' || bs.clashStage !== 'charge') return;
    const round = bs.round ?? 1;
    setBattleState(p => p?.riffOff ? { ...p, clashStage: 'clash' } : p); // beams shoot + collide
    playBeamClash(round >= 2);
    setTimeout(() => {
      const s = battleStateRef.current;
      if (!s?.riffOff || s.phase !== 'riff_clash') return;
      const decisive = !s.tie && s.margin >= 3;        // ≥2-note accuracy gap = total domination
      if (round >= 2 || decisive) {
        const winner = s.tie ? null : (s.attackerWon ? 'attacker' : 'defender');
        const wName  = winner ? spirits.find(x => x.id === (winner === 'attacker' ? s.attackerId : s.defenderId))?.name : null;
        addLog(winner
          ? `🌟 BEAM CLASH${round >= 2 ? ' — FINAL ROUND' : ''}: ${wName}'s beam OVERPOWERS and sweeps the stage!`
          : `🌟 BEAM CLASH: the beams cancel out — neither Spirit breaks through!`);
        playBeamBreak(round >= 2);
        setBattleState(p => p?.riffOff ? { ...p, clashStage: 'break', clashWinner: winner } : p);
        setTimeout(() => setBattleState(p => p?.riffOff ? { ...p, phase: 'riff_result' } : p), 2000);
      } else {
        // Too close to break — beams lock, SURGE, and we play a real ROUND 2:
        // fresh riffs, faster and meaner, sudden death. The round-1 beams stay
        // locked in the background while the new riffs play out.
        addLog(`⚡ ROUND 1 TOO CLOSE — the beams LOCK and SURGE! Bring on ROUND 2!`);
        playBeamSurge();
        setBattleState(p => p?.riffOff ? { ...p, clashStage: 'escalate' } : p);
        setTimeout(() => {
          const s2 = battleStateRef.current;
          if (!s2?.riffOff) return;
          const atk = generateAttackerRiff();
          const def = generateDefenderRiff(atk);
          const mk = (r, extra) => ({
            notes: riffDegreesToNotes(r.degrees, r.sharps),
            freqs: r.degrees.map((d, i) => riffDegreeFreq(d, r.sharps[i])),
            rhythm: speedUpRiffRhythm(r.rhythm, 0.58),
            ...extra,
          });
          addLog(`🎸🔥 ROUND 2! New riffs — faster, meaner, sudden death!`);
          // 🗡️ RIFF SLAYER carries into Round 2 if it was active in Round 1 —
          // the rival is still rattled. Re-roll a fresh 2–3 note glitch set.
          let r2Glitch = [];
          if ((s2.defGlitch?.length ?? 0) > 0) {
            const defLen  = def.degrees.length;
            const glitchN = 2 + Math.floor(Math.random() * 2);
            const idxPool = Array.from({ length: defLen }, (_, i) => i);
            for (let i = idxPool.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [idxPool[i], idxPool[j]] = [idxPool[j], idxPool[i]];
            }
            r2Glitch = idxPool.slice(0, Math.min(glitchN, defLen)).sort((a, b) => a - b);
            addLog(`🗡️ Still rattled — Riff Slayer lurches ${r2Glitch.length} of their Round 2 notes!`);
          }
          // 🎴 E-Rush ghost barrage also carries into Round 2 if it was active
          let r2Ghosts = null;
          if (s2.defGhosts) {
            const r2Notes = riffDegreesToNotes(def.degrees, def.sharps);
            r2Ghosts = r2Notes.map(n => pickGlitchRiffNote(n).letter);
            addLog(`🎴 The ghost barrage rages on — Round 2 answer notes still demand TWO keys!`);
          }
          setBattleState(p => p?.riffOff ? {
            ...p,
            round: 2,
            r1Won: s2.attackerWon, r1Tie: s2.tie, r1Margin: s2.margin, // remember Round 1's edge
            atkRiff: mk(atk, { contour: atk.contour }),
            defRiff: mk(def, { kind: def.kind }),
            defGlitch: r2Glitch, glitchAt: null,
            defGhosts: r2Ghosts, ghostHit: null,
            atkResults: [], defResults: [],
            turn: 'attacker', noteIdx: -1, feedback: null,
            clashStage: null, clashWinner: null,
            phase: 'riff_r2intro',
          } : p);
        }, 1700);
      }
    }, 1600);
  }

  // Close the riff-off overlay and apply consequences through the normal
  // battle pipeline: knockback, Vibe damage, Fame. The duel is symmetric —
  // whoever loses takes the hit, attacker or defender alike.
  function closeRiffOff() {
    const s = battleStateRef.current;
    if (!s?.riffOff) { setBattleState(null); setDiceDisplay(null); return; }
    const { attackerWon, margin, damage, tie, attackerId, defenderId } = s;
    if (!tie) {
      const winnerId = attackerWon ? attackerId : defenderId;
      const loserId  = attackerWon ? defenderId : attackerId;
      battleKnockback(winnerId, loserId, knockbackSpaces(s, margin));
      resolveWinDamage(winnerId, loserId, damage, spirits.find(x => x.id === winnerId)?.name);
      awardFame(winnerId, margin);
      if (attackerWon) applyPendingCombatEffects(attackerId, defenderId);
    }
    clearBattleBuffs(attackerId, defenderId);
    riffEngineRef.current = null;
    setBattleState(null);
    setDiceDisplay(null);
  }

  // Zero out tempDrive/tempSustain for both combatants once a battle resolves.
  // Bonuses from note track patterns last only for the turn they were built —
  // they should not compound across multiple battles.
  function clearBattleBuffs(attackerId, defenderId) {
    setNoteStates(prev => {
      const next = { ...prev };
      if (attackerId && next[attackerId]) next[attackerId] = { ...next[attackerId], tempDrive: 0 };
      if (defenderId && next[defenderId]) next[defenderId] = { ...next[defenderId], tempSustain: 0 };
      return next;
    });
  }

  // Close the battle overlay and apply any pending effects immediately
  function closeBattleOverlay() {
    const s = battleStateRef.current;
    if (!s || s.phase !== 'result') { setBattleState(null); setDiceDisplay(null); return; }
    const { attackerWon, damage, margin, attackerId, defenderId } = s;
    if (attackerWon) {
      if (margin <= 2) {
        setBattleState(prev2 => prev2 ? { ...prev2, pendingPush: true, phase: 'retaliation_prompt' } : prev2);
        setRetaliationTimer(3);
      } else {
        battleKnockback(attackerId, defenderId, knockbackSpaces(s));
        resolveWinDamage(attackerId, defenderId, damage, spirits.find(s2 => s2.id === attackerId)?.name);
        awardFame(attackerId, margin);
        if (!s.sonicAttack) applySwingEffects(attackerId, defenderId, s.swingEffectRoll); // CQC = melee only
        applyPendingCombatEffects(attackerId, defenderId); // Mojo Drain / Stagger land on any hit
        clearBattleBuffs(attackerId, defenderId);
        setBattleState(null);
        setDiceDisplay(null);
      }
    } else {
      const selfDmg = Math.max(1, Math.ceil(margin / 2));
      resolveWinDamage(defenderId, attackerId, selfDmg, 'whiff');
      awardFame(defenderId, margin);
      battleKnockback(defenderId, attackerId, knockbackSpaces(s));
      clearBattleBuffs(attackerId, defenderId);
      setBattleState(null);
      setDiceDisplay(null);
    }
  }

  // Called when player clicks the spinning attacker die
  function handleAtkDieClick() {
    setBattleState(prev => {
      if (!prev || prev.phase !== 'atk_die_spin') return prev;
      return { ...prev, phase: 'atk_die_settling' };
    });
    // Decelerate: fast random faces → slow → land on pre-rolled d6 result
    let interval = 60;
    let steps = 0;
    const maxSteps = 10;
    function tick() {
      steps++;
      const progress = steps / maxSteps;
      interval = 60 + progress * 340; // 60ms → 400ms, done in ~10 steps
      setBattleState(p => {
        if (!p || p.phase !== 'atk_die_settling') return p;
        // Last 2 steps: show adjacent face then land
        const face = steps >= maxSteps ? p.atkRoll
          : steps >= maxSteps - 2
            ? ((p.atkRoll % 6) + 1)
            : randD6();
        return { ...p, spinFaceAtk: Math.max(1,Math.min(6,face)), atkDieReady: steps >= maxSteps };
      });
      if (steps < maxSteps) {
        setTimeout(tick, interval);
      } else {
        // Die settled — slide pick left by atkRoll after a short beat
        setTimeout(() => {
          setBattleState(p => {
            if (!p) return p;
            return { ...p, phase: 'pick_atk_slide', pickPos: p.pickPos - p.atkRoll };
          });
          // Launch defender die after pick settles
          setTimeout(() => {
            setBattleState(p => {
              if (!p) return p;
              if (p.posing) return { ...p, phase: 'result' };
              return { ...p, phase: 'def_die_spin', spinFaceDef: randD6() };
            });
            // Spin defender die faces randomly
            const spinI2 = setInterval(() => {
              setBattleState(p => {
                if (!p || p.phase !== 'def_die_spin') { clearInterval(spinI2); return p; }
                return { ...p, spinFaceDef: randD6() };
              });
            }, 90);
          }, 2400);
        }, 800);
      }
    }
    setTimeout(tick, interval);
  }

  // Called when player clicks the spinning defender die
  function handleDefDieClick() {
    setBattleState(prev => {
      if (!prev || prev.phase !== 'def_die_spin') return prev;
      return { ...prev, phase: 'def_die_settling' };
    });
    let interval = 60;
    let steps = 0;
    const maxSteps = 10;
    function tick() {
      steps++;
      const progress = steps / maxSteps;
      interval = 60 + progress * 340;
      setBattleState(p => {
        if (!p || p.phase !== 'def_die_settling') return p;
        const face = steps >= maxSteps ? p.defRoll
          : steps >= maxSteps - 2
            ? ((p.defRoll % 6) + 1)
            : randD6();
        return { ...p, spinFaceDef: Math.max(1,Math.min(6,face)), defDieReady: steps >= maxSteps };
      });
      if (steps < maxSteps) {
        setTimeout(tick, interval);
      } else {
        // Die settled — slide pick right by defRoll
        setTimeout(() => {
          setBattleState(p => {
            if (!p) return p;
            return { ...p, phase: 'pick_def_slide', pickPos: p.pickPos + p.defRoll };
          });
          // Show result after pick settles
          setTimeout(() => {
            // Capture all values from the ref NOW, before any state updates
            const snap = battleStateRef.current;
            if (!snap) return;
            const { attackerWon, damage, margin, attackerId, defenderId, atkTotal, defTotal } = snap;
            const atk = spirits.find(s => s.id === attackerId);

            // Log result
            if (attackerWon) {
              addLog(`⚔️ ${atk?.name} HITS! (${atkTotal} vs ${defTotal}) — ${damage} Vibe dmg + pushed`);
            } else {
              const selfDmg = Math.max(1, Math.ceil(margin / 2));
              addLog(`💨 ${atk?.name} WHIFFS! (${atkTotal} vs ${defTotal}) — ${selfDmg} Vibe self-damage`);
            }
            setBattleState(p => p ? { ...p, phase: 'result' } : p);

            // Apply effects after player reads — values captured in closure above, no ref needed
            setTimeout(() => {
              // Guard: if the player already clicked BACK TO GAME (closeBattleOverlay
              // applied everything and nulled the state), bail — otherwise damage,
              // Fame, and knockback would all be applied TWICE.
              const cur = battleStateRef.current;
              if (!cur || cur.phase !== 'result') return;
              if (attackerWon) {
                // Stage Lighting: 33% chance heal on win (rolled at battle start, stored in skillMods)
                if (snap.skillMods?.stageLightActive) {
                  const heal = 1;
                  setSpirits(prev => prev.map(s => s.id === attackerId
                    ? { ...s, vibe: Math.min(s.maxVibe, (s.vibe ?? 0) + heal) } : s));
                  addLog(`💡 Stage Lighting pays off! ${spirits.find(s=>s.id===attackerId)?.name} +${heal} Vibe saved.`);
                }
                if (margin <= 2 && !snap.retaliationBlocked) {
                  setBattleState(prev2 => prev2 ? { ...prev2, pendingPush: true, phase: 'retaliation_prompt' } : prev2);
                  setRetaliationTimer(3);
                } else {
                  if (snap.retaliationBlocked && margin <= 2) {
                    addLog(`🔇 ${spirits.find(s=>s.id===snap.defenderId)?.name} is unplugged — cannot retaliate against a ranged Sonic Attack!`);
                  }
                  battleKnockback(attackerId, defenderId, knockbackSpaces(snap, margin));
                  resolveWinDamage(attackerId, defenderId, damage, spirits.find(s2 => s2.id === attackerId)?.name);
                  awardFame(attackerId, margin);
                  if (!snap.sonicAttack) applySwingEffects(attackerId, defenderId, snap.swingEffectRoll); // CQC = melee only
                  applyPendingCombatEffects(attackerId, defenderId); // Mojo Drain / Stagger land on any hit
                  clearBattleBuffs(attackerId, defenderId);
                  setBattleState(null);
                  setDiceDisplay(null);
                }
              } else {
                const selfDmg = Math.max(1, Math.ceil(margin / 2));
                resolveWinDamage(defenderId, attackerId, selfDmg, 'whiff');
                awardFame(defenderId, margin);
                battleKnockback(defenderId, attackerId, knockbackSpaces(snap, margin));
                clearBattleBuffs(attackerId, defenderId);
                setBattleState(null);
                setDiceDisplay(null);
              }
            }, 5000); // 5s on screen, then auto-close
          }, 2400);
        }, 800);
      }
    }
    setTimeout(tick, interval);
  }


  // Retaliation timer tick
  useEffect(() => {
    if (retaliationTimer === null) return;
    if (retaliationTimer <= 0) {
      // Timed out — apply original damage + push, no counter
      const bs = battleState;
      if (bs) {
        if (bs.pendingPush) battleKnockback(bs.attackerId, bs.defenderId, knockbackSpaces(bs));
        resolveWinDamage(bs.attackerId, bs.defenderId, bs.damage, 'swing');
        awardFame(bs.attackerId, bs.margin);
        addLog(`⏰ ${spirits.find(s=>s.id===bs.defenderId)?.name} held back — took ${bs.damage} Vibe dmg`);
        if (!bs.sonicAttack) applySwingEffects(bs.attackerId, bs.defenderId, bs.swingEffectRoll); // CQC = melee only
        applyPendingCombatEffects(bs.attackerId, bs.defenderId);
        clearBattleBuffs(bs.attackerId, bs.defenderId);
      }
      setBattleState(null);
      setDiceDisplay(null);
      setRetaliationTimer(null);
      return;
    }
    const t = setTimeout(() => setRetaliationTimer(prev => (prev ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [retaliationTimer]); // eslint-disable-line

  // ── RETALIATION — "PART 2" of the battle ──────────────────────────────────
  // The defender's choice at the prompt. ABSORB resolves the original hit.
  // COUNTER no longer rolls invisibly — it sets up an interactive counter
  // round (retaliation_spin) where the defender CLICKS to roll their own die
  // and tries to out-swing the attacker. Damage is applied later, in
  // finishCounter, once the die has settled and the result is on screen.
  function resolveRetaliation(chosen) {
    const bs = battleStateRef.current;
    if (!bs) return;
    setRetaliationTimer(null);

    if (!chosen) {
      // Declined — take original damage + push
      if (bs.pendingPush) battleKnockback(bs.attackerId, bs.defenderId, knockbackSpaces(bs));
      resolveWinDamage(bs.attackerId, bs.defenderId, bs.damage, 'swing');
      awardFame(bs.attackerId, bs.margin);
      addLog(`🛡️ ${spirits.find(s=>s.id===bs.defenderId)?.name} absorbs the hit — ${bs.damage} Vibe dmg`);
      if (!bs.sonicAttack) applySwingEffects(bs.attackerId, bs.defenderId, bs.swingEffectRoll); // CQC = melee only
      applyPendingCombatEffects(bs.attackerId, bs.defenderId);
      clearBattleBuffs(bs.attackerId, bs.defenderId);
      setBattleState(null);
      setDiceDisplay(null);
      return;
    }

    // Defender chose to COUNTER — pre-roll the result, then hand the die to
    // the player to fire it off. The threshold to beat is the attacker's
    // winning swing die (atkRoll): a glancing hit (margin ≤ 2) means it's a
    // genuine, viable swing-back rather than a near-impossible stat wall.
    const defender   = spirits.find(s => s.id === bs.defenderId);
    const vibeBonus  = Math.round(((defender?.vibe ?? 1) / (defender?.maxVibe ?? 1)) * 3);
    const counterRoll  = randD6();
    const counterTotal = counterRoll + vibeBonus;
    const target       = bs.atkRoll ?? Math.max(1, (bs.atkTotal ?? 6) - (bs.atkStat ?? 0));
    const counterSuccess = counterTotal >= target;

    addLog(`🥊 ${defender?.name} winds up for a COUNTER — needs to out-swing a ${target}!`);
    setBattleState(prev => prev ? {
      ...prev,
      phase: 'retaliation_spin',
      counterRoll, vibeBonus, counterTotal, counterTarget: target, counterSuccess,
      counterFace: randD6(), counterReady: false,
    } : prev);

    // Spin the counter die's face until the player clicks it (mirrors def_die_spin)
    const spinIv = setInterval(() => {
      setBattleState(p => {
        if (!p || p.phase !== 'retaliation_spin') { clearInterval(spinIv); return p; }
        return { ...p, counterFace: randD6() };
      });
    }, 90);
  }

  // Player clicked the counter die — decelerate it onto the pre-rolled value,
  // then reveal the result. Mirrors handleAtkDieClick / handleDefDieClick.
  function handleCounterDieClick() {
    setBattleState(prev => {
      if (!prev || prev.phase !== 'retaliation_spin') return prev;
      return { ...prev, phase: 'retaliation_settling' };
    });
    let steps = 0;
    const maxSteps = 10;
    function tick() {
      steps++;
      const progress = steps / maxSteps;
      const interval = 60 + progress * 340; // 60ms → 400ms
      setBattleState(p => {
        if (!p || p.phase !== 'retaliation_settling') return p;
        const target = p.counterRoll ?? 1;
        const face = steps >= maxSteps ? target
          : steps >= maxSteps - 2 ? ((target % 6) + 1)
          : randD6();
        return { ...p, counterFace: Math.max(1, Math.min(6, face)), counterReady: steps >= maxSteps };
      });
      if (steps < maxSteps) setTimeout(tick, interval);
      else setTimeout(finishCounter, 700); // beat to read the total, then resolve
    }
    setTimeout(tick, 60);
  }

  // Apply the counter outcome and surface the result banner. Effects land once
  // here; the overlay then auto-closes (or the player taps ROCK ON).
  function finishCounter() {
    const bs = battleStateRef.current;
    if (!bs || bs.phase !== 'retaliation_settling') return;
    const atkName = spirits.find(s => s.id === bs.attackerId)?.name;
    const defName = spirits.find(s => s.id === bs.defenderId)?.name;

    if (bs.counterSuccess) {
      const counterMargin = Math.max(1, bs.counterTotal - bs.counterTarget + 1);
      const counterDmg = marginToDamage(counterMargin);
      addLog(`💥 COUNTER LANDS! ${defName} swings back — ${counterDmg} Vibe dmg to ${atkName}!`);
      resolveWinDamage(bs.defenderId, bs.attackerId, counterDmg, 'counter');
      awardFame(bs.defenderId, counterMargin);
      battleKnockback(bs.defenderId, bs.attackerId, 1);
      setBattleState(prev => prev ? { ...prev, phase: 'retaliation_result', counterDmg, counterMargin } : prev);
    } else {
      // Whiffed the counter — caught worse than if they'd just absorbed it
      const extraDmg = marginToDamage(bs.margin + 2);
      addLog(`💔 COUNTER FAILS! ${defName} is caught swinging — ${extraDmg} Vibe dmg!`);
      if (bs.pendingPush) battleKnockback(bs.attackerId, bs.defenderId, knockbackSpaces(bs));
      resolveWinDamage(bs.attackerId, bs.defenderId, extraDmg, 'failed_counter');
      awardFame(bs.attackerId, bs.margin + 2);
      if (!bs.sonicAttack) applySwingEffects(bs.attackerId, bs.defenderId, bs.swingEffectRoll); // CQC = melee only
      applyPendingCombatEffects(bs.attackerId, bs.defenderId);
      setBattleState(prev => prev ? { ...prev, phase: 'retaliation_result', counterDmg: extraDmg, counterMargin: 0 } : prev);
    }
    clearBattleBuffs(bs.attackerId, bs.defenderId);

    // Auto-close after the player reads the result (guarded against double-close)
    setTimeout(() => {
      const cur = battleStateRef.current;
      if (cur && cur.phase === 'retaliation_result') { setBattleState(null); setDiceDisplay(null); }
    }, 4200);
  }

  // roadieSelectHex — used for MOVE AMP flow: player clicks a hex, then a direction
  function roadieSelectHex(hexNum) {
    if (!roadieAction || roadieAction.phase !== 'selectHex') return;
    setRoadieAction(prev => ({ ...prev, phase: 'selectDir', adjHexNum: hexNum }));
    addLog(`🔧 Roadie at hex #${hexNum} — click a direction hex to move the Amp`);
  }

  // roadieStartFix — used for FIX CABLE flow: player picks which unplugged amp to fix
  function roadieStartFix(spiritId, roadieId) {
    const unpluggedAmps = amps.filter(a => a.ownerId === spiritId && a.unplugged);
    if (unpluggedAmps.length === 0) {
      addLog('🔧 No unplugged amps to fix!');
      return;
    }
    if (unpluggedAmps.length === 1) {
      // Only one — go straight to confirm
      setRoadieAction({ spiritId, roadieId, phase: 'replug', ampId: unpluggedAmps[0].id });
      addLog(`🔧 Roadie ready to replug Amp on #${unpluggedAmps[0].hexNum} — confirm!`);
    } else {
      // Multiple — let player pick (phase: 'pickAmp')
      setRoadieAction({ spiritId, roadieId, phase: 'pickAmp' });
      addLog(`🔧 Multiple unplugged amps — click one to fix`);
    }
  }

  function confirmRoadieReplug() {
    if (!roadieAction || roadieAction.phase !== 'replug') return;
    const { spiritId, roadieId, ampId } = roadieAction;
    roadieReplugAmp(spiritId, ampId);
    // Put roadie on cooldown
    setNoteStates(prev => {
      const s = prev[spiritId];
      if (!s) return prev;
      return {
        ...prev,
        [spiritId]: {
          ...s,
          roadies: (s.roadies ?? []).map(r =>
            r.id === roadieId ? { ...r, cooldownTurns: 2 } : r
          ),
        },
      };
    });
    setRoadieAction(null);
  }


  function roadieMoveAmp(dirHexNum) {
    if (!roadieAction || roadieAction.phase !== 'selectDir') return;
    const { spiritId, roadieId } = roadieAction;
    // Find amp adjacent to adjHexNum
    const adjHex = HEX_BY_NUM[roadieAction.adjHexNum];
    if (!adjHex) { setRoadieAction(null); return; }
    const ampHere = amps.find(a => {
      const ah = HEX_BY_NUM[a.hexNum];
      if (!ah) return false;
      return getFlatTopNeighborSlots(adjHex).some(n => n.num === a.hexNum) || a.hexNum === adjHex.num;
    });
    if (!ampHere) { addLog('🔧 No amp found — roadie action cancelled'); setRoadieAction(null); return; }

    // Move amp 2 hexes toward dirHexNum from its current position
    const ampHex = HEX_BY_NUM[ampHere.hexNum];
    const dirHex = HEX_BY_NUM[dirHexNum];
    if (!ampHex || !dirHex) { setRoadieAction(null); return; }

    // Step 1: nearest neighbor toward direction
    const step1 = neighborInDirection(ampHex, Math.atan2(dirHex.py - ampHex.py, dirHex.px - ampHex.px));
    // Step 2: another step in same direction from step1
    const step2 = step1 ? neighborInDirection(step1, Math.atan2(dirHex.py - ampHex.py, dirHex.px - ampHex.px)) : null;
    const finalHex = step2 ?? step1 ?? ampHex;

    const spirit = spirits.find(s => s.id === spiritId);
    const spiritHex = spirit ? HEX_BY_NUM[spirit.num] : null;

    // ── Spawn roadie slide animation ──────────────────────────────────────────
    const animId = `roadie-anim-${Date.now()}`;
    setRoadieAnimations(prev => [...prev, {
      id: animId,
      fromHex: spiritHex ?? ampHex,
      toAmpHex: ampHex,
      toFinalHex: finalHex,
      spiritColor: spirit?.color ?? '#ff8800',
      spiritName: spirit?.name ?? 'Roadie',
      startTime: Date.now(),
    }]);
    // Clear animation after it completes (2.8s total)
    setTimeout(() => {
      setRoadieAnimations(prev => prev.filter(a => a.id !== animId));
    }, 2800);

    setAmps(prev => prev.map(a => a.id === ampHere.id ? { ...a, hexNum: finalHex.num, connected: false, connectedBy: null } : a));

    // Put roadie on cooldown (2 turns) and remove from board
    setNoteStates(prev => {
      const s = prev[spiritId];
      if (!s) return prev;
      return {
        ...prev,
        [spiritId]: {
          ...s,
          roadies: (s.roadies ?? []).map(r =>
            r.id === roadieId ? { ...r, cooldownTurns: 2, onBoard: false, boardHex: null } : r
          ),
        },
      };
    });

    // Flavor log
    const flavorLines = [
      `🔧 ${spirit?.name}'s Roadie sprints out, grabs the cab, shoves it to hex #${finalHex.num} — gone before anyone noticed! (cooldown 2t)`,
      `🔧 ${spirit?.name}'s crew member dashes onto stage, kicks the Amp to hex #${finalHex.num}, then vanishes into the wings. (cooldown 2t)`,
      `🔧 A roadie for ${spirit?.name} hauls the cabinet across the floor to hex #${finalHex.num} — quick work! (cooldown 2t)`,
    ];
    addLog(flavorLines[Math.floor(Math.random() * flavorLines.length)]);
    setRoadieAction(null);
  }

  // ─── END TURN ────────────────────────────────────────────────────────────────
  function endTurn() {
    const s = spirits.find(sp => sp.id === acting.id);

    // ── LIMELIGHT POSE CHECK ──────────────────────────────────────────────────
    // A pose turn counts if: posing, started the turn on limelight, AND ends on limelight
    const lostLimelightStart = !startedOnLimelight[acting.id];
    if (posing[acting.id] && acting.num === LIMELIGHT_HEX && !lostLimelightStart) {
      setLimelightScores(prev => {
        const newScore = (prev[acting.id] ?? 0) + 1;
        const updated = { ...prev, [acting.id]: newScore };
        addLog(`🎤 ${s.name} holds the Limelight! (${newScore}/${LIMELIGHT_TO_WIN})`);
        if (newScore >= LIMELIGHT_TO_WIN) {
          setTimeout(() => setWinner(acting.id), 0);
        }
        return updated;
      });
    } else if (posing[acting.id] && acting.num === LIMELIGHT_HEX && lostLimelightStart) {
      // Ended on limelight but didn't START there — no point, warn
      addLog(`🎤 ${s.name} must start AND end their turn on the Limelight to score!`);
      setPosing(prev => ({ ...prev, [acting.id]: false }));
    } else if (posing[acting.id] && acting.num !== LIMELIGHT_HEX) {
      // Was posing but left the hex — pose doesn't count, clear pose flag
      setPosing(prev => ({ ...prev, [acting.id]: false }));
    }

    setMoveStepsLeft(0);
    setMovedThisTurn(false);
    setAction(null);
    setActionTokenUsed(false);
    setBattleState(null);
    setDiceDisplay(null);
    setRetaliationTimer(null);

    // ── END-OF-TURN DEBUFF TICK ──────────────────────────────────────────────
    // Physical debuffs (tripped / dazed / dropped instrument) and timed effects
    // (Mojo Drain, Stagger) wear off at the END of your own turn — after you've
    // actually suffered them for a turn. (They used to be cleared at the START
    // of your turn, which meant they never did anything.)
    setNoteStates(prev => {
      const ns = prev[acting.id];
      if (!ns) return prev;
      const hadDebuff = ns.tripped || ns.dazed || ns.instrumentDropped
        || (ns.mojoDrain ?? 0) > 0 || ns.stagger;
      if (!hadDebuff) return prev;
      const newMojoDrain = Math.max(0, (ns.mojoDrain ?? 0) - 1);
      let newStagger = null;
      if (ns.stagger && ns.stagger.turnsLeft > 1) {
        newStagger = { ...ns.stagger, turnsLeft: ns.stagger.turnsLeft - 1 };
      }
      return { ...prev, [acting.id]: {
        ...ns,
        tripped:           false,
        dazed:             false,
        instrumentDropped: false,
        mojoDrain:         newMojoDrain,
        stagger:           newStagger,
      }};
    });

    // ── 🎤 FAN ECONOMY TICK ──────────────────────────────────────────────────
    // Positional boredom: fans drift only after lingering on the outer edge; tick recovery lag.
    tickFans(acting.id, acting.num);

    // ── SPOTLIGHT HEAL CHECK ──────────────────────────────────────────────────
    if (acting.num === spotlightHex && !acting.knockedOut) {
      setSpirits(prev => prev.map(sp =>
        sp.id === acting.id
          ? { ...sp, vibe: Math.min(sp.maxVibe, (sp.vibe ?? 0) + 1) }
          : sp
      ));
      addLog(`💡 ${s.name} steps into the spotlight — +1 Vibe!`);
    }

    // ── SPOTLIGHT MOVE: advance every full round ───────────────────────────
    const newTurnCount = turnCount + 1;
    setTurnCount(newTurnCount);
    if (newTurnCount % spirits.filter(sp => !sp.knockedOut).length === 0) {
      setSpotlightHex(prev => {
        const occupied = new Set(spirits.map(sp => sp.num));
        const pool = SPOTLIGHT_POOL.filter(n => n !== prev && !occupied.has(n));
        const pick = pool[Math.floor(Math.random() * pool.length)];
        addLog(`💡 The spotlight shifts to hex #${pick}!`);
        return pick;
      });
      // ── FAME SPARKS: scatter fresh sparks each full round (up to SPARK_MAX) ──
      setSparkHexes(prev => {
        if (prev.length >= SPARK_MAX) return prev;
        const occupied = new Set([
          ...spirits.filter(sp => !sp.knockedOut).map(sp => sp.num),
          ...amps.map(a => a.hexNum),
          ...boardCards.map(c => c.hexNum),
          ...eventHexes, ...prev, spotlightHex, LIMELIGHT_HEX,
        ]);
        const pool = ALL_HEXES.filter(h => !occupied.has(h.num)).map(h => h.num);
        const out = [...prev];
        for (let i = 0; i < 2 && out.length < SPARK_MAX && pool.length > 0; i++) {
          const k = Math.floor(Math.random() * pool.length);
          out.push(pool.splice(k, 1)[0]);
        }
        if (out.length > prev.length) addLog(`✨ Fresh Fame Sparks glitter across the stage!`);
        return out;
      });
      // ── DISCO INFERNO: flames die down one round per full round ──────────
      setFlamingHexes(prev => {
        if (prev.roundsLeft <= 0) return prev;
        const left = prev.roundsLeft - 1;
        if (left <= 0) {
          addLog(`🔥💿 The flaming discs finally burn out. The stage is clear!`);
          return { hexes: [], roundsLeft: 0 };
        }
        addLog(`🔥💿 The discs still burn — ${left} round${left !== 1 ? 's' : ''} left.`);
        return { ...prev, roundsLeft: left };
      });
    }

    // Advance queue first so we know who acts next, then replenish their used slots
    setTurnQueue(q => {
      const newQ = advanceTurnQueue(q, spirits, mode, teams);
      const nextId = newQ[0];
      if (nextId) {
        startNewTurnNotes(nextId);
        // Pulse the next spirit's current hex briefly
        const nextSpirit = spirits.find(s => s.id === nextId);
        if (nextSpirit) {
          setPulsingHex(nextSpirit.num);
          setTimeout(() => setPulsingHex(null), 1800);
        }
      }
      return newQ;
    });
    addLog(`⏭ ${s.name} ends turn`);

    // Event marquee respawn countdown
    setEventRespawnIn(prev => {
      if (prev <= 0) return 0;
      const next = prev - 1;
      if (next <= 0) {
        setTimeout(() => spawnEventHex(), 60);
        return 0;
      }
      return next;
    });

    // Board card respawn countdown
    setCardRespawnIn(prev => {
      const next = prev - 1;
      if (next <= 0) {
        // Respawn after a tick so spirits/amps state is settled
        setTimeout(() => {
          setBoardCards(cur => spawnBoardCards(cur, spirits, amps));
        }, 50);
        return 2; // reset timer
      }
      return next;
    });
  }

  // ─── KNOCK OUT ────────────────────────────────────────────────────────────────
  function knockOut(tgtId, atkId, pushAngle) {
    const tgt = spirits.find(s => s.id === tgtId);
    const livesLeft = (tgt?.lives ?? 1) - 1;
    const willRespawn = livesLeft > 0;

    function applyKnockOut(p) {
      if (willRespawn) {
        const homeNum = tgt.corner ? CORNERS[tgt.corner]?.homeNum : tgt.num;
        const newFacing = tgt.corner ? cornerFacing(homeNum) : tgt.facing;
        return p.map(s => s.id !== tgtId ? s : {
          ...s, lives: livesLeft, num: homeNum, facing: newFacing,
          vibe: s.maxVibe,
        });
      }
      return p.map(s => s.id === tgtId ? { ...s, lives: 0, knockedOut: true } : s);
    }

    function checkWinner(updated) {
      const survivors = updated.filter(s => !s.knockedOut);
      if (survivors.length === 1) setTimeout(() => setWinner(survivors[0].id), 0);
      else if (survivors.length === 0 && atkId) {
        const atk = updated.find(s => s.id === atkId && !s.knockedOut);
        if (atk) setTimeout(() => setWinner(atk.id), 0);
      }
    }

    if (tgt) {
      const tgtHex = HEX_BY_NUM[tgt.num];
      const centre = HEX_BY_NUM[56];
      if (tgtHex && centre) {
        let flyDx, flyDy;
        if (pushAngle !== undefined) {
          flyDx = Math.cos(pushAngle);
          flyDy = Math.sin(pushAngle);
        } else {
          const rawDx = tgtHex.px - centre.px;
          const rawDy = tgtHex.py - centre.py;
          const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy) || 1;
          flyDx = rawDx / dist;
          flyDy = rawDy / dist;
        }
        const slideAmount = HEX_SIZE * SCALE * 14;
        const dx = flyDx * slideAmount;
        const dy = flyDy * slideAmount;
        const cx2 = Math.round(tgtHex.px * SCALE);
        const cy2 = Math.round(tgtHex.py * SCALE);
        if (!willRespawn) setTurnQueue(q => q.filter(id => id !== tgtId));
        setSlideOffAnimations(prev => ({
          ...prev,
          [tgtId]: { cx: cx2, cy: cy2, dx, dy, color: tgt.color, imageSrc: tgt.imageSrc, name: tgt.name, id: tgtId, corner: tgt.corner },
        }));
        setTimeout(() => {
          setSlideOffAnimations(prev => { const n = { ...prev }; delete n[tgtId]; return n; });
          if (willRespawn) addLog(`💥 ${tgt.name} KNOCKED DOWN! ${livesLeft} ${livesLeft === 1 ? "life" : "lives"} left — respawning!`);
          else addLog(`💀 ${tgt.name} is KO'd!`);
          setSpirits(p => {
            const updated = applyKnockOut(p);
            if (!willRespawn) checkWinner(updated);
            return updated;
          });
          if (willRespawn) {
            // Same Knock Down penalty as a Vibe-loss knockdown: -1 FP + lose next turn.
            setNoteStates(nsPrev => nsPrev[tgtId]
              ? { ...nsPrev, [tgtId]: { ...nsPrev[tgtId], fame: Math.max(0, (nsPrev[tgtId].fame ?? 0) - 1), recovering: true } }
              : nsPrev);
            addLog(`💸 ${tgt.name} loses 1 FP and must recover — skips their next turn.`);
            setRespawnFlashes(prev => ({ ...prev, [tgtId]: true }));
            setTimeout(() => setRespawnFlashes(prev => { const n = { ...prev }; delete n[tgtId]; return n; }), 1200);
          }
        }, 4000);
        return;
      }
    }
    if (!willRespawn) setTurnQueue(q => q.filter(id => id !== tgtId));
    setSpirits(p => {
      const updated = applyKnockOut(p);
      if (!willRespawn) checkWinner(updated);
      return updated;
    });
    if (willRespawn) addLog(`💫 ${tgt?.name} respawns with ${livesLeft} ${livesLeft === 1 ? "life" : "lives"} left!`);
  }

  // ─── HEX CLICK ───────────────────────────────────────────────────────────────
  function onHexClick(num) {
    if (!acting) return;
    // Amp placement mode takes priority
    if (ampPlacing) {
      placeAmp(num);
      return;
    }
    // Roadie: phase 1 — player clicks a hex adjacent to (or on) an amp
    if (roadieAction?.phase === 'selectHex') {
      const clickedHex = HEX_BY_NUM[num];
      if (!clickedHex) return;
      // Valid target: the hex must be occupied by an amp, or be a neighbor of one
      const hasAmpHere    = amps.some(a => a.hexNum === num);
      const hasAmpNearby  = amps.some(a => {
        const ah = HEX_BY_NUM[a.hexNum];
        if (!ah) return false;
        return getFlatTopNeighborSlots(clickedHex).some(n => n.num === a.hexNum);
      });
      if (hasAmpHere || hasAmpNearby) {
        roadieSelectHex(num);
      } else {
        addLog('🔧 Click a hex next to one of your Amps to send the Roadie there.');
      }
      return;
    }
    if (action === "swing") {
      const rivals = acting ? getRivalsInCone(acting) : [];
      const target = rivals.find(r => r.num === num);
      if (target) { initiateSwing(target.id); setAction(null); }
      else addLog("⚔️ That spirit is not in your swing cone!");
      return;
    }
    if (action === "face") {
      if (!acting) return;
      const actingHex = HEX_BY_NUM[acting.num];
      if (!actingHex) return;
      const neighbors = getFlatTopNeighborSlots(actingHex);
      const isNeighbor = neighbors.some(n => n.num === num);
      if (!isNeighbor) { addLog("🔄 Click an adjacent hex to set your facing direction."); return; }
      const targetHex = HEX_BY_NUM[num];
      if (!targetHex) return;
      const newFacing = angleTo(actingHex, targetHex);
      setSpirits(prev => prev.map(s => s.id === acting.id ? { ...s, facing: newFacing } : s));
      setMoveStepsLeft(prev => Math.max(0, prev - 1));
      setAction(null);
      addLog(`🔄 ${acting.name} turns to face hex #${num} (costs 1 step)`);
      return;
    }
    if (action === "sonic") {
      const rivals = acting ? getRivalsInBeam(acting) : [];
      const target = rivals.find(r => r.num === num);
      if (target) { initiateSonicAttack(target.id); setAction(null); }
      else addLog("🔊 That spirit is not in your sonic beam!");
      return;
    }
    if (action === "move") {
      if (reachable.has(num)) move(num);
      else addLog("❌ Can't reach that hex!");
      return;
    }
    const s = spiritByNum[num];
    if (s) addLog(`ℹ️ ${s.name} — ${s.vibe}/${s.maxVibe} Vibe · Hex #${num}`);
  }

  // ─── HEX VISUAL HELPERS ───────────────────────────────────────────────────────
  const HS = Math.round(HEX_SIZE * SCALE * 0.88);

  // Neighbours of acting spirit (used for amp placement highlights)
  const actingNeighbors = useMemo(() => {
    if (!ampPlacing || !acting) return new Set();
    const hex = HEX_BY_NUM[acting.num];
    if (!hex) return new Set();
    const occupied = new Set([
      ...spirits.filter(s => !s.knockedOut).map(s => s.num),
      ...amps.map(a => a.hexNum),
    ]);
    return new Set(
      getFlatTopNeighborSlots(hex)
        .filter(n => !occupied.has(n.num))
        .map(n => n.num)
    );
  }, [ampPlacing, acting, spirits, amps]);

  function hexFill(hex) {
    if (hex.num === LIMELIGHT_HEX) return "#ff44ff18";
    if (hex.num === spotlightHex)  return "#ffffff14";
    const sp = spiritByNum[hex.num];
    if (sp) return sp.color + "44";
    if (ampPlacing && actingNeighbors.has(hex.num)) return "#ffcc4422";
    if (reachable.has(hex.num)) return "#ffffff18";
    // Swing cone highlight
    if (action === 'swing' && acting) {
      const cone = getSwingCone(acting);
      if (cone.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num);
        return isRival ? '#ff333344' : '#ff111122';
      }
    }
    // Sonic beam highlight
    if (action === 'sonic' && acting) {
      const beam = getSonicBeam(acting);
      if (beam.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num);
        return isRival ? '#0066ff44' : '#0033ff18';
      }
    }
    // Face mode: highlight adjacent hexes
    if (action === 'face' && acting) {
      const actingHex = HEX_BY_NUM[acting.num];
      if (actingHex) {
        const neighbors = getFlatTopNeighborSlots(actingHex);
        if (neighbors.some(n => n.num === hex.num)) return '#00ccff22';
      }
    }
    // Roadie selectHex: highlight hexes adjacent to (or on) any amp
    if (roadieAction?.phase === 'selectHex') {
      const hasAmpHere = amps.some(a => a.hexNum === hex.num);
      const hexObj = HEX_BY_NUM[hex.num];
      const hasAmpNearby = hexObj && amps.some(a => {
        const ah = HEX_BY_NUM[a.hexNum];
        if (!ah) return false;
        return getFlatTopNeighborSlots(hexObj).some(n => n.num === a.hexNum);
      });
      if (hasAmpHere || hasAmpNearby) return "#ff880022";
    }
    // Amp range preview on hover: fill hexes within AMP_UNPLUG_DIST of the hovered amp
    if (hovered !== null) {
      const hoveredAmp = amps.find(a => a.hexNum === hovered);
      if (hoveredAmp) {
        const ampHex = HEX_BY_NUM[hoveredAmp.hexNum];
        const thisHex = HEX_BY_NUM[hex.num];
        if (ampHex && thisHex) {
          const dist = axialDist(ampHex.q, ampHex.r, thisHex.q, thisHex.r);
          if (dist <= AMP_UNPLUG_DIST && dist > 0)
            return hoveredAmp.ownerColor + "22";
        }
      }
    }
    return "transparent";
  }

  function hexStroke(hex) {
    if (hex.num === LIMELIGHT_HEX) return "#ff44ff";
    if (hex.num === spotlightHex)  return "#ffffaacc";
    const sp = spiritByNum[hex.num];
    if (sp && acting?.id === sp.id) return sp.color;
    if (sp) return sp.color;
    if (ampPlacing && actingNeighbors.has(hex.num)) return "#ffcc44cc";
    if (reachable.has(hex.num)) return "#ffffff88";
    // Swing cone stroke
    if (action === 'swing' && acting) {
      const cone = getSwingCone(acting);
      if (cone.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num);
        return isRival ? '#ff4444ee' : '#ff222244';
      }
    }
    // Sonic beam stroke
    if (action === 'sonic' && acting) {
      const beam = getSonicBeam(acting);
      if (beam.has(hex.num)) {
        const isRival = spirits.some(s => !s.knockedOut && s.id !== acting.id && s.num === hex.num);
        return isRival ? '#44aaffee' : '#2244ff44';
      }
    }
    // Face mode: adjacent hex stroke
    if (action === 'face' && acting) {
      const actingHex = HEX_BY_NUM[acting.num];
      if (actingHex && getFlatTopNeighborSlots(actingHex).some(n => n.num === hex.num)) {
        return '#00ccffcc';
      }
    }
    // Roadie selectHex: highlight hexes adjacent to (or on) any amp
    if (roadieAction?.phase === 'selectHex') {
      const hasAmpHere = amps.some(a => a.hexNum === hex.num);
      const hexObj = HEX_BY_NUM[hex.num];
      const hasAmpNearby = hexObj && amps.some(a => {
        const ah = HEX_BY_NUM[a.hexNum];
        if (!ah) return false;
        return getFlatTopNeighborSlots(hexObj).some(n => n.num === a.hexNum);
      });
      if (hasAmpHere || hasAmpNearby) return "#ff8800bb";
    }
    if (hovered === hex.num && action) return "#ffffffaa";
    if (hex.stage) return "#ff44ff88";
    // Amp range preview on hover: stroke hexes within AMP_UNPLUG_DIST of the hovered amp
    if (hovered !== null) {
      const hoveredAmp = amps.find(a => a.hexNum === hovered);
      if (hoveredAmp) {
        const ampHex = HEX_BY_NUM[hoveredAmp.hexNum];
        const thisHex = HEX_BY_NUM[hex.num];
        if (ampHex && thisHex) {
          const dist = axialDist(ampHex.q, ampHex.r, thisHex.q, thisHex.r);
          if (dist <= AMP_UNPLUG_DIST && dist > 0)
            return hoveredAmp.ownerColor + "99";
        }
      }
    }
    return "transparent";
  }

  function hexStrokeW(hex) {
    if (hex.num === LIMELIGHT_HEX) return 2;
    const sp = spiritByNum[hex.num];
    if (sp && acting?.id === sp.id) return Math.round(3 / SCALE * 0.13);
    if (sp || reachable.has(hex.num) || hex.stage) return 1.5;
    if (ampPlacing && actingNeighbors.has(hex.num)) return 2;
    return 0.8;
  }

  // ─── RUMBLE & DAMAGE FLOAT ────────────────────────────────────────────────────
  function triggerRumble(spiritId, durationMs = 500) {
    setRumblingIds(prev => new Set([...prev, spiritId]));
    setTimeout(() => setRumblingIds(prev => {
      const next = new Set(prev); next.delete(spiritId); return next;
    }), durationMs);
  }

  function showDamageFloat(spiritId, amount) {
    if (!amount || amount <= 0) return;
    const key = `${spiritId}-${Date.now()}-${Math.random()}`;
    setFloatingDmg(prev => [...prev, { spiritId, amount, key }]);
    setTimeout(() => setFloatingDmg(prev => prev.filter(f => f.key !== key)), 1200);
  }

  // 💥 STATUS-EFFECT BOARD VFX ─────────────────────────────────────────────────
  // Pulsing shockwave rings + a floating neon label around a spirit's standee —
  // fired the moment an ability lands so it's unmistakable WHO got hit by WHAT.
  function triggerEffectFlash(spiritId, icon, label, color, durationMs = 2800) {
    const key = `fx-${spiritId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setEffectFlashes(prev => [...prev, { key, spiritId, icon, label, color }]);
    triggerRumble(spiritId, 350);
    setTimeout(() => setEffectFlashes(prev => prev.filter(f => f.key !== key)), durationMs);
  }

  // ─── CAMERA ZOOM ──────────────────────────────────────────────────────────────
  const animatedVBRef = useRef(null);
  const vbAnimRef     = useRef(null);

  useEffect(() => {
    const W = SVG_W, H = SVG_H;
    const fullVB = `0 0 ${W} ${H}`;
    if (!animatedVBRef.current) {
      animatedVBRef.current = fullVB;
      if (svgRef.current) svgRef.current.setAttribute("viewBox", fullVB);
    }
    let targetVB = fullVB;
    if (cameraView) {
      const { cx, cy, padW, padH } = cameraView;
      const sx = cx * SCALE, sy = cy * SCALE;
      const sw = padW * SCALE, sh = padH * SCALE;
      const aspect = W / H;
      const wFromH = sh * aspect;
      const hFromW = sw / aspect;
      const fw = Math.max(sw, wFromH);
      const fh = Math.max(sh, hFromW);
      targetVB = `${sx - fw/2} ${sy - fh/2} ${fw} ${fh}`;
    }
    const parse = s => s.split(" ").map(Number);
    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpVB = (from, to, t) => from.map((v, i) => lerp(v, to[i], t));
    const format = v => v.map(n => n.toFixed(2)).join(" ");
    if (vbAnimRef.current) cancelAnimationFrame(vbAnimRef.current);
    const start = performance.now();
    const duration = 380;
    const fromVB = parse(animatedVBRef.current);
    const toVB = parse(targetVB);
    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const ease = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
      const current = lerpVB(fromVB, toVB, ease);
      const vbStr = format(current);
      animatedVBRef.current = vbStr;
      if (svgRef.current) svgRef.current.setAttribute("viewBox", vbStr);
      if (t < 1) vbAnimRef.current = requestAnimationFrame(tick);
    }
    vbAnimRef.current = requestAnimationFrame(tick);
    return () => { if (vbAnimRef.current) cancelAnimationFrame(vbAnimRef.current); };
  }, [cameraView]); // eslint-disable-line

  useEffect(() => {
    if (!cameraView && manualVBRef.current) {
      const str = manualVBRef.current.map(n => n.toFixed(2)).join(" ");
      animatedVBRef.current = str;
      if (svgRef.current) svgRef.current.setAttribute("viewBox", str);
    }
  }, [cameraView]);

  function zoomReset(delay = 0) {
    setTimeout(() => setCameraView(null), delay);
  }

  // ─── MANUAL ZOOM/PAN ─────────────────────────────────────────────────────────
  function clientToSVG(evt) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vbParts = animatedVBRef.current?.split(" ").map(Number) ?? [0, 0, SVG_W, SVG_H];
    const [vx, vy, vw, vh] = vbParts;
    const scaleX = vw / rect.width;
    const scaleY = vh / rect.height;
    return {
      x: vx + (evt.clientX - rect.left) * scaleX,
      y: vy + (evt.clientY - rect.top)  * scaleY,
    };
  }

  function applyManualVB(vb) {
    manualVBRef.current = vb;
    const str = vb.map(n => n.toFixed(2)).join(" ");
    animatedVBRef.current = str;
    if (svgRef.current) svgRef.current.setAttribute("viewBox", str);
    setManualZoomActive(true);
  }

  function resetManualZoom() {
    manualVBRef.current = null;
    setManualZoomActive(false);
    const fullVB = `0 0 ${SVG_W} ${SVG_H}`;
    animatedVBRef.current = fullVB;
    if (svgRef.current) svgRef.current.setAttribute("viewBox", fullVB);
  }

  function handleBoardWheel(evt) {
    evt.preventDefault();
    const vbParts = animatedVBRef.current?.split(" ").map(Number) ?? [0, 0, SVG_W, SVG_H];
    let [vx, vy, vw, vh] = vbParts;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = vx + (evt.clientX - rect.left) * (vw / rect.width);
    const my = vy + (evt.clientY - rect.top)  * (vh / rect.height);
    const factor = evt.deltaY < 0 ? 0.85 : 1 / 0.85;
    const newW = Math.min(SVG_W, Math.max(SVG_W * 0.15, vw * factor));
    const newH = Math.min(SVG_H, Math.max(SVG_H * 0.15, vh * factor));
    if (newW >= SVG_W || newH >= SVG_H) {
      applyManualVB([0, 0, SVG_W, SVG_H]);
      return;
    }
    const newX = mx - (mx - vx) * (newW / vw);
    const newY = my - (my - vy) * (newH / vh);
    const clampedX = Math.max(0, Math.min(SVG_W - newW, newX));
    const clampedY = Math.max(0, Math.min(SVG_H - newH, newY));
    applyManualVB([clampedX, clampedY, newW, newH]);
  }

  function handleBoardMouseDown(evt) {
    if (evt.button === 1 || evt.button === 2 || (evt.button === 0 && !action)) {
      const vbParts = animatedVBRef.current?.split(" ").map(Number) ?? [0, 0, SVG_W, SVG_H];
      isPanningRef.current = true;
      panStartRef.current = { clientX: evt.clientX, clientY: evt.clientY, vb: vbParts };
      evt.preventDefault();
    }
  }

  function handleBoardMouseMove(evt) {
    if (!isPanningRef.current || !panStartRef.current) return;
    const { clientX: sx, clientY: sy, vb } = panStartRef.current;
    const [vx, vy, vw, vh] = vb;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (sx - evt.clientX) * (vw / rect.width);
    const dy = (sy - evt.clientY) * (vh / rect.height);
    const newX = Math.max(0, Math.min(SVG_W - vw, vx + dx));
    const newY = Math.max(0, Math.min(SVG_H - vh, vy + dy));
    applyManualVB([newX, newY, vw, vh]);
  }

  function handleBoardMouseUp() {
    isPanningRef.current = false;
    panStartRef.current = null;
  }

  // ─── CSS KEYFRAMES ────────────────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes rumble {
        0%   { transform: translate(0px, 0px); }
        15%  { transform: translate(-3px, 2px); }
        30%  { transform: translate(3px, -2px); }
        45%  { transform: translate(-2px, -3px); }
        60%  { transform: translate(2px, 3px); }
        75%  { transform: translate(-3px, 1px); }
        90%  { transform: translate(3px, -1px); }
        100% { transform: translate(0px, 0px); }
      }
      @keyframes floatUp {
        0%   { transform: translateY(0px);    opacity: 1; }
        60%  { transform: translateY(-18px);  opacity: 1; }
        100% { transform: translateY(-32px);  opacity: 0; }
      }
      @keyframes slideOff {
        0%   { opacity: 1; }
        30%  { opacity: 0.9; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily:"'Share Tech Mono','Courier New',monospace",
      background:"radial-gradient(ellipse at 50% -10%, #0a1226 0%, #050810 55%)",
      color:"#e2e8f0", minHeight:"100vh", display:"flex", flexDirection:"column", padding:10, boxSizing:"border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700&display=swap" rel="stylesheet"/>

      {/* ── GAME OVER OVERLAY ── */}
      {winner && (() => {
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
      })()}

      <style>{`
        * { box-sizing:border-box }
        /* ── FULL-BLEED LAYOUT ──────────────────────────────────────────────
           Vite's starter index.css centers #root with max-width:1280px and
           padding, which squeezes the whole game into a centered strip and
           starves the HUD columns (the loadout column then wraps on top of
           the spirit portrait). Override it so the game spans the viewport. */
        #root, #app, body, html {
          max-width: none !important;
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          text-align: initial !important;
        }
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2d3748;border-radius:2px}
        .btn{background:#0a1020;border:1px solid #1e3a5f;color:#c0d0e0;padding:4px 8px;border-radius:3px;cursor:pointer;font-family:inherit;font-size:10px;transition:all .15s;white-space:nowrap}
        .btn{transition:all .12s}
        .btn:hover{background:#152030;transform:translateY(-1px);box-shadow:0 2px 8px #00000066}.btn.on{background:#1a3560;border-color:#4488ff;color:#88bbff}
        .btn:disabled{opacity:.3;cursor:not-allowed}
        .btn.end{border-color:#cc8800;color:#ffaa22}
        .bar{background:#0d1a2a;border-radius:2px;height:5px}
        .bar-f{height:5px;border-radius:2px;transition:width .3s}
        .pip{display:inline-block;width:9px;height:9px;border-radius:50%;margin:1px;border:1px solid #1e3a5f}
        .card{position:relative;background:linear-gradient(180deg,#091020 0%,#070d1a 100%);border-radius:8px;padding:7px 9px;border:1px solid #1a2a40;margin-bottom:6px;box-shadow:inset 0 1px 0 #ffffff08}
        /* ── HUD NEON GLOW ── (see NeonStrikeFX) — gentle fade in, hold, fade out */
        @keyframes hud-neon-pulse {
          0%   { opacity: 0; }
          35%  { opacity: 1; }
          60%  { opacity: 0.8; }
          100% { opacity: 0; }
        }
        .stitle{font-family:'Orbitron',sans-serif;font-size:8px;color:#5a7a9a;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;display:flex;align-items:center;gap:6}
        .stitle::before{content:'';width:3px;height:9px;border-radius:2px;background:linear-gradient(180deg,#f6ad55,#ff6644);box-shadow:0 0 6px #f6ad5566}
        /* Hexagonal note chips — pointy-top, matching the board.
           .hexw = outer shell (background acts as the border), .hexi = inner fill */
        .hexw{clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;padding:1.5px;flex-shrink:0;box-sizing:border-box}
        .hexi{clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);width:100%;height:100%;display:flex;align-items:center;justify-content:center}
        *::-webkit-scrollbar{width:7px;height:7px}
        *::-webkit-scrollbar-track{background:#070d18}
        *::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:4px}
        *::-webkit-scrollbar-thumb:hover{background:#2a5080}
        .hex-g{cursor:pointer}
        .hex-g:hover polygon{filter:brightness(1.4)}
        @keyframes outline-pulse {
          0%,100% { opacity: 0.80; filter: brightness(1.0) drop-shadow(0 0 3px #ff00ee) drop-shadow(0 0 8px #cc00cc); }
          50%     { opacity: 1.00; filter: brightness(1.55) drop-shadow(0 0 10px #ff44ff) drop-shadow(0 0 22px #ff00ff) drop-shadow(0 0 40px #aa00aa); }
        }
        @keyframes outline-pulse-soft {
          0%,100% { opacity: 0.30; }
          50%     { opacity: 0.65; }
        }
        @keyframes hex-turn-pulse {
          0%   { opacity: 0; }
          15%  { opacity: 0.9; }
          70%  { opacity: 0.7; }
          100% { opacity: 0; }
        }
        @keyframes roadie-run {
          0%   { opacity: 0; transform: scale(0.5); }
          12%  { opacity: 1; transform: scale(1.1); }
          85%  { opacity: 1; transform: scale(1.0); }
          100% { opacity: 0; transform: scale(0.6); }
        }
        @keyframes roadie-label-fade {
          0%   { opacity: 0; }
          20%  { opacity: 1; }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes card-float {
          0%,100% { transform: translateY(0px);   }
          50%     { transform: translateY(-5px);  }
        }
        @keyframes eventTicketIn {
          0%   { opacity: 0; transform: scale(0.7) rotate(-3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes marqueeBlink {
          0%,100% { opacity: 0.25; }
          50%     { opacity: 1; }
        }
        @keyframes eventDiePop {
          0%   { transform: scale(0.3) rotate(-20deg); opacity: 0; }
          70%  { transform: scale(1.15) rotate(4deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes event-hex-pulse {
          0%,100% { opacity: 0.55; filter: drop-shadow(0 0 3px currentColor); }
          50%     { opacity: 1;    filter: drop-shadow(0 0 9px currentColor); }
        }
        @keyframes flame-flicker {
          0%,100% { transform: scale(1)    rotate(-2deg); opacity: 0.9; }
          30%     { transform: scale(1.12) rotate(2deg);  opacity: 1;   }
          60%     { transform: scale(0.94) rotate(-1deg); opacity: 0.85;}
          80%     { transform: scale(1.07) rotate(1deg);  opacity: 1;   }
        }
        @keyframes crew-ready-glow {
          0%,100% { box-shadow: 0 0 3px currentColor; }
          50%     { box-shadow: 0 0 9px currentColor; }
        }
        @keyframes cadence-gold-pulse {
          0%,100% { filter: drop-shadow(0 0 3px #ffd70088); }
          50%     { filter: drop-shadow(0 0 9px #ffd700) drop-shadow(0 0 16px #ffd70055); }
        }
        @keyframes fx-ring {
          0%   { transform: scale(0.55); opacity: 0.95; }
          100% { transform: scale(2.6);  opacity: 0; }
        }
        @keyframes fx-label {
          0%   { opacity: 0; transform: translateY(10px) scale(0.7); }
          12%  { opacity: 1; transform: translateY(0) scale(1.15); }
          22%  { opacity: 1; transform: translateY(0) scale(1); }
          78%  { opacity: 1; transform: translateY(-7px) scale(1); }
          100% { opacity: 0; transform: translateY(-16px) scale(0.95); }
        }
        @keyframes affliction-pulse {
          0%,100% { opacity: 0.30; }
          50%     { opacity: 0.85; }
        }
        /* 🎤 Fans bobbing at a Spirit's home turf — holds still, then a gentle sway */
        @keyframes fan-bob {
          0%, 55%, 100% { transform: translateY(0px); }
          72%           { transform: translateY(-2.6px); }
          86%           { transform: translateY(-0.9px); }
        }
        /* 🎤 Centre stage energy — throb the glow without overriding opacity */
        @keyframes stage-throb {
          0%,100% { filter: drop-shadow(0 0 2px #ff3399); }
          50%     { filter: drop-shadow(0 0 8px #ff3399); }
        }
        .board-outline-img  { animation: outline-pulse      5s ease-in-out infinite; }
        .board-outline-glow { animation: outline-pulse-soft  5s ease-in-out infinite; }
        /* 🤘 Master of Moshpits — fans flooding the board bob & jostle the rival */
        @keyframes moshpit-bob {
          0%,100% { transform: translateY(0) rotate(var(--mosh-tilt, 0deg)); }
          50%     { transform: translateY(-7px) rotate(calc(var(--mosh-tilt, 0deg) * -1)); }
        }
        @keyframes moshpit-pop {
          0%   { opacity: 0; transform: scale(0.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes moshpit-shudder {
          0%,100% { transform: translate(0,0); }
          25%     { transform: translate(-2px,1px); }
          50%     { transform: translate(2px,-1px); }
          75%     { transform: translate(-1px,2px); }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8,paddingBottom:7,borderBottom:"1px solid #1a2a40"}}>
        <span style={{fontFamily:"'Orbitron',sans-serif",fontSize:17,color:"#f6ad55",letterSpacing:3,
          textShadow:"0 0 12px #f6ad5566, 0 0 28px #f6ad5522"}}>⚡ RLSW</span>
        <span style={{fontSize:10,color:"#3a5a7a"}}>v3.6</span>
        <button onClick={() => setShowRiffbook(true)} title="The Riffbook — legendary riffs hidden in the note system"
          style={{fontFamily:'inherit', fontSize:9, padding:'2px 9px', cursor:'pointer',
            background:'#14110a', border:'1px solid #ffd70066', borderRadius:10, color:'#ffd700'}}>
          📖 RIFFBOOK {Object.keys(riffBook).length}/{RIFF_LIBRARY.length}
        </button>
        {(() => {
          // Show only when the acting Spirit has an exclusive (spiritOnly) route.
          const sigRoute = acting ? SKILL_TREE.routes.find(r => r.spiritOnly === acting.id) : null;
          if (!sigRoute) return null;
          return (
            <button onClick={() => setSignatureSpirit(acting.id)}
              title={`${acting.name}'s signature abilities`}
              style={{fontFamily:'inherit', fontSize:9, padding:'2px 9px', cursor:'pointer',
                background:'#0a1424', border:`1px solid ${sigRoute.color}88`, borderRadius:10, color:sigRoute.color}}>
              {sigRoute.icon} {acting.name?.split(' ')[0]?.toUpperCase()} ABILITIES
            </button>
          );
        })()}
        <span style={{fontSize:9, padding:'2px 9px', background:'#0a1020', border:'1px solid #1e3a5f',
          borderRadius:10, color:'#6a8aaa'}} title="First spirit to reach the Fame target wins">
          🏆 first to ⭐{FAME_TO_WIN} FP wins
        </span>
        {flamingHexes.roundsLeft > 0 && (
          <span style={{fontSize:9,padding:"2px 8px",background:"#1a0800",border:"1px solid #ff6622",borderRadius:10,color:"#ff8844",
            animation:"marqueeBlink 1.4s ease-in-out infinite"}}>
            🔥💿 DISCO INFERNO — {flamingHexes.roundsLeft} round{flamingHexes.roundsLeft!==1?"s":""} left
          </span>
        )}
        {mode === "team" && (
          <span style={{fontSize:9,padding:"2px 8px",background:"#1a0a30",border:"1px solid #aa55ff",borderRadius:10,color:"#cc99ff"}}>
            🤝 {spirits.filter(s=>teams.a.includes(s.corner)).map(s=>s.name.split(" ")[0]).join("+")} vs {spirits.filter(s=>teams.b.includes(s.corner)).map(s=>s.name.split(" ")[0]).join("+")}
          </span>
        )}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {action === "move" && (
            <span style={{fontSize:10,padding:"2px 8px",background:"#1a2a00",border:"1px solid #aacc00",borderRadius:10,color:"#ccff44"}}>
              👆 Click a lit hex to move ({moveStepsLeft} step{moveStepsLeft !== 1 ? "s" : ""} left)
            </span>
          )}
          <span style={{fontSize:10,padding:"2px 10px",background:"#0a1020",border:"1px solid #f6ad55",borderRadius:10,color:"#f6ad55"}}>
            ▶ {acting?.name}
          </span>
          {/* BGM Controls */}
          <div style={{display:"flex",alignItems:"center",gap:4,background:"#0a1020",border:"1px solid #1e3a5f",borderRadius:4,padding:"2px 6px"}}>
            <span style={{fontSize:8,color:"#3a5a7a",letterSpacing:1}}>BGM</span>
            <span style={{fontSize:8,color:"#4488ff",minWidth:16,textAlign:"center"}}>{bgmTrackNum}</span>
            <button onClick={() => setBgmMuted(m => !m)}
              style={{fontFamily:"inherit",fontSize:10,padding:"1px 4px",background:"none",border:"none",color:bgmMuted?"#ff4444":"#88bbff",cursor:"pointer",lineHeight:1}}>
              {bgmMuted ? "🔇" : "🔊"}
            </button>
            <input type="range" min={0} max={1} step={0.05} value={bgmVolume}
              onChange={e => setBgmVolume(parseFloat(e.target.value))}
              style={{width:40,accentColor:"#4488ff",cursor:"pointer"}}/>
            <button onClick={bgmSkip}
              style={{fontFamily:"inherit",fontSize:9,padding:"1px 4px",background:"none",border:"none",color:"#3a5a7a",cursor:"pointer",lineHeight:1}}>
              ⏭
            </button>
          </div>
          <button onClick={onReturnToLobby}
            style={{fontFamily:"inherit",fontSize:9,padding:"3px 8px",background:"#0a1020",border:"1px solid #1e3a5f",borderRadius:4,color:"#3a5a7a",cursor:"pointer"}}>
            ↩ Lobby
          </button>
        </div>
      </div>

      {/* ── THREE-COLUMN LAYOUT ── */}
      {/* HUD column: min 430px guarantees the spirit card's loadout + portrait
          columns always sit side-by-side (never wrap onto the portrait); max
          620px lets it stretch toward full-screen on wide monitors. The board
          column flexes and the board SVG scales to whatever remains. */}
      <div style={{display:"grid",gridTemplateColumns:"minmax(430px,620px) 1fr minmax(232px,310px)",gap:12,alignItems:"start",flex:1}}>

      {/* ── BATTLE METER OVERLAY ── */}
      {battleState && (() => {
        const attacker = spirits.find(s => s.id === battleState.attackerId);
        const defender = spirits.find(s => s.id === battleState.defenderId);
        const { phase, atkStat, defStat, atkBase, atkBonus, defBase, defBonus, atkRoll, defRoll, atkTotal, defTotal,
                attackerWon, margin, damage, pickPos,
                spinFaceAtk, spinFaceDef, atkDieReady, defDieReady, sonicAttack } = battleState;

        // ── RETALIATION PHASES ────────────────────────────────────────────────
        // Handled by the dedicated "PART 2" counter screen further down, after
        // NeonDie + spiritGlow + the crowd helpers are in scope (so the counter
        // round can reuse the same dice, glow and fan-fare as the main battle).

        // ── RIFF-OFF PHASES — full-screen rhythm duel overlay ─────────────────
        if (battleState.riffOff) {
          const rTurn     = battleState.turn;
          const isAtkTurn = rTurn === 'attacker';
          const activeSp  = isAtkTurn ? attacker : defender;
          const rRiff     = isAtkTurn ? battleState.atkRiff : battleState.defRiff;
          const rResults  = isAtkTurn ? battleState.atkResults : battleState.defResults;
          const rNoteIdx  = battleState.noteIdx;
          const curNote   = rRiff?.notes?.[rNoteIdx];
          const curSharp  = curNote ? curNote === curNote.toUpperCase() : false;
          // Only show judgment for the note it belongs to (visible during the
          // gap after resolving, cleared when the next note flashes)
          const fbRaw     = battleState.feedback;
          const fb        = (fbRaw && fbRaw.turn === rTurn && fbRaw.noteIdx === rNoteIdx) ? fbRaw : null;
          const answerInfo = RIFF_ANSWER_LABELS[battleState.defRiff?.kind] ?? {};
          const noteColor  = activeSp?.color ?? '#f6ad55';
          const GRADE_COLORS = { perfect:'#44ff99', good:'#aaff44', ok:'#ffcc44', miss:'#ff4455', wrong:'#ff4455' };
          const GRADE_TEXT   = { perfect:'PERFECT!', good:'GOOD!', ok:'OK', miss:'MISSED!', wrong:'WRONG NOTE!' };

          // ── BEAM CLASH derived state ──────────────────────────────────────
          const clashing    = phase === 'riff_clash';
          const clashStage  = battleState.clashStage;       // charge | clash | break | escalate
          const round       = battleState.round ?? 1;
          const clashWinner = battleState.clashWinner;       // 'attacker' | 'defender' | null
          const clashIntense = round >= 2;
          const isBreak     = clashing && clashStage === 'break';
          // Round-2 riff phases (the new sudden-death round playing out)
          const r2intro     = phase === 'riff_r2intro';
          const inRiffPlay  = ['riff_countdown','riff_play','riff_handoff'].includes(phase) || r2intro;
          const bgBeams     = round >= 2 && inRiffPlay; // round-1 beams linger behind round 2
          // Lean: how far off-center the beams meet. Pushed toward the WEAKER
          // side (the one losing the push). attacker stronger → meet point right.
          const cLean = battleState.tie ? 0
            : (battleState.attackerWon ? 1 : -1) * Math.min(0.34, 0.06 + (battleState.margin ?? 0) * 0.05);
          // Meeting point as a fraction across the portrait band (0=left,1=right)
          const clashFrac =
              clashStage === 'charge'   ? 0.5
            : clashStage === 'clash'    ? 0.5 + cLean
            : clashStage === 'escalate' ? 0.5
            : clashStage === 'break'    ? (clashWinner === 'attacker' ? 0.86 : clashWinner === 'defender' ? 0.14 : 0.5)
            : 0.5;
          // Beams are "firing" once charged
          const beamsOut = clashing && clashStage !== 'charge';
          const atkColor = attacker?.color ?? '#ff4444';
          const defColor = defender?.color ?? '#00ccff';
          // Loser blast animation on the break
          const atkBlasted = isBreak && clashWinner === 'defender';
          const defBlasted = isBreak && clashWinner === 'attacker';
          // Screen-shake: a jolt on collision, a heavier (doubled on Round 2) quake on the break
          const containerShake =
              clashStage === 'break'    ? `clash-shake ${clashIntense ? '0.6s' : '0.45s'} cubic-bezier(.36,.07,.19,.97) ${clashIntense ? '2' : '1'} both`
            : clashStage === 'clash'    ? 'clash-shake 0.3s ease-out 1'
            : clashStage === 'escalate' ? 'clash-shake 0.45s ease-out 1'
            : undefined;

          // Highlight logic: who's "live" right now
          const atkLive = phase === 'riff_intro' || (['riff_countdown','riff_play'].includes(phase) && isAtkTurn)
            || (phase === 'riff_result' && !battleState.tie && battleState.attackerWon)
            || (clashing && (!isBreak || clashWinner === 'attacker'));
          const defLive = phase === 'riff_intro' || phase === 'riff_handoff'
            || (['riff_countdown','riff_play'].includes(phase) && !isAtkTurn)
            || (phase === 'riff_result' && !battleState.tie && !battleState.attackerWon)
            || (clashing && (!isBreak || clashWinner === 'defender'));

          // ── FAN-FARE: pink fans (attacker/left), blue fans (defender/right) ──
          // Energy tracks the duel: the live performer's side cheers, the
          // beam-lean favourite roars, and the winner's crowd erupts on the break.
          const rfCrowdStyle = (level, color, surge) => {
            const amp = 4 + level * 24, dur = Math.max(0.32, 0.95 - level * 0.55);
            const bright = 0.5 + level * 0.95 + (surge ? 0.5 : 0), glow = 5 + level * 30 + (surge ? 18 : 0);
            return { '--cheer-amp': `-${amp.toFixed(1)}px`,
              animation: `crowd-cheer ${surge ? '0.34' : dur.toFixed(2)}s ease-in-out infinite`,
              filter: `drop-shadow(0 0 ${glow.toFixed(0)}px ${color}) brightness(${bright.toFixed(2)})`,
              opacity: 0.4 + level * 0.6 };
          };
          const atkCheerLvl = isBreak ? (clashWinner === 'attacker' ? 1 : 0.15)
            : clashStage === 'escalate' ? 0.85
            : clashing ? (clashStage === 'clash' && cLean > 0 ? 0.8 : 0.5)
            : ['riff_countdown','riff_play'].includes(phase) ? (isAtkTurn ? 0.7 : 0.2)
            : r2intro ? 0.6 : 0.3;
          const defCheerLvl = isBreak ? (clashWinner === 'defender' ? 1 : 0.15)
            : clashStage === 'escalate' ? 0.85
            : clashing ? (clashStage === 'clash' && cLean < 0 ? 0.8 : 0.5)
            : ['riff_countdown','riff_play'].includes(phase) ? (!isAtkTurn ? 0.7 : 0.2)
            : r2intro ? 0.6 : 0.3;
          const atkSurge = isBreak && clashWinner === 'attacker';
          const defSurge = isBreak && clashWinner === 'defender';

          const noteGlyph = (n) => n === n.toUpperCase() ? `${n}♯` : n.toUpperCase();
          const progressRow = (notes, res, current, accent) => (
            <div style={{display:'flex', gap:8, justifyContent:'center', marginTop:16}}>
              {notes.map((n, i) => {
                const r = res[i];
                const played = i < res.length;
                const isCur  = i === current;
                const col = played ? GRADE_COLORS[r.grade] : isCur ? '#ffffff' : '#2a3a55';
                return (
                  <div key={i} style={{
                    width:34, height:40, display:'flex', alignItems:'center', justifyContent:'center',
                    border:`2px solid ${col}`, borderRadius:6, fontSize:13, fontWeight:700, color:col,
                    background: isCur ? '#16213a' : '#0a1020',
                    boxShadow: isCur ? `0 0 12px ${accent}66` : 'none',
                  }}>
                    {played ? noteGlyph(n) : isCur ? '?' : '·'}
                  </div>
                );
              })}
            </div>
          );
          const cardBase = (borderColor) => ({
            background:'#080f1e', border:`2px solid ${borderColor}`,
            borderRadius:12, padding:'20px 32px', minWidth:420, maxWidth:580, textAlign:'center',
            boxShadow:`0 0 40px ${borderColor}33`,
          });
          const bigBtn = (color) => ({
            fontFamily:'inherit', fontSize:11, padding:'10px 24px', marginTop:14,
            background:'#1a1400', border:`2px solid ${color}`, borderRadius:7,
            color, cursor:'pointer', fontWeight:700, boxShadow:`0 0 14px ${color}44`,
          });

          return (
            <div style={{
              position:'fixed', inset:0, background:'#000000f2', zIndex:9980,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              fontFamily:"'Orbitron',sans-serif",
              animation: clashing ? containerShake : undefined,
            }}>
              <style>{`
                @keyframes riffwin   { from { width:100%; } to { width:0%; } }
                @keyframes riffpulse { 0%{transform:scale(0.4);opacity:0;} 60%{transform:scale(1.18);opacity:1;} 100%{transform:scale(1);opacity:1;} }
                @keyframes riffglitch { 0%{transform:translate(0,0) skewX(0);} 15%{transform:translate(-6px,2px) skewX(-9deg);} 30%{transform:translate(7px,-3px) skewX(8deg);} 45%{transform:translate(-5px,1px) skewX(-5deg);} 60%{transform:translate(4px,2px) skewX(4deg);} 80%{transform:translate(-2px,-1px) skewX(-2deg);} 100%{transform:translate(0,0) skewX(0);} }
                /* ── Beam clash ── */
                @keyframes clash-orb-pulse  { 0%,100%{transform:translate(-50%,-50%) scale(1);} 50%{transform:translate(-50%,-50%) scale(1.16);} }
                @keyframes clash-orb-surge  { 0%,100%{transform:translate(-50%,-50%) scale(1.05);} 50%{transform:translate(-50%,-50%) scale(1.5);} }
                @keyframes clash-crackle    { 0%,100%{filter:brightness(1);} 25%{filter:brightness(1.55);} 50%{filter:brightness(0.8);} 75%{filter:brightness(1.7);} }
                @keyframes clash-charge      { 0%,100%{opacity:0.55; transform:translate(-50%,-50%) scale(0.85);} 50%{opacity:1; transform:translate(-50%,-50%) scale(1.1);} }
                @keyframes clash-blast-burst { 0%{opacity:0; transform:translate(-50%,-50%) scale(0.2);} 30%{opacity:1; transform:translate(-50%,-50%) scale(1);} 100%{opacity:0; transform:translate(-50%,-50%) scale(2);} }
                @keyframes clash-blast-left  { 0%{transform:translateX(0) rotate(0); opacity:1;} 100%{transform:translateX(-200px) rotate(-24deg); opacity:0;} }
                @keyframes clash-blast-right { 0%{transform:translateX(0) scaleX(-1) rotate(0); opacity:1;} 100%{transform:translateX(200px) scaleX(-1) rotate(24deg); opacity:0;} }
                @keyframes clash-flash       { 0%{opacity:0;} 12%{opacity:0.9;} 100%{opacity:0;} }
                @keyframes clash-shake       { 0%,100%{transform:translate(0,0);} 20%{transform:translate(-7px,4px);} 40%{transform:translate(6px,-5px);} 60%{transform:translate(-5px,3px);} 80%{transform:translate(4px,-2px);} }
                @keyframes crowd-cheer       { 0%,100%{transform:translateY(0) scaleY(1);} 50%{transform:translateY(var(--cheer-amp,-6px)) scaleY(1.05);} }
                @keyframes r2-slam           { 0%{opacity:0; transform:scale(0.4) rotate(-8deg);} 55%{opacity:1; transform:scale(1.15) rotate(3deg);} 100%{opacity:1; transform:scale(1) rotate(0);} }
                @keyframes bg-beam-pulse     { 0%,100%{opacity:0.18;} 50%{opacity:0.34;} }
              `}</style>

              {/* ── FAN-FARE — pink fans (attacker/left), blue fans (defender/right) ── */}
              <div style={{position:'absolute', left:0, right:0, bottom:0, height:'30%',
                           zIndex:-1, pointerEvents:'none', overflow:'hidden'}}>
                <div style={{position:'absolute', left:'-3%', bottom:'-2%', width:'52%', maxWidth:660}}>
                  <img src={crowdPinkImg} alt="" draggable={false}
                    style={{width:'100%', display:'block', mixBlendMode:'screen', transformOrigin:'bottom center',
                            ...rfCrowdStyle(atkCheerLvl, '#ff3ad0', atkSurge)}}/>
                </div>
                <div style={{position:'absolute', right:'-3%', bottom:'-2%', width:'52%', maxWidth:660}}>
                  <img src={crowdBlueImg} alt="" draggable={false}
                    style={{width:'100%', display:'block', mixBlendMode:'screen', transformOrigin:'bottom center',
                            ...rfCrowdStyle(defCheerLvl, '#34d6ff', defSurge)}}/>
                </div>
              </div>

              {/* ── LINGERING ROUND-1 BEAMS — locked in the background through Round 2 ── */}
              {bgBeams && (
                <div style={{position:'absolute', left:0, right:0, top:'40%', height:14, zIndex:-1,
                             pointerEvents:'none', animation:'bg-beam-pulse 1.3s ease-in-out infinite'}}>
                  <div style={{position:'absolute', top:'50%', left:'8%', width:'42%', height:12,
                    transform:'translateY(-50%)', borderRadius:12,
                    background:`linear-gradient(90deg, ${atkColor}00, ${atkColor} 80%, #ffffff)`,
                    boxShadow:`0 0 24px ${atkColor}`}}/>
                  <div style={{position:'absolute', top:'50%', right:'8%', width:'42%', height:12,
                    transform:'translateY(-50%)', borderRadius:12,
                    background:`linear-gradient(270deg, ${defColor}00, ${defColor} 80%, #ffffff)`,
                    boxShadow:`0 0 24px ${defColor}`}}/>
                  <div style={{position:'absolute', top:'50%', left:'50%', width:54, height:54,
                    transform:'translate(-50%,-50%)', borderRadius:'50%',
                    background:'radial-gradient(circle, #ffffff, #ffffff00 70%)'}}/>
                </div>
              )}

              {/* Title */}
              <div style={{position:'relative', zIndex:3, fontSize:24, fontWeight:900, letterSpacing:6, marginBottom:16,
                color: round >= 2 ? '#ff7733' : '#ffd700',
                textShadow: round >= 2 ? '0 0 28px #ff5522, 0 0 70px #ff990055' : '0 0 24px #ff444488, 0 0 60px #ffd70044'}}>
                {round >= 2 ? '🔥 RIFF-OFF · ROUND 2 🔥' : '⚡ RIFF-OFF ⚡'}
              </div>

              {/* Portraits — live player glows, the other waits in the dark.
                  During the beam clash this band also hosts the dueling beams. */}
              <div style={{position:'relative', display:'flex', alignItems:'flex-end', justifyContent:'center',
                           gap:70, marginBottom:18, width:'100%', maxWidth:760}}>

                {/* ── BEAM CLASH LAYER (behind the Spirits) ── */}
                {clashing && (() => {
                  const baseTh = clashIntense ? 30 : 18;            // beam thickness (px)
                  const orbSz  = (clashIntense ? 132 : 92) * (isBreak ? 1.25 : 1);
                  const leftW  = `${Math.max(0, (clashFrac - 0.10) * 100)}%`;
                  const rightW = `${Math.max(0, (0.90 - clashFrac) * 100)}%`;
                  const beamTransition = 'width 1.5s cubic-bezier(.6,0,.4,1), left 1.5s cubic-bezier(.6,0,.4,1)';
                  const orbAnim = clashStage === 'escalate' ? 'clash-orb-surge 0.5s ease-in-out infinite'
                                : isBreak ? 'none' : 'clash-orb-pulse 0.7s ease-in-out infinite';
                  return (
                    <div style={{position:'absolute', left:0, right:0, top:'24%', height:'46%',
                                 zIndex:1, pointerEvents:'none'}}>
                      {/* Attacker beam (from left) */}
                      <div style={{position:'absolute', top:'50%', left:'10%', width: beamsOut ? leftW : '0%',
                        height:baseTh, transform:'translateY(-50%)', borderRadius:baseTh, transition:beamTransition,
                        opacity: beamsOut ? 1 : 0,
                        background:`linear-gradient(90deg, ${atkColor} 0%, ${atkColor} 70%, #ffffff 100%)`,
                        boxShadow:`0 0 ${baseTh*1.4}px ${atkColor}, 0 0 ${baseTh*3}px ${atkColor}aa`,
                        animation: clashStage === 'clash' || clashStage === 'escalate' ? 'clash-crackle 0.16s steps(2,end) infinite' : 'none'}}/>
                      {/* Defender beam (from right) */}
                      <div style={{position:'absolute', top:'50%', right:'10%', width: beamsOut ? rightW : '0%',
                        height:baseTh, transform:'translateY(-50%)', borderRadius:baseTh, transition:beamTransition,
                        opacity: beamsOut ? 1 : 0,
                        background:`linear-gradient(270deg, ${defColor} 0%, ${defColor} 70%, #ffffff 100%)`,
                        boxShadow:`0 0 ${baseTh*1.4}px ${defColor}, 0 0 ${baseTh*3}px ${defColor}aa`,
                        animation: clashStage === 'clash' || clashStage === 'escalate' ? 'clash-crackle 0.16s steps(2,end) infinite' : 'none'}}/>
                      {/* Charging orbs at each Spirit while powering up */}
                      {clashStage === 'charge' && [['10%', atkColor], ['90%', defColor]].map(([x,c],i) => (
                        <div key={i} style={{position:'absolute', top:'50%', left:x,
                          width:orbSz*0.5, height:orbSz*0.5, borderRadius:'50%',
                          background:`radial-gradient(circle, #ffffff, ${c} 55%, transparent 72%)`,
                          animation:'clash-charge 0.5s ease-in-out infinite'}}/>
                      ))}
                      {/* Collision orb where the beams meet */}
                      {beamsOut && (
                        <div style={{position:'absolute', top:'50%', left:`${clashFrac*100}%`,
                          width:orbSz, height:orbSz, borderRadius:'50%', transition:'left 1.5s cubic-bezier(.6,0,.4,1)',
                          background:`radial-gradient(circle, #ffffff 0%, ${(clashFrac>0.5?atkColor:defColor)} 45%, transparent 70%)`,
                          boxShadow:`0 0 ${orbSz*0.6}px #ffffff, 0 0 ${orbSz}px ${clashFrac>0.5?atkColor:defColor}`,
                          animation:orbAnim}}/>
                      )}
                      {/* KO blast engulfing the loser on the break */}
                      {isBreak && clashWinner && (
                        <div style={{position:'absolute', top:'50%', left: clashWinner==='attacker' ? '90%' : '10%',
                          width:orbSz*2.4, height:orbSz*2.4, borderRadius:'50%',
                          background:`radial-gradient(circle, #ffffff 0%, ${clashWinner==='attacker'?atkColor:defColor}cc 35%, transparent 70%)`,
                          animation:'clash-blast-burst 1.6s ease-out both'}}/>
                      )}
                    </div>
                  );
                })()}

                <div style={{position:'relative', zIndex:2, textAlign:'center'}}>
                  <img src={attacker?.imageSrc} alt={attacker?.name}
                    style={{height:190, width:'auto', objectFit:'contain', objectPosition:'bottom center',
                      opacity: atkLive ? 1 : 0.35,
                      filter:`drop-shadow(0 0 ${atkLive ? (clashing ? 34 : 26) : 8}px ${atkColor}${atkLive ? 'aa' : '44'})`,
                      transition:'opacity 0.4s, filter 0.4s',
                      animation: atkBlasted ? 'clash-blast-left 0.9s ease-in both' : 'none'}}/>
                  <div style={{fontSize:9, color:attacker?.color ?? '#ff8866', letterSpacing:2, marginTop:4}}>🎤 {attacker?.name}</div>
                </div>
                <div style={{fontSize:20, fontWeight:900, color:'#3a5a7a', paddingBottom:80,
                  opacity: clashing ? 0 : 1, transition:'opacity 0.3s'}}>VS</div>
                <div style={{position:'relative', zIndex:2, textAlign:'center'}}>
                  <img src={defender?.imageSrc} alt={defender?.name}
                    style={{height:190, width:'auto', objectFit:'contain', objectPosition:'bottom center',
                      transform:'scaleX(-1)',
                      opacity: defLive ? 1 : 0.35,
                      filter:`drop-shadow(0 0 ${defLive ? (clashing ? 34 : 26) : 8}px ${defColor}${defLive ? 'aa' : '44'})`,
                      transition:'opacity 0.4s, filter 0.4s',
                      animation: defBlasted ? 'clash-blast-right 0.9s ease-in both' : 'none'}}/>
                  <div style={{fontSize:9, color:defender?.color ?? '#66ccff', letterSpacing:2, marginTop:4}}>🎸 {defender?.name}</div>
                </div>
              </div>

              {/* ── FULL-SCREEN IMPACT FLASH (the break, brighter on round 2) ── */}
              {isBreak && (
                <div key={`flash-${round}`} style={{position:'absolute', inset:0, pointerEvents:'none', zIndex:9,
                  background: clashWinner ? `radial-gradient(circle at ${clashWinner==='attacker'?'78%':'22%'} 42%, #ffffff, ${(clashWinner==='attacker'?atkColor:defColor)}00 60%)` : '#ffffff',
                  animation:`clash-flash ${clashIntense ? '0.7s' : '0.5s'} ease-out both`}}/>
              )}

              {/* ── INTRO ── */}
              {phase === 'riff_intro' && (
                <div style={cardBase('#ffd700')}>
                  <div style={{fontSize:11, color:'#ffd700', letterSpacing:2, marginBottom:10}}>
                    🔊 PLUGGED IN · FACE TO FACE · BEAMS CROSSED
                  </div>
                  <div style={{fontSize:9, color:'#8aa5c5', lineHeight:1.8, marginBottom:8}}>
                    {RIFF_LEN} notes flash one by one — hit the matching key the INSTANT it appears.<br/>
                    <span style={{color:'#ffcc44'}}>CAPITAL letters are SHARPS — hold SHIFT.</span><br/>
                    <span style={{color:'#ff8855'}}>The riff has a GROOVE — some notes rush in with no warning, some sit behind a rest.</span><br/>
                    Accuracy wins · reaction time breaks ties · loser eats the feedback.
                  </div>
                  <div style={{fontSize:8.5, color:'#6a8aaa', lineHeight:1.7, marginBottom:6}}>
                    {attacker?.name} calls a <span style={{color:attacker?.color ?? '#ff8866'}}>{RIFF_CONTOUR_LABELS[battleState.atkRiff?.contour]}</span><br/>
                    {defender?.name} answers with a <span style={{color:defender?.color ?? '#66ccff'}}>{answerInfo.name}</span> — {answerInfo.desc}
                  </div>
                  <button onClick={() => riffBeginTurn('attacker')} style={bigBtn('#ffd700')}>
                    🎤 {attacker?.name} — DROP THE RIFF
                  </button>
                </div>
              )}

              {/* ── COUNTDOWN ── */}
              {phase === 'riff_countdown' && (
                <div style={cardBase(noteColor)}>
                  <div style={{fontSize:10, color:noteColor, letterSpacing:2, marginBottom:8}}>
                    {isAtkTurn ? '🎤 THE CALL' : '🎸 THE ANSWER'} — {activeSp?.name}, GET READY
                  </div>
                  <div key={battleState.countdown} style={{fontSize:64, fontWeight:900, color:'#fff',
                    textShadow:`0 0 30px ${noteColor}`, animation:'riffpulse 0.3s ease-out', lineHeight:1.1}}>
                    {battleState.countdown}
                  </div>
                  {progressRow(rRiff.notes, rResults, -1, noteColor)}
                </div>
              )}

              {/* ── PLAY — the flashing note ── */}
              {phase === 'riff_play' && (
                <div style={cardBase(noteColor)}>
                  <div style={{fontSize:10, color:noteColor, letterSpacing:2, marginBottom:4}}>
                    {isAtkTurn ? '🎤 THE CALL' : '🎸 THE ANSWER'} — {activeSp?.name}
                  </div>
                  {(() => {
                    const glitched = battleState.glitchAt === rNoteIdx;
                    const ghostKey = (!isAtkTurn && battleState.defGhosts) ? battleState.defGhosts[rNoteIdx] : null;
                    const gh = (battleState.ghostHit && battleState.ghostHit.idx === rNoteIdx) ? battleState.ghostHit : null;
                    if (ghostKey) {
                      // 🎴 E-RUSH — real note + its ghost; BOTH keys must be hit
                      const mainHit  = gh?.main;
                      const ghostDone = gh?.ghost;
                      return (
                        <div key={`${rTurn}-${rNoteIdx}-erush`} style={{display:'flex', alignItems:'center',
                          justifyContent:'center', gap:18, margin:'4px 0 0', animation:'riffpulse 0.18s ease-out'}}>
                          <div style={{fontSize:80, fontWeight:900,
                            color: mainHit ? '#55ffaa' : '#fff',
                            textShadow: mainHit ? '0 0 30px #55ffaa' : `0 0 34px ${noteColor}`, lineHeight:1.1}}>
                            {curNote ? noteGlyph(curNote) : ''}
                          </div>
                          <div style={{fontSize:30, fontWeight:900, color:'#9a7adf'}}>+</div>
                          <div style={{fontSize:66, fontWeight:900, fontStyle:'italic',
                            color: ghostDone ? '#55ffaa' : '#b899ff',
                            opacity: ghostDone ? 1 : 0.62,
                            textShadow: ghostDone ? '0 0 26px #55ffaa' : '0 0 22px #7a4ddf, 2px 2px 0 #2a1a4a',
                            lineHeight:1.1}}>
                            {noteGlyph(ghostKey)}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={`${rTurn}-${rNoteIdx}-${glitched ? 'g' : 'n'}`} style={{fontSize:80, fontWeight:900,
                        color: glitched ? '#ff3355' : '#fff',
                        textShadow: glitched ? '0 0 34px #ff3355, 2px 0 0 #00e5ff, -2px 0 0 #ff00aa' : `0 0 34px ${noteColor}`,
                        animation: glitched ? 'riffglitch 0.4s ease-in-out' : 'riffpulse 0.18s ease-out',
                        lineHeight:1.1, margin:'4px 0 0'}}>
                        {curNote ? noteGlyph(curNote) : ''}
                      </div>
                    );
                  })()}
                  <div style={{fontSize:9, letterSpacing:2, height:14,
                    color: (!isAtkTurn && battleState.defGhosts && battleState.defGhosts[rNoteIdx]) ? '#b899ff'
                         : curSharp ? '#ffcc44' : '#1f2f4a'}}>
                    {(!isAtkTurn && battleState.defGhosts && battleState.defGhosts[rNoteIdx]) ? '🎴 GHOST BARRAGE — HIT BOTH KEYS'
                     : curSharp ? '⬆ SHARP — HOLD SHIFT' : '​'}
                  </div>
                  {/* Window timer — rushed notes burn hot and fast */}
                  {(() => {
                    const beat   = rRiff?.rhythm?.[rNoteIdx] ?? {};
                    const ghostKey = (!isAtkTurn && battleState.defGhosts) ? battleState.defGhosts[rNoteIdx] : null;
                    const curWin = (beat.window ?? RIFF_NOTE_WINDOW) * (ghostKey ? 1.5 : 1);
                    const barCol = ghostKey ? '#b899ff' : (beat.feel === 'rushed' ? '#ff6633' : noteColor);
                    return (
                      <div style={{height:5, background:'#1a2a40', borderRadius:3, margin:'12px auto 0', width:260, overflow:'hidden'}}>
                        <div key={`bar-${rTurn}-${rNoteIdx}`} style={{height:'100%', background:barCol,
                          borderRadius:3, animation:`riffwin ${curWin}ms linear forwards`}}/>
                      </div>
                    );
                  })()}
                  {/* Hit/miss feedback */}
                  <div style={{height:18, marginTop:10, fontSize:12, fontWeight:800, letterSpacing:2,
                    color: fb ? GRADE_COLORS[fb.grade] : 'transparent'}}>
                    {fb ? `${GRADE_TEXT[fb.grade]}${fb.rt != null ? ` · ${fb.rt}ms` : ''}` : '·'}
                  </div>
                  {progressRow(rRiff.notes, rResults, rNoteIdx, noteColor)}
                </div>
              )}

              {/* ── HANDOFF — pass the keyboard ── */}
              {phase === 'riff_handoff' && (() => {
                const aS = riffStats(battleState.atkResults);
                return (
                  <div style={cardBase(defender?.color ?? '#00ccff')}>
                    <div style={{fontSize:11, color:'#ffd700', letterSpacing:2, marginBottom:10}}>
                      🔁 PASS THE KEYBOARD!
                    </div>
                    <div style={{fontSize:9, color:'#8aa5c5', marginBottom:10}}>
                      {attacker?.name} laid down the call: <b style={{color:'#fff'}}>{aS.hits}/{RIFF_LEN} notes</b>
                      {aS.avgRt != null ? <> · <b style={{color:'#fff'}}>{aS.avgRt}ms</b> avg reaction</> : <> · no clean hits</>}
                    </div>
                    {progressRow(battleState.atkRiff.notes, battleState.atkResults, -1, attacker?.color ?? '#ff8866')}
                    <div style={{fontSize:8.5, color:'#6a8aaa', lineHeight:1.7, margin:'14px 0 0'}}>
                      {defender?.name}, your answer is a <span style={{color:defender?.color ?? '#66ccff'}}>{answerInfo.name}</span> — {answerInfo.desc}
                    </div>
                    <button onClick={() => riffBeginTurn('defender')} style={bigBtn(defender?.color ?? '#00ccff')}>
                      🎸 {defender?.name} — DROP THE ANSWER
                    </button>
                  </div>
                );
              })()}

              {/* ── ROUND 2 INTRO — fresh, faster, sudden death ── */}
              {phase === 'riff_r2intro' && (
                <div style={cardBase('#ff7733')}>
                  <div style={{fontSize:16, fontWeight:900, letterSpacing:3, color:'#ff7733',
                    textShadow:'0 0 24px #ff5522', marginBottom:8, animation:'r2-slam 0.6s cubic-bezier(.22,1,.36,1) both'}}>
                    🔥 ROUND 2 🔥
                  </div>
                  <div style={{fontSize:9, color:'#ffcc99', lineHeight:1.8, marginBottom:6}}>
                    Round 1 was too close to call — the beams couldn't break.<br/>
                    <span style={{color:'#fff'}}>Sudden death.</span> New riffs, <span style={{color:'#ff7733'}}>faster windows, no breathers.</span><br/>
                    Whoever plays cleaner here takes the whole duel — winner's blast hits even harder.
                  </div>
                  <div style={{fontSize:8.5, color:'#6a8aaa', lineHeight:1.7, marginBottom:2}}>
                    {attacker?.name} calls a <span style={{color:attacker?.color ?? '#ff8866'}}>{RIFF_CONTOUR_LABELS[battleState.atkRiff?.contour]}</span> ·
                    {defender?.name} answers with a <span style={{color:defender?.color ?? '#66ccff'}}>{answerInfo.name}</span>
                  </div>
                  <button onClick={() => riffBeginTurn('attacker')} style={bigBtn('#ff7733')}>
                    🎤 {attacker?.name} — BRING IT →
                  </button>
                </div>
              )}

              {/* ── BEAM CLASH — charge → collide → break / escalate ── */}
              {phase === 'riff_clash' && (() => {
                const clashColor = clashStage === 'escalate' ? '#ffaa33'
                  : isBreak ? (clashWinner === 'attacker' ? atkColor : clashWinner === 'defender' ? defColor : '#8aa5c5')
                  : '#ffd700';
                const winName = clashWinner === 'attacker' ? attacker?.name : clashWinner === 'defender' ? defender?.name : null;
                return (
                  <div style={cardBase(clashColor)}>
                    <div style={{fontSize:10, color:clashColor, letterSpacing:3, marginBottom:6}}>
                      🌟 BEAM CLASH · ROUND {round}{clashIntense ? ' — GO BEYOND!' : ''}
                    </div>
                    {clashStage === 'charge' && (
                      <>
                        <div style={{fontSize:9, color:'#8aa5c5', lineHeight:1.7, marginBottom:6}}>
                          Both Spirits plant their feet and pour everything into one beam.<br/>
                          The crowd-pleaser's blast will <span style={{color:'#fff'}}>outclass</span> the other and sweep them away.
                        </div>
                        <button onClick={fireBeamClash} style={bigBtn(clashColor)}>
                          {clashIntense ? '🔥🔥 UNLEASH IT ALL →' : '🔥 FIRE BEAMS →'}
                        </button>
                      </>
                    )}
                    {clashStage === 'clash' && (
                      <div style={{fontSize:13, fontWeight:900, letterSpacing:3, color:'#fff',
                        textShadow:'0 0 20px #ffffff88', animation:'clash-crackle 0.12s steps(2,end) infinite'}}>
                        ⚡ BEAMS COLLIDE ⚡
                      </div>
                    )}
                    {clashStage === 'escalate' && (
                      <div style={{fontSize:12, fontWeight:900, letterSpacing:2, color:'#ffaa33',
                        textShadow:'0 0 20px #ffaa3388'}}>
                        ⚖️ TOO CLOSE — BEAMS LOCK!<br/>
                        <span style={{fontSize:9, color:'#ffcc88', letterSpacing:1}}>Stakes rising — escalating to Round 2…</span>
                      </div>
                    )}
                    {isBreak && (
                      <div style={{fontSize:15, fontWeight:900, letterSpacing:2,
                        color:clashColor, textShadow:`0 0 24px ${clashColor}aa`}}>
                        {winName ? `💥 ${winName}'S BEAM BREAKS THROUGH!` : '🤝 BEAMS CANCEL OUT'}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── RESULT ── */}
              {phase === 'riff_result' && (() => {
                const { atkStats: A, defStats: D, tie, attackerWon: won, margin: m, damage: dmg, decidedBy } = battleState;
                const winSp  = tie ? null : won ? attacker : defender;
                const statCard = (sp, st, riffObj, res, highlight) => (
                  <div style={{flex:1, padding:'12px 14px', borderRadius:8, textAlign:'center',
                    border:`2px solid ${highlight ? (sp?.color ?? '#ffd700') : '#1e3a5f'}`,
                    background: highlight ? '#101a30' : '#0a1020',
                    boxShadow: highlight ? `0 0 18px ${(sp?.color ?? '#ffd700')}44` : 'none'}}>
                    <div style={{fontSize:9, color:sp?.color ?? '#8aa5c5', letterSpacing:1, marginBottom:6}}>{sp?.name}</div>
                    <div style={{fontSize:16, fontWeight:900, color:'#fff'}}>{st.hits}/{RIFF_LEN}</div>
                    <div style={{fontSize:8, color:'#6a8aaa', marginBottom:4}}>
                      {st.avgRt != null ? `${st.avgRt}ms avg reaction` : 'no clean hits'}
                    </div>
                    <div style={{display:'flex', gap:4, justifyContent:'center'}}>
                      {riffObj.notes.map((n, i) => {
                        const r = res[i];
                        return <span key={i} style={{fontSize:10, fontWeight:700,
                          color: r ? GRADE_COLORS[r.grade] : '#2a3a55'}}>{noteGlyph(n)}</span>;
                      })}
                    </div>
                    <button onClick={() => playRiffOffPlayback(riffObj.freqs, riffObj.rhythm)}
                      style={{fontFamily:'inherit', fontSize:8, padding:'4px 10px', marginTop:8,
                        background:'#0a1020', border:`1px solid ${sp?.color ?? '#3a5070'}`,
                        borderRadius:5, color:sp?.color ?? '#8aa5c5', cursor:'pointer', letterSpacing:1}}>
                      ▶ HEAR THE RIFF
                    </button>
                  </div>
                );
                return (
                  <div style={cardBase(tie ? '#8aa5c5' : (winSp?.color ?? '#ffd700'))}>
                    <div style={{fontSize:13, fontWeight:900, letterSpacing:3, marginBottom:12,
                      color: tie ? '#8aa5c5' : (winSp?.color ?? '#ffd700'),
                      textShadow: tie ? 'none' : `0 0 20px ${(winSp?.color ?? '#ffd700')}88`}}>
                      {tie ? '🤝 DEAD HEAT — CROWD CAN\'T DECIDE' : `🏆 ${winSp?.name} WINS THE RIFF-OFF!`}
                    </div>
                    <div style={{display:'flex', gap:12, marginBottom:12}}>
                      {statCard(attacker, A, battleState.atkRiff, battleState.atkResults, !tie && won)}
                      {statCard(defender, D, battleState.defRiff, battleState.defResults, !tie && !won)}
                    </div>
                    <div style={{fontSize:8.5, color:'#6a8aaa', lineHeight:1.7}}>
                      {tie
                        ? 'Beams cancelled out after 2 rounds — no damage, no Fame, both Spirits walk away with their pride.'
                        : <>Won on <span style={{color:'#ffcc44'}}>{decidedBy}</span> · sealed by beam clash{(battleState.round ?? 1) >= 2 ? ' (Round 2!)' : ''} · margin {m} →
                          <span style={{color:'#ff6677'}}> {dmg} Vibe damage</span> +
                          <span style={{color:'#88bbff'}}> knockback</span> ·
                          <span style={{color:'#ffd700'}}> ⭐ Fame to the winner</span></>}
                    </div>
                    <button onClick={closeRiffOff} style={bigBtn(tie ? '#8aa5c5' : (winSp?.color ?? '#ffd700'))}>
                      🤘 ROCK ON →
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        }

        // ── METER GEOMETRY (pixel-measured from 2690×1389 source) ────────────
        // Display: 860 × 444 (scale = 860/2690 = 0.3197)
        // pickPos: 0=center, negative=left(attacker), positive=right(defender)
        const METER_W = 860; const METER_H = 444;
        const TRACK_Y = 336;       // vertical center of number track row
        const CENTER_X = 433.5;    // midpoint between two '1' slots (nudged right)
        const SLOT_W = 32.2;       // px per slot — nudged down from 33.0
        const clampedPos = Math.max(-10, Math.min(10, pickPos ?? 0));
        const pickX = CENTER_X + clampedPos * SLOT_W;

        // Die squares — nudged further in correction direction
        const ATK_SQ_X = 287; const ATK_SQ_Y = 142;
        const DEF_SQ_X = 541; const DEF_SQ_Y = 142;
        const SQ = 197;   // full square size (for SVG background rect)
        const DIE_SIZE = 110; // rendered die — smaller than square, centered within it

        // Phase helpers
        const showAtkDie = ['atk_die_spin','atk_die_settling','pick_atk_slide',
                            'def_die_spin','def_die_settling','pick_def_slide','result'].includes(phase);
        const showDefDie = ['def_die_spin','def_die_settling','pick_def_slide','result'].includes(phase)
                           && !battleState.posing;
        const atkSpinning = phase === 'atk_die_spin';
        const defSpinning = phase === 'def_die_spin';
        const atkFace = showAtkDie ? (spinFaceAtk ?? atkRoll) : null;
        const defFace = showDefDie ? (spinFaceDef ?? defRoll) : null;

        // Spirit visibility
        const atkIn = ['enter_attacker','flash_drive','pick_drive_slide','enter_defender',
                       'flash_sustain','pick_sustain_slide','atk_die_spin','atk_die_settling',
                       'pick_atk_slide','def_die_spin','def_die_settling','pick_def_slide','result'].includes(phase);
        const defIn = ['enter_defender','flash_sustain','pick_sustain_slide','atk_die_spin',
                       'atk_die_settling','pick_atk_slide','def_die_spin','def_die_settling',
                       'pick_def_slide','result'].includes(phase);

        const showFlashDrive   = ['flash_drive','pick_drive_slide'].includes(phase);
        const showFlashSustain = ['flash_sustain','pick_sustain_slide'].includes(phase);

        // Sliding pick uses CSS transition only during slide phases
        const isSliding = ['pick_drive_slide','pick_sustain_slide','pick_atk_slide','pick_def_slide'].includes(phase);
        const pickTransition = isSliding ? 'left 2.0s cubic-bezier(0.25,0.46,0.45,0.94)' : 'left 0s';

        // D6 pip layouts: [value] → array of [cx,cy] offsets from die center (in a 0-1 space, scaled)
        const PIPS = {
          1: [[0,0]],
          2: [[-0.28,-0.28],[0.28,0.28]],
          3: [[-0.28,-0.28],[0,0],[0.28,0.28]],
          4: [[-0.28,-0.28],[0.28,-0.28],[-0.28,0.28],[0.28,0.28]],
          5: [[-0.28,-0.28],[0.28,-0.28],[0,0],[-0.28,0.28],[0.28,0.28]],
          6: [[-0.28,-0.33],[0.28,-0.33],[-0.28,0],[0.28,0],[-0.28,0.33],[0.28,0.33]],
        };

        // Neon die rendered as inline SVG — supports d6 (pips), d8, d10, d12 (numerals)
        function NeonDie({ value, spinning, color, size = 110, sides = 6 }) {
          const glowColor = color ?? '#ff4444';
          const half = size / 2;
          const val = value ?? 1;

          // ── D6: classic rounded-rect with pips ──────────────────────────────
          if (sides === 6) {
            const face = Math.max(1, Math.min(6, val));
            const pips = PIPS[face] || PIPS[1];
            const pipR  = size * 0.09;
            const spread = size * 0.30;
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',overflow:'visible'}}>
                <rect x={4} y={4} width={size-8} height={size-8} rx={14}
                  fill="#060810" stroke={glowColor} strokeWidth={spinning ? 3 : 2}
                  style={spinning ? {filter:`drop-shadow(0 0 10px ${glowColor})`} : {}}/>
                {[[10,10],[size-10,10],[10,size-10],[size-10,size-10]].map(([cx,cy],i) => (
                  <circle key={i} cx={cx} cy={cy} r={2.5} fill={glowColor} opacity={0.25}/>
                ))}
                {pips.map(([ox,oy], i) => (
                  <circle key={i}
                    cx={half + ox * spread * 2} cy={half + oy * spread * 2}
                    r={pipR} fill={glowColor}
                    style={spinning ? {filter:`drop-shadow(0 0 5px ${glowColor})`} : {}}/>
                ))}
              </svg>
            );
          }

          // ── D8: octagon (diamond-ish) ────────────────────────────────────────
          if (sides === 8) {
            const r = half - 5;
            const pts = Array.from({length:8}, (_,i) => {
              const a = (i * Math.PI / 4) - Math.PI / 8;
              return `${half + r * Math.cos(a)},${half + r * Math.sin(a)}`;
            }).join(' ');
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',overflow:'visible'}}>
                <polygon points={pts} fill="#060810" stroke={glowColor}
                  strokeWidth={spinning ? 3 : 2}
                  style={spinning ? {filter:`drop-shadow(0 0 12px ${glowColor})`} : {}}/>
                {/* Inner octagon decoration */}
                {(() => {
                  const r2 = r * 0.72;
                  const pts2 = Array.from({length:8}, (_,i) => {
                    const a = (i * Math.PI / 4) - Math.PI / 8;
                    return `${half + r2 * Math.cos(a)},${half + r2 * Math.sin(a)}`;
                  }).join(' ');
                  return <polygon points={pts2} fill="none" stroke={glowColor} strokeWidth={0.7} opacity={0.25}/>;
                })()}
                <text x={half} y={half + size * 0.13}
                  textAnchor="middle" fontSize={size * 0.38} fontWeight="900"
                  fontFamily="'Orbitron',sans-serif"
                  fill={glowColor}
                  style={spinning ? {filter:`drop-shadow(0 0 8px ${glowColor})`} : {}}>
                  {val}
                </text>
                <text x={half} y={size - 10}
                  textAnchor="middle" fontSize={size * 0.13} fontWeight="700"
                  fontFamily="'Orbitron',sans-serif" fill={glowColor} opacity={0.5}>
                  d8
                </text>
              </svg>
            );
          }

          // ── D10: kite / elongated diamond ───────────────────────────────────
          if (sides === 10) {
            const topY    = 5;
            const botY    = size - 5;
            const midTopY = half - size * 0.08;
            const midBotY = half + size * 0.08;
            const sideX   = half - 4;
            // 10-point kite: top spike → wide sides → bottom spike
            const pts = Array.from({length:10}, (_,i) => {
              const a = (i * 2 * Math.PI / 10) - Math.PI / 2;
              const rx = (i % 2 === 0) ? half - 6 : half - 22;
              const ry = (i % 2 === 0) ? half - 6 : half - 22;
              return `${half + rx * Math.cos(a)},${half + ry * Math.sin(a)}`;
            }).join(' ');
            // Simpler clean kite shape
            const kite = [
              `${half},${topY}`,
              `${half + size*0.42},${half - size*0.07}`,
              `${half + size*0.26},${half + size*0.06}`,
              `${half},${botY}`,
              `${half - size*0.26},${half + size*0.06}`,
              `${half - size*0.42},${half - size*0.07}`,
            ].join(' ');
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',overflow:'visible'}}>
                <polygon points={kite} fill="#060810" stroke={glowColor}
                  strokeWidth={spinning ? 3 : 2}
                  style={spinning ? {filter:`drop-shadow(0 0 12px ${glowColor})`} : {}}/>
                {/* Horizontal mid line */}
                <line x1={half - size*0.38} y1={half - size*0.015}
                      x2={half + size*0.38} y2={half - size*0.015}
                  stroke={glowColor} strokeWidth={0.7} opacity={0.3}/>
                <text x={half} y={half + size * 0.10}
                  textAnchor="middle" fontSize={size * 0.36} fontWeight="900"
                  fontFamily="'Orbitron',sans-serif"
                  fill={glowColor}
                  style={spinning ? {filter:`drop-shadow(0 0 8px ${glowColor})`} : {}}>
                  {val}
                </text>
                <text x={half} y={size - 14}
                  textAnchor="middle" fontSize={size * 0.13} fontWeight="700"
                  fontFamily="'Orbitron',sans-serif" fill={glowColor} opacity={0.5}>
                  d10
                </text>
              </svg>
            );
          }

          // ── D12: regular pentagon ────────────────────────────────────────────
          if (sides === 12) {
            const r = half - 5;
            const pts = Array.from({length:5}, (_,i) => {
              const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
              return `${half + r * Math.cos(a)},${half + r * Math.sin(a)}`;
            }).join(' ');
            const r2 = r * 0.65;
            const pts2 = Array.from({length:5}, (_,i) => {
              const a = (i * 2 * Math.PI / 5) - Math.PI / 2;
              return `${half + r2 * Math.cos(a)},${half + r2 * Math.sin(a)}`;
            }).join(' ');
            return (
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',overflow:'visible'}}>
                <polygon points={pts} fill="#060810" stroke={glowColor}
                  strokeWidth={spinning ? 3 : 2}
                  style={spinning ? {filter:`drop-shadow(0 0 14px ${glowColor})`} : {}}/>
                <polygon points={pts2} fill="none" stroke={glowColor} strokeWidth={0.7} opacity={0.22}/>
                <text x={half} y={half + size * 0.14}
                  textAnchor="middle" fontSize={size * 0.36} fontWeight="900"
                  fontFamily="'Orbitron',sans-serif"
                  fill={glowColor}
                  style={spinning ? {filter:`drop-shadow(0 0 10px ${glowColor})`} : {}}>
                  {val}
                </text>
                <text x={half} y={half + size * 0.44}
                  textAnchor="middle" fontSize={size * 0.13} fontWeight="700"
                  fontFamily="'Orbitron',sans-serif" fill={glowColor} opacity={0.5}>
                  d12
                </text>
              </svg>
            );
          }

          return null;
        }

        const SPIRIT_H = 340;

        // ── STAT-STRENGTH GLOW ──────────────────────────────────────────────
        // Effective battle stat → glow intensity. Faint at low Drive/Sustain,
        // brighter + pulsing as it climbs, electric "storm" flicker at the top.
        // `surge` = momentary bright burst during the DRIVE/FEEDBACK reveal beat.
        function spiritGlow(stat, color, surge) {
          const gc = color ?? '#ffffff';
          if (surge) return { '--gc': gc, animation: 'battle-glow-burst 0.9s cubic-bezier(.22,1,.36,1)',
                              filter:`drop-shadow(0 0 60px #ffffff) drop-shadow(0 0 26px ${gc})` };
          const s = stat ?? 0;
          if (s <= 4)  return { filter:`drop-shadow(0 0 14px ${gc}66)` };                          // barely there
          if (s <= 6)  return { filter:`drop-shadow(0 0 26px ${gc}aa)` };                          // soft steady (baseline)
          if (s <= 8)  return { '--gc': gc, filter:`drop-shadow(0 0 34px ${gc}cc)`,
                                animation:'battle-glow-pulse 1.9s ease-in-out infinite' };          // bright + slow pulse
          if (s <= 10) return { '--gc': gc, filter:`drop-shadow(0 0 46px ${gc})`,
                                animation:'battle-glow-pulse-fast 1.1s ease-in-out infinite' };     // intense + fast pulse
          return { '--gc': gc, filter:`drop-shadow(0 0 60px ${gc}) drop-shadow(0 0 10px #ffffff)`,
                   animation:'battle-glow-storm 0.55s steps(6,end) infinite' };                    // electric storm
        }
        const atkGlow = spiritGlow(atkStat, attacker?.color, showFlashDrive);
        const defGlow = spiritGlow(defStat, defender?.color, showFlashSustain);

        // ── FAN-FARE / CROWD CHEER ──────────────────────────────────────────
        // The battle pick is the crowd's heartbeat. The further it slides toward
        // a Spirit, the more that Spirit glows — and the harder that side's fans
        // cheer. pickPos is negative toward the attacker (left / pink fans) and
        // positive toward the defender (right / blue fans), so each side's "lead"
        // is just how far the pick has crossed onto their half. Normalise that
        // lead into a 0..1 cheer level (≈8 slots of lead = full-tilt roar).
        const atkCheer = Math.max(0, Math.min(1, -clampedPos / 8)); // pink, left
        const defCheer = Math.max(0, Math.min(1,  clampedPos / 8)); // blue, right
        // Confirm-beat pops: fans jump when their number is locked in / on a win.
        const atkSurge = showFlashDrive   || (phase === 'result' && attackerWon);
        const defSurge = showFlashSustain || (phase === 'result' && !attackerWon);
        // level→energy: bob height, tempo, brightness and glow all rise together.
        // Even a losing side keeps a gentle idle sway — they're still fans.
        function crowdCheer(level, color, surge) {
          const amp    = 4 + level * 24;                       // bob height (px)
          const dur    = Math.max(0.32, 0.95 - level * 0.55);  // tempo (s) — hyped = faster
          const bright = 0.55 + level * 0.95 + (surge ? 0.5 : 0);
          const glow   = 5 + level * 30 + (surge ? 18 : 0);
          return {
            '--cheer-amp': `-${amp.toFixed(1)}px`,
            animation: `crowd-cheer ${surge ? '0.34' : dur.toFixed(2)}s ease-in-out infinite`,
            filter: `drop-shadow(0 0 ${glow.toFixed(0)}px ${color}) brightness(${bright.toFixed(2)})`,
            opacity: 0.45 + level * 0.55,
          };
        }
        const atkFans = crowdCheer(atkCheer, '#ff3ad0', atkSurge); // pink fanfare
        const defFans = crowdCheer(defCheer, '#34d6ff', defSurge); // blue fanfare

        // ── RETALIATION — "PART 2" of the battle, fully played out ────────────
        // A glancing hit (margin ≤ 2) earns the defender a real counter round:
        // they choose to swing back, then CLICK to roll their own die and try to
        // out-swing the attacker. Reuses NeonDie, spiritGlow and the fan-fare so
        // it reads as a continuation of the main battle rather than a side popup.
        if (phase === 'retaliation_prompt' || phase === 'retaliation_spin'
            || phase === 'retaliation_settling' || phase === 'retaliation_result') {
          const bs2        = battleState;
          const target     = bs2.counterTarget ?? bs2.atkRoll ?? 0;
          const vibeBonus  = bs2.vibeBonus ?? Math.round(((defender?.vibe ?? 1) / (defender?.maxVibe ?? 1)) * 3);
          const cFace      = bs2.counterFace ?? bs2.counterRoll ?? 1;
          const spinning   = phase === 'retaliation_spin';
          const settling   = phase === 'retaliation_settling';
          const showResult = phase === 'retaliation_result';
          const showTotal  = (bs2.counterReady || showResult);
          const cTotal     = showTotal ? (bs2.counterTotal ?? (cFace + vibeBonus)) : null;
          const success    = bs2.counterSuccess;
          const atkColor   = attacker?.color ?? '#ff4444';
          const defColor   = defender?.color ?? '#00ccff';
          // Crowd energy for the counter beat: defender's fans drive it, the
          // attacker's fans only roar back if the counter whiffs.
          const cAtk = crowdCheer(showResult ? (success ? 0.2 : 0.9) : 0.25, '#ff3ad0', showResult && !success);
          const cDef = crowdCheer(showResult ? (success ? 1 : 0.25) : 0.7,  '#34d6ff', showResult && success);
          // Defender is the aggressor now: glow scales up as they wind up / land.
          const defCounterGlow = spiritGlow(
            showResult ? (success ? (defStat ?? 6) + 5 : 3) : (defStat ?? 6) + 2,
            defColor, showResult && success);

          return (
            <div style={{position:'fixed', inset:0, background:'#000000f2', zIndex:9980,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              fontFamily:"'Orbitron',sans-serif", overflow:'hidden'}}>
              <style>{`
                @keyframes crowd-cheer { 0%,100%{transform:translateY(0) scaleY(1);} 50%{transform:translateY(var(--cheer-amp,-6px)) scaleY(1.05);} }
                @keyframes counter-click-bounce { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-5px);} }
                @keyframes counter-title-pulse { 0%,100%{text-shadow:0 0 20px #ffcc44, 0 0 50px #ff880055;} 50%{text-shadow:0 0 34px #ffee88, 0 0 80px #ffaa44aa;} }
                @keyframes counter-pop { 0%{opacity:0;transform:scale(0.5);} 55%{opacity:1;transform:scale(1.12);} 100%{opacity:1;transform:scale(1);} }
                @keyframes counter-spirit-l { from{transform:translateX(-45%);opacity:0;} to{transform:translateX(0);opacity:1;} }
                @keyframes counter-spirit-r { from{transform:translateX(45%) scaleX(-1);opacity:0;} to{transform:translateX(0) scaleX(-1);opacity:1;} }
              `}</style>

              {/* Fan-fare — pink (attacker) left, blue (defender) right */}
              <div style={{position:'absolute', left:0, right:0, bottom:0, height:'32%',
                           zIndex:1, pointerEvents:'none', overflow:'hidden'}}>
                <div style={{position:'absolute', left:'-3%', bottom:'-2%', width:'52%', maxWidth:680}}>
                  <img src={crowdPinkImg} alt="" draggable={false}
                    style={{width:'100%', display:'block', mixBlendMode:'screen', transformOrigin:'bottom center', ...cAtk}}/>
                </div>
                <div style={{position:'absolute', right:'-3%', bottom:'-2%', width:'52%', maxWidth:680}}>
                  <img src={crowdBlueImg} alt="" draggable={false}
                    style={{width:'100%', display:'block', mixBlendMode:'screen', transformOrigin:'bottom center', ...cDef}}/>
                </div>
              </div>

              {/* Title */}
              <div style={{position:'relative', zIndex:3, textAlign:'center', marginBottom:4}}>
                <div style={{fontSize:11, color:'#7a6a3a', letterSpacing:6, marginBottom:4}}>BATTLE · PART 2</div>
                <div style={{fontSize:30, fontWeight:900, letterSpacing:6, color:'#ffd34d',
                  animation:'counter-title-pulse 1.6s ease-in-out infinite'}}>🥊 RETALIATION</div>
              </div>

              {/* Spirits + center stage */}
              <div style={{position:'relative', zIndex:3, display:'flex', alignItems:'flex-end',
                           justifyContent:'center', gap:20, marginTop:6}}>

                {/* Attacker — now bracing for the counter */}
                <div style={{width:168, height:270, position:'relative', flexShrink:0,
                             animation:'counter-spirit-l 0.5s cubic-bezier(.22,1,.36,1) both'}}>
                  <img src={attacker?.imageSrc} alt={attacker?.name}
                    style={{height:'100%', width:'auto', objectFit:'contain', objectPosition:'bottom center', display:'block',
                      opacity: showResult && success ? 0.55 : 0.85,
                      filter:`drop-shadow(0 0 ${showResult && success ? 8 : 16}px ${atkColor}${showResult && success ? '55' : 'aa'})`,
                      transition:'opacity .4s, filter .4s'}}/>
                  <div style={{position:'absolute', top:4, left:'50%', transform:'translateX(-50%)',
                    fontSize:9, color:atkColor, letterSpacing:2, whiteSpace:'nowrap'}}>
                    {showResult && success ? 'TAKES IT' : 'BRACING'}
                  </div>
                </div>

                {/* Center: threshold + counter die / result */}
                <div style={{display:'flex', flexDirection:'column', alignItems:'center',
                             minWidth:300, paddingBottom:18}}>
                  <div style={{textAlign:'center', marginBottom:10}}>
                    <div style={{fontSize:9, color:'#6a8aaa', letterSpacing:3}}>OUT-SWING THE HIT</div>
                    <div style={{fontSize:32, fontWeight:900, color:atkColor, lineHeight:1.1,
                      textShadow:`0 0 18px ${atkColor}`}}>{target}</div>
                    <div style={{fontSize:8.5, color:'#3a5a7a', letterSpacing:1, marginTop:2}}>
                      {defender?.name}: d6 + Vibe ({vibeBonus}) — meet or beat it
                    </div>
                  </div>

                  {phase === 'retaliation_prompt' ? (
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:11, color:'#ffcc44', letterSpacing:2, marginBottom:10}}>🛡️ SWING BACK?</div>
                      <div style={{height:4, width:240, background:'#1a2a40', borderRadius:2, marginBottom:14, overflow:'hidden'}}>
                        <div style={{height:'100%', borderRadius:2, background:'#ffcc44',
                          width:`${((retaliationTimer ?? 0) / 3) * 100}%`, transition:'width 1s linear'}}/>
                      </div>
                      <div style={{display:'flex', gap:12, justifyContent:'center'}}>
                        <button onClick={() => resolveRetaliation(true)}
                          style={{fontFamily:'inherit', fontSize:11, padding:'11px 22px', background:'#1a1400',
                            border:'2px solid #ffcc44', borderRadius:7, color:'#ffcc44', cursor:'pointer',
                            fontWeight:700, boxShadow:'0 0 14px #ffcc4444'}}>
                          ⚡ COUNTER! ({retaliationTimer}s)
                        </button>
                        <button onClick={() => resolveRetaliation(false)}
                          style={{fontFamily:'inherit', fontSize:10, padding:'11px 16px', background:'#0a1020',
                            border:'1px solid #3a5070', borderRadius:7, color:'#6a8099', cursor:'pointer'}}>
                          Absorb {bs2.damage} dmg
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                      <div onClick={spinning ? handleCounterDieClick : undefined}
                        style={{cursor: spinning ? 'pointer' : 'default', userSelect:'none',
                          display:'flex', flexDirection:'column', alignItems:'center'}}>
                        <NeonDie value={cFace} spinning={spinning || settling} color={defColor} size={120} sides={6}/>
                        {spinning && (
                          <div style={{marginTop:6, fontSize:10, color:defColor, letterSpacing:3,
                            animation:'counter-click-bounce 0.6s ease-in-out infinite'}}>CLICK TO COUNTER</div>
                        )}
                        {cTotal !== null && (
                          <div style={{marginTop:6, fontSize:11, color:'#ffcc44', letterSpacing:1}}>
                            {cFace} + {vibeBonus} = <b>{cTotal}</b>
                          </div>
                        )}
                      </div>
                      {showResult && (
                        <div key="cres" style={{marginTop:12, textAlign:'center',
                          animation:'counter-pop 0.5s cubic-bezier(.22,1,.36,1) both'}}>
                          <div style={{fontSize:25, fontWeight:900, letterSpacing:3,
                            color: success ? '#44ff99' : '#ff4455',
                            textShadow:`0 0 22px ${success ? '#44ff99' : '#ff4455'}`}}>
                            {success ? '💥 COUNTER LANDS!' : '💔 COUNTER FAILS!'}
                          </div>
                          <div style={{fontSize:10, color:'#9ab', marginTop:6, lineHeight:1.6}}>
                            {success
                              ? <>{defender?.name} swings back for <span style={{color:'#ff6677'}}>{bs2.counterDmg} Vibe</span> + knockback · <span style={{color:'#ffd700'}}>⭐ Fame</span></>
                              : <>caught swinging — <span style={{color:'#ff6677'}}>{bs2.counterDmg} Vibe</span>, worse than absorbing</>}
                          </div>
                          <button onClick={() => { setBattleState(null); setDiceDisplay(null); }}
                            style={{marginTop:14, fontFamily:'inherit', fontSize:11, padding:'10px 24px',
                              background:'#1a1400', border:`2px solid ${success ? '#44ff99' : '#ff4455'}`,
                              borderRadius:7, color: success ? '#44ff99' : '#ff4455', cursor:'pointer', fontWeight:700}}>
                            🤘 ROCK ON →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Defender — the one throwing the counter */}
                <div style={{width:168, height:270, position:'relative', flexShrink:0,
                             animation:'counter-spirit-r 0.5s cubic-bezier(.22,1,.36,1) both'}}>
                  <img src={defender?.imageSrc} alt={defender?.name}
                    style={{height:'100%', width:'auto', objectFit:'contain', objectPosition:'bottom center', display:'block',
                      transform:'scaleX(-1)', ...defCounterGlow, transition:'filter .4s'}}/>
                  <div style={{position:'absolute', top:4, left:'50%', transform:'translateX(-50%)',
                    fontSize:9, color:defColor, letterSpacing:2, whiteSpace:'nowrap'}}>
                    {showResult ? (success ? 'COUNTER!' : 'WHIFFED') : spinning ? 'YOUR ROLL' : 'WINDING UP'}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        // ── CONDITION-SPRITE HOOKS ──────────────────────────────────────────
        // Drop custom art in later by adding a `sprites` map to a SPIRIT_DEF,
        // e.g. sprites:{ attack, hit, block, charge }. Falls back to imageSrc.
        const atkImg = (phase === 'result' && !sonicAttack && attacker?.sprites?.attack)
          ? attacker.sprites.attack : attacker?.imageSrc;
        const defImg = (phase === 'result' && defender?.sprites
          ? defender.sprites[attackerWon ? 'hit' : 'block'] : null) ?? defender?.imageSrc;

        // ── CQC CRASH (melee result) ────────────────────────────────────────
        // Lunge force scales with how decisively the attacker won (margin).
        const crashTier = !attackerWon ? 'whiff' : margin >= 6 ? 'heavy' : margin >= 3 ? 'medium' : 'light';
        const isCrash = phase === 'result' && !sonicAttack;
        const crashDur = crashTier === 'heavy' ? '0.6s' : crashTier === 'medium' ? '0.7s' : '0.8s';
        const atkCrashAnim = isCrash
          ? (attackerWon
              ? `battle-crash-${crashTier} ${crashDur} cubic-bezier(0.3,0,0.2,1) both`
              : 'battle-crash-whiff 0.9s cubic-bezier(0.3,0,0.4,1) both')
          : null;
        const defRecoilAnim = isCrash && attackerWon
          ? `battle-recoil-${crashTier} 0.7s cubic-bezier(0.3,0,0.2,1) both`
          : null;
        const rowShakeAnim = isCrash && attackerWon
          ? `battle-row-shake-${crashTier === 'heavy' ? 'hard' : 'soft'} 0.6s ease-out`
          : null;

        // ── SONIC BEAM (ranged) ─────────────────────────────────────────────
        // Charges through the dice spin, then surges to full power once the
        // total is locked. Thickness/length scale with power; connects on a
        // win, sputters on a whiff.
        const beamPhase = !sonicAttack ? null
          : phase === 'result' ? (attackerWon ? 'blast' : 'fizzle')
          : ['atk_die_spin','atk_die_settling','pick_atk_slide','def_die_spin',
             'def_die_settling','pick_def_slide'].includes(phase) ? 'charge'
          : null;
        const beamPower   = beamPhase === 'blast' ? (atkTotal ?? atkStat ?? 6) : (atkStat ?? 6);
        const beamH       = beamPhase === 'charge' ? 8 : Math.min(96, Math.round(10 + beamPower * 3.2)); // px
        const beamColor   = attacker?.color ?? '#aa66ff';

        // ── MOVE-NAME NEON CALLOUT (CQC only, fires at result) ──────────────
        let moveFlash = null;
        if (phase === 'result' && !sonicAttack) {
          if (!attackerWon) {
            moveFlash = { text:'whiff…', color:'#6688aa', whiff:true };
          } else {
            const landed = battleState.swingEffectRoll?.effects ?? [];
            if (landed.length > 0) {
              moveFlash = {
                text: (battleState.swingEffectRoll?.upgradeName ?? 'Swing').toUpperCase(),
                color: SWING_FX_INFO[landed[0]]?.color ?? '#ff44aa',
              };
            } else {
              moveFlash = { text: battleState.danceName ?? 'SWING', color:'#44ddff' };
            }
          }
        }

        return (
          <div style={{
            position:'fixed', inset:0, background:'#000000f2', zIndex:9980,
            display:'flex', flexDirection:'column', alignItems:'center',
            // 'safe center' keeps content centered but never clips the top/bottom;
            // overflowY lets the result banner scroll into view on short screens
            justifyContent:'safe center', overflowY:'auto', overflowX:'hidden',
            padding:'24px 0',
            fontFamily:"'Orbitron',sans-serif",
          }}>
            <style>{`
              @keyframes battle-spirit-left {
                from { transform:translateX(-130%); opacity:0; }
                to   { transform:translateX(0);    opacity:1; }
              }
              @keyframes battle-spirit-right {
                from { transform:translateX(130%);  opacity:0; }
                to   { transform:translateX(0);    opacity:1; }
              }
              @keyframes battle-stat-flash {
                0%   { opacity:0; transform:translate(-50%,-50%) scale(0.3); }
                45%  { opacity:1; transform:translate(-50%,-50%) scale(1.18); }
                70%  { opacity:1; transform:translate(-50%,-50%) scale(1.0); }
                100% { opacity:1; transform:translate(-50%,-50%) scale(1.0); }
              }
              @keyframes battle-result-slam {
                0%   { opacity:0; transform:translateY(40px) scale(0.6); }
                55%  { opacity:1; transform:translateY(-6px) scale(1.06); }
                100% { opacity:1; transform:translateY(0)   scale(1.0); }
              }
              @keyframes battle-pick-glow {
                0%,100% { filter:drop-shadow(0 0 8px #ff44ff) drop-shadow(0 0 4px #ffffff88); }
                50%     { filter:drop-shadow(0 0 20px #ff88ff) drop-shadow(0 0 8px #ffffff); }
              }
              @keyframes battle-die-pulse {
                0%,100% { opacity:1; }
                50%     { opacity:0.7; }
              }
              @keyframes battle-click-bounce {
                0%,100% { transform:translateY(0); }
                50%     { transform:translateY(-4px); }
              }
              @keyframes battle-overlay-fade-out {
                0%   { opacity:1; }
                100% { opacity:0; }
              }
              /* ── Fan-fare crowd bob (amplitude driven by var(--cheer-amp)) ── */
              @keyframes crowd-cheer {
                0%,100% { transform:translateY(0)                       scaleY(1);    }
                50%     { transform:translateY(var(--cheer-amp,-6px))   scaleY(1.05); }
              }
              /* ── Stat-strength glow tiers (var(--gc) = spirit colour) ── */
              @keyframes hydra-loom {
                0%,100% { transform:translateY(0) scale(1);     opacity:0.42; }
                50%     { transform:translateY(-8px) scale(1.03); opacity:0.6; }
              }
              @keyframes battle-glow-pulse {
                0%,100% { filter:drop-shadow(0 0 22px var(--gc)) drop-shadow(0 0 8px var(--gc)); }
                50%     { filter:drop-shadow(0 0 40px var(--gc)) drop-shadow(0 0 16px #ffffff); }
              }
              @keyframes battle-glow-pulse-fast {
                0%,100% { filter:drop-shadow(0 0 34px var(--gc)) drop-shadow(0 0 12px var(--gc)); }
                50%     { filter:drop-shadow(0 0 60px var(--gc)) drop-shadow(0 0 24px #ffffff) brightness(1.15); }
              }
              @keyframes battle-glow-storm {
                0%   { filter:drop-shadow(0 0 30px var(--gc)) drop-shadow(0 0 6px #ffffff); }
                18%  { filter:drop-shadow(0 0 64px var(--gc)) drop-shadow(0 0 20px #ffffff) brightness(1.4); }
                32%  { filter:drop-shadow(0 0 18px var(--gc)) drop-shadow(0 0 4px var(--gc)); }
                55%  { filter:drop-shadow(0 0 70px #ffffff) drop-shadow(0 0 26px var(--gc)) brightness(1.6); }
                70%  { filter:drop-shadow(0 0 24px var(--gc)) drop-shadow(0 0 6px var(--gc)); }
                100% { filter:drop-shadow(0 0 30px var(--gc)) drop-shadow(0 0 6px #ffffff); }
              }
              @keyframes battle-glow-burst {
                0%   { filter:drop-shadow(0 0 20px var(--gc)) drop-shadow(0 0 6px var(--gc)); }
                40%  { filter:drop-shadow(0 0 70px #ffffff) drop-shadow(0 0 30px var(--gc)) brightness(1.5); }
                100% { filter:drop-shadow(0 0 34px var(--gc)) drop-shadow(0 0 12px var(--gc)); }
              }
              /* ── Move-name neon callout (CQC) ── */
              @keyframes battle-move-flash {
                0%   { opacity:0; transform:translate(-50%,-50%) scale(0.4) rotate(-6deg); }
                18%  { opacity:1; transform:translate(-50%,-50%) scale(1.22) rotate(2deg); }
                34%  { opacity:1; transform:translate(-50%,-50%) scale(1.0) rotate(0deg); }
                78%  { opacity:1; transform:translate(-50%,-50%) scale(1.0) rotate(0deg); }
                100% { opacity:0; transform:translate(-50%,-50%) scale(1.1) rotate(0deg); }
              }
              @keyframes battle-move-whiff {
                0%   { opacity:0; transform:translate(-50%,-50%) scale(1.0) rotate(0deg); }
                25%  { opacity:1; transform:translate(-50%,-46%) scale(1.0) rotate(0deg); }
                55%  { opacity:0.9; transform:translate(-50%,-30%) scale(0.92) rotate(-3deg); }
                100% { opacity:0; transform:translate(-50%,4%) scale(0.8) rotate(-8deg); }
              }
              /* ── CQC crash: attacker lunge (right) + defender recoil ── */
              /* ── CQC crash: attacker charges the full gap INTO the defender ──
                 min(62vw,980px) closes the meter gap on desktop, scales on mobile. */
              @keyframes battle-crash-light  { 0%{transform:translateX(0)} 46%{transform:translateX(calc(min(62vw,980px) - 70px))} 62%{transform:translateX(calc(min(62vw,980px) - 100px))} 100%{transform:translateX(0)} }
              @keyframes battle-crash-medium { 0%{transform:translateX(0)} 42%{transform:translateX(min(62vw,980px))} 58%{transform:translateX(calc(min(62vw,980px) - 30px))} 100%{transform:translateX(0)} }
              @keyframes battle-crash-heavy  { 0%{transform:translateX(0)} 36%{transform:translateX(min(62vw,980px))} 52%{transform:translateX(calc(min(62vw,980px) - 45px))} 100%{transform:translateX(0)} }
              @keyframes battle-crash-whiff  { 0%{transform:translateX(0) rotate(0)} 40%{transform:translateX(min(62vw,980px)) rotate(6deg)} 58%{transform:translateX(calc(min(62vw,980px) + 60px)) rotate(13deg)} 100%{transform:translateX(0) rotate(0)} }
              /* ── Defender knockback on impact (wrapper isn't mirrored; +X = driven back right) ── */
              @keyframes battle-recoil-light  { 0%{transform:translateX(0)} 48%{transform:translateX(0)} 58%{transform:translateX(min(10vw,150px))} 76%{transform:translateX(min(5vw,80px))} 100%{transform:translateX(0)} }
              @keyframes battle-recoil-medium { 0%{transform:translateX(0)} 44%{transform:translateX(0)} 56%{transform:translateX(min(16vw,240px))} 74%{transform:translateX(min(8vw,130px))} 100%{transform:translateX(0)} }
              @keyframes battle-recoil-heavy  { 0%{transform:translateX(0) rotate(0)} 40%{transform:translateX(0)} 52%{transform:translateX(min(22vw,330px)) rotate(7deg)} 70%{transform:translateX(min(12vw,190px)) rotate(3deg)} 100%{transform:translateX(0) rotate(0)} }
              @keyframes battle-row-shake-soft { 0%,100%{transform:translate(0,0)} 20%{transform:translate(-3px,2px)} 40%{transform:translate(3px,-2px)} 60%{transform:translate(-2px,1px)} 80%{transform:translate(2px,-1px)} }
              @keyframes battle-row-shake-hard { 0%,100%{transform:translate(0,0)} 15%{transform:translate(-9px,5px)} 30%{transform:translate(8px,-6px)} 45%{transform:translate(-7px,4px)} 60%{transform:translate(6px,-3px)} 75%{transform:translate(-4px,2px)} 90%{transform:translate(3px,-1px)} }
              /* ── Sonic beam ── */
              @keyframes battle-beam-charge { 0%,100%{opacity:0.45} 50%{opacity:0.8} }
              @keyframes battle-beam-blast  { 0%{opacity:0; transform:translateY(-50%) scaleX(0.1)} 30%{opacity:1; transform:translateY(-50%) scaleX(1.05)} 100%{opacity:1; transform:translateY(-50%) scaleX(1)} }
              @keyframes battle-beam-crackle { 0%,100%{filter:brightness(1)} 25%{filter:brightness(1.5)} 50%{filter:brightness(0.85)} 75%{filter:brightness(1.7)} }
              @keyframes battle-beam-fizzle { 0%{opacity:0.7; transform:translateY(-50%) scaleX(0.6)} 100%{opacity:0; transform:translateY(-30%) scaleX(0.3) rotate(-4deg)} }
              @keyframes battle-impact { 0%{opacity:0; transform:translate(-50%,-50%) scale(0.2)} 25%{opacity:1; transform:translate(-50%,-50%) scale(1.0)} 100%{opacity:0; transform:translate(-50%,-50%) scale(1.6)} }
              @keyframes battle-muzzle { 0%,100%{opacity:0.6; transform:translate(-50%,-50%) scale(0.9)} 50%{opacity:1; transform:translate(-50%,-50%) scale(1.15)} }
            `}</style>

            {/* ── FAN-FARE / CROWD ── audience at the foot of the stage.
                Pink fans rally behind the attacker (left), blue behind the
                defender (right). They bob harder the further the battle pick
                slides onto their half (atkCheer / defCheer) and pop on each
                confirmed number. The PNGs are neon-on-black, so screen blend
                drops the black background and leaves only the glowing fans. */}
            <div style={{position:'absolute', left:0, right:0, bottom:0, height:'34%',
                         zIndex:1, pointerEvents:'none', overflow:'hidden'}}>
              {/* pink fanfare — attacker, fades in with their Spirit */}
              <div style={{position:'absolute', left:'-3%', bottom:'-2%',
                           width:'54%', maxWidth:720,
                           opacity: atkIn ? 1 : 0, transition:'opacity 0.7s ease'}}>
                <img src={crowdPinkImg} alt="" draggable={false}
                  style={{width:'100%', display:'block', mixBlendMode:'screen',
                          transformOrigin:'bottom center', ...atkFans}}/>
              </div>
              {/* blue fanfare — defender, fades in with their Spirit */}
              <div style={{position:'absolute', right:'-3%', bottom:'-2%',
                           width:'54%', maxWidth:720,
                           opacity: defIn ? 1 : 0, transition:'opacity 0.7s ease'}}>
                <img src={crowdBlueImg} alt="" draggable={false}
                  style={{width:'100%', display:'block', mixBlendMode:'screen',
                          transformOrigin:'bottom center', ...defFans}}/>
              </div>
            </div>

            {/* ── Spirit + Meter + Spirit row ── */}
            <div style={{display:'flex', alignItems:'flex-end', justifyContent:'center',
                         width:'100%', maxWidth:1300, gap:0,
                         position:'relative',
                         animation: rowShakeAnim ?? 'none'}}>

              {/* ── SONIC BEAM LAYER (procedural; swap in attacker.sprites.beam later) ── */}
              {beamPhase && (
                <div style={{
                  position:'absolute', left:'18%', right:'22%',
                  top:'54%', height:beamH, transform:'translateY(-50%)',
                  zIndex:4, pointerEvents:'none', transformOrigin:'left center',
                  animation: beamPhase === 'blast'  ? 'battle-beam-blast 0.45s cubic-bezier(0.2,0,0.2,1) both'
                           : beamPhase === 'fizzle' ? 'battle-beam-fizzle 0.6s ease-in both'
                           : 'battle-beam-charge 0.4s ease-in-out infinite',
                }}>
                  {/* Hook: render a custom beam sprite stretched along the path */}
                  {attacker?.sprites?.beam ? (
                    <img src={attacker.sprites.beam} alt="" style={{width:'100%',height:'100%',objectFit:'fill'}}/>
                  ) : (
                    <div style={{
                      position:'absolute', inset:0, borderRadius:beamH,
                      background:`linear-gradient(90deg, ${beamColor}00 0%, ${beamColor}cc 12%, ${beamColor} 55%, #ffffff 100%)`,
                      boxShadow:`0 0 ${beamH}px ${beamColor}, 0 0 ${beamH*2.4}px ${beamColor}88`,
                      animation: beamPhase === 'blast' ? 'battle-beam-crackle 0.12s steps(2,end) infinite' : 'none',
                    }}>
                      {/* bright inner core */}
                      <div style={{position:'absolute', left:'10%', right:0, top:'50%',
                        height:Math.max(2, beamH*0.28), transform:'translateY(-50%)',
                        background:'#ffffff', borderRadius:beamH, opacity:0.9,
                        boxShadow:'0 0 8px #ffffff'}}/>
                    </div>
                  )}
                  {/* muzzle flash at the emitter */}
                  <div style={{position:'absolute', left:0, top:'50%',
                    width:beamH*1.8, height:beamH*1.8, borderRadius:'50%',
                    background:`radial-gradient(circle, #ffffff, ${beamColor}aa 40%, transparent 70%)`,
                    animation:'battle-muzzle 0.18s ease-in-out infinite'}}/>
                </div>
              )}

              {/* ── IMPACT BURST where they collide (sonic blast or melee crash) ── */}
              {phase === 'result' && attackerWon && (
                <div style={{
                  position:'absolute', right:'20%', top: sonicAttack ? '54%' : '48%',
                  width:sonicAttack ? 160 : (crashTier === 'heavy' ? 220 : crashTier === 'medium' ? 170 : 120),
                  height:sonicAttack ? 160 : (crashTier === 'heavy' ? 220 : crashTier === 'medium' ? 170 : 120),
                  zIndex:6, pointerEvents:'none',
                  background:`radial-gradient(circle, #ffffff 0%, ${(sonicAttack?beamColor:(attacker?.color))??'#ffaa44'}cc 35%, transparent 70%)`,
                  animation:'battle-impact 0.6s ease-out both',
                }}/>
              )}

              {/* ATTACKER SPIRIT */}
              <div style={{
                width:200, height:SPIRIT_H, flexShrink:0, position:'relative', overflow:'visible',
                marginRight:-50, zIndex:3,
                animation: atkCrashAnim ? atkCrashAnim
                          : atkIn ? 'battle-spirit-left 1.1s cubic-bezier(0.22,1,0.36,1) both' : 'none',
                opacity: atkIn ? 1 : 0,
              }}>
                <img src={atkImg} alt={attacker?.name}
                  style={{
                    height:'100%', width:'auto', maxWidth:260,
                    objectFit:'contain', objectPosition:'bottom center', display:'block',
                    ...atkGlow,
                  }}/>
                {showFlashDrive && (
                  <div style={{
                    position:'absolute', top:'22%', left:'50%',
                    animation:'battle-stat-flash 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
                    textAlign:'center', zIndex:10, pointerEvents:'none',
                    transform:'translate(-50%,-50%)',
                  }}>
                    <div style={{fontSize:88, fontWeight:900, lineHeight:1,
                      color:'#ff3322', textShadow:'0 0 30px #ff0000, 0 0 12px #ff6644', letterSpacing:2}}>
                      {atkStat}
                    </div>
                    {atkBonus > 0 && (
                      <div style={{fontSize:13, color:'#ffaa44', letterSpacing:2, marginTop:2}}>
                        ({atkBase} +{atkBonus})
                      </div>
                    )}
                    <div style={{fontSize:12, color:'#ff8844', letterSpacing:4, marginTop:4}}>DRIVE</div>
                  </div>
                )}
              </div>

              {/* BATTLE METER */}
              <div style={{position:'relative', flexShrink:0, zIndex:2}}>
                {/* 🐉 HYDRA — the three-headed beast looms behind the Ronin, its
                    three beams screaming toward the defender. Black bg drops out
                    via screen blend. */}
                {battleState.hydra && (
                  <img src={hydraImg} alt="" draggable={false}
                    style={{position:'absolute', left:'-14%', top:'-46%', width:'128%',
                      pointerEvents:'none', mixBlendMode:'screen', opacity:0.5,
                      filter:'drop-shadow(0 0 26px #aa55ff66)', zIndex:1,
                      animation:'hydra-loom 2.4s ease-in-out infinite'}}/>
                )}
                <img src={battleMeterImg} alt="Battle Meter"
                  style={{
                    width:METER_W, maxWidth:'68vw', display:'block', borderRadius:10,
                    boxShadow:'0 0 60px #ff44ff22, 0 0 30px #00ccff11',
                    position:'relative', zIndex:2,
                  }}/>

                {/* SVG overlay — pointer-events none so absolute click divs work */}
                <svg viewBox={`0 0 ${METER_W} ${METER_H}`}
                  style={{position:'absolute', inset:0, width:'100%', height:'100%', overflow:'visible', pointerEvents:'none'}}>

                  {/* ATK Die slot — SVG background rect sized to full square */}
                  <rect x={ATK_SQ_X-SQ/2} y={ATK_SQ_Y-SQ/2} width={SQ} height={SQ} rx={16}
                    fill="#040608" stroke={showAtkDie ? (attacker?.color ?? '#ff4444') : '#1a2240'}
                    strokeWidth={showAtkDie ? 2 : 1} opacity={0.6}/>

                  {/* DEF Die slot — SVG background rect sized to full square */}
                  <rect x={DEF_SQ_X-SQ/2} y={DEF_SQ_Y-SQ/2} width={SQ} height={SQ} rx={16}
                    fill="#040608" stroke={showDefDie ? (defender?.color ?? '#00ccff') : '#1a2240'}
                    strokeWidth={showDefDie ? 2 : 1} opacity={0.6}/>
                </svg>

                {/* ── ATK DIE — absolute HTML div, centered within square, reliable click ── */}
                {showAtkDie && (
                  <div
                    onClick={atkSpinning ? handleAtkDieClick : undefined}
                    style={{
                      position:'absolute',
                      // Center the die within the square: offset by (SQ-DIE_SIZE)/2
                      left:`${((ATK_SQ_X - DIE_SIZE/2) / METER_W) * 100}%`,
                      top:`${((ATK_SQ_Y - DIE_SIZE/2) / METER_H) * 100}%`,
                      width:`${(DIE_SIZE / METER_W) * 100}%`,
                      aspectRatio:'1',
                      display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center',
                      cursor: atkSpinning ? 'pointer' : 'default',
                      zIndex:6, userSelect:'none',

                    }}>
                    {battleState.hydra ? (
                      <div style={{display:'flex', gap:`${DIE_SIZE*0.06}px`, alignItems:'center', justifyContent:'center'}}>
                        {[0,1,2].map(i => {
                          const v = atkSpinning
                            ? (battleState.hydraSpin?.[i] ?? 1)
                            : (battleState.hydraDice?.[i] ?? 1);
                          return <NeonDie key={i} value={v} spinning={atkSpinning}
                            color={attacker?.color ?? '#4488ff'} size={DIE_SIZE*0.56} sides={6}/>;
                        })}
                      </div>
                    ) : (
                      <NeonDie value={atkFace} spinning={atkSpinning} color={attacker?.color ?? '#ff4444'} size={DIE_SIZE} sides={battleState.sonicAttack ? (battleState.dieSides ?? 6) : 6}/>
                    )}
                    {atkSpinning && (
                      <div style={{
                        marginTop:4, fontSize:9, color: attacker?.color ?? '#ff4444',
                        letterSpacing:3, fontFamily:"'Orbitron',sans-serif",
                        animation:'battle-click-bounce 0.6s ease-in-out infinite',
                      }}>CLICK</div>
                    )}
                    {phase === 'result' && atkFace !== null && (
                      <div style={{marginTop:3, fontSize:8, color:'#ffcc44', letterSpacing:1,
                        fontFamily:"'Orbitron',sans-serif"}}>
                        +{atkFace} = {atkTotal}
                      </div>
                    )}
                  </div>
                )}

                {/* ── DEF DIE — absolute HTML div, centered within square ── */}
                {showDefDie && (
                  <div
                    onClick={defSpinning ? handleDefDieClick : undefined}
                    style={{
                      position:'absolute',
                      left:`${((DEF_SQ_X - DIE_SIZE/2) / METER_W) * 100}%`,
                      top:`${((DEF_SQ_Y - DIE_SIZE/2) / METER_H) * 100}%`,
                      width:`${(DIE_SIZE / METER_W) * 100}%`,
                      aspectRatio:'1',
                      display:'flex', flexDirection:'column',
                      alignItems:'center', justifyContent:'center',
                      cursor: defSpinning ? 'pointer' : 'default',
                      zIndex:6, userSelect:'none',

                    }}>
                    <NeonDie value={defFace} spinning={defSpinning} color={defender?.color ?? '#00ccff'} size={DIE_SIZE}/>
                    {defSpinning && (
                      <div style={{
                        marginTop:4, fontSize:9, color: defender?.color ?? '#00ccff',
                        letterSpacing:3, fontFamily:"'Orbitron',sans-serif",
                        animation:'battle-click-bounce 0.6s ease-in-out infinite',
                      }}>CLICK</div>
                    )}
                    {phase === 'result' && defFace !== null && (
                      <div style={{marginTop:3, fontSize:8, color:'#ffcc44', letterSpacing:1,
                        fontFamily:"'Orbitron',sans-serif"}}>
                        {battleState?.posing ? '🌟 POSING = 0' : `+${defFace} = ${defTotal}`}
                      </div>
                    )}
                  </div>
                )}

                {/* ── PICK — absolute div, CSS transition for smooth slide ── */}
                <div style={{
                  position:'absolute',
                  left:`${(pickX / METER_W) * 100}%`,
                  top:`${((TRACK_Y - 56) / METER_H) * 100}%`,
                  transform:'translateX(-50%)',
                  width:`${(60 / METER_W) * 100}%`,
                  transition: pickTransition,
                  pointerEvents:'none', zIndex:5,
                  animation:'battle-pick-glow 1.4s ease-in-out infinite',
                }}>
                  <img src={battlePickImg} alt="pick" style={{width:'100%', display:'block'}}/>
                </div>
              </div>

              {/* DEFENDER SPIRIT */}
              <div style={{
                width:200, height:SPIRIT_H, flexShrink:0, position:'relative', overflow:'visible',
                marginLeft:-50, zIndex:3,
                animation: defRecoilAnim ? defRecoilAnim
                          : defIn ? 'battle-spirit-right 1.1s cubic-bezier(0.22,1,0.36,1) both' : 'none',
                opacity: defIn ? 1 : 0,
              }}>
                <img src={defImg} alt={defender?.name}
                  style={{
                    height:'100%', width:'auto', maxWidth:260,
                    objectFit:'contain', objectPosition:'bottom center', display:'block',
                    transform:'scaleX(-1)',
                    ...defGlow,
                  }}/>
                {showFlashSustain && (
                  <div style={{
                    position:'absolute', top:'22%', left:'50%',
                    animation:'battle-stat-flash 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
                    textAlign:'center', zIndex:10, pointerEvents:'none',
                    transform:'translate(-50%,-50%)',
                  }}>
                    <div style={{fontSize:88, fontWeight:900, lineHeight:1,
                      color:'#00ccff', textShadow:'0 0 30px #0088ff, 0 0 12px #88ccff', letterSpacing:2}}>
                      {defStat}
                    </div>
                    {defBonus > 0 && (
                      <div style={{fontSize:13, color:'#88ccff', letterSpacing:2, marginTop:2}}>
                        ({defBase} +{defBonus})
                      </div>
                    )}
                    <div style={{fontSize:12, color:'#88ccff', letterSpacing:4, marginTop:4}}>FEEDBACK</div>
                  </div>
                )}
              </div>
            </div>

            {/* ── MOVE-NAME NEON CALLOUT (CQC result) ── */}
            {moveFlash && (
              <div key={`move-${phase}-${moveFlash.text}`} style={{
                position:'absolute', top:'34%', left:'50%', zIndex:9,
                transform:'translate(-50%,-50%)', pointerEvents:'none', textAlign:'center',
                animation: moveFlash.whiff
                  ? 'battle-move-whiff 1.3s ease-in forwards'
                  : 'battle-move-flash 1.6s cubic-bezier(0.22,1,0.36,1) forwards',
              }}>
                <div style={{
                  fontFamily:"'Orbitron',sans-serif", fontWeight:900,
                  fontSize: moveFlash.whiff ? 44 : 76,
                  letterSpacing: moveFlash.whiff ? 4 : 6,
                  color: moveFlash.whiff ? moveFlash.color : '#ffffff',
                  textShadow: moveFlash.whiff
                    ? `0 0 12px ${moveFlash.color}`
                    : `0 0 18px ${moveFlash.color}, 0 0 40px ${moveFlash.color}, 0 0 70px ${moveFlash.color}`,
                  WebkitTextStroke: moveFlash.whiff ? 'none' : `2px ${moveFlash.color}`,
                  fontStyle: moveFlash.whiff ? 'italic' : 'normal',
                }}>
                  {moveFlash.text}
                </div>
              </div>
            )}

            {/* ── Attack name banner ── */}
            {(() => {
              const nsA = noteStates[battleState.attackerId] ?? {};
              // Live CQC chain first (legacy swingUpgrades is never populated)
              const cqcSkills = nsA.unlockedSkills ?? [];
              const cqcTop = ['baki_gravity','moon_shuffle','cosmic_boogaloo','shank_skank']
                .find(id => cqcSkills.includes(id));
              const cqcDef = cqcTop ? SKILL_BY_ID[cqcTop] : null;
              const swingUpgrades = nsA.swingUpgrades ?? [];
              const highestTier = ['swing_3','swing_2','swing_1'].find(t => swingUpgrades.includes(t));
              const tierDef = highestTier ? SWING_UPGRADE_TIERS.find(t => t.id === highestTier) : null;
              const attackLabel = battleState.sonicAttack
                ? `🔊 Sonic Attack (d${battleState.dieSides})`
                : cqcDef ? `${cqcDef.icon} ${cqcDef.label}`
                : tierDef ? `${tierDef.icon} ${tierDef.label}` : '⚔️ Swing';
              const mods = battleState.skillMods ?? {};
              const activeMods = [
                mods.laserActive      && { icon:'🔴', label:'Laser Show',     color:'#ff4444', desc:"Defender's die halved" },
                mods.stageLightActive && { icon:'💡', label:'Stage Lighting',  color:'#ffcc44', desc:'+1 Vibe on win' },
                mods.fogActive        && { icon:'🌫️', label:'Fog Machine',     color:'#aaccff', desc:'-1 Drive, -1 Feedback' },
                mods.pyroBonus > 0    && { icon:'🔥', label:'Pyrotechnics',    color:'#ff8844', desc:`+${mods.pyroBonus} Drive` },
                (battleState.pedalBonus > 0) && { icon:'🎛️', label:'Pedal Dist', color:'#44ffaa', desc:`+${battleState.pedalBonus} Drive` },
                (battleState.powerBonus > 0) && { icon:'🤘', label:'Power Chords',color:'#ffcc44', desc:`+${battleState.powerBonus} Drive` },
              ].filter(Boolean);
              return (
                <div style={{textAlign:'center'}}>
                  <div style={{
                    marginTop:8,
                    fontFamily:"'Orbitron',sans-serif",
                    fontSize:22, fontWeight:900, letterSpacing:4,
                    color: attacker?.color ?? '#ff4444',
                    textShadow:`0 0 20px ${attacker?.color ?? '#ff4444'}, 0 0 8px ${attacker?.color ?? '#ff4444'}88`,
                    opacity: atkIn ? 1 : 0,
                    transition:'opacity 0.6s',
                    textTransform:'uppercase',
                  }}>
                    {attackLabel}
                  </div>
                  {/* Active skill effect pills */}
                  {activeMods.length > 0 && (
                    <div style={{
                      display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap',
                      marginTop:8, opacity: atkIn ? 1 : 0, transition:'opacity 0.8s 0.3s',
                    }}>
                      {activeMods.map((m, i) => (
                        <div key={i} style={{
                          display:'flex', alignItems:'center', gap:4,
                          background:`${m.color}18`, border:`1px solid ${m.color}66`,
                          borderRadius:4, padding:'3px 8px',
                          fontFamily:"'Orbitron',sans-serif",
                        }}>
                          <span style={{fontSize:11}}>{m.icon}</span>
                          <span style={{fontSize:7, color:m.color, letterSpacing:1}}>{m.label}</span>
                          <span style={{fontSize:7, color:'#4a6a7a'}}>· {m.desc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Phase status strip ── */}
            <div style={{
              marginTop:10, display:'flex', alignItems:'center', justifyContent:'center',
              gap:40, width:'100%', maxWidth:1300,
            }}>
              <div style={{textAlign:'center', opacity: atkIn ? 1 : 0, transition:'opacity 0.5s'}}>
                <div style={{fontSize:11, color: attacker?.color, letterSpacing:2}}>{attacker?.name}</div>
                <div style={{fontSize:9, color:'#ff8844', marginTop:2}}>
                  ⚔️ Drive {atkBase}{atkBonus > 0 && <span style={{color:'#ffaa44'}}>+{atkBonus}</span>}={atkStat}
                  {phase === 'result' && atkFace !== null &&
                    <span style={{color:'#ffcc44'}}> + {atkFace} = {atkTotal}</span>}
                </div>
              </div>
              <div style={{fontSize:10, color:'#6a8aaa', letterSpacing:2, textAlign:'center', minWidth:260}}>
                {phase==='enter_attacker'     && '⚔️ SWING!'}
                {phase==='flash_drive'        && `${attacker?.name?.split(' ')[0]} DRIVE: ${atkStat}`}
                {phase==='pick_drive_slide'   && `↙ pick slides ${atkStat} toward attacker…`}
                {phase==='enter_defender'     && `${defender?.name} steps up!`}
                {phase==='flash_sustain'      && `${defender?.name?.split(' ')[0]} FEEDBACK: ${defStat}`}
                {phase==='pick_sustain_slide' && `↗ defender pushes back ${defStat}…`}
                {phase==='atk_die_spin'       && '🎲 Click the die to stop it!'}
                {phase==='atk_die_settling'   && '🎲 Rolling…'}
                {phase==='pick_atk_slide'     && `↙ Attack +${atkRoll} — pick slides left!`}
                {phase==='def_die_spin'       && '🎲 Defender — click to stop!'}
                {phase==='def_die_settling'   && '🎲 Rolling…'}
                {phase==='pick_def_slide'     && `↗ Defense +${defRoll} — pick slides right!`}
              </div>
              <div style={{textAlign:'center', opacity: defIn ? 1 : 0, transition:'opacity 0.5s'}}>
                <div style={{fontSize:11, color: defender?.color, letterSpacing:2}}>{defender?.name}</div>
                <div style={{fontSize:9, color:'#88ccff', marginTop:2}}>
                  🛡️ Feedback {defBase}{defBonus > 0 && <span style={{color:'#88ccff'}}>+{defBonus}</span>}={defStat}
                  {battleState?.posing && <span style={{color:'#ffd700'}}> — 🌟 CAUGHT POSING: defense = 0!</span>}
                  {phase === 'result' && defFace !== null && !battleState?.posing &&
                    <span style={{color:'#ffcc44'}}> + {defFace} = {defTotal}</span>}
                </div>
              </div>
            </div>

            {/* ── RESULT BANNER — auto-fades after 3.5s ── */}
            {phase === 'result' && attackerWon !== undefined && (
              <div key="result-banner" style={{
                marginTop:14, marginBottom:10, flexShrink:0,
                animation:'battle-result-slam 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
                textAlign:'center', padding:'14px 40px', borderRadius:14,
                background: attackerWon ? '#140000' : '#00001a',
                border:`3px solid ${attackerWon ? '#ff2222' : '#00aaff'}`,
                boxShadow: attackerWon
                  ? '0 0 50px #ff222255, 0 0 100px #ff222222'
                  : '0 0 50px #00aaff44',
                maxWidth:640,
              }}>
                {attackerWon ? (
                  <>
                    <div style={{fontSize:26, color:'#ff2222', letterSpacing:5, marginBottom:6,
                      textShadow:'0 0 24px #ff0000'}}>
                      💥 HIT!
                    </div>
                    <div style={{fontSize:15, color:'#ffaa44', marginBottom:4}}>
                      {attacker?.name} lands <strong style={{color:'#ff6644'}}>{damage} Vibe damage</strong> on {defender?.name}!
                    </div>
                    <div style={{fontSize:10, color:'#6a8aaa', marginBottom:6}}>
                      Attack {atkTotal} vs Defense {defTotal} — margin {margin}
                    </div>
                    <div style={{display:'flex', justifyContent:'center', gap:10, marginBottom:2}}>
                      <span style={{fontSize:10, color:'#ffd700'}}>
                        ⭐ +{fameFromMargin(margin)} Fame
                      </span>
                      <span style={{fontSize:10, color:'#ff8866'}}>
                        💢 Knockback {knockbackSpaces(battleState, margin)} hex{knockbackSpaces(battleState, margin) !== 1 ? 'es' : ''}
                      </span>
                    </div>
                    {margin <= 2 && (
                      <div style={{fontSize:10, color:'#ffcc44'}}>⚡ Barely landed — counter window!</div>
                    )}
                    {/* ── SWING / CQC STATUS-EFFECT PREVIEW ── */}
                    {/* Shows whether the attacker's upgrade (e.g. Shank Skank) */}
                    {/* triggered, and exactly what happens once this overlay     */}
                    {/* closes and the defender is pushed back.                   */}
                    {(() => {
                      const roll = battleState?.swingEffectRoll;
                      if (!roll) return null; // no swing upgrade / Sonic attack
                      const landed = roll.effects ?? [];
                      return (
                        <div style={{
                          marginTop:10, padding:'8px 12px', borderRadius:8,
                          background:'#0a0014aa',
                          border:`1px solid ${landed.length ? '#ff44aa66' : '#44557766'}`,
                        }}>
                          <div style={{fontSize:9, letterSpacing:2, color:'#ff66cc',
                            marginBottom: landed.length ? 5 : 0}}>
                            🗡️ {roll.upgradeName}
                          </div>
                          {landed.length === 0 ? (
                            <div style={{fontSize:9, color:'#7a8aa0'}}>
                              Rolled for a status effect — none landed this time.
                            </div>
                          ) : (
                            <>
                              {landed.map(fx => {
                                const info = SWING_FX_INFO[fx];
                                if (!info) return null;
                                const dmgNote = fx === 'confused' && roll.confusedDmg
                                  ? ` (${roll.confusedDmg} Vibe)` : '';
                                return (
                                  <div key={fx} style={{fontSize:9, color:info.color, lineHeight:1.5}}>
                                    {info.icon} <strong>{info.label}!</strong>{' '}
                                    <span style={{color:'#b8c4d4'}}>
                                      {defender?.name} {info.after}{dmgNote}.
                                    </span>
                                  </div>
                                );
                              })}
                              <div style={{fontSize:8, color:'#5a6a80', marginTop:4}}>
                                Applies after you close this overlay & the push-back resolves.
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <div style={{fontSize:26, color:'#00aaff', letterSpacing:5, marginBottom:6,
                      textShadow:'0 0 24px #0088ff'}}>
                      💨 WHIFF!
                    </div>
                    <div style={{fontSize:15, color:'#88ccff', marginBottom:4}}>
                      {attacker?.name} swings wide — <strong style={{color:'#4488ff'}}>{Math.max(1,Math.ceil(margin/2))} Vibe self-damage!</strong>
                    </div>
                    <div style={{fontSize:10, color:'#6a8aaa', marginBottom:4}}>
                      Attack {atkTotal} vs Defense {defTotal} — margin {margin}
                    </div>
                    <div style={{display:'flex', justifyContent:'center', gap:10}}>
                      <span style={{fontSize:10, color:'#ffd700'}}>
                        ⭐ {defender?.name} +{fameFromMargin(margin)} Fame
                      </span>
                      <span style={{fontSize:10, color:'#88aaff'}}>
                        💢 Staggered back {knockbackSpaces(battleState, margin)} hex{knockbackSpaces(battleState, margin) !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  </>
                )}
                <div style={{marginTop:10, fontSize:15, letterSpacing:4,
                  color: attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff'),
                  textShadow:`0 0 16px ${attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff')}`,
                }}>
                  🏆 {attackerWon ? attacker?.name?.toUpperCase() : defender?.name?.toUpperCase()} WINS THE EXCHANGE!
                </div>
                {/* Close button */}
                <button
                  onClick={closeBattleOverlay}
                  style={{
                    marginTop:12, padding:'8px 32px', borderRadius:8,
                    background:'transparent',
                    border:`2px solid ${attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff')}`,
                    color: attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff'),
                    fontSize:11, letterSpacing:3, fontFamily:"'Orbitron',sans-serif",
                    cursor:'pointer',
                    textShadow:`0 0 8px ${attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff')}`,
                    boxShadow:`0 0 12px ${attackerWon ? (attacker?.color ?? '#ff4444') : (defender?.color ?? '#00ccff')}44`,
                    transition:'all 0.2s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#ffffff18'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  BACK TO GAME
                </button>
              </div>
            )}
          </div>
        );
      })()}





      {/* ── RIFF BANNER — legendary riff toast ── */}
      {riffBanner && (() => {
        const riff = RIFF_BY_ID[riffBanner.riffId];
        const sp   = spirits.find(s => s.id === riffBanner.spiritId);
        if (!riff) return null;
        return (
          <div onClick={() => setRiffBanner(null)} style={{
            position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
            zIndex:9985, cursor:'pointer',
            background:'linear-gradient(135deg, #14081e 0%, #0a0f20 100%)',
            border:'2px solid #ffd700', borderRadius:12, padding:'12px 26px',
            boxShadow:'0 0 36px #ffd70055, inset 0 0 40px #ffd7000c',
            display:'flex', alignItems:'center', gap:14, maxWidth:480,
            animation:'eventTicketIn .4s cubic-bezier(.2,1.4,.4,1)',
          }}>
            <span style={{fontSize:30, filter:'drop-shadow(0 0 10px #ffd700)'}}>{riff.icon}</span>
            <div>
              {riffBanner.isNew && (
                <div style={{fontSize:8, color:'#0a0f20', background:'#ffd700', display:'inline-block',
                  borderRadius:3, padding:'1px 7px', fontWeight:900, letterSpacing:2, marginBottom:3,
                  fontFamily:"'Orbitron',sans-serif"}}>
                  ✨ NEW DISCOVERY
                </div>
              )}
              <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:13, color:'#ffd700',
                letterSpacing:2, textShadow:'0 0 14px #ffd70088'}}>
                🎼 {riff.name}
              </div>
              <div style={{fontSize:9, color:'#9eb3c8', fontStyle:'italic', marginTop:2}}>{riff.flavor}</div>
              <div style={{fontSize:9, color:'#ffd700', marginTop:3, fontWeight:700}}>
                <span style={{color: sp?.color}}>{sp?.name}</span> +{riffBanner.fp} Fame Point{riffBanner.fp !== 1 ? 's' : ''} ⭐
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── CADENCE TOAST — objective resolved ── */}
      {cadenceToast && (() => {
        const cad = CADENCE_BY_ID[cadenceToast.cadenceId];
        const sp  = spirits.find(s => s.id === cadenceToast.spiritId);
        if (!cad) return null;
        return (
          <div onClick={() => setCadenceToast(null)} style={{
            position:'fixed', bottom: riffBanner ? 128 : 24, left:'50%', transform:'translateX(-50%)',
            zIndex:9986, cursor:'pointer',
            background:'linear-gradient(135deg, #081a14 0%, #0a0f20 100%)',
            border:'2px solid #44ffaa', borderRadius:12, padding:'12px 26px',
            boxShadow:'0 0 36px #44ffaa44, inset 0 0 40px #44ffaa0c',
            display:'flex', alignItems:'center', gap:14, maxWidth:480,
            animation:'eventTicketIn .4s cubic-bezier(.2,1.4,.4,1)',
          }}>
            <span style={{fontSize:30, filter:'drop-shadow(0 0 10px #44ffaa)'}}>{cad.icon}</span>
            <div>
              <div style={{fontSize:8, color:'#06281c', background:'#44ffaa', display:'inline-block',
                borderRadius:3, padding:'1px 7px', fontWeight:900, letterSpacing:2, marginBottom:3,
                fontFamily:"'Orbitron',sans-serif"}}>
                🎯 CADENCE RESOLVED
              </div>
              <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:13, color:'#44ffaa',
                letterSpacing:2, textShadow:'0 0 14px #44ffaa88'}}>
                {cad.name} · {cad.formula}
              </div>
              <div style={{fontSize:9, color:'#9eb3c8', fontStyle:'italic', marginTop:2}}>{cad.desc}</div>
              <div style={{fontSize:9, color:'#44ffaa', marginTop:3, fontWeight:700}}>
                <span style={{color: sp?.color}}>{sp?.name}</span> +{cadenceToast.fp} Fame Points ⭐
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── RIFFBOOK — discovery codex ── */}
      {showRiffbook && (
        <div onClick={() => setShowRiffbook(false)} style={{
          position:'fixed', inset:0, background:'#000000d8', zIndex:9300,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width:560, maxHeight:'86vh', overflowY:'auto',
            background:'#080f1e', border:'2px solid #ffd700', borderRadius:12,
            boxShadow:'0 0 50px #ffd70044',
          }}>
            <div style={{padding:'14px 20px', borderBottom:'1px solid #ffd70044',
              background:'linear-gradient(135deg, #ffd70018 0%, #0a1020 100%)',
              display:'flex', alignItems:'center', gap:10, position:'sticky', top:0, backdropFilter:'blur(4px)'}}>
              <span style={{fontSize:22}}>📖</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:13, color:'#ffd700', letterSpacing:2, fontWeight:700}}>
                  THE RIFFBOOK
                </div>
                <div style={{fontSize:8, color:'#6a8aaa', marginTop:2}}>
                  {Object.keys(riffBook).length}/{RIFF_LIBRARY.length} legendary riffs discovered ·
                  place a riff's opening intervals on your track (any key!) and CONFIRM ·
                  first discovery = full Fame, replays = 1 FP
                </div>
                <div style={{display:'flex', gap:6, marginTop:7}}>
                  {[['discoveries','🎼 DISCOVERIES'],['cadences','🎯 CADENCES'],['legacy','📜 LEGACY CODEX']].map(([tab,label]) => (
                    <button key={tab} onClick={() => setRiffbookTab(tab)}
                      style={{fontFamily:"'Orbitron',sans-serif", fontSize:8, letterSpacing:1, cursor:'pointer',
                        padding:'4px 12px', borderRadius:4,
                        background: riffbookTab === tab ? '#ffd70022' : 'transparent',
                        border:`1px solid ${riffbookTab === tab ? '#ffd700' : '#ffd70033'}`,
                        color: riffbookTab === tab ? '#ffd700' : '#8a7a3a'}}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setShowRiffbook(false)} style={{fontFamily:'inherit', fontSize:10,
                background:'none', border:'1px solid #ffd70055', borderRadius:4, color:'#ffd700',
                padding:'3px 10px', cursor:'pointer'}}>✕</button>
            </div>
            {riffbookTab === 'discoveries' && (
            <div style={{padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              {RIFF_LIBRARY.map(riff => {
                const discovererId = riffBook[riff.id];
                const discovered   = !!discovererId;
                const discoverer   = spirits.find(s => s.id === discovererId);
                return (
                  <div key={riff.id} style={{
                    borderRadius:8, padding:'9px 12px',
                    background: discovered ? '#14110a' : '#0a0e16',
                    border:`1px solid ${discovered ? '#ffd70066' : '#1a2a40'}`,
                    opacity: discovered ? 1 : 0.8,
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <span style={{fontSize:18, filter: discovered ? 'none' : 'grayscale(1) brightness(0.5)'}}>
                        {discovered ? riff.icon : '❓'}
                      </span>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:9, fontWeight:700,
                          color: discovered ? '#ffd700' : '#3a5a7a', letterSpacing:1}}>
                          {discovered ? riff.name : '? ? ? ? ?'}
                        </div>
                        <div style={{fontSize:8, color: discovered ? '#9eb3c8' : '#44608044',
                          fontStyle:'italic', lineHeight:1.4, marginTop:2}}>
                          {discovered ? riff.flavor : riff.hint}
                        </div>
                        {discovered && discoverer && (
                          <div style={{fontSize:7, color: discoverer.color, marginTop:2}}>
                            ✍️ first played by {discoverer.name}
                          </div>
                        )}
                      </div>
                      <span style={{fontSize:9, color: discovered ? '#ffd700' : '#3a5a7a',
                        fontWeight:700, whiteSpace:'nowrap'}}>
                        ⭐{riff.fp}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            {/* ── CADENCES — multi-turn resolution objectives ── */}
            {riffbookTab === 'cadences' && (
            <div style={{padding:'12px 16px'}}>
              <div style={{fontSize:8.5, color:'#7a9a8a', marginBottom:10, padding:'7px 10px',
                background:'#081a14', border:'1px dashed #44ffaa44', borderRadius:6, lineHeight:1.6}}>
                🎯 The LAST note of your confirmed track each turn is your <b style={{color:'#44ffaa'}}>FINAL</b>.
                String the right finals together across consecutive turns — in ANY key — to resolve a
                cadence for Fame. Example: end a turn on C, the next on F, the next on G, then back
                on C — that's THE FULL RESOLVE. Each cadence has a 3-turn cooldown after completion.
              </div>
              {acting && (() => {
                const trail = noteStates[acting.id]?.finalsTrail ?? [];
                return (
                  <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:12,
                    padding:'7px 10px', background:'#0a0e16', border:'1px solid #44ffaa33', borderRadius:6}}>
                    <span style={{fontSize:8, color:'#44ffaa', letterSpacing:1, fontFamily:"'Orbitron',sans-serif"}}>
                      {acting.name?.split(' ')[0]?.toUpperCase()}'S RUN
                    </span>
                    {trail.length === 0
                      ? <span style={{fontSize:9, color:'#3a5a7a'}}>— no finals yet, confirm a track to begin</span>
                      : trail.map((pc, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span style={{fontSize:8, color:'#2a4a3a'}}>→</span>}
                            <span style={{fontSize:10, fontWeight:700, color:'#e8fff4',
                              background:'#0e2018', border:'1px solid #44ffaa44',
                              borderRadius:3, padding:'1px 7px', fontFamily:"'Share Tech Mono',monospace"}}>
                              {PC_PLAY_NAMES[pc]}
                            </span>
                          </React.Fragment>
                        ))}
                    {trail.length > 0 && <span style={{fontSize:9, color:'#2a4a3a'}}>→ ?</span>}
                  </div>
                );
              })()}
              <div style={{display:'flex', flexDirection:'column', gap:8}}>
                {CADENCE_OBJECTIVES.map(cad => {
                  const exampleNotes = cad.degrees.map(d => PC_PLAY_NAMES[d % 12]);
                  const cd = acting ? (noteStates[acting.id]?.cadenceCooldowns?.[cad.id] ?? 0) : 0;
                  return (
                    <div key={cad.id} style={{borderRadius:8, padding:'9px 12px',
                      background: cd > 0 ? '#0a0e16' : '#081a14',
                      border:`1px solid ${cd > 0 ? '#1a2a40' : '#44ffaa44'}`,
                      opacity: cd > 0 ? 0.6 : 1}}>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <span style={{fontSize:16}}>{cad.icon}</span>
                        <span style={{fontFamily:"'Orbitron',sans-serif", fontSize:9.5, fontWeight:700,
                          color:'#44ffaa', letterSpacing:1, flex:1}}>
                          {cad.name} <span style={{color:'#7a9a8a', fontWeight:400}}>· {cad.formula}</span>
                        </span>
                        {cd > 0 && <span style={{fontSize:8, color:'#ff8800'}}>⏳ {cd}t cooldown</span>}
                        <span style={{fontSize:9, color:'#ffd700', fontWeight:700}}>⭐{cad.fp}</span>
                      </div>
                      <div style={{display:'flex', gap:4, alignItems:'center', marginTop:5, flexWrap:'wrap'}}>
                        <span style={{fontSize:7, color:'#3a5a7a', letterSpacing:1, width:62}}>e.g. IN C</span>
                        {exampleNotes.map((n, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span style={{fontSize:7, color:'#44ffaa'}}>then</span>}
                            <span style={{fontSize:9, fontWeight:700, color:'#e8fff4',
                              background:'#0e2018', border:'1px solid #2a4a3a',
                              borderRadius:3, padding:'1px 6px', fontFamily:"'Share Tech Mono',monospace"}}>
                              {n}
                            </span>
                          </React.Fragment>
                        ))}
                        <span style={{fontSize:7, color:'#44608088', marginLeft:4}}>
                          · {cad.degrees.length} consecutive turn-finals
                        </span>
                      </div>
                      <div style={{fontSize:8, color:'#7a8aa0', fontStyle:'italic', marginTop:4}}>{cad.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* ── LEGACY CODEX — full designer reference: every combination, spoilers and all ── */}
            {riffbookTab === 'legacy' && (
            <div style={{padding:'12px 16px'}}>
              <div style={{fontSize:8, color:'#8a7a3a', marginBottom:10, padding:'6px 10px',
                background:'#14110a', border:'1px dashed #ffd70044', borderRadius:6}}>
                ⚠️ FULL SPOILERS — every trigger combination in the book. Patterns are shown in C for
                reference, but ANY key works: only the interval spacing matters. Place at least the
                TRIGGER notes (in order, anywhere in your track) and confirm.
              </div>
              {['classical','theory','homage'].map(genre => {
                const meta = RIFF_GENRE_META[genre];
                const riffs = RIFF_LIBRARY.filter(r => RIFF_GENRE[r.id] === genre);
                return (
                  <div key={genre} style={{marginBottom:14}}>
                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                      <span style={{fontFamily:"'Orbitron',sans-serif", fontSize:9, letterSpacing:2,
                        color: meta.color, fontWeight:700}}>
                        {meta.label} WING — {riffs.length}
                      </span>
                      <span style={{flex:1, height:1, background:`linear-gradient(90deg, ${meta.color}44, transparent)`}}/>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:6}}>
                      {riffs.map(riff => {
                        const trigOffs = riff.notes.slice(0, riff.triggerLen).map(n => n[0]);
                        const trigNotes = trigOffs.map(off => PC_PLAY_NAMES[((off % 12) + 12) % 12]);
                        const steps = trigOffs.slice(1).map((o, i) => {
                          const d = o - trigOffs[i];
                          return d === 0 ? '±0' : d > 0 ? `+${d}` : `${d}`;
                        });
                        return (
                          <div key={riff.id} style={{borderRadius:7, padding:'8px 12px',
                            background:'#0a0e16', border:`1px solid ${meta.color}33`}}>
                            <div style={{display:'flex', alignItems:'center', gap:8}}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (legacyPlayingId) return; // one audition at a time
                                  const dur = playRiffSequence(riff, 0); // audition in C
                                  setLegacyPlayingId(riff.id);
                                  setTimeout(() => setLegacyPlayingId(p => (p === riff.id ? null : p)), dur + 250);
                                }}
                                title="Audition this riff (played in C)"
                                style={{fontFamily:'inherit', cursor: legacyPlayingId ? 'default' : 'pointer',
                                  width:26, height:22, borderRadius:4, fontSize:10, lineHeight:1,
                                  background: legacyPlayingId === riff.id ? '#ffd70028' : '#10182a',
                                  border:`1px solid ${legacyPlayingId === riff.id ? '#ffd700' : '#ffd70055'}`,
                                  color:'#ffd700',
                                  animation: legacyPlayingId === riff.id ? 'crew-ready-glow 0.7s ease-in-out infinite' : 'none'}}>
                                {legacyPlayingId === riff.id ? '♪' : '▶'}
                              </button>
                              <span style={{fontSize:15}}>{riff.icon}</span>
                              <span style={{fontFamily:"'Orbitron',sans-serif", fontSize:9, fontWeight:700,
                                color:'#ffd700', letterSpacing:1, flex:1}}>
                                {riff.name}
                              </span>
                              <span style={{fontSize:7, color: meta.color, border:`1px solid ${meta.color}55`,
                                borderRadius:3, padding:'1px 5px'}}>{meta.label}</span>
                              <span style={{fontSize:8, color:'#6a8aaa'}}>♩{riff.bpm}</span>
                              <span style={{fontSize:9, color:'#ffd700', fontWeight:700}}>⭐{riff.fp}</span>
                            </div>
                            <div style={{display:'flex', gap:4, flexWrap:'wrap', alignItems:'center', marginTop:6}}>
                              <span style={{fontSize:7, color:'#3a5a7a', letterSpacing:1, width:62}}>TRIGGER ({riff.triggerLen})</span>
                              {trigNotes.map((n, i) => (
                                <React.Fragment key={i}>
                                  {i > 0 && <span style={{fontSize:7, color: meta.color}}>{steps[i-1]}</span>}
                                  <span style={{fontSize:9, fontWeight:700, color:'#e8f0ff',
                                    background:'#10182a', border:'1px solid #2a3a55',
                                    borderRadius:3, padding:'1px 6px', fontFamily:"'Share Tech Mono',monospace"}}>
                                    {n}
                                  </span>
                                </React.Fragment>
                              ))}
                              <span style={{fontSize:7, color:'#44608088', marginLeft:4}}>
                                · full phrase {riff.notes.length} notes
                              </span>
                            </div>
                            <div style={{fontSize:8, color:'#7a8aa0', fontStyle:'italic', marginTop:4}}>{riff.flavor}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </div>
      )}

      {/* ── EVENT MODAL — marquee ticket ── */}
      {activeEvent && (() => {
        const ev = EVENT_BY_ID[activeEvent.eventId];
        if (!ev) return null;
        const spirit = spirits.find(s => s.id === activeEvent.spiritId);
        const isReveal = activeEvent.phase === 'reveal';
        const needsRoll = ['roll', 'duel', 'community'].includes(ev.kind);
        return (
          <div style={{
            position:'fixed',inset:0,background:'#000000d8',zIndex:9990,
            display:'flex',alignItems:'center',justifyContent:'center',
          }}>
            <div style={{
              background:'linear-gradient(165deg, #0c0818 0%, #080f1e 55%, #050810 100%)',
              border:`2px solid ${ev.color}`,borderRadius:12,
              padding:0,maxWidth:380,width:'92%',overflow:'hidden',
              boxShadow:`0 0 40px ${ev.color}55, inset 0 0 60px ${ev.color}0c`,
              animation:'eventTicketIn .35s cubic-bezier(.2,1.4,.4,1)',
            }}>
              {/* Marquee strip */}
              <div style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                padding:'6px 0',borderBottom:`1px solid ${ev.color}55`,
                background:`linear-gradient(90deg, transparent, ${ev.color}1e, transparent)`,
              }}>
                {[...Array(9)].map((_,i)=>(
                  <span key={i} style={{width:5,height:5,borderRadius:'50%',background:ev.color,
                    opacity:.85,animation:`marqueeBlink 1.1s ${i*0.12}s ease-in-out infinite`}}/>
                ))}
              </div>

              <div style={{padding:'18px 24px 20px',textAlign:'center'}}>
                <div style={{fontSize:34,marginBottom:6,filter:`drop-shadow(0 0 12px ${ev.color})`}}>{ev.icon}</div>
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:15,color:ev.color,
                  letterSpacing:3,textShadow:`0 0 14px ${ev.color}aa`,marginBottom:2}}>
                  {ev.title}
                </div>
                <div style={{fontSize:8,color:'#3a5a7a',letterSpacing:2,marginBottom:12}}>
                  ⚡ EVENT SPACE · TRIGGERED BY <span style={{color:spirit?.color}}>{spirit?.name?.toUpperCase()}</span> ⚡
                </div>

                {isReveal ? (
                  <>
                    <div style={{fontSize:10,color:'#9eb3c8',fontStyle:'italic',lineHeight:1.55,marginBottom:12}}>
                      {ev.flavor}
                    </div>
                    <div style={{fontSize:9,color:'#c0d0e0',lineHeight:1.5,textAlign:'left',
                      background:'#0a1020',border:`1px solid ${ev.color}44`,borderRadius:6,
                      padding:'8px 12px',marginBottom:16}}>
                      {ev.rules}
                    </div>
                    <button onClick={resolveActiveEvent}
                      style={{fontFamily:"'Orbitron',sans-serif",fontSize:12,letterSpacing:2,cursor:'pointer',
                        padding:'10px 32px',borderRadius:6,color:'#050810',fontWeight:700,
                        background:ev.color,border:'none',
                        boxShadow:`0 0 20px ${ev.color}88`,
                      }}>
                      {needsRoll ? '🎲 ROLL!' : '⚡ RESOLVE'}
                    </button>
                  </>
                ) : (
                  <>
                    {/* Dice results */}
                    {activeEvent.rolls?.you != null && (
                      <div style={{display:'flex',justifyContent:'center',marginBottom:12}}>
                        <div style={{width:52,height:52,borderRadius:9,background:'#0a1020',
                          border:`2px solid ${ev.color}`,display:'flex',alignItems:'center',justifyContent:'center',
                          fontFamily:"'Orbitron',sans-serif",fontSize:24,color:ev.color,
                          boxShadow:`0 0 18px ${ev.color}66`,animation:'eventDiePop .3s ease-out'}}>
                          {activeEvent.rolls.you}
                        </div>
                      </div>
                    )}
                    {activeEvent.rolls?.duel && (
                      <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:14,marginBottom:12}}>
                        {[activeEvent.rolls.duel.you, activeEvent.rolls.duel.them].map((d,i)=>(
                          <React.Fragment key={i}>
                            {i===1 && <span style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,color:'#3a5a7a'}}>VS</span>}
                            <div style={{textAlign:'center'}}>
                              <div style={{width:44,height:44,borderRadius:8,background:'#0a1020',
                                border:`2px solid ${ev.color}`,display:'flex',alignItems:'center',justifyContent:'center',
                                fontFamily:"'Orbitron',sans-serif",fontSize:20,color:ev.color,margin:'0 auto',
                                animation:'eventDiePop .3s ease-out'}}>
                                {d.roll}
                              </div>
                              <div style={{fontSize:7,color:'#9eb3c8',marginTop:3,maxWidth:70,
                                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</div>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                    {activeEvent.rolls?.community && (
                      <div style={{display:'flex',justifyContent:'center',gap:8,flexWrap:'wrap',marginBottom:12}}>
                        {activeEvent.rolls.community.map(r=>(
                          <div key={r.id} style={{textAlign:'center'}}>
                            <div style={{width:36,height:36,borderRadius:7,background:'#0a1020',
                              border:`2px solid ${r.color}`,display:'flex',alignItems:'center',justifyContent:'center',
                              fontFamily:"'Orbitron',sans-serif",fontSize:16,color:r.color,margin:'0 auto',
                              animation:'eventDiePop .3s ease-out'}}>
                              {r.roll}
                            </div>
                            <div style={{fontSize:6,color:'#9eb3c8',marginTop:2,maxWidth:54,
                              overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Outcome lines */}
                    <div style={{fontSize:9.5,color:'#c0d0e0',lineHeight:1.6,textAlign:'left',
                      background:'#0a1020',border:`1px solid ${ev.color}44`,borderRadius:6,
                      padding:'10px 12px',marginBottom:16}}>
                      {(activeEvent.resultLines ?? []).map((l,i)=>(
                        <div key={i} style={{marginBottom:i<activeEvent.resultLines.length-1?5:0}}>{l}</div>
                      ))}
                    </div>
                    <button onClick={()=>setActiveEvent(null)}
                      style={{fontFamily:"'Orbitron',sans-serif",fontSize:11,letterSpacing:2,cursor:'pointer',
                        padding:'8px 28px',borderRadius:6,color:ev.color,fontWeight:700,
                        background:'transparent',border:`1.5px solid ${ev.color}`,
                      }}>
                      🤘 ROCK ON
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 🎸⏰ BACK TO THE PAST — play-challenge overlay ── */}
      {bttpChallenge && (() => {
        const ch = bttpChallenge;
        const st = BTTP_STAGES[ch.stageKey] || BTTP_STAGES.angel;
        const data = bttpStageData(ch.stageKey);
        const sp = spirits.find(s => s.id === ch.spiritId);
        const accent = st.accent;
        const pads = ['c','d','e','f','g','a','b']; // input row, aligned to the piano
        const gradeColor = ch.lastGrade === 'clean' ? '#7CFFB2'
          : ch.lastGrade === 'clam' ? '#ffb347'
          : ch.lastGrade === 'miss' ? '#ff6b6b' : '#9eb3c8';
        const gradeText = ch.lastGrade === 'clean' ? 'NAILED IT!'
          : ch.lastGrade === 'clam' ? 'CLAMS!'
          : ch.lastGrade === 'miss' ? 'MISSED!' : '';
        const view = ch.view || st.view;
        // Fretboard position for each keystroke: [stringIndex 0=low E … 5=high E, fret].
        const GUITAR_POS = { e:[0,0], f:[0,1], a:[1,0], b:[1,2], c:[1,3], d:[2,0], g:[3,0] };
        // Render the chord on a piano or a vertical fretboard. `chord` = letters to
        // play; `got` = letters already pressed correctly (shown in green).
        const renderDiagram = (chord, got) => {
          const lit = new Set(chord || []);
          const done = new Set(got || []);
          if (view === 'guitar') {
            // Vertical fretboard, headstock up. Strings run top→bottom; low E on the
            // LEFT (thick) through high E on the RIGHT (thin). Blips sit on a string at
            // a fret; open notes show as a ring above the nut.
            const names = ['E','A','D','G','B','e'];        // low → high (low E vs high e)
            const gauge = [3.0, 2.4, 1.9, 1.5, 1.1, 0.8];   // string thickness, low → high
            const N = 6, FRETS = 4, colW = 24, fh = 24, side = 16, topPad = 18;
            const W = (N - 1) * colW + side * 2, H = topPad + FRETS * fh + 14;
            const sx = i => side + i * colW;
            const nutY = topPad, fy = f => nutY + f * fh;
            return (
              <svg width={W} height={H} style={{maxWidth:'100%'}}>
                {names.map((nm, i) => (
                  <text key={`n${i}`} x={sx(i)} y={topPad - 6} textAnchor="middle" fontSize={9}
                    fontWeight="bold" fill={`${accent}cc`} fontFamily="monospace">{nm}</text>
                ))}
                {/* fret-marker inlay at the 3rd fret */}
                {3 <= FRETS && (
                  <circle cx={(sx(2) + sx(3)) / 2} cy={nutY + 2.5 * fh} r={3.5} fill={`${accent}33`}/>
                )}
                {/* frets (horizontal) — the nut (fret 0) is thick */}
                {Array.from({ length: FRETS + 1 }).map((_, f) => (
                  <line key={`f${f}`} x1={sx(0)} y1={fy(f)} x2={sx(N - 1)} y2={fy(f)}
                    stroke={f === 0 ? '#dbe4f0' : `${accent}44`} strokeWidth={f === 0 ? 3.5 : 1}/>
                ))}
                {/* strings (vertical) — width = gauge, so low/high E read at a glance */}
                {names.map((_, i) => (
                  <line key={`s${i}`} x1={sx(i)} y1={fy(0)} x2={sx(i)} y2={fy(FRETS)}
                    stroke="#aab8cc" strokeWidth={gauge[i]} strokeLinecap="round"/>
                ))}
                {/* blips on string + fret (open = ring above the nut) */}
                {pads.filter(l => lit.has(l) && GUITAR_POS[l]).map(l => {
                  const [s, f] = GUITAR_POS[l], dn = done.has(l), cx = sx(s);
                  if (f === 0) {
                    return <circle key={l} cx={cx} cy={nutY - 9} r={5}
                      fill={dn ? '#2bd66b' : 'none'} stroke={dn ? '#2bd66b' : accent} strokeWidth={2}/>;
                  }
                  return <circle key={l} cx={cx} cy={nutY + (f - 0.5) * fh} r={7.5}
                    fill={dn ? '#2bd66b' : accent} stroke="#06111f" strokeWidth={1}
                    style={dn ? {} : { filter:`drop-shadow(0 0 5px ${accent})` }}/>;
                })}
              </svg>
            );
          }
          // piano — one octave in real key order (C D E F G A B) with black keys
          // as calibration landmarks. No labels: read the position, press the key.
          const whites = ['c','d','e','f','g','a','b'];   // left→right, true piano order
          const blackAfter = [0, 1, 3, 4, 5];             // a black key sits to the right of these whites (the 2-and-3 groups)
          const W = 26, H = 84, bw = 16, bh = 52;
          const svgW = whites.length * W;
          return (
            <svg width={svgW} height={H} style={{maxWidth:'100%'}}>
              {whites.map((l, i) => {
                const x = i * W, isLit = lit.has(l), dn = done.has(l);
                const fill = dn ? '#2bd66b' : isLit ? accent : '#e6ecf6';
                return (
                  <rect key={l} x={x} y={0} width={W - 1} height={H} rx={3} fill={fill}
                    stroke="#0a0e16" strokeWidth={1}
                    style={isLit && !dn ? { filter:`drop-shadow(0 0 7px ${accent})` } : {}}/>
                );
              })}
              {blackAfter.map(i => (
                <rect key={`b${i}`} x={(i + 1) * W - bw / 2} y={0} width={bw} height={bh} rx={2}
                  fill="#0c1018" stroke="#000" strokeWidth={1}/>
              ))}
            </svg>
          );
        };
        return (
          <div style={{position:'fixed',inset:0,background:'#000000e0',zIndex:9995,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{background:'linear-gradient(165deg,#0c0818,#08101e 60%,#050810)',border:`2px solid ${accent}`,borderRadius:12,padding:'18px 22px 20px',maxWidth:400,width:'94%',textAlign:'center',boxShadow:`0 0 44px ${accent}55`}}>
              <div style={{fontSize:8,color:'#3a5a7a',letterSpacing:2,marginBottom:8}}>🎸⏰ BACK TO THE PAST · <span style={{color:sp?.color}}>{sp?.name?.toUpperCase()}</span></div>
              <div style={{fontSize:30,filter:`drop-shadow(0 0 12px ${accent})`}}>{st.icon}</div>
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:14,color:accent,letterSpacing:2,textShadow:`0 0 12px ${accent}aa`}}>{st.name}</div>
              <div style={{fontSize:9,color:'#9eb3c8',fontStyle:'italic',margin:'4px 0 12px'}}>{st.blurb}</div>

              <div style={{display:'flex',justifyContent:'center',gap:5,marginBottom:14,flexWrap:'wrap'}}>
                {data.chords.map((c,i) => {
                  const active = ch.phase === 'play' || ch.phase === 'playback';
                  const done = i < ch.idx && active, cur = i === ch.idx && active;
                  return <span key={i} style={{width:9,height:9,borderRadius:'50%',
                    background: cur ? accent : done ? `${accent}99` : '#1a2740',
                    boxShadow: cur ? `0 0 10px ${accent}` : 'none', border:`1px solid ${accent}44`}}/>;
                })}
              </div>

              {ch.phase === 'choose' && (
                <div style={{padding:'6px 0 4px'}}>
                  <div style={{fontSize:10,color:'#c0d0e0',marginBottom:12}}>How do you want to play it?</div>
                  <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                    <button onClick={()=>bttpChoose(ch.spiritId,'piano')} style={{flex:1,maxWidth:150,cursor:'pointer',
                      background:'#0a1426',border:`1.5px solid ${accent}`,borderRadius:10,padding:'14px 10px',color:accent,fontFamily:"'Orbitron',sans-serif"}}>
                      <div style={{fontSize:26}}>🎹</div>
                      <div style={{fontSize:11,letterSpacing:1,marginTop:4}}>PIANO</div>
                      <div style={{fontSize:7.5,color:'#8aa0b8',marginTop:3,fontFamily:'monospace'}}>standard timing</div>
                    </button>
                    <button onClick={()=>bttpChoose(ch.spiritId,'guitar')} style={{flex:1,maxWidth:150,cursor:'pointer',
                      background:'#0a1426',border:`1.5px solid ${accent}`,borderRadius:10,padding:'14px 10px',color:accent,fontFamily:"'Orbitron',sans-serif"}}>
                      <div style={{fontSize:26}}>🎸</div>
                      <div style={{fontSize:11,letterSpacing:1,marginTop:4}}>GUITAR</div>
                      <div style={{fontSize:7.5,color:'#8aa0b8',marginTop:3,fontFamily:'monospace'}}>harder read · +50% time</div>
                    </button>
                  </div>
                </div>
              )}

              {ch.phase === 'countdown' && (
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:13,color:'#ffd98a',letterSpacing:2,padding:'18px 0'}}>GET READY…</div>
              )}

              {ch.phase === 'play' && (
                <>
                  <div style={{fontSize:9,color:'#ffd98a',fontFamily:"'Orbitron',sans-serif",letterSpacing:2,marginBottom:6}}>
                    {view === 'guitar' ? '🎸' : '🎹'} PLAY THE CHORD
                  </div>
                  <div style={{height:104,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                    {ch.flash ? renderDiagram(ch.flash.chord, ch.flash.got)
                      : <div style={{fontSize:12,color:gradeColor,fontFamily:"'Orbitron',sans-serif",letterSpacing:2}}>{gradeText || '…'}</div>}
                  </div>
                  <div style={{fontSize:8,color:'#5a7a9a',marginBottom:8}}>
                    Chord {Math.min(ch.idx+1, data.chords.length)}/{data.chords.length} — hit every lit key (tap or press)
                  </div>
                  <div style={{display:'flex',justifyContent:'center',gap:5,flexWrap:'wrap'}}>
                    {pads.map(k => {
                      const hit = ch.flash && ch.flash.got && ch.flash.got.includes(k);
                      return (
                        <button key={k} onClick={()=>bttpInput(k)} style={{
                          width:36,height:44,borderRadius:8,cursor:'pointer',
                          fontFamily:"'Orbitron',sans-serif",fontSize:15,fontWeight:700,
                          color: hit ? '#06111f' : accent,
                          background: hit ? '#2bd66b' : '#0a1020',
                          border:`1.5px solid ${accent}55`}}>
                          {k.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                  {ch.tally.vibeLost > 0 && (
                    <div style={{fontSize:8,color:'#ff8a8a',marginTop:10}}>💔 fading… −{ch.tally.vibeLost} Vibe so far</div>
                  )}
                </>
              )}

              {ch.phase === 'playback' && (
                <>
                  <div style={{fontSize:9,color:accent,fontFamily:"'Orbitron',sans-serif",letterSpacing:2,marginBottom:6}}>🎵 HOW IT GOES…</div>
                  <div style={{height:104,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {ch.flash ? renderDiagram(ch.flash.chord, ch.flash.chord) : <div style={{height:84}}/>}
                  </div>
                  <div style={{fontSize:8,color:'#5a7a9a'}}>Here's the progression, in rhythm.</div>
                </>
              )}

              {ch.phase === 'stageclear' && (
                <div style={{padding:'10px 0'}}>
                  <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:13,color:'#7CFFB2',letterSpacing:2,marginBottom:8}}>STAGE 1 DONE</div>
                  <div style={{fontSize:9.5,color:'#c0d0e0',lineHeight:1.5,marginBottom:6}}>{ch.lines[ch.lines.length-1]}</div>
                  <div style={{fontSize:9,color:'#ff9a3c',fontStyle:'italic'}}>…now here's something they're not ready for yet. 🦆⚡</div>
                </div>
              )}

              {ch.phase === 'done' && (
                <>
                  <div style={{fontSize:9.5,color:'#c0d0e0',lineHeight:1.6,textAlign:'left',background:'#0a1020',border:`1px solid ${accent}44`,borderRadius:6,padding:'10px 12px',margin:'4px 0 14px'}}>
                    {ch.lines.map((l,i)=>(<div key={i} style={{marginBottom:i<ch.lines.length-1?5:0}}>{l}</div>))}
                    {ch.tally.vibeLost > 0 && <div style={{marginTop:6,color:'#ff8a8a'}}>💔 The fade cost you {ch.tally.vibeLost} Vibe total — but you held on.</div>}
                  </div>
                  <button onClick={()=>setBttpChallenge(null)} style={{fontFamily:"'Orbitron',sans-serif",fontSize:11,letterSpacing:2,cursor:'pointer',padding:'8px 28px',borderRadius:6,color:accent,fontWeight:700,background:'transparent',border:`1.5px solid ${accent}`}}>
                    🤘 ROCK ON
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── 🧪 TESTING GROUNDS — in-game dev panel ── */}
      {testMode && (
        <>
          <button onClick={()=>setDevOpen(o=>!o)} title="Testing Grounds"
            style={{position:'fixed',bottom:14,left:14,zIndex:9996,fontFamily:"'Orbitron',sans-serif",fontSize:11,letterSpacing:1,
              cursor:'pointer',padding:'8px 13px',borderRadius:8,background:'#2a1030',border:'1.5px solid #cc66ff',color:'#e0a0ff',
              boxShadow:'0 0 16px #cc66ff55'}}>
            🧪 {devOpen ? 'CLOSE' : 'TEST'}
          </button>
          {devOpen && (
            <div style={{position:'fixed',bottom:54,left:14,zIndex:9996,width:252,
              background:'linear-gradient(165deg,#140a20,#0a0814)',border:'1.5px solid #cc66ff',borderRadius:10,
              padding:'12px 14px',boxShadow:'0 0 30px #cc66ff44',fontFamily:"'Share Tech Mono',monospace"}}>
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:10,color:'#e0a0ff',letterSpacing:2,marginBottom:8}}>🧪 TESTING GROUNDS</div>
              <div style={{fontSize:8,color:'#9a7ab5',marginBottom:10}}>Acting spirit: <span style={{color:'#e0a0ff'}}>{spiritById[devCurrentSpiritId()]?.name ?? '—'}</span></div>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,marginBottom:4}}>FIRE EVENT</div>
              <div style={{display:'flex',gap:5,marginBottom:11}}>
                <select value={devEventId} onChange={e=>setDevEventId(e.target.value)}
                  style={{flex:1,background:'#0a0814',color:'#d0c0e0',border:'1px solid #4a2a60',borderRadius:5,fontSize:9,padding:'5px',fontFamily:'inherit'}}>
                  {EVENT_DECK.map(ev => <option key={ev.id} value={ev.id}>{ev.icon} {ev.title}</option>)}
                </select>
                <button onClick={()=>devFireEvent(devEventId)}
                  style={{background:'#3a1550',border:'1px solid #cc66ff',color:'#e0a0ff',borderRadius:5,fontSize:9,padding:'5px 10px',cursor:'pointer',fontFamily:'inherit'}}>FIRE</button>
              </div>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,marginBottom:4}}>GRANT TO ACTING SPIRIT</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {[['hc','+3 HC'],['cas','+5 Casuals'],['die','+1 Diehard'],['uns','+5 Unsure'],['vup','+1 Vibe'],['vdn','−1 Vibe']].map(([k,lbl])=>(
                  <button key={k} onClick={()=>devGrant(k)}
                    style={{background:'#0a0814',border:'1px solid #4a2a60',color:'#d0c0e0',borderRadius:5,fontSize:9,padding:'5px 8px',cursor:'pointer',fontFamily:'inherit'}}>{lbl}</button>
                ))}
              </div>

              <div style={{fontSize:8,color:'#7a6a95',letterSpacing:1,margin:'12px 0 4px'}}>SIGNATURE SKILLS</div>
              {Object.entries(SIGNATURE_TESTS).map(([sid, route]) => {
                const inGame = spirits.some(s => s.id === sid);
                const unlocked = noteStates[sid]?.unlockedSkills ?? [];
                return (
                  <div key={sid} style={{marginBottom:8,opacity:inGame?1:0.5}}>
                    <div style={{fontSize:8,color:route.color,marginBottom:3}}>{route.name}{!inGame && ' (not in game)'}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                      {route.skills.map(sk => {
                        const on = unlocked.includes(sk.id);
                        return (
                          <button key={sk.id} disabled={!inGame}
                            onClick={()=> sk.fire ? devFireSignature(sid, sk) : devUnlockSkill(sid, sk.id, sk.pre)}
                            title={sk.fire === 'hydra' ? 'Unlock + deploy 3 amps' : sk.fire === 'thousand' ? 'Unlock + fire the masher' : (on ? 'Already unlocked' : 'Unlock')}
                            style={{background: on && !sk.fire ? '#16331e' : '#0a0814',
                              border:`1px solid ${on && !sk.fire ? '#44cc66' : (sk.fire ? route.color : '#4a2a60')}`,
                              color: on && !sk.fire ? '#88ffaa' : (sk.fire ? route.color : '#d0c0e0'),
                              borderRadius:5,fontSize:8.5,padding:'4px 7px',cursor:inGame?'pointer':'default',fontFamily:'inherit'}}>
                            {sk.label}{sk.fire ? ' ▶' : (on ? ' ✓' : '')}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div style={{fontSize:7,color:'#6a5a85',marginTop:11,lineHeight:1.45}}>
                Add tests: a new entry in <span style={{color:'#cc99ff'}}>EVENT_DECK</span> auto-appears above; a new lever goes in <span style={{color:'#cc99ff'}}>devGrant</span>.
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 🗡️ SIGNATURE ABILITIES — per-spirit exclusive-route reference ── */}
      {signatureSpirit && (() => {
        const route = SKILL_TREE.routes.find(r => r.spiritOnly === signatureSpirit);
        const sp    = spirits.find(s => s.id === signatureSpirit)
                   || Object.values(SPIRIT_DEFS).find(s => s.id === signatureSpirit);
        if (!route) return null;
        const unlocked = noteStates[signatureSpirit]?.unlockedSkills ?? [];
        const col = route.color;
        return (
          <div onClick={() => setSignatureSpirit(null)} style={{position:'fixed', inset:0, zIndex:9100,
            background:'rgba(2,6,16,0.88)', display:'flex', alignItems:'center', justifyContent:'center',
            backdropFilter:'blur(3px)', padding:20}}>
            <div onClick={e => e.stopPropagation()} style={{width:560, maxWidth:'94vw', maxHeight:'88vh',
              overflowY:'auto', background:'linear-gradient(180deg,#0a1428,#070d18)', border:`2px solid ${col}`,
              borderRadius:16, boxShadow:`0 0 50px ${col}55`, padding:'22px 24px'}}>
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4}}>
                <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:18, letterSpacing:2, color:col,
                  textShadow:`0 0 16px ${col}77`}}>{route.icon} {sp?.name ?? route.label}</div>
                <button onClick={() => setSignatureSpirit(null)} style={{fontFamily:'inherit', fontSize:10,
                  padding:'3px 10px', cursor:'pointer', background:'#0a1020', border:'1px solid #1e3a5f',
                  borderRadius:8, color:'#8aa5c5'}}>✕ CLOSE</button>
              </div>
              <div style={{fontSize:10, color:'#7a95b5', marginBottom:16}}>Signature abilities — exclusive to this Spirit</div>

              {route.skills.map(sk => {
                const owned = unlocked.includes(sk.id);
                const prereqLabel = sk.prereq ? (SKILL_BY_ID[sk.prereq]?.label ?? sk.prereq) : null;
                return (
                  <div key={sk.id} style={{display:'flex', gap:12, alignItems:'flex-start', padding:'11px 12px',
                    marginBottom:9, borderRadius:10, background: owned ? `${col}14` : '#0b1322',
                    border:`1px solid ${owned ? col + '66' : '#16243c'}`, opacity: owned ? 1 : 0.82}}>
                    <div style={{fontSize:26, lineHeight:1, filter: owned ? 'none' : 'grayscale(0.6)'}}>{sk.icon}</div>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                        <span style={{fontSize:13, fontWeight:800, color: owned ? '#fff' : '#b9c8db'}}>{sk.label}</span>
                        <span style={{fontSize:8.5, padding:'1px 7px', borderRadius:8, letterSpacing:1,
                          background: owned ? '#1c3a22' : '#241a0a',
                          border:`1px solid ${owned ? '#3fae5a' : '#caa24a'}66`,
                          color: owned ? '#7fe39a' : '#e0bd6a'}}>
                          {owned ? '✓ UNLOCKED' : `🔒 ${sk.hcCost} HC`}
                        </span>
                        {prereqLabel && (
                          <span style={{fontSize:8.5, color:'#7a95b5'}}>needs {prereqLabel}</span>
                        )}
                      </div>
                      <div style={{fontSize:10.5, color:'#9fb4cd', lineHeight:1.55, marginTop:4}}>{sk.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── ⚡ THOUSAND BEATS — Fame-Spark mash overlay ── */}
      {thousandBeats && (() => {
        const sp = spirits.find(s => s.id === thousandBeats.spiritId);
        const col = sp?.color ?? '#4488ff';
        const isMash = thousandBeats.phase === 'mash';
        const clicks = thousandBeats.clicks ?? 0;
        return (
          <div style={{position:'fixed', inset:0, zIndex:9000, background:'rgba(2,6,16,0.86)',
            display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)'}}>
            <style>{`
              @keyframes tb-pop { 0%{transform:scale(0.4);opacity:0;} 60%{transform:scale(1.15);opacity:1;} 100%{transform:scale(1);opacity:1;} }
              @keyframes tb-thump { 0%,100%{transform:scale(1);} 50%{transform:scale(1.08);} }
              @keyframes tb-spark-burst { 0%{transform:scale(0) rotate(0deg);opacity:0;} 40%{opacity:1;} 100%{transform:scale(1.6) rotate(140deg);opacity:0;} }
            `}</style>
            <div style={{width:440, maxWidth:'92vw', textAlign:'center', padding:'30px 26px',
              background:'linear-gradient(180deg,#0a1428,#070d1a)', border:`2px solid ${col}`,
              borderRadius:16, boxShadow:`0 0 50px ${col}66`, animation:'tb-pop 0.3s ease-out'}}>
              <div style={{fontFamily:"'Orbitron',sans-serif", fontSize:22, letterSpacing:3, color:col,
                textShadow:`0 0 18px ${col}88`}}>⚡ THOUSAND BEATS</div>
              <div style={{fontSize:11, color:'#8aa5c5', margin:'6px 0 18px'}}>
                {sp?.name} — a thousand cuts forged into Fame
              </div>

              {isMash ? (<>
                <div style={{fontSize:13, color:'#ffd700', fontWeight:800, letterSpacing:2, marginBottom:10}}>
                  MASH <span style={{padding:'2px 10px', border:'1px solid #ffd70088', borderRadius:6}}>SPACE</span>
                </div>
                <div key={clicks} style={{fontSize:74, fontWeight:900, color:'#fff', lineHeight:1.05,
                  textShadow:`0 0 30px ${col}`, animation:'tb-thump 0.12s ease-out'}}>{clicks}</div>
                <div style={{fontSize:9, letterSpacing:2, color:'#6a8aaa', marginBottom:14}}>BEATS</div>
                {/* countdown bar */}
                <div style={{height:8, background:'#10203a', borderRadius:5, overflow:'hidden'}}>
                  <div style={{height:'100%', background:`linear-gradient(90deg,${col},#ffd700)`,
                    borderRadius:5, transition:'width 1s linear',
                    width:`${(thousandBeats.secondsLeft / 5) * 100}%`}}/>
                </div>
                <div style={{fontSize:11, color:'#8aa5c5', marginTop:8}}>{thousandBeats.secondsLeft}s</div>
              </>) : (<>
                <div style={{fontSize:54, animation:'tb-spark-burst 0.7s ease-out'}}>✨</div>
                <div style={{fontSize:13, color:'#fff', margin:'6px 0'}}>
                  {thousandBeats.clicks} beats → <b style={{color:col}}>{thousandBeats.sparksAwarded} Fame Spark{thousandBeats.sparksAwarded !== 1 ? 's' : ''}</b>
                </div>
                {thousandBeats.fpForged > 0 && (
                  <div style={{fontSize:16, fontWeight:900, color:'#ffd700', textShadow:'0 0 16px #ffd70088'}}>
                    🌟 +{thousandBeats.fpForged} FAME POINT{thousandBeats.fpForged !== 1 ? 'S' : ''} FORGED!
                  </div>
                )}
              </>)}
            </div>
          </div>
        );
      })()}

      {/* ── CARD PICKUP MODAL ── */}
      {pendingCardPickup && (() => {
        const { spiritId, cardType } = pendingCardPickup;
        const spirit = spirits.find(s => s.id === spiritId);
        const ns = noteStates[spiritId] ?? {};
        const hand = ns.modCards ?? [];
        const handFull = hand.length >= 2;
        const def = {
          chromatic_shift: { icon:'🎼', name:'Chromatic Shift', color:'#44ffaa',
            desc:'Rewrites all discord notes in your stock into in-scale notes for your chosen mode.' },
          transpose:       { icon:'🔄', name:'Transpose',       color:'#ffcc44',
            desc:'Pick any note in your stock as your new Root Note — re-prompts Major/Minor.' },
          overdrive:       { icon:'⚡', name:'Overdrive',       color:'#ff8844',
            desc:'One discord note in your committed track counts as in-scale for HC scoring.' },
        }[cardType] ?? { icon:'?', name:cardType, color:'#aaaaff', desc:'' };

        return (
          <div style={{
            position:'fixed',inset:0,background:'#000000cc',zIndex:9990,
            display:'flex',alignItems:'center',justifyContent:'center',
          }}>
            <div style={{
              background:'#080f1e',border:`2px solid ${def.color}`,borderRadius:10,
              padding:'24px 28px',maxWidth:320,width:'90%',
              boxShadow:`0 0 30px ${def.color}44`,
            }}>
              {/* Card reveal */}
              <div style={{textAlign:'center',marginBottom:16}}>
                <div style={{fontSize:36,marginBottom:6}}>{def.icon}</div>
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:13,
                  color:def.color,letterSpacing:2,marginBottom:6}}>{def.name}</div>
                <div style={{fontSize:9,color:'#6a8aaa',lineHeight:1.6}}>{def.desc}</div>
              </div>

              {/* Hand display */}
              <div style={{marginBottom:14,padding:'8px 10px',background:'#0a1020',
                borderRadius:6,border:'1px solid #1a2a40'}}>
                <div style={{fontSize:7,color:'#3a5a7a',letterSpacing:1,marginBottom:6}}>
                  {spirit?.name}'s hand ({hand.length}/2)
                </div>
                {hand.length === 0 && (
                  <div style={{fontSize:8,color:'#2a3a50'}}>Empty — take it free!</div>
                )}
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {hand.map((c, i) => {
                    const cd = {
                      chromatic_shift: { icon:'🎼', name:'Chromatic Shift', color:'#44ffaa' },
                      transpose:       { icon:'🔄', name:'Transpose',       color:'#ffcc44' },
                      overdrive:       { icon:'⚡', name:'Overdrive',       color:'#ff8844' },
                    }[c.type] ?? { icon:'?', name:c.type, color:'#888' };
                    return (
                      <div key={c.id} style={{display:'flex',alignItems:'center',gap:8,
                        padding:'5px 8px',borderRadius:4,
                        background:`${cd.color}11`,border:`1px solid ${cd.color}44`}}>
                        <span style={{fontSize:12}}>{cd.icon}</span>
                        <span style={{flex:1,fontSize:8,color:cd.color}}>{cd.name}</span>
                        {c.exhausted && <span style={{fontSize:6,color:'#3a5070'}}>USED</span>}
                        <button onClick={() => resolveCardPickup(`replace-${i}`)}
                          style={{fontFamily:'inherit',fontSize:7,padding:'2px 7px',
                            background:'#0a1020',border:`1px solid ${def.color}66`,
                            borderRadius:3,color:def.color,cursor:'pointer'}}>
                          Replace
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{display:'flex',gap:8}}>
                {!handFull && (
                  <button onClick={() => resolveCardPickup('take')}
                    style={{flex:1,fontFamily:'inherit',fontSize:9,padding:'8px 0',
                      background:`${def.color}22`,border:`1px solid ${def.color}`,
                      borderRadius:5,color:def.color,cursor:'pointer',fontWeight:700}}>
                    ✓ Take Card
                  </button>
                )}
                <button onClick={() => resolveCardPickup('discard')}
                  style={{flex:handFull?1:0,fontFamily:'inherit',fontSize:9,padding:'8px 12px',
                    background:'#0a1020',border:'1px solid #3a5070',
                    borderRadius:5,color:'#3a5070',cursor:'pointer'}}>
                  Discard
                </button>
              </div>
              {handFull && (
                <div style={{fontSize:7,color:'#3a5a7a',textAlign:'center',marginTop:6}}>
                  Hand full — replace a card or discard
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── UPGRADE MODAL — blocks all action until resolved ── */}
      {acting && upgradesPending > 0 && (() => {
        const ns           = noteStates[acting.id] ?? {};
        const unlocked     = ns.unlockedSkills ?? [];
        const pendingId    = ns.pendingAwardSkillId;
        const pendingDef   = pendingId ? SKILL_BY_ID[pendingId] : null;
        const activeRoute  = ns.skillRoute ?? null;
        const acColor      = acting.color ?? '#44aaff';

        // If the just-awarded skill is an amp, show the place-amp prompt
        // and keep the overlay open until the amp is placed (ampPlacing clears on placement).
        const needsAmpPlacement = ['amp_1','amp_2','amp_3'].includes(pendingId) && ampPlacing === acting.id;
        if (needsAmpPlacement) {
          return (
            <div style={{
              position:'fixed', inset:0, background:'#000000cc', zIndex:8000,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:"'Orbitron',sans-serif", pointerEvents:'none',
            }}>
              <div style={{
                pointerEvents:'all',
                background:'#080f1e', border:`2px solid ${acColor}`,
                borderRadius:12, padding:'24px 28px', maxWidth:400, textAlign:'center',
                boxShadow:`0 0 50px ${acColor}55`,
              }}>
                <div style={{fontSize:28, marginBottom:8}}>🔊</div>
                <div style={{fontSize:14, color:acColor, fontWeight:700, letterSpacing:2, marginBottom:6}}>
                  AMP UNLOCKED!
                </div>
                <div style={{fontSize:11, color:'#c0d0e0', marginBottom:10}}>
                  {pendingDef?.label} — {pendingDef?.desc}
                </div>
                <div style={{fontSize:10, color:'#ffcc44', background:'#1a1200',
                  border:'1px solid #ffcc4455', borderRadius:6, padding:'10px 16px', marginBottom:14}}>
                  Click an adjacent hex on the board to place your Amp
                </div>
                <button
                  onClick={() => { setAmpPlacing(null);
                    setNoteStates(prev => ({...prev, [acting.id]:
                      {...prev[acting.id], upgradesPending:0, pendingAwardSkillId:null}})); }}
                  style={{fontFamily:'inherit', fontSize:8, padding:'5px 14px', cursor:'pointer',
                    background:'#0a1020', border:'1px solid #3a5070', borderRadius:4, color:'#3a5070'}}>
                  Skip placement
                </button>
              </div>
            </div>
          );
        }

        // Helper: can this skill be set as the next target?
        function canTarget(sk) {
          if (unlocked.includes(sk.id) || sk.id === pendingId) return false;
          if (sk.prereq && sk.prereq !== '__all_pa__' && sk.prereq !== '__all_stage_3__') {
            if (!unlocked.includes(sk.prereq) && sk.prereq !== pendingId) return false;
          }
          if (sk.prereq === '__all_pa__') {
            return ['mic','pedal_dist','amp_1','mixer'].every(id => unlocked.includes(id) || id === pendingId);
          }
          if (sk.prereq === '__all_stage_3__') {
            return ['laser_show','stage_light','fog_machine'].every(id => unlocked.includes(id) || id === pendingId);
          }
          if (sk.chainId === 'pa' && sk.id !== 'amp_1'
              && !unlocked.includes('amp_1') && pendingId !== 'amp_1') return false;
          return true;
        }

        const routeDef = activeRoute ? SKILL_TREE.routes.find(r => r.id === activeRoute) : null;

        const isInitialPick = (unlocked.length === 0) && !pendingId;

        return (
          <div style={{
            position:'fixed', inset:0, background:'#000000dd', zIndex:8000,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:"'Orbitron',sans-serif",
          }}>
            <div style={{
              width: activeRoute ? 560 : 480,
              maxHeight:'90vh', overflowY:'auto',
              background:'#080f1e', border:`2px solid ${acColor}`,
              // NOTE: was overflow:'hidden', which overrode overflowY:'auto' above
              // (the shorthand resets both axes) and made tall routes like Electric
              // unscrollable. overflowX:'hidden' keeps corner clipping horizontally.
              borderRadius:12, overflowX:'hidden',
              boxShadow:`0 0 50px ${acColor}55`,
            }}>
              {/* Header */}
              <div style={{
                padding:'14px 20px', borderBottom:`1px solid ${acColor}44`,
                background:`linear-gradient(135deg, ${acColor}22 0%, #0a1020 100%)`,
              }}>
                {/* Awarded skill banner */}
                {pendingDef && (() => {
                  const rd = SKILL_TREE.routes.find(r => r.id === pendingDef.routeId);
                  return (
                    <div style={{
                      background:`${rd?.color ?? acColor}22`, border:`1px solid ${rd?.color ?? acColor}88`,
                      borderRadius:8, padding:'8px 14px', marginBottom:10,
                      display:'flex', alignItems:'center', gap:10,
                    }}>
                      <span style={{fontSize:24}}>{pendingDef.icon}</span>
                      <div>
                        <div style={{fontSize:10, color: rd?.color ?? acColor, fontWeight:700, letterSpacing:1}}>
                          SKILL UNLOCKED!
                        </div>
                        <div style={{fontSize:12, color:'#ffffff', fontWeight:900, marginTop:1}}>
                          {pendingDef.label}
                        </div>
                        <div style={{fontSize:8, color:'#6a8aaa', marginTop:2}}>{pendingDef.desc}</div>
                      </div>
                    </div>
                  );
                })()}
                <div style={{display:'flex', alignItems:'center', gap:10}}>
                  <span style={{fontSize:22}}>{isInitialPick ? '🎸' : '🎯'}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13, color:acColor, letterSpacing:2, fontWeight:700}}>
                      {isInitialPick
                        ? (activeRoute ? `${routeDef?.icon} ${routeDef?.label} — Pick Your Path` : 'CHOOSE YOUR STARTING PATH')
                        : (activeRoute ? `${routeDef?.icon} ${routeDef?.label} — Pick Your Next Path` : 'SKILL TREE — Choose a Route')
                      }
                    </div>
                    <div style={{fontSize:8, color:'#3a5a7a', marginTop:2}}>
                      {acting.name} · pick a skill to work toward — it unlocks AUTOMATICALLY once your Harmonic Charge fills
                    </div>
                  </div>
                  <button onClick={() => setNoteStates(prev => ({
                    ...prev, [acting.id]: { ...prev[acting.id], upgradesPending: 0 }
                  }))} style={{
                    fontFamily:'inherit', fontSize:8, padding:'4px 10px',
                    background:'transparent', border:'1px solid #1e3a5f',
                    borderRadius:4, color:'#3a5a7a', cursor:'pointer',
                  }}>Decide later</button>
                  {activeRoute && (
                    <button onClick={() => setNoteStates(prev => ({
                      ...prev, [acting.id]: { ...prev[acting.id], skillRoute: null }
                    }))} style={{
                      fontFamily:'inherit', fontSize:8, padding:'4px 10px',
                      background:'#0a1020', border:`1px solid ${acColor}55`,
                      borderRadius:4, color:acColor, cursor:'pointer',
                    }}>← Routes</button>
                  )}
                </div>
              </div>

              {/* Route picker */}
              {!activeRoute && (
                <div style={{padding:'16px 20px', display:'flex', flexDirection:'column', gap:8}}>
                  <div style={{fontSize:8, color:'#3a5a7a', marginBottom:4}}>
                    Choose a route to browse. You can switch routes each upgrade.
                  </div>
                  {SKILL_TREE.routes.filter(route => !route.spiritOnly || route.spiritOnly === acting.id).map(route => {
                    const allSkills = route.skills
                      ? route.skills
                      : (route.subChains ?? []).flatMap(c => c.skills.map(sk => ({...sk, chainId:c.id})));
                    const targetable = allSkills.filter(sk => canTarget({...sk, chainId: sk.chainId})).length;
                    const owned      = allSkills.filter(sk => unlocked.includes(sk.id)).length;
                    return (
                      <button key={route.id}
                        onClick={() => setNoteStates(prev => ({
                          ...prev, [acting.id]: { ...prev[acting.id], skillRoute: route.id }
                        }))}
                        style={{
                          fontFamily:'inherit', cursor:'pointer', textAlign:'left',
                          background:'#0a1525', border:`1px solid ${route.color}66`,
                          borderRadius:8, padding:'12px 16px', transition:'all .15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background=`${route.color}18`; e.currentTarget.style.borderColor=route.color; }}
                        onMouseLeave={e => { e.currentTarget.style.background='#0a1525'; e.currentTarget.style.borderColor=`${route.color}66`; }}>
                        <div style={{display:'flex', alignItems:'center', gap:12}}>
                          <span style={{fontSize:26}}>{route.icon}</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:11, fontWeight:700, color:route.color, marginBottom:3}}>{route.label}</div>
                            <div style={{fontSize:8, color:'#6a8aaa'}}>{route.desc}</div>
                          </div>
                          <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4}}>
                            {targetable > 0 && (
                              <span style={{fontSize:7, color:'#ffcc44', background:'#1a1200',
                                border:'1px solid #ffcc4444', borderRadius:3, padding:'2px 6px'}}>
                                {targetable} available
                              </span>
                            )}
                            {owned > 0 && (
                              <span style={{fontSize:7, color:route.color, background:`${route.color}18`,
                                border:`1px solid ${route.color}44`, borderRadius:3, padding:'2px 6px'}}>
                                {owned} owned
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Skill list for selected route */}
              {activeRoute && routeDef && (
                <div style={{padding:'14px 20px', display:'flex', flexDirection:'column', gap:10}}>
                  {/* Flat-skills routes */}
                  {routeDef.skills && routeDef.skills.map(sk => {
                    const owned     = unlocked.includes(sk.id);
                    const isPending = sk.id === pendingId;
                    const targetable = canTarget(sk);
                    const prereqDef = sk.prereq && sk.prereq !== '__all_pa__' && sk.prereq !== '__all_stage_3__'
                      ? SKILL_BY_ID[sk.prereq] : null;
                    const locked = !owned && !isPending && !targetable
                      && prereqDef && !unlocked.includes(sk.prereq);
                    return (
                      <button key={sk.id}
                        disabled={owned || isPending || !targetable}
                        onClick={() => setSkillTarget(acting.id, sk.id)}
                        style={{
                          fontFamily:'inherit',
                          cursor: (owned || isPending) ? 'default' : targetable ? 'pointer' : 'default',
                          textAlign:'left', borderRadius:7, padding:'11px 14px',
                          background: isPending ? `${routeDef.color}28` : owned ? `${routeDef.color}14` : '#0a1525',
                          border:`1px solid ${isPending ? routeDef.color : owned ? routeDef.color+'66' : targetable ? routeDef.color+'55' : '#1a2a40'}`,
                          opacity: locked ? 0.35 : 1, transition:'all .15s',
                        }}
                        onMouseEnter={e => { if (targetable) { e.currentTarget.style.background=`${routeDef.color}28`; e.currentTarget.style.borderColor=routeDef.color; }}}
                        onMouseLeave={e => { if (targetable) { e.currentTarget.style.background='#0a1525'; e.currentTarget.style.borderColor=`${routeDef.color}55`; }}}>
                        <div style={{display:'flex', alignItems:'flex-start', gap:10}}>
                          <span style={{fontSize:20, marginTop:1}}>{sk.icon}</span>
                          <div style={{flex:1}}>
                            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                              <span style={{fontSize:10, fontWeight:700,
                                color: isPending ? '#ffffff' : owned ? routeDef.color : targetable ? '#c0d0e0' : '#3a5a7a'}}>
                                {sk.label}
                              </span>
                              {isPending && <span style={{fontSize:7, color:'#ffffff', background:routeDef.color,
                                borderRadius:3, padding:'1px 6px', fontWeight:700}}>✦ JUST UNLOCKED</span>}
                              {owned && !isPending && <span style={{fontSize:7, color:routeDef.color,
                                background:`${routeDef.color}22`, border:`1px solid ${routeDef.color}44`,
                                borderRadius:3, padding:'1px 5px'}}>✓ OWNED</span>}
                              {locked && prereqDef && (
                                <span style={{fontSize:7, color:'#3a5a7a'}}>🔒 {prereqDef.label}</span>
                              )}
                            </div>
                            <div style={{fontSize:8, color:'#5a7a8a', lineHeight:1.4}}>{sk.desc}</div>
                          </div>
                          <div style={{
                            fontSize:9, fontWeight:700, whiteSpace:'nowrap',
                            color: owned||isPending ? routeDef.color : '#ffcc44',
                            background:'#0a0e18',
                            border:`1px solid ${owned||isPending ? `${routeDef.color}44` : '#ffcc4433'}`,
                            borderRadius:4, padding:'3px 8px', marginTop:1,
                          }}>
                            {owned||isPending ? '✓' : `${sk.hcCost} HC`}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                  {/* Sub-chain routes (Electric) */}
                  {routeDef.subChains && routeDef.subChains.map(chain => (
                    <div key={chain.id}>
                      <div style={{fontSize:8, color:'#3a5a7a', letterSpacing:2, marginBottom:5,
                        borderBottom:'1px solid #1a2a40', paddingBottom:3}}>
                        {chain.label.toUpperCase()}
                        {chain.requiresFirst && !unlocked.includes(chain.requiresFirst) && pendingId !== chain.requiresFirst && (
                          <span style={{color:'#ff4444', marginLeft:8}}>
                            🔒 Requires {SKILL_BY_ID[chain.requiresFirst]?.label}
                          </span>
                        )}
                      </div>
                      <div style={{display:'flex', flexDirection:'column', gap:6}}>
                        {chain.skills.map(sk => {
                          const skWithChain = {...sk, chainId: chain.id};
                          const owned      = unlocked.includes(sk.id);
                          const isPending  = sk.id === pendingId;
                          const targetable = canTarget(skWithChain);
                          const prereqDef  = sk.prereq && sk.prereq !== '__all_pa__'
                            ? SKILL_BY_ID[sk.prereq] : null;
                          const locked = !owned && !isPending && !targetable && prereqDef;
                          return (
                            <button key={sk.id}
                              disabled={owned || isPending || !targetable}
                              onClick={() => setSkillTarget(acting.id, sk.id)}
                              style={{
                                fontFamily:'inherit',
                                cursor: (owned||isPending) ? 'default' : targetable ? 'pointer' : 'default',
                                textAlign:'left', borderRadius:6, padding:'9px 12px',
                                background: isPending ? `${routeDef.color}24` : owned ? `${routeDef.color}14` : '#0a1525',
                                border:`1px solid ${isPending ? routeDef.color : owned ? routeDef.color+'66' : targetable ? routeDef.color+'55' : '#1a2a40'}`,
                                opacity: locked ? 0.35 : 1, transition:'all .15s',
                              }}
                              onMouseEnter={e => { if (targetable) { e.currentTarget.style.background=`${routeDef.color}22`; e.currentTarget.style.borderColor=routeDef.color; }}}
                              onMouseLeave={e => { if (targetable) { e.currentTarget.style.background='#0a1525'; e.currentTarget.style.borderColor=`${routeDef.color}55`; }}}>
                              <div style={{display:'flex', alignItems:'flex-start', gap:9}}>
                                <span style={{fontSize:16, marginTop:1}}>{sk.icon}</span>
                                <div style={{flex:1}}>
                                  <div style={{display:'flex', alignItems:'center', gap:7, marginBottom:2}}>
                                    <span style={{fontSize:9, fontWeight:700,
                                      color: isPending ? '#ffffff' : owned ? routeDef.color : targetable ? '#c0d0e0' : '#3a5a7a'}}>
                                      {sk.label}
                                    </span>
                                    {isPending && <span style={{fontSize:6, color:'#ffffff',
                                      background:routeDef.color, borderRadius:3, padding:'1px 5px'}}>✦ NEW</span>}
                                    {owned && !isPending && <span style={{fontSize:6, color:routeDef.color}}>✓</span>}
                                    {locked && prereqDef && (
                                      <span style={{fontSize:6, color:'#3a5a7a'}}>🔒 {prereqDef.label}</span>
                                    )}
                                  </div>
                                  <div style={{fontSize:7, color:'#4a6a7a', lineHeight:1.4}}>{sk.desc}</div>
                                </div>
                                <div style={{
                                  fontSize:8, fontWeight:700, whiteSpace:'nowrap',
                                  color: owned||isPending ? routeDef.color : '#ffcc44',
                                  background:'#0a0e18',
                                  border:`1px solid ${owned||isPending ? `${routeDef.color}33` : '#ffcc4433'}`,
                                  borderRadius:4, padding:'2px 7px',
                                }}>
                                  {owned||isPending ? '✓' : `${sk.hcCost} HC`}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* (legacy purchase modal removed — skill picks set a target path; HC auto-unlocks) */}

      {/* ── LEFT PANEL ── */}
        <div style={{display:"flex",flexDirection:"column",gap:0}}>
          <div className="stitle">Spirits</div>

          {/* ── ACTIVE SPIRIT — full portrait card ── */}
          {acting && (() => {
            const s = acting;
            const ns = noteStates[s.id] ?? {};
            return (
              <div className="card" style={{
                borderLeft:`3px solid ${s.color}`,
                background:"#0d1528",
                boxShadow:`0 0 14px ${s.color}33, inset 0 0 20px ${s.color}0a`,
                marginBottom:6, padding:0, overflow:"hidden",
              }}>
                <NeonStrikeFX color={s.color}/>
                {/* Two-column card: loadout (left) · portrait + stats (right).
                    DOM order keeps portrait first; CSS `order` renders it on the
                    right. flexWrap lets the columns stack on very narrow panels. */}
                <div style={{display:"flex", flexWrap:"wrap", alignItems:"stretch"}}>
                {/* ── RIGHT COLUMN — stats OVER a faded portrait ──
                    The Spirit fills the whole column as a dimmed backdrop;
                    name header and stat bars float on top. A vertical wash
                    keeps text readable (dark top/bottom) while the middle
                    band stays clear so the Spirit shows through. */}
                <div style={{width:238, flexShrink:0, order:2, marginLeft:"auto",
                  position:"relative", overflow:"hidden", minHeight:174}}>

                {/* Faded portrait backdrop */}
                <img src={s.imageSrc} alt={s.name}
                  style={{position:"absolute", inset:0, width:"100%", height:"100%",
                    objectFit:"cover", objectPosition:"top center", display:"block",
                    opacity:0.42}}/>
                {/* readability wash + spirit-color tint */}
                <div style={{position:"absolute", inset:0, pointerEvents:"none",
                  background:"linear-gradient(180deg, #0d1528e6 0%, #0d152880 24%, #0d152840 50%, #0d1528a8 72%, #0d1528f0 100%)"}}/>
                <div style={{position:"absolute", inset:0, pointerEvents:"none",
                  background:`radial-gradient(130% 100% at 50% 100%, transparent 55%, ${s.color}10 100%)`,
                  borderLeft:`1px solid ${s.color}22`}}/>

                {/* CONTENT — floats over the art */}
                <div style={{position:"relative", display:"flex", flexDirection:"column", height:"100%"}}>
                {/* Header: name / style · NOW / Fame / Sparks */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
                  gap:6, padding:"6px 8px 5px"}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:700,color:s.color,lineHeight:1.2}}>
                      {s.name}
                      {s.knockedOut ? " 💀" : s.vibe===0 ? " ⚠️" : ""}
                    </div>
                    <div style={{fontSize:7,color:"#3a5a7a",marginTop:1,letterSpacing:1}}>{s.style}</div>
                    <div style={{fontSize:7,color:"#3a5a7a",marginTop:2}}>
                      Hex <span style={{color:HEX_BY_NUM[s.num]?.edge?"#ff4444":"#c0d0e0"}}>
                        #{s.num}{HEX_BY_NUM[s.num]?.edge?" ⚠":""}
                      </span>
                      {mode==="team" && <span style={{marginLeft:5}}>· Team {teams?.a.includes(s.corner)?"A":"B"}</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                    <span style={{fontSize:7,color:"#f6ad55",fontWeight:700}}>▶ NOW</span>
                    <span style={{fontSize:11,color:"#ffd700",fontWeight:900,letterSpacing:0.5,
                      background:"linear-gradient(180deg,#241c00,#120e00)",
                      border:"1.5px solid #ffd70088",borderRadius:5,padding:"2px 8px",
                      boxShadow:"0 0 10px #ffd70044, inset 0 0 6px #ffd70022",
                      textShadow:"0 0 6px #ffd70088",
                      animation: (ns.fame ?? 0) >= FAME_TO_WIN * 0.8 ? "crew-ready-glow 1.8s ease-in-out infinite" : undefined}}
                      title={`Fame Points — first to ${FAME_TO_WIN} wins! Earned by battles, riffs, cadences & sparks`}>
                      ⭐ {ns.fame ?? 0}<span style={{fontSize:8,opacity:0.7,fontWeight:700}}>/{FAME_TO_WIN}</span>
                    </span>
                    <span style={{fontSize:7,color:"#ffe9a0",
                      background:"#141104",border:"1px solid #ffd70033",borderRadius:3,padding:"1px 5px"}}
                      title={`Fame Sparks — collect ${SPARKS_PER_FP} from the board to forge 1 FP`}>
                      ✨ {ns.sparks ?? 0}/{SPARKS_PER_FP}
                    </span>
                  </div>
                </div>

                {/* clear window — the Spirit shows through here */}
                <div style={{flex:1, minHeight:44}}/>

                {/* Stats — overlaid at the bottom, over the faded art */}
                <div style={{padding:"6px 8px 7px", textShadow:"0 1px 3px #000c"}}>
                  {/* Vibe */}
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:7,color:"#3a5a7a",width:22}}>VIBE</span>
                    <div className="bar" style={{flex:1}}>
                      <div className="bar-f" style={{width:`${(s.vibe/s.maxVibe)*100}%`,
                        background:s.vibe>s.maxVibe*.4?"#44cc66":"#ff4444"}}/>
                    </div>
                    <span style={{fontSize:8,width:22,textAlign:"right",color:"#c0d0e0"}}>{s.vibe}/{s.maxVibe}</span>
                  </div>
                  {/* ⭐ Fame — the win condition, front and centre */}
                  <div style={{display:"flex",alignItems:"center",gap:4,marginTop:4}}
                    title={`Fame Points — first to ${FAME_TO_WIN} wins the game!`}>
                    <span style={{fontSize:7,color:"#ffd700",width:22,fontWeight:700}}>FAME</span>
                    <div className="bar" style={{flex:1,boxShadow:"0 0 5px #ffd70033"}}>
                      <div className="bar-f" style={{width:`${Math.min(100,((ns.fame ?? 0)/FAME_TO_WIN)*100)}%`,
                        background:"linear-gradient(90deg,#aa7700,#ffd700)",
                        boxShadow:"0 0 6px #ffd70088"}}/>
                    </div>
                    <span style={{fontSize:8,width:22,textAlign:"right",color:"#ffd700",fontWeight:700}}>{ns.fame ?? 0}</span>
                  </div>
                  {/* Drive (Power) / Feedback (Defense) / Sustain (Vibe capacity) / Speed */}
                  <div style={{display:"flex",gap:3,marginTop:4}}>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                        <span style={{fontSize:7,color:"#ff6644"}}>⚔️ DRV</span>
                        <span style={{fontSize:7,color:"#ff6644"}}>
                          {s.drive}{(ns.tempDrive??0)>0&&<span style={{color:"#ffaa44"}}>+{ns.tempDrive}</span>}
                        </span>
                      </div>
                      <div className="bar"><div className="bar-f" style={{width:`${(s.drive/10)*100}%`,background:"#cc4422"}}/></div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                        <span style={{fontSize:7,color:"#44aaff"}}>🛡️ FBK</span>
                        <span style={{fontSize:7,color:"#44aaff"}}>
                          {s.sustain}{(ns.tempSustain??0)>0&&<span style={{color:"#88ccff"}}>+{ns.tempSustain}</span>}
                        </span>
                      </div>
                      <div className="bar"><div className="bar-f" style={{width:`${(s.sustain/10)*100}%`,background:"#2266aa"}}/></div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                        <span style={{fontSize:7,color:"#cc66ff"}}>💗 SUS</span>
                        <span style={{fontSize:7,color:"#cc66ff"}}>{s.maxVibe ?? 5}</span>
                      </div>
                      <div className="bar"><div className="bar-f" style={{width:`${((s.maxVibe??5)/8)*100}%`,background:"#8844cc"}}/></div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:1}}>
                        <span style={{fontSize:7,color:"#44cc88"}}>⚡ SPD</span>
                        <span style={{fontSize:7,color:"#44cc88"}}>{Math.min(5, s.speed ?? 5)}</span>
                      </div>
                      <div className="bar"><div className="bar-f" style={{width:`${(Math.min(5,s.speed??5)/5)*100}%`,background:"#22aa66"}}/></div>
                    </div>
                  </div>
                </div>
                </div>{/* end overlay content */}
                </div>{/* end right column */}

                {/* ── LEFT COLUMN — loadout: badges · crew & gear · HC · skills ── */}
                <div style={{flex:1, minWidth:170, order:1, display:"flex", flexDirection:"column",
                  borderRight:`1px solid ${s.color}22`}}>
                {/* Status badges */}
                {((ns.tempDrive??0)>0||(ns.tempSustain??0)>0||(ns.mojoDrain??0)>0||ns.stagger||respawnFlashes[s.id]||ns.instrumentDropped||ns.tripped||ns.dazed||(ns.elevenTurns??0)>0||ns.junkyardArmed||amps.some(a=>a.ownerId===s.id&&a.unplugged)) && (
                  <div style={{display:"flex",gap:3,flexWrap:"wrap",padding:"4px 8px",borderTop:`1px solid ${s.color}22`}}>
                    {(ns.elevenTurns??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a1400",border:"1px solid #ffcc44",color:"#ffcc44"}}>
                        🎚️ GOES TO 11 — {ns.elevenTurns}t
                      </span>)}
                    {ns.junkyardArmed&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a1200",border:"1px solid #ffaa22",color:"#ffaa22"}}>
                        🔩 WEAPON ARMED — next Swing +2
                      </span>)}
                    {(ns.tempDrive??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#2a0e00",border:"1px solid #ff6644",color:"#ffaa44"}}>
                        ⚔️ +{ns.tempDrive} atk
                      </span>)}
                    {(ns.tempSustain??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#001a2a",border:"1px solid #44aaff",color:"#88ccff"}}>
                        🛡️ +{ns.tempSustain} def
                      </span>)}
                    {(ns.mojoDrain??0)>0&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#05101a",border:"1px solid #1155ff66",color:"#4499ff"}}>
                        💧 MOJO {ns.mojoDrain}t
                      </span>)}
                    {ns.stagger&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0e00",border:"1px solid #ff880066",color:"#ff8800"}}>
                        ⚡ STAGGER {ns.stagger.turnsLeft}t
                      </span>)}
                    {ns.tripped&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#0a1a0a",border:"1px solid #88ff8866",color:"#aaffaa"}}>
                        🌀 TRIPPED — half move
                      </span>)}
                    {ns.dazed&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0a1a",border:"1px solid #ff88ff66",color:"#ffaaff"}}>
                        😵 DAZED — move misdirected
                      </span>)}
                    {ns.instrumentDropped&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0808",border:"1px solid #ff444466",color:"#ff6666"}}>
                        🎸💥 DROPPED — Drive -1
                      </span>)}
                    {amps.some(a=>a.ownerId===s.id&&a.unplugged)&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#1a0e00",border:"1px solid #ff880066",color:"#ff8800"}}>
                        🔌 AMP UNPLUGGED — d6 only
                      </span>)}
                    {respawnFlashes[s.id]&&(
                      <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,background:"#0a2a10",border:"1px solid #44ff8866",color:"#44ff88"}}>
                        ✨ RESPAWN
                      </span>)}
                  </div>
                )}
                {/* ── CREW & GEAR — deployable amps, roadies, groupies, ultimate ── */}
                {(() => {
                  const unlocked = ns.unlockedSkills ?? [];
                  const myAmps   = amps.filter(a => a.ownerId === s.id);
                  const groupieIds = ['fans_4eva','pranksta','junkyard_dog','fandom_army'].filter(id => unlocked.includes(id));
                  const hasRoadies = (ns.roadies?.length ?? 0) > 0;
                  const hasUlt     = unlocked.includes('ultimate');
                  const ampUnlockCount = ['amp_1','amp_2','amp_3'].filter(id => unlocked.includes(id)).length;
                  const canPlaceAmp    = ampUnlockCount > myAmps.length;
                  if (!hasRoadies && groupieIds.length === 0 && !hasUlt && myAmps.length === 0 && !canPlaceAmp) return null;

                  const GROUPIE_DEFS = {
                    fans_4eva:    { icon:'💚', label:'Fans 4Eva',    hint:'+2 Vibe' },
                    pranksta:     { icon:'🪤', label:'Pranksta',     hint:'Unplug 2 rival amps ≤4 hex' },
                    junkyard_dog: { icon:'🔩', label:'Junkyard',     hint:'+2 next Swing' },
                    fandom_army:  { icon:'🛡️', label:'Fandom Army',  hint:'+2 Feedback next battle' },
                  };
                  const chipBase = {
                    fontFamily:'inherit', cursor:'pointer', borderRadius:4,
                    padding:'3px 7px', fontSize:8, lineHeight:1.3, whiteSpace:'nowrap',
                  };
                  return (
                    <div style={{padding:'5px 8px', borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:4}}>
                        <span style={{fontSize:7,color:'#3a5a7a',letterSpacing:2}}>CREW &amp; GEAR</span>
                        <span style={{flex:1,height:1,background:`linear-gradient(90deg, ${s.color}33, transparent)`}}/>
                      </div>

                      {/* AMPS row */}
                      {(myAmps.length > 0 || canPlaceAmp) && (
                        <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:4,alignItems:'center'}}>
                          <span style={{fontSize:7,color:'#ffcc4488',width:34}}>AMPS</span>
                          {myAmps.map((a,i) => (
                            <span key={a.id} title={a.unplugged ? 'Unplugged — send a Roadie or walk back in range' : 'Live'}
                              style={{...chipBase, cursor:'default',
                                background:a.unplugged?'#1a0e00':'#141a08',
                                border:`1px solid ${a.unplugged?'#ff8800':'#ffcc44'}66`,
                                color:a.unplugged?'#ff8800':'#ffcc44'}}>
                              🔊 #{a.hexNum}{a.unplugged?' ⚡✕':''}
                            </span>
                          ))}
                          {canPlaceAmp && !ampPlacing && (
                            <button style={{...chipBase, background:'#0a1020',
                                border:'1px dashed #ffcc44aa', color:'#ffcc44',
                                animation:'crew-ready-glow 2s ease-in-out infinite'}}
                              onClick={() => {
                                setAmpPlacing(s.id);
                                addLog(`🔊 ${s.name} — click an adjacent hex to place Amp ${myAmps.length + 1}`);
                              }}>
                              ➕ Place Amp {myAmps.length + 1}/{ampUnlockCount}
                            </button>
                          )}
                        </div>
                      )}

                      {/* ROADIES row */}
                      {hasRoadies && (
                        <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:4,alignItems:'center'}}>
                          <span style={{fontSize:7,color:'#88bbff88',width:34}}>CREW</span>
                          {ns.roadies.map((r, i) => {
                            const onCooldown = r.cooldownTurns > 0;
                            const isActive = roadieAction?.roadieId === r.id;
                            if (onCooldown) return (
                              <span key={r.id} style={{...chipBase, cursor:'default',
                                background:'#0a0e16', border:'1px solid #333344', color:'#444455'}}>
                                🔧 R{i+1} · {r.cooldownTurns}t
                              </span>
                            );
                            return (
                              <React.Fragment key={r.id}>
                                <button
                                  onClick={() => !isActive && startRoadieAction(s.id, r.id)}
                                  style={{...chipBase,
                                    background: isActive && roadieAction.phase!=='replug' && roadieAction.phase!=='pickAmp' ? s.color+'33' : '#0a1525',
                                    border:`1px solid ${s.color}66`, color:'#c0d0e0'}}>
                                  🔧 R{i+1} · Move Amp
                                </button>
                                {myAmps.some(a => a.unplugged) && (
                                  <button
                                    onClick={() => roadieStartFix(s.id, r.id)}
                                    style={{...chipBase,
                                      background: isActive && (roadieAction.phase==='replug'||roadieAction.phase==='pickAmp') ? '#113300' : '#0a1525',
                                      border:'1px solid #44ff8866', color:'#44ff88'}}>
                                    🔌 Fix Cable
                                  </button>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      )}

                      {/* GROUPIES row */}
                      {groupieIds.length > 0 && (
                        <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:4,alignItems:'center'}}>
                          <span style={{fontSize:7,color:'#44cc8888',width:34}}>FANS</span>
                          {groupieIds.map(id => {
                            const def = GROUPIE_DEFS[id];
                            const cd = ns.groupieCooldowns?.[id] ?? 0;
                            const armed = id === 'junkyard_dog' && ns.junkyardArmed;
                            if (cd > 0) return (
                              <span key={id} title={def.hint} style={{...chipBase, cursor:'default',
                                background:'#0a0e16', border:'1px solid #333344', color:'#444455'}}>
                                {def.icon} {cd}t
                              </span>
                            );
                            if (armed) return (
                              <span key={id} title="Weapon armed — lands on your next Swing" style={{...chipBase, cursor:'default',
                                background:'#1a1200', border:'1px solid #ffaa22', color:'#ffaa22'}}>
                                🔩 ARMED
                              </span>
                            );
                            return (
                              <button key={id} title={def.hint}
                                onClick={() => deployGroupie(s.id, id)}
                                style={{...chipBase, color:'#44cc88',
                                  background:'#08140e', border:'1px solid #44cc8866',
                                  animation:'crew-ready-glow 2.4s ease-in-out infinite'}}>
                                {def.icon} {def.label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* ULTIMATE row */}
                      {hasUlt && (
                        <div style={{display:'flex',gap:3,flexWrap:'wrap',marginBottom:2,alignItems:'center'}}>
                          <span style={{fontSize:7,color:'#ff44aa88',width:34}}>ULT</span>
                          {ns.ultimateUsed ? (
                            <span style={{...chipBase, cursor:'default',
                              background:'#0a0e16', border:'1px solid #333344', color:'#444455'}}>
                              💀 Encore spent
                            </span>
                          ) : (
                            <button title="Once per game: 2 Vibe damage + Stagger to all rivals within 4 hexes"
                              onClick={() => fireUltimate(s.id)}
                              style={{...chipBase, color:'#ff44aa', fontWeight:700,
                                background:'linear-gradient(135deg,#1a0014,#0a0010)',
                                border:'1px solid #ff44aa',
                                animation:'crew-ready-glow 1.6s ease-in-out infinite'}}>
                              💀 ENCORE APOCALYPSE
                            </button>
                          )}
                        </div>
                      )}

                      {/* Roadie action prompt (unchanged flow) */}
                      {roadieAction?.spiritId === s.id && (
                        <div style={{fontSize:8, color:'#ffcc44', marginTop:4,
                          padding:'3px 6px', background:'#1a1200', borderRadius:3,
                          border:'1px solid #ffcc4444'}}>
                          {roadieAction.phase === 'replug'
                            ? <>🔌 Replug amp on #{amps.find(a=>a.id===roadieAction.ampId)?.hexNum}?{' '}
                                <button onClick={confirmRoadieReplug}
                                  style={{fontFamily:'inherit',cursor:'pointer',background:'#113300',
                                    border:'1px solid #44ff88',borderRadius:3,color:'#44ff88',
                                    fontSize:9,marginLeft:4,padding:'1px 6px'}}>✓ Fix it!</button>
                              </>
                            : roadieAction.phase === 'pickAmp'
                              ? <>🔌 Click an unplugged amp hex to fix:<br/>
                                  {amps.filter(a=>a.ownerId===roadieAction.spiritId&&a.unplugged).map(a=>(
                                    <button key={a.id}
                                      onClick={()=>{
                                        setRoadieAction(prev=>({...prev,phase:'replug',ampId:a.id}));
                                        addLog(`🔌 Roadie targeting amp on #${a.hexNum}`);
                                      }}
                                      style={{fontFamily:'inherit',cursor:'pointer',background:'#0a1a0a',
                                        border:'1px solid #44ff88',borderRadius:3,color:'#44ff88',
                                        fontSize:9,margin:'2px 3px',padding:'1px 6px'}}>
                                      Amp #{a.hexNum}
                                    </button>
                                  ))}
                                </>
                            : roadieAction.phase === 'selectHex'
                              ? '📦 Click a hex near your Amp to move it'
                              : '📦 Click a direction hex to push the Amp toward'}
                          <button onClick={() => setRoadieAction(null)}
                            style={{fontFamily:'inherit', cursor:'pointer', background:'none', border:'none',
                              color:'#ff4444', fontSize:9, marginLeft:8, padding:0}}>✕</button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── HC PROGRESS BAR ── */}
                {(() => {
                  const targetId  = ns.targetSkillId;
                  const targetDef = targetId ? SKILL_BY_ID[targetId] : null;
                  const hcPts     = ns.hcPoints ?? 0;
                  const targetCost = targetDef?.hcCost ?? 8;
                  const pct       = Math.min(1, hcPts / targetCost);
                  const routeDef  = targetDef ? SKILL_TREE.routes.find(r => r.id === targetDef.routeId) : null;
                  const barColor  = routeDef?.color ?? '#ffcc44';
                  return (
                    <div style={{padding:"5px 8px 6px", borderTop:`1px solid ${s.color}22`}}>
                      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3}}>
                        <span style={{fontSize:7, color:"#3a5a7a", letterSpacing:1}}>HC PROGRESS</span>
                        {targetDef
                          ? <span style={{fontSize:7, color:barColor, fontWeight:700}}>
                              {targetDef.icon} {targetDef.label}
                            </span>
                          : <span style={{fontSize:7, color:"#2a3a50", fontStyle:"italic"}}>no target set</span>
                        }
                      </div>
                      <div style={{display:"flex", alignItems:"center", gap:6}}>
                        <div style={{flex:1, height:6, background:"#0a1020", borderRadius:3, overflow:"hidden",
                          border:"1px solid #1a2a40"}}>
                          <div style={{
                            height:"100%", borderRadius:3,
                            width:`${pct*100}%`,
                            background: pct >= 1
                              ? `linear-gradient(90deg, ${barColor}, #ffffff88)`
                              : `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                            transition:"width 0.4s ease",
                            boxShadow: pct >= 1 ? `0 0 8px ${barColor}` : "none",
                          }}/>
                        </div>
                        <span style={{fontSize:8, color: pct>=1 ? barColor : "#4a6a7a",
                          fontWeight: pct>=1 ? 700 : 400, whiteSpace:"nowrap"}}>
                          {hcPts} / {targetCost}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* ── OWNED SKILLS ── */}
                {(ns.unlockedSkills?.length ?? 0) > 0 && (() => {
                  return (
                    <div style={{padding:"4px 8px 6px", borderTop:`1px solid ${s.color}22`}}>
                      <div style={{fontSize:7, color:"#3a5a7a", letterSpacing:1, marginBottom:4}}>SKILLS</div>
                      <div style={{display:"flex", gap:4, flexWrap:"wrap"}}>
                        {ns.unlockedSkills.map(skillId => {
                          const sk       = SKILL_BY_ID[skillId];
                          if (!sk) return null;
                          const routeDef = SKILL_TREE.routes.find(r => r.id === sk.routeId);
                          const col      = routeDef?.color ?? '#88aabb';
                          return (
                            <div key={skillId} title={`${sk.label}: ${sk.desc}`} style={{
                              display:"flex", alignItems:"center", gap:3,
                              background:`${col}18`, border:`1px solid ${col}55`,
                              borderRadius:4, padding:"2px 6px",
                              cursor:"default",
                            }}>
                              <span style={{fontSize:11}}>{sk.icon}</span>
                              <span style={{fontSize:7, color:col, fontWeight:700, lineHeight:1.2}}>
                                {sk.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div style={{flex:1}}/>{/* push loadout content to top */}
                </div>{/* end left column */}
                </div>{/* end two-column row */}
              </div>
            );
          })()}

          {/* ── NOTE STOCK PANEL ── */}
          {acting && (
            <div className="card" style={{borderLeft:`2px solid #4488ff`,padding:"6px 8px",marginBottom:4}}>
              <NeonStrikeFX color="#4488ff"/>
              {/* Header: big Root Note badge + title + interval legend */}
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                {/* 🎵 ROOT NOTE — big mode-colored badge */}
                <div title={pivotPending
                    ? `Root Note is ${rootNote} — choose Major or Minor below to set your scale`
                    : `Root Note — your scale is ${rootNote} ${scaleMode}. The LAST note of your committed track becomes next turn's Root!`}
                  style={{
                    width:48,height:48,borderRadius:9,flexShrink:0,
                    display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                    background: pivotPending ? "linear-gradient(135deg,#241a00,#120d00)"
                      : scaleMode==='major' ? "linear-gradient(135deg,#0d2050,#0a1228)"
                      : "linear-gradient(135deg,#240d45,#12091e)",
                    border:`2px solid ${pivotPending ? "#ffcc44" : scaleMode==='major' ? "#4488ff" : "#aa55ff"}`,
                    boxShadow:`0 0 14px ${pivotPending ? "#ffcc4466" : scaleMode==='major' ? "#4488ff66" : "#aa55ff66"}, inset 0 0 10px ${pivotPending ? "#ffcc4422" : scaleMode==='major' ? "#4488ff22" : "#aa55ff22"}`,
                  }}>
                  <span style={{fontSize:5.5,letterSpacing:1.5,color:"#7a90aa",fontWeight:700}}>ROOT</span>
                  <span style={{fontSize:18,fontWeight:900,color:"#ffffff",lineHeight:1,
                    textShadow:`0 0 10px ${pivotPending ? "#ffcc44" : scaleMode==='major' ? "#4488ff" : "#aa55ff"}`}}>
                    {rootNote}
                  </span>
                  <span style={{fontSize:6,letterSpacing:1,marginTop:1,fontWeight:700,
                    color: pivotPending ? "#ffcc44" : scaleMode==='major' ? "#88bbff" : "#cc99ff"}}>
                    {pivotPending ? "PICK MODE" : scaleMode === 'major' ? "☀️ MAJOR" : "🌑 MINOR"}
                  </span>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="stitle" style={{marginBottom:3,color:"#4488ff"}}>Note Stock</div>
                  <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:7,color:"#cc55ff"}}>4th={fourthNote}</span>
                    <span style={{fontSize:7,color:"#ff55aa"}}>5th={fifthNote}</span>
                    <span style={{fontSize:7,color:"#ff3300"}}>tri={tritoneNote}</span>
                    <span style={{fontSize:7,color:"#44ffaa"}}>M3={majorThirdNote}</span>
                    <span style={{fontSize:7,color:"#4499ff"}}>m7={minorSeventhNote}</span>
                  </div>
                </div>
              </div>
              {/* 🎛️ AMP TONE PANEL — knobs shape how clicked notes sound */}
              <div style={{display:"flex",alignItems:"flex-end",gap:9,marginBottom:5,
                background:"linear-gradient(180deg,#161d30,#0a0e1c)",border:"1px solid #283850",
                borderRadius:6,padding:"5px 10px 4px 10px",
                boxShadow:"inset 0 1px 0 #ffffff14, 0 2px 4px #00000055"}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginRight:1,paddingBottom:1}}>
                  <span style={{fontSize:13,lineHeight:1}}>🎛️</span>
                  <span style={{fontSize:5.5,color:"#5a7090",letterSpacing:1.5,marginTop:3,fontFamily:"'Orbitron',sans-serif"}}>AMP</span>
                </div>
                {/* 🎙️ VOICE — click to cycle the oscillator waveform/character */}
                {(() => {
                  const cur = toneKnobs.voice ?? 'saw';
                  const V = TONE_VOICES[cur] ?? TONE_VOICES.saw;
                  const cycle = () => {
                    const i = TONE_VOICE_ORDER.indexOf(cur);
                    const next = TONE_VOICE_ORDER[(i + 1) % TONE_VOICE_ORDER.length];
                    setToneKnobs(k => ({ ...k, voice: next }));
                    toneKnobsRef.current = { ...toneKnobsRef.current, voice: next }; // sync ref so preview uses new voice
                    playNoteSound(rootNote, { holdTime: 0.3, fadeTime: 0.35, volume: 0.16 });
                  };
                  return (
                    <button onClick={cycle}
                      title="VOICE — the wave/character: LEAD (saw), BUZZ (square), MELLOW (triangle), CLEAN (sine), FUZZ (octave-stacked square). Click to cycle."
                      style={{fontFamily:"'Orbitron',sans-serif", cursor:"pointer",
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                        width:46, height:46, borderRadius:9, flexShrink:0,
                        background:"linear-gradient(135deg,#1c1230,#0e0a1e)",
                        border:"2px solid #aa66ff",
                        boxShadow:"0 0 12px #aa66ff55, inset 0 0 8px #aa66ff22"}}>
                      <span style={{fontSize:5.5,letterSpacing:1.5,color:"#b98aff",fontWeight:700}}>VOICE</span>
                      <span style={{fontSize:9.5,fontWeight:900,color:"#ffffff",lineHeight:1.1,marginTop:2,
                        textShadow:"0 0 10px #aa66ff"}}>{V.label}</span>
                      <span style={{fontSize:5,letterSpacing:1,marginTop:2,color:"#7a6aaa"}}>▶ cycle</span>
                    </button>
                  );
                })()}
                <AmpKnob label="DRIVE" color="#ff6644"
                  value={toneKnobs.drive} defaultValue={TONE_KNOB_DEFAULTS.drive}
                  onChange={v=>setToneKnobs(k=>({...k,drive:v}))}
                  onCommit={()=>playNoteSound(rootNote,{holdTime:0.3,fadeTime:0.35,volume:0.16})}
                  title="DRIVE — distortion. Crank it for filth, roll it back for clean. Double-click to reset."/>
                <AmpKnob label="TONE" color="#ffcc44"
                  value={toneKnobs.tone} defaultValue={TONE_KNOB_DEFAULTS.tone}
                  onChange={v=>setToneKnobs(k=>({...k,tone:v}))}
                  onCommit={()=>playNoteSound(rootNote,{holdTime:0.3,fadeTime:0.35,volume:0.16})}
                  title="TONE — brightness. Left = dark and woolly, right = cutting treble. Double-click to reset."/>
                <AmpKnob label="ECHO" color="#44ddff"
                  value={toneKnobs.echo} defaultValue={TONE_KNOB_DEFAULTS.echo}
                  onChange={v=>setToneKnobs(k=>({...k,echo:v}))}
                  onCommit={()=>playNoteSound(rootNote,{holdTime:0.3,fadeTime:0.35,volume:0.16})}
                  title="ECHO — slapback delay. Higher = louder, longer repeats. Double-click to reset."/>
                <AmpKnob label="VERB" color="#aa88ff"
                  value={toneKnobs.verb} defaultValue={TONE_KNOB_DEFAULTS.verb}
                  onChange={v=>setToneKnobs(k=>({...k,verb:v}))}
                  onCommit={()=>playNoteSound(rootNote,{holdTime:0.3,fadeTime:0.35,volume:0.16})}
                  title="VERB — reverb. From dry club stage to stadium wash. Double-click to reset."/>
                <span style={{marginLeft:"auto",fontSize:6,color:"#3a5a7a",lineHeight:1.5,textAlign:"right",paddingBottom:4}}>
                  drag / scroll to turn<br/>shift = fine · 2×click resets
                </span>
              </div>
              {/* Active effect badges */}
              {(feedbackBoost || dieFloorBoost > 0 || statusEffects.length > 0
                || (actingNoteState?.finalsTrail?.length ?? 0) > 0
                || ((actingNoteState?.unlockedSkills ?? []).includes('mixer') && !actingNoteState?.mixerUsedThisTurn && !hasConfirmed && !pivotPending)) && (
                <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:4}}>
                  {(actingNoteState?.finalsTrail?.length ?? 0) > 0 && (() => {
                    const trail = actingNoteState.finalsTrail;
                    const hints = cadenceHints(trail, actingNoteState?.cadenceCooldowns ?? {}).slice(0, 2);
                    return (
                      <div title="Cadence run — the pitch of each turn's FINAL track note. String the right finals across turns (any key) for Fame! See 📖 Riffbook → Cadences."
                        style={{flexBasis:"100%",padding:"4px 7px",borderRadius:4,
                        background:"#081a14",border:"1px solid #44ffaa66"}}>
                        <div style={{fontSize:7,color:"#44ffaa",fontWeight:700,marginBottom: hints.length ? 3 : 0}}>
                          🎯 finals: {trail.slice(-4).map(pc => PC_PLAY_NAMES[pc]).join(' → ')} → ?
                        </div>
                        {hints.map(h => (
                          <div key={h.cadence.id} style={{
                            fontSize:7, lineHeight:1.5, display:"flex", alignItems:"center", gap:4,
                            color: h.resolves ? "#ffd700" : "#7ab89a",
                          }}>
                            <span>{h.cadence.icon}</span>
                            <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {h.cadence.name} <span style={{opacity:0.7}}>{h.matched}/{h.total}</span>
                              {' — end on '}
                              <span style={{fontWeight:900, color: h.resolves ? "#ffd700" : "#aaffcc",
                                textShadow: h.resolves ? "0 0 6px #ffd70088" : "none"}}>{h.nextNote}</span>
                              {h.resolves
                                ? <span style={{fontWeight:700}}> to RESOLVE! ⭐{h.cadence.fp} FP</span>
                                : <span style={{opacity:0.6}}> next ({h.cadence.formula})</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {(actingNoteState?.unlockedSkills ?? []).includes('mixer') && !actingNoteState?.mixerUsedThisTurn && !hasConfirmed && !pivotPending && (
                    <span title="Mixer — tap one dimmed (already played) note to layer it a second time"
                      style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#0a141a",border:"1px solid #44ddff",color:"#44ddff",
                      animation:"crew-ready-glow 2.4s ease-in-out infinite"}}>
                      🎚️ MIXER READY — tap a played note to double it
                    </span>
                  )}{feedbackBoost && (
                    <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#2a0800",border:"1px solid #ff3300",color:"#ff5522"}}>
                      🔥 Feedback ×2
                    </span>
                  )}
                  {dieFloorBoost > 0 && (
                    <span style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#0a1a2a",border:"1px solid #44aaff",color:"#44aaff"}}>
                      🎶 Floor +{dieFloorBoost}
                    </span>
                  )}
                  {statusEffects.map((fx,i) => (
                    <span key={i} style={{fontSize:7,padding:"1px 5px",borderRadius:3,
                      background:"#1a0a2a",border:"1px solid #aa55ff",color:"#aa55ff"}}>
                      {fx}
                    </span>
                  ))}
                </div>
              )}
              {/* Pivot choice — shown BEFORE stock, with note stock preview */}
              {pivotPending ? (
                <div style={{background:"#0e0d18",border:"1.5px solid #ffcc44",borderRadius:5,padding:"8px 10px",marginBottom:4}}>
                  <div style={{fontSize:9,color:"#ffcc44",fontWeight:700,marginBottom:6}}>
                    ⚡ Root Note: <span style={{color:"#fff"}}>{rootNote}</span> — choose your scale
                  </div>

                  {/* Stock preview split by mode */}
                  {(() => {
                    const majRoot  = canonicalRoot(rootNote, 'major');
                    const minRoot  = canonicalRoot(rootNote, 'minor');
                    const majScale = buildScale(majRoot, 'major');
                    const minScale = buildScale(minRoot, 'minor');
                    const majIntervals = getIntervalNotes(majRoot, 'major');
                    const minIntervals = getIntervalNotes(minRoot, 'minor');
                    const stock = actingNoteState?.noteStock ?? [];

                    function noteColor(note, scale, intervals, mode) {
                      const pc = pitchIndex(note);
                      // Fourth and fifth are always diatonic — always show their color
                      if (pc === pitchIndex(intervals.fifth))        return { border:"#ff55aa", text:"#ff55aa", bg:"#2a0f1a" };
                      if (pc === pitchIndex(intervals.fourth))       return { border:"#cc55ff", text:"#cc55ff", bg:"#1a0a2a" };
                      // Special interval colors only show once the matching Discord upgrade is unlocked.
                      // If the note is already in-scale for this mode, it's just a plain scale note.
                      // Tritone: red only with discord_3 (Devil's Interval), both modes
                      if (pc === pitchIndex(intervals.tritone)) {
                        if (!scale.includes(note) && discordUnlocks.includes('discord_3'))
                          return { border:"#ff3300", text:"#ff3300", bg:"#2a0800" };
                        // Note: chromatic (discord_4) gives no special color — stays grey
                      }
                      // Minor seventh: blue only with discord_1 (Blues Lick), major mode only
                      if (pc === pitchIndex(intervals.minorSeventh)) {
                        if (!scale.includes(note) && mode === 'major' && discordUnlocks.includes('discord_1'))
                          return { border:"#4499ff", text:"#4499ff", bg:"#051525" };
                      }
                      // Major third: green only with discord_2 (Borrowed Chord), minor mode only
                      if (pc === pitchIndex(intervals.majorThird)) {
                        if (!scale.includes(note) && mode === 'minor' && discordUnlocks.includes('discord_2'))
                          return { border:"#44ffaa", text:"#44ffaa", bg:"#0a2a1a" };
                      }
                      if (scale.includes(note)) return { border:"#c0c8d8", text:"#e8eef8", bg:"#1a2035" };
                      return { border:"#333344", text:"#444455", bg:"#0d0d14" };
                    }

                    // Count how many stock notes are in-scale for each mode
                    const majInScale = stock.filter(n => {
                      const respelled = getSpelledPool(majRoot,'major')[pitchIndex(n)] ?? n;
                      return majScale.includes(respelled);
                    }).length;
                    const minInScale = stock.filter(n => {
                      const respelled = getSpelledPool(minRoot,'minor')[pitchIndex(n)] ?? n;
                      return minScale.includes(respelled);
                    }).length;

                    return (
                      <div style={{display:"flex",gap:6,marginBottom:8}}>
                        {/* Major preview */}
                        <div style={{flex:1,background:"#0a1228",borderRadius:4,padding:"6px 7px",
                          border:"1px solid #4488ff33"}}>
                          <div style={{fontSize:7,color:"#4488ff",letterSpacing:1,marginBottom:5,
                            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>♩ MAJOR</span>
                            <span style={{color:"#6aaa88",fontSize:7}}>{majInScale}/8 in scale</span>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:5}}>
                            {stock.map((note,i) => {
                              const pool = getSpelledPool(majRoot,'major');
                              const respelled = pool[pitchIndex(note)] ?? note;
                              const c = noteColor(respelled, majScale, majIntervals, 'major');
                              return (
                                <div key={i} style={{
                                  width:22,height:20,borderRadius:2,fontSize:8,fontWeight:700,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  border:`1.5px solid ${c.border}`,color:c.text,background:c.bg,
                                }}>{respelled}</div>
                              );
                            })}
                          </div>
                          <div style={{fontSize:7,color:"#4488ff88",marginBottom:1}}>Scale: {majScale.join(' · ')}</div>
                          <div style={{marginTop:4,padding:"3px 6px",borderRadius:3,
                            background:"#0d1830",border:"1px solid #4488ff44",
                            fontSize:7,color:"#88bbff"}}>
                            ☀️ Bonus: <span style={{color:"#aaccff",fontWeight:700}}>+1 HC point</span>
                          </div>
                        </div>

                        {/* Minor preview */}
                        <div style={{flex:1,background:"#12091e",borderRadius:4,padding:"6px 7px",
                          border:"1px solid #aa55ff33"}}>
                          <div style={{fontSize:7,color:"#aa55ff",letterSpacing:1,marginBottom:5,
                            display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>♩ MINOR</span>
                            <span style={{color:"#6aaa88",fontSize:7}}>{minInScale}/8 in scale</span>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:5}}>
                            {stock.map((note,i) => {
                              const pool = getSpelledPool(minRoot,'minor');
                              const respelled = pool[pitchIndex(note)] ?? note;
                              const c = noteColor(respelled, minScale, minIntervals, 'minor');
                              return (
                                <div key={i} style={{
                                  width:22,height:20,borderRadius:2,fontSize:8,fontWeight:700,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  border:`1.5px solid ${c.border}`,color:c.text,background:c.bg,
                                }}>{respelled}</div>
                              );
                            })}
                          </div>
                          <div style={{fontSize:7,color:"#aa55ff88",marginBottom:1}}>Scale: {minScale.join(' · ')}</div>
                          <div style={{marginTop:4,padding:"3px 6px",borderRadius:3,
                            background:"#180d2a",border:"1px solid #aa55ff44",
                            fontSize:7,color:"#cc99ff"}}>
                            🌑 Bonus: <span style={{color:"#ddbbff",fontWeight:700}}>+1 Feedback</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{display:"flex",gap:6}}>
                    <button className="btn" onClick={()=>declarePivot("major")}
                      style={{flex:1,fontSize:9,padding:"5px 0",borderColor:"#4488ff",color:"#4488ff",
                        background:"#0a1228",fontWeight:700}}>
                      ☀️ Major
                    </button>
                    <button className="btn" onClick={()=>declarePivot("minor")}
                      style={{flex:1,fontSize:9,padding:"5px 0",borderColor:"#aa55ff",color:"#aa55ff",
                        background:"#12091e",fontWeight:700}}>
                      🌑 Minor
                    </button>
                  </div>
                </div>
              ) : hasConfirmed ? (
                <div style={{fontSize:8,color:"#44ff88",marginBottom:5,padding:"6px 8px",background:"#0d1f10",border:"1px solid #44ff8844",borderRadius:4}}>
                  ✓ Notes committed — end your turn or move.
                </div>
              ) : (
                <>
                {/* Note stock grid */}
                {(() => {
                  // 🎯 Pitch classes that would RESOLVE a cadence if they end this track
                  const resolvePcs = new Set(
                    cadenceHints(actingNoteState?.finalsTrail ?? [], actingNoteState?.cadenceCooldowns ?? {})
                      .filter(h => h.resolves).map(h => h.nextPc)
                  );
                  return (
                <div style={{display:"flex",flexWrap:"wrap",gap:2,marginBottom:5}}>
                  {noteStock.map((note,idx)=>{
                    const notePC         = pitchIndex(note);
                    const isTritone      = notePC === pitchIndex(tritoneNote);
                    const isMajorThird   = notePC === pitchIndex(majorThirdNote);
                    const isMinorSeventh = notePC === pitchIndex(minorSeventhNote);
                    const isFourth       = notePC === pitchIndex(fourthNote);
                    const isFifth        = notePC === pitchIndex(fifthNote);
                    const intervalKey    = isTritone      ? 'tritone'
                                        : isMajorThird   ? 'majorThird'
                                        : isMinorSeventh ? 'minorSeventh'
                                        : isFourth       ? 'fourth'
                                        : isFifth        ? 'fifth' : null;
                    const isIntervalNote = intervalKey !== null;
                    const isUnlocked     = isIntervalNote && unlockedIntervalKeys.has(intervalKey);
                    const inScaleNote    = currentScale.includes(note);
                    const inScale        = inScaleNote;
                    const used           = usedStockIdx.has(idx);
                    const isStaggered    = staggeredSlots.includes(idx);
                    // Special color rules mirror the Discord unlock gates:
                    // - tritone: needs discord_3 (out-of-scale until then → gray)
                    // - minorSeventh: needs discord_1 to show blue (in Major it's out-of-scale
                    //   without it; in Minor it's naturally in-scale → show as plain white)
                    // - majorThird: needs discord_2 to show green (in Minor it's out-of-scale
                    //   without it; in Major it's naturally in-scale → show as plain white)
                    // - fourth/fifth: always diatonic → always show their color
                    const showTritoneColor      = isTritone      && discordUnlocks.includes('discord_3');
                    const showMinorSeventhColor = isMinorSeventh && discordUnlocks.includes('discord_1') && scaleMode === 'major';
                    const showMajorThirdColor   = isMajorThird   && discordUnlocks.includes('discord_2') && scaleMode === 'minor';
                    // Out-of-scale interval notes that haven't been unlocked → gray discord
                    const showAsDiscord  = isIntervalNote && !isUnlocked && !inScaleNote;
                    const borderC = showAsDiscord        ? "#444455"
                                  : showTritoneColor     ? "#ff3300"
                                  : showMinorSeventhColor? "#4499ff"
                                  : showMajorThirdColor  ? "#44ffaa"
                                  : isFifth              ? "#ff55aa"
                                  : isFourth             ? "#cc55ff"
                                  : inScaleNote          ? "#c0c8d8"
                                  : "#444455";
                    const textC   = showAsDiscord        ? "#555566"
                                  : showTritoneColor     ? "#ff3300"
                                  : showMinorSeventhColor? "#4499ff"
                                  : showMajorThirdColor  ? "#44ffaa"
                                  : isFifth              ? "#ff55aa"
                                  : isFourth             ? "#cc55ff"
                                  : inScaleNote          ? "#e8eef8"
                                  : "#555566";
                    const bgC     = showAsDiscord        ? "#111118"
                                  : showTritoneColor     ? "#2a0800"
                                  : showMinorSeventhColor? "#051525"
                                  : showMajorThirdColor  ? "#0a2a1a"
                                  : isFifth              ? "#2a0f1a"
                                  : isFourth             ? "#1a0a2a"
                                  : inScaleNote          ? "#1a2035"
                                  : "#111118";
                    const shadow  = showAsDiscord        ? "none"
                                  : showTritoneColor     ? "0 0 6px #ff330077"
                                  : showMinorSeventhColor? "0 0 5px #4499ff77"
                                  : showMajorThirdColor  ? "0 0 5px #44ffaa55"
                                  : isFifth              ? "0 0 5px #ff55aa66"
                                  : isFourth             ? "0 0 5px #cc55ff66"
                                  : inScaleNote          ? "0 0 4px #c0c8d844"
                                  : "none";
                    const lockTip = isIntervalNote && !isUnlocked && !inScaleNote
                                  ? ` 🔒 Locked — upgrade Discord path to unlock` : '';
                    // 🎚️ Mixer — used slots stay tappable for one layered repeat per turn
                    const mixerReady = used && !isStaggered
                      && (actingNoteState?.unlockedSkills ?? []).includes('mixer')
                      && !actingNoteState?.mixerUsedThisTurn
                      && !hasConfirmed && !pivotPending && noteTrack.length < 8;
                    // 🎯 This note's pitch would resolve a cadence if it ends the track
                    const resolvesCadence = resolvePcs.has(notePC) && !used && !isStaggered;
                    return (
                      <div key={idx} onClick={()=>{ if (isStaggered) return; if (!used || mixerReady) clickNoteStock(idx); }}
                        title={isStaggered ? "⚡ Staggered — unavailable"
                             : mixerReady ? "🎚️ Mixer — tap to layer this note again"
                             : resolvesCadence ? `🎯 End your track on this note to RESOLVE a cadence — Fame!${lockTip}`
                             : lockTip || undefined}
                        className="hexw"
                        style={{
                          width:29,height:32,
                          cursor:(used&&!mixerReady)||isStaggered?"default":"pointer",
                          opacity:used?(mixerReady?0.55:0.15):isStaggered?0.3:1,
                          background: isStaggered ? "#ff880066" : mixerReady ? "#44ddff" : resolvesCadence ? "#ffd700" : borderC,
                          filter: resolvesCadence ? "drop-shadow(0 0 5px #ffd700cc)"
                                : (isStaggered || shadow === "none") ? "none" : `drop-shadow(${shadow})`,
                          animation: resolvesCadence ? "cadence-gold-pulse 1.6s ease-in-out infinite" : undefined,
                          transition:"all .1s",
                        }}>
                        <div className="hexi" style={{
                          fontSize:9,fontWeight:700,
                          color: isStaggered ? "#ff8800" : mixerReady ? "#44ddff" : resolvesCadence ? "#ffd700" : textC,
                          background: isStaggered ? "#1a0e00" : bgC,
                        }}>{isStaggered ? "⚡" : note}</div>
                      </div>
                    );
                  })}
                </div>
                  );
                })()}
                {/* Transpose card — pick-a-note banner */}
                {actingNoteState?.transposeCardPending && (
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,
                    background:'#1a1400',border:'1.5px solid #ffcc44',borderRadius:4,padding:'5px 8px',
                    animation:'hex-turn-pulse 1s ease-in-out infinite'}}>
                    <span style={{fontSize:11}}>🔄</span>
                    <span style={{fontSize:8,color:'#ffcc44',fontWeight:700}}>
                      Transpose: click any stock note to set it as your new Root
                    </span>
                  </div>
                )}
                {/* Overdrive active banner */}
                {actingNoteState?.overdriveActive && !hasConfirmed && (
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,
                    background:'#1a0c00',border:'1.5px solid #ff8844',borderRadius:4,padding:'4px 8px'}}>
                    <span style={{fontSize:10}}>⚡</span>
                    <span style={{fontSize:8,color:'#ff8844',fontWeight:700}}>
                      Overdrive active — 1 discord note pardoned
                    </span>
                  </div>
                )}
                {/* Bank note UI */}
                {bankedNote && !hasConfirmed && (
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4,
                    background:"#0d1a10",border:"1px solid #44aa6644",borderRadius:4,padding:"4px 7px"}}>
                    <span style={{fontSize:8,color:"#44aa66"}}>💾 Banked:</span>
                    <span style={{fontSize:10,fontWeight:700,color:"#44ff88",background:"#0d2010",
                      border:"1px solid #44ff8866",borderRadius:3,padding:"1px 6px"}}>{bankedNote.note}</span>
                    <button className="btn" style={{fontSize:7,padding:"1px 6px",borderColor:"#44aa66",color:"#44ff88",marginLeft:"auto"}}
                      onClick={useBankedNote}>▶ Use</button>
                  </div>
                )}
                {discordCount>0 && <div style={{fontSize:8,color:"#ff6600",marginBottom:3}}>⚡ {discordCount} Dischord note{discordCount!==1?"s":""}</div>}
                <div style={{display:"flex",gap:3}}>
                  <button className="btn" style={{flex:1,borderColor:"#44ff88",color:"#44ff88",fontSize:8}}
                    onClick={confirmNoteTrack}
                    disabled={noteTrack.length===0}>
                    ✓ Commit ({noteTrack.length} notes → {Math.min(noteTrack.length, actingSpeed)} hex · SPD {actingSpeed})
                  </button>
                  <button className="btn" style={{borderColor:"#ff4444",color:"#ff4444",fontSize:8}}
                    onClick={clearNoteTrack}>✕</button>
                </div>
                </>
              )}
            </div>
          )}

          {/* ── RIVAL SPIRITS — collapsed rows ── */}
          {spirits.filter(s => !s.knockedOut && acting?.id !== s.id).map(s => {
            const ns = noteStates[s.id] ?? {};
            return (
              <div key={s.id} className="card" style={{
                padding:"4px 7px", marginBottom:3,
                borderLeft:`2px solid ${s.color}66`,
                opacity: s.knockedOut ? 0.25 : 0.75,
                background:"#080f1e",
              }}>
                <NeonStrikeFX color={s.color} calm/>
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <div style={{width:18,height:18,borderRadius:2,overflow:"hidden",flexShrink:0,
                    border:`1px solid ${s.color}44`}}>
                    <img src={s.imageSrc} alt={s.name} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:8,fontWeight:700,color:s.color,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {s.name.split(" ")[0]}
                    </div>
                    <div className="bar" style={{marginTop:2}}>
                      <div className="bar-f" style={{
                        width:`${(s.vibe/s.maxVibe)*100}%`,
                        background:s.vibe>s.maxVibe*.4?"#44cc66":"#ff4444"}}/>
                    </div>
                  </div>
                  <span style={{fontSize:7,color:"#3a5a7a",whiteSpace:"nowrap"}}>
                    {s.vibe}/{s.maxVibe}
                  </span>
                  <span style={{fontSize:7,color:"#ffd700",whiteSpace:"nowrap",marginLeft:2}} title="Fame Points">
                    ⭐{ns.fame ?? 0}
                  </span>
                  <span style={{fontSize:7,color:"#44aaff",whiteSpace:"nowrap",marginLeft:2}} title="Feedback">
                    🛡️{s.sustain}{(ns.tempSustain??0)>0&&<span style={{color:"#88ccff"}}>+{ns.tempSustain}</span>}
                  </span>
                  {(ns.mojoDrain??0)>0&&<span style={{fontSize:7,color:"#4499ff"}}>💧</span>}
                  {ns.stagger&&<span style={{fontSize:7,color:"#ff8800"}}>⚡</span>}
                  {ns.tripped&&<span style={{fontSize:7,color:"#aaffaa"}} title="Tripped — movement halved">🌀</span>}
                  {ns.dazed&&<span style={{fontSize:7,color:"#ffaaff"}} title="Dazed — next move misdirected">😵</span>}
                  {ns.instrumentDropped&&<span style={{fontSize:7,color:"#ff4444"}} title="Dropped instrument — -1 Drive">🎸💥</span>}
                  {amps.some(a=>a.ownerId===s.id&&a.unplugged)&&<span style={{fontSize:7,color:"#ff8800"}} title="Amp unplugged!">🔌</span>}
                </div>
                {/* Owned skills + HC target row */}
                {(() => {
                  const owned     = ns.unlockedSkills ?? [];
                  const targetDef = ns.targetSkillId ? SKILL_BY_ID[ns.targetSkillId] : null;
                  const targetRoute = targetDef ? SKILL_TREE.routes.find(r => r.id === targetDef.routeId) : null;
                  const hcPts     = ns.hcPoints ?? 0;
                  const targetCost = targetDef?.hcCost ?? 8;
                  const pct       = Math.min(1, hcPts / targetCost);
                  if (owned.length === 0 && !targetDef) return null;
                  return (
                    <div style={{marginTop:4, display:"flex", flexDirection:"column", gap:3}}>
                      {/* Owned skill icons */}
                      {owned.length > 0 && (
                        <div style={{display:"flex", gap:3, flexWrap:"wrap"}}>
                          {owned.map(skillId => {
                            const sk = SKILL_BY_ID[skillId];
                            if (!sk) return null;
                            const rd = SKILL_TREE.routes.find(r => r.id === sk.routeId);
                            return (
                              <span key={skillId} title={`${sk.label}: ${sk.desc}`} style={{
                                fontSize:10, cursor:"default",
                                background:`${rd?.color ?? '#888'}18`,
                                border:`1px solid ${rd?.color ?? '#888'}44`,
                                borderRadius:3, padding:"1px 3px",
                              }}>{sk.icon}</span>
                            );
                          })}
                        </div>
                      )}
                      {/* HC target mini-bar */}
                      {targetDef && (
                        <div style={{display:"flex", alignItems:"center", gap:5}}>
                          <span style={{fontSize:9}}>{targetDef.icon}</span>
                          <div style={{flex:1, height:3, background:"#0a1020", borderRadius:2, overflow:"hidden"}}>
                            <div style={{
                              height:"100%", borderRadius:2,
                              width:`${pct*100}%`,
                              background: targetRoute?.color ?? '#ffcc44',
                              transition:"width 0.4s",
                            }}/>
                          </div>
                          <span style={{fontSize:6, color:"#3a5a7a", whiteSpace:"nowrap"}}>
                            {hcPts}/{targetCost}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {spirits.filter(s=>s.knockedOut).map(s=>(
            <div key={s.id} className="card" style={{padding:"3px 7px",marginBottom:3,opacity:0.2,borderLeft:`2px solid ${s.color}44`}}>
              <span style={{fontSize:8,color:s.color}}>💀 {s.name.split(" ")[0]}</span>
            </div>
          ))}

          {/* ACTIONS */}
          <div className="stitle" style={{marginTop:4}}>Actions</div>
          {ampPlacing && (
            <div style={{fontSize:8,color:"#ffcc44",background:"#1a1200",border:"1px solid #ffcc4466",
              borderRadius:4,padding:"4px 8px",marginBottom:4}}>
              🔊 Click an adjacent hex to place your Amp
              <button className="btn" style={{marginLeft:6,fontSize:7,borderColor:"#ff4444",color:"#ff4444",padding:"1px 5px"}}
                onClick={() => setAmpPlacing(null)}>Cancel</button>
            </div>
          )}
          {/* Amp placement now lives in the CREW & GEAR panel above */}
          <div style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:5}}>
            <button className={`btn${action==="move"?" on":""}`}
              onClick={() => {
                if (action === "move") { setAction(null); }
                else if (moveStepsLeft > 0) { setAction("move"); addLog(`🚶 ${acting?.name} enters move mode — ${moveStepsLeft} hex${moveStepsLeft!==1?"es":""} available`); }
                else addLog(`🎵 Build and confirm your Note Track first.`);
              }}
              disabled={!acting}>Move {moveStepsLeft>0?`(${moveStepsLeft} hex)`:""}</button>
            {action === "move" && (
              <button className="btn" style={{borderColor:"#44cc88",color:"#44cc88"}}
                onClick={() => { setAction(null); setMoveStepsLeft(0); addLog(`🚶 ${acting.name} stops moving.`); }}>
                ✓ End Move</button>
            )}
            {/* FACE TURN — costs 1 move step */}
            {acting && moveStepsLeft > 0 && (
              <button className={`btn${action === "face" ? " on" : ""}`}
                style={{borderColor: action === "face" ? "#44ccff" : "#0a3044",
                  color: action === "face" ? "#44ccff" : "#1a5066"}}
                onClick={() => {
                  if (action === "face") { setAction(null); }
                  else {
                    setAction("face");
                    addLog(`🔄 ${acting.name} — click any adjacent hex to face that direction (costs 1 step)`);
                  }
                }}>
                🔄 Face{action === "face" ? "…" : ""}
              </button>
            )}
            {action === "face" && (
              <button className="btn" style={{borderColor:"#888",color:"#888"}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* Pose button — needs Hero Pose unlocked, Limelight hex, and a confirmed turn */}
            {acting?.num === LIMELIGHT_HEX && hasConfirmed
              && (noteStates[acting?.id]?.unlockedSkills ?? []).includes('hero_pose') && (
              <button className={`btn${posing[acting?.id] ? " on" : ""}`}
                style={{borderColor:"#ff88ff",color: posing[acting?.id] ? "#ff88ff" : "#aa55cc"}}
                onClick={togglePose}>
                {posing[acting?.id] ? "✨ Posing!" : "✨ Pose"}
              </button>
            )}
            {/* SWING — baseline attack, always available */}
            {hasConfirmed && !actionTokenUsed && (() => {
              const cone = acting ? getSwingCone(acting) : new Set();
              const rivals = acting ? getRivalsInCone(acting) : [];
              const canSwing = rivals.length > 0 && moveStepsLeft >= 2;
              return (
                <div style={{position:'relative',display:'inline-block'}}>
                  <button className={canSwing ? 'btn active' : 'btn'}
                    style={{borderColor: canSwing ? '#ff4444' : '#441111',
                      color: canSwing ? '#ff6666' : '#441111',
                      position:'relative'}}
                    disabled={!canSwing}
                    onClick={() => {
                      if (action === 'swing') { setAction(null); }
                      else if (canSwing) {
                        setAction('swing');
                        addLog('⚔️ SWING — click a rival in your cone to attack!');
                      }
                    }}>
                    ⚔️ Swing{rivals.length > 0 ? ` (${rivals.length})` : ''} {!canSwing && moveStepsLeft < 2 ? '(2AP)' : ''}
                  </button>
                </div>
              );
            })()}
            {action === 'swing' && (
              <button className="btn" style={{borderColor:'#888',color:'#888'}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* SONIC ATTACK — available when connected to ≥1 amp */}
            {hasConfirmed && !actionTokenUsed && (() => {
              const beam    = acting ? getSonicBeam(acting) : new Set();
              const targets = acting ? getRivalsInBeam(acting) : [];
              const plugged = ampsInRange >= 1;
              const ampCount = Math.min(ampsInRange + elevenBoost, 3);
              const dieSides = SONIC_DICE[ampCount] ?? 8;
              const canSonic = plugged && targets.length > 0 && moveStepsLeft >= 2;
              if (!plugged) return null; // hide entirely when not plugged in
              return (
                <div style={{position:'relative',display:'inline-block'}}>
                  <button className={canSonic ? 'btn active' : 'btn'}
                    style={{borderColor: canSonic ? '#44aaff' : '#112244',
                      color: canSonic ? '#66ccff' : '#112244'}}
                    disabled={!canSonic}
                    onClick={() => {
                      if (action === 'sonic') { setAction(null); }
                      else if (canSonic) {
                        setAction('sonic');
                        addLog(`🔊 SONIC ATTACK — click a target in your beam! (d${dieSides}, ${ampCount} amp${ampCount>1?'s':''})`);
                      }
                    }}>
                    🔊 Sonic{targets.length > 0 ? ` (${targets.length})` : ''} d{dieSides}
                    {!canSonic && moveStepsLeft < 2 ? ' (2AP)' : ''}
                  </button>
                </div>
              );
            })()}
            {action === 'sonic' && (
              <button className="btn" style={{borderColor:'#888',color:'#888'}}
                onClick={() => setAction(null)}>Cancel</button>
            )}
            {/* UNPLUG RIVAL AMP — shown when adjacent to an unplugged-able rival amp */}
            {hasConfirmed && !actionTokenUsed && (() => {
              const actingHex = acting ? HEX_BY_NUM[acting.num] : null;
              if (!actingHex) return null;
              const adjacentRivalAmps = amps.filter(amp => {
                if (amp.ownerId === acting?.id) return false;
                if (amp.unplugged) return false;
                const ampHex = HEX_BY_NUM[amp.hexNum];
                if (!ampHex) return false;
                const neighbors = getFlatTopNeighborSlots(actingHex);
                return neighbors.some(n => n.num === amp.hexNum) || acting?.num === amp.hexNum;
              });
              if (adjacentRivalAmps.length === 0) return null;
              return adjacentRivalAmps.map(amp => {
                const owner = spirits.find(s => s.id === amp.ownerId);
                return (
                  <button key={amp.id} className="btn"
                    style={{borderColor:'#ff8800',color:'#ff8800'}}
                    onClick={() => { unplugRivalAmp(amp.id); setActionTokenUsed(true); }}>
                    🔌 Unplug {owner?.name?.split(' ')[0] ?? 'rival'}'s Amp
                  </button>
                );
              });
            })()}
            <button className="btn end" onClick={endTurn}>End ⏭</button>
          </div>
          {/* Limelight scores */}
          {Object.keys(limelightScores).length > 0 && (
            <div style={{background:"#1a0a2a",border:"1px solid #ff44ff44",borderRadius:4,
              padding:"4px 8px",marginBottom:4,fontSize:8}}>
              <span style={{color:"#ff88ff",letterSpacing:1}}>✨ LIMELIGHT</span>
              <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap"}}>
                {spirits.map(s => {
                  const score = limelightScores[s.id] ?? 0;
                  if (score === 0) return null;
                  return (
                    <span key={s.id} style={{color:s.color,fontSize:9}}>
                      {s.name}: {score}/{LIMELIGHT_TO_WIN}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── CENTER: BOARD ── */}
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",position:"relative"}}>

          {/* ── POINTS FLASH OVERLAY ── */}
          <style>{`
            @keyframes flashFadeUp {
              0%   { opacity: 0; transform: translateY(10px) scale(0.95); }
              10%  { opacity: 1; transform: translateY(0px)  scale(1.05); }
              75%  { opacity: 1; transform: translateY(0px)  scale(1); }
              100% { opacity: 0; transform: translateY(-18px) scale(0.95); }
            }
            .points-flash-line {
              animation: flashFadeUp 4.5s ease forwards;
              text-shadow: 0 0 12px currentColor, 0 0 24px currentColor;
              white-space: nowrap;
            }
            @keyframes spotlight-pulse {
              from { opacity: 0.6; }
              to   { opacity: 1.0; }
            }
            @keyframes disco-spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
          `}</style>
          {pointsFlash && (
            <div key={pointsFlash.key} style={{
              position:"absolute", top:0, left:"50%", transform:"translateX(-50%)",
              zIndex:999, pointerEvents:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:4,
              paddingTop:8,
            }}>
              {pointsFlash.lines.map((line, i) => {
                const isMainPts = i === 0 && line.startsWith('+');
                const isTierUp  = line.includes('TIER UP');
                const isTritone = line.includes('Tritone');
                const isMojo    = line.includes('Mojo');
                const isStagger = line.includes('Stagger');
                const isOctave  = line.includes('Octave');
                const isCleanse = line.includes('Cleanse') || line.includes('Major 3rd');
                const isDrive   = line.includes('Drive');
                const isSustain = line.includes('Feedback');
                const color = isTierUp  ? '#ffcc00'
                            : isTritone ? '#ff3300'
                            : isMojo    ? '#4499ff'
                            : isStagger ? '#ff8800'
                            : isOctave  ? '#44aaff'
                            : isCleanse ? '#44ffaa'
                            : isDrive   ? '#ffaa44'
                            : isSustain ? '#88ccff'
                            : isMainPts ? '#ffffff'
                            : '#aaccff';
                const size = isMainPts ? 28 : isTierUp ? 20 : 13;
                return (
                  <div key={i} className="points-flash-line"
                    style={{
                      fontSize: size,
                      fontWeight: 700,
                      fontFamily: "'Orbitron', sans-serif",
                      color,
                      animationDelay: `${i * 0.12}s`,
                      opacity: 0,
                    }}>
                    {line}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── COMMIT TRACK ── */}
          <div style={{width:"100%",background:"#080f1e",border:"1px solid #1a2a40",borderRadius:6,padding:"7px 10px",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:5}}>
              <div className="stitle" style={{marginBottom:0,color:"#aa88ff"}}>Commit Track</div>
              {acting && (
                <>
                  <span style={{fontSize:8,color:"#3a5a7a"}}>Root:</span>
                  <span style={{fontSize:11,fontWeight:700,color:"#44ff88",background:"#0d1f10",border:"1px solid #44ff8866",borderRadius:3,padding:"1px 7px"}}>{rootNote}</span>
                  <span style={{fontSize:9,color:"#4488ff"}}>{scaleMode}</span>
                  <span style={{fontSize:8,color:"#cc88ff",marginLeft:2}}>4th=<b style={{color:"#cc55ff"}}>{fourthNote}</b></span>
                  <span style={{fontSize:8,color:"#ff88cc",marginLeft:2}}>5th=<b style={{color:"#ff55aa"}}>{fifthNote}</b></span>
                  {/* Harmonic Charge — current die + points bar */}
                  <span style={{fontSize:8,color:"#aa88ff",marginLeft:4,letterSpacing:1}}>HC</span>
                  <span style={{fontSize:11,fontWeight:700,color:"#ffcc44",background:"#1a1200",border:"1px solid #ffcc4466",borderRadius:3,padding:"1px 7px"}}
                    title={`${ampsInRange} amp${ampsInRange!==1?"s":""} in range → ${diceTier}`}>
                    {diceTier}
                    {ampsInRange > 0 && <span style={{fontSize:7,color:"#44ff88",marginLeft:3}}>🔊×{ampsInRange}</span>}
                  </span>
                  <div style={{display:"flex",alignItems:"center",gap:3,marginLeft:2}}>
                    <div style={{width:60,height:5,background:"#1a2a40",borderRadius:3,overflow:"hidden"}}>
                      <div style={{
                        height:"100%",borderRadius:3,background:"#ffcc44",
                        width:`${Math.round((hcPoints / HC_UPGRADE_THRESHOLD) * 100)}%`,
                        transition:"width .3s",
                      }}/>
                    </div>
                    <span style={{fontSize:7,color:"#7a6a30"}}>{hcPoints}/{HC_UPGRADE_THRESHOLD}</span>
                    {upgradesPending > 0 && (
                      <span style={{fontSize:8,color:"#ffcc00",background:"#1a1200",border:"1px solid #ffcc0066",
                        borderRadius:3,padding:"1px 5px",animation:"pulse 1s ease-in-out infinite"}}>
                        🎸 UPGRADE!
                      </span>
                    )}
                  </div>
                  <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                    {manualZoomActive && (
                      <button className="btn" style={{fontSize:8,padding:"1px 6px",borderColor:"#3a5a7a",color:"#7090b0"}}
                        onClick={resetManualZoom}>⌖ Reset View</button>
                    )}
                    <span style={{fontSize:7,color:"#1e3a5f"}}>scroll to zoom · drag to pan</span>
                  </div>
                </>
              )}
              {!acting && (
                <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                  {manualZoomActive && (
                    <button className="btn" style={{fontSize:8,padding:"1px 6px",borderColor:"#3a5a7a",color:"#7090b0"}}
                      onClick={resetManualZoom}>⌖ Reset View</button>
                  )}
                  <span style={{fontSize:7,color:"#1e3a5f"}}>scroll to zoom · drag to pan</span>
                </div>
              )}
            </div>
            {/* Committed note slots — larger than the side panel track */}
            <div style={{display:"flex",gap:4,justifyContent:"center",background:"#060a10",border:"1px dashed #2a1a50",borderRadius:8,padding:"6px 5px",minHeight:42}}>
              {Array.from({length:8}).map((_,i)=>{
                const note = noteTrack[i];
                const isRoot   = i === 0 && note;
                const isTritone      = note && note === tritoneNote;
                const isMajorThird   = note && note === majorThirdNote;
                const isMinorSeventh = note && note === minorSeventhNote;
                const isFourth       = note && note === fourthNote;
                const isFifth        = note && note === fifthNote;
                const inScale        = note && currentScale.includes(note);
                const borderC = !note          ? "#2a1a5060"
                  : isRoot         ? "#44ff88"
                  : isTritone      ? "#ff3300"
                  : isMinorSeventh ? "#4499ff"
                  : isMajorThird   ? "#44ffaa"
                  : isFifth        ? "#ff55aa"
                  : isFourth       ? "#cc55ff"
                  : inScale        ? "#c0c8d8"
                  : "#444455";
                const textC = !note            ? "#2a1a5040"
                  : isRoot         ? "#44ff88"
                  : isTritone      ? "#ff3300"
                  : isMinorSeventh ? "#4499ff"
                  : isMajorThird   ? "#44ffaa"
                  : isFifth        ? "#ff55aa"
                  : isFourth       ? "#cc55ff"
                  : inScale        ? "#e8eef8"
                  : "#555566";
                const bgC = !note              ? "transparent"
                  : isRoot         ? "#0d2510"
                  : isTritone      ? "#2a0800"
                  : isMinorSeventh ? "#051525"
                  : isMajorThird   ? "#0a2a1a"
                  : isFifth        ? "#2a0f1a"
                  : isFourth       ? "#1a0a2a"
                  : inScale        ? "#1a2035"
                  : "#111118";
                const glow = isTritone      ? "drop-shadow(0 0 7px #ff330077)"
                           : isMinorSeventh ? "drop-shadow(0 0 6px #4499ff77)"
                           : isMajorThird   ? "drop-shadow(0 0 5px #44ffaa55)"
                           : isFifth        ? "drop-shadow(0 0 6px #ff55aa55)"
                           : isFourth       ? "drop-shadow(0 0 6px #cc55ff55)"
                           : "none";
                return (
                  <div key={i} className="hexw" style={{
                    width:33,height:37,
                    background: note ? borderC : "#2a1a5055",
                    filter: glow,
                    transition:"all .15s",
                  }}>
                    <div className="hexi" style={{
                      fontSize:10,fontWeight:700,
                      color:textC,
                      background: note ? bgC : "#07091466",
                    }}>{note || ""}</div>
                  </div>
                );
              })}
            </div>
            {hasConfirmed && moveStepsLeft > 0 && (
              <div style={{fontSize:8,color:"#44ff88",marginTop:4}}>✓ {moveStepsLeft} hex{moveStepsLeft!==1?"es":""} committed — click Move</div>
            )}
          </div>

          <div
            ref={boardDivRef}
            style={{position:"relative",width:SVG_W,maxWidth:"100%",overflow:"visible",borderRadius:8,border:"1px solid #1a2a40",cursor:isPanningRef.current?"grabbing":"default"}}
            onMouseDown={handleBoardMouseDown}
            onMouseMove={handleBoardMouseMove}
            onMouseUp={handleBoardMouseUp}
            onMouseLeave={handleBoardMouseUp}
            onContextMenu={e => e.preventDefault()}
          >
            <svg
              ref={svgRef}
              width={SVG_W}
              height={SVG_H}
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              style={{display:"block",borderRadius:8}}
            >
              <image href={boardImg} x={0} y={0} width={SVG_W} height={SVG_H} preserveAspectRatio="xMidYMid slice"/>
              <BoardFX />
              <defs>
                <filter id="outline-crush" color-interpolation-filters="sRGB">
                  <feComponentTransfer>
                    <feFuncR type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                    <feFuncG type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                    <feFuncB type="gamma" amplitude="1" exponent="0.5" offset="-0.18"/>
                    <feFuncA type="linear" slope="1" intercept="0"/>
                  </feComponentTransfer>
                </filter>
              </defs>
              {/* Soft bloom layer */}
              <image
                href={boardOutlineImg}
                className="board-outline-glow"
                x={0} y={0} width={SVG_W} height={SVG_H}
                preserveAspectRatio="xMidYMid slice"
                style={{ mixBlendMode:"screen", filter:"url(#outline-crush) blur(4px)" }}
              />
              {/* Crisp outline */}
              <image
                href={boardOutlineImg}
                className="board-outline-img"
                x={0} y={0} width={SVG_W} height={SVG_H}
                preserveAspectRatio="xMidYMid slice"
                style={{ mixBlendMode:"screen", filter:"url(#outline-crush)" }}
              />

              {/* ── ROAMING SEARCHLIGHT ── */}
              {(() => {
                const sh = HEX_BY_NUM[spotlightHex];
                if (!sh) return null;
                const cx  = Math.round(sh.px * SCALE);
                const cy  = Math.round(sh.py * SCALE);
                const r   = HS * 1.1;
                // Beam origin: top-centre of the SVG, offset slightly for angle
                const bx  = cx + HS * 1.2;
                const by  = 0;
                // Beam half-width at the target pool
                const bw  = r * 1.6;
                // The four corners of the cone
                const coneL1 = { x: bx - 6,  y: by };
                const coneR1 = { x: bx + 6,  y: by };
                const coneL2 = { x: cx - bw, y: cy };
                const coneR2 = { x: cx + bw, y: cy };
                const conePoints = `${coneL1.x},${coneL1.y} ${coneR1.x},${coneR1.y} ${coneR2.x},${coneR2.y} ${coneL2.x},${coneL2.y}`;
                const healingSpirit = spirits.find(s => s.num === spotlightHex && !s.knockedOut);
                return (
                  <g style={{pointerEvents:"none"}}>
                    <defs>
                      <linearGradient id="searchbeam-grad" x1={bx} y1={by} x2={cx} y2={cy} gradientUnits="userSpaceOnUse">
                        <stop offset="0%"   stopColor="#ffffcc" stopOpacity={0.0}/>
                        <stop offset="60%"  stopColor="#ffffcc" stopOpacity={0.08}/>
                        <stop offset="100%" stopColor="#ffffff" stopOpacity={0.18}/>
                      </linearGradient>
                      <radialGradient id="searchpool-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.55}/>
                        <stop offset="40%"  stopColor="#ffffaa" stopOpacity={0.28}/>
                        <stop offset="100%" stopColor="#ffff88" stopOpacity={0}/>
                      </radialGradient>
                    </defs>
                    {/* Cone beam */}
                    <polygon points={conePoints}
                      fill="url(#searchbeam-grad)"
                      style={{animation:"spotlight-pulse 2.2s ease-in-out infinite alternate"}}/>
                    {/* Light pool on hex */}
                    <ellipse cx={cx} cy={cy} rx={r * 1.5} ry={r * 0.9}
                      fill="url(#searchpool-grad)"
                      style={{animation:"spotlight-pulse 1.6s ease-in-out infinite alternate"}}/>
                    {/* Bright centre dot */}
                    <ellipse cx={cx} cy={cy} rx={r * 0.55} ry={r * 0.38}
                      fill="#ffffff" opacity={0.22}
                      style={{animation:"spotlight-pulse 1.2s ease-in-out infinite alternate"}}/>
                    {/* Hex border ring */}
                    <polygon points={pointyCorners(cx, cy, HS * 1.08)}
                      fill="none" stroke="#ffffaa" strokeWidth={1.2}
                      opacity={0.55}
                      style={{animation:"spotlight-pulse 1.8s ease-in-out infinite alternate"}}/>
                    {/* Source lamp dot at top */}
                    <circle cx={bx} cy={by + 4} r={5}
                      fill="#ffffee" opacity={0.7}
                      style={{filter:"blur(2px)"}}/>
                    {/* Heal label */}
                    <text x={cx} y={cy - HS * 1.25}
                      textAnchor="middle" fontSize={HS * 0.42}
                      fontWeight="bold" fill="#ffffaa"
                      stroke="#000" strokeWidth={0.3}
                      style={{pointerEvents:"none",
                        filter:"drop-shadow(0 0 3px #ffff44)",
                        animation:"spotlight-pulse 1.4s ease-in-out infinite alternate"}}>
                      💡 +1 Vibe
                    </text>
                    {/* Flash when a spirit is standing in it */}
                    {healingSpirit && (
                      <polygon points={pointyCorners(cx, cy, HS * 1.22)}
                        fill="none" stroke={healingSpirit.color} strokeWidth={2}
                        opacity={0.7}
                        style={{animation:"spotlight-pulse 0.7s ease-in-out infinite alternate",
                          filter:`drop-shadow(0 0 6px ${healingSpirit.color})`}}/>
                    )}
                  </g>
                );
              })()}

              {/* ── 🎤 CENTRE STAGE ENERGY ── the dark middle lights up as the arena fills ── */}
              {(() => {
                const hub = HEX_BY_NUM[LIMELIGHT_HEX]; if (!hub) return null;
                const cx = hub.px * SCALE, cy = hub.py * SCALE;
                const energy = Math.min(1, arenaFans() / 50);   // 0..1 as the crowd swells
                const glowO  = 0.10 + 0.42 * energy;
                const ringO  = 0.28 + 0.55 * energy;
                const pit = ALL_HEXES.filter(h => hexRingFromCenter(h.num) === 'pit');
                return (
                  <g style={{pointerEvents:"none"}}>
                    <defs>
                      <radialGradient id="stage-glow-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%"   stopColor="#ff66cc" stopOpacity={glowO}/>
                        <stop offset="45%"  stopColor="#ff3399" stopOpacity={glowO * 0.5}/>
                        <stop offset="100%" stopColor="#ff3399" stopOpacity={0}/>
                      </radialGradient>
                    </defs>
                    {/* Radial bloom filling the dead centre (static; intensity = energy) */}
                    <ellipse cx={cx} cy={cy} rx={HS * 3.4} ry={HS * 3.0} fill="url(#stage-glow-grad)"/>
                    {/* The Pit — contested apron around the stage */}
                    {pit.map(h => (
                      <polygon key={`pit-${h.num}`}
                        points={pointyCorners(h.px * SCALE, h.py * SCALE, HS * 0.98)}
                        fill="none" stroke="#ff66cc" strokeWidth={1.1} opacity={ringO * 0.7}
                        style={{animation:`stage-throb ${3.0 + (h.num % 3) * 0.4}s ease-in-out infinite`}}/>
                    ))}
                    {/* The Mainstage hex itself */}
                    <polygon points={pointyCorners(cx, cy, HS * 1.02)}
                      fill="none" stroke="#ff99dd" strokeWidth={1.6} opacity={ringO}
                      style={{animation:"stage-throb 2.4s ease-in-out infinite"}}/>
                  </g>
                );
              })()}

              {/* ── 🎤 FAN CROWDS ── each Spirit's following gathers at its home turf, outside the field ── */}
              {spirits.map(s => {
                if (!s.corner) return null;
                const home = HEX_BY_NUM[CORNERS[s.corner]?.homeNum];
                const hub  = HEX_BY_NUM[LIMELIGHT_HEX];
                if (!home || !hub) return null;
                const ns = noteStates[s.id] ?? {};
                const D = ns.diehards ?? 0, C = ns.casuals ?? 0;
                const total = D + C;
                const sc = CORNER_LABELS[s.corner]?.color ?? s.color;
                const hx = home.px * SCALE, hy = home.py * SCALE;
                const cxC = hub.px * SCALE, cyC = hub.py * SCALE;
                // Unit vector pointing from board centre outward through the home corner.
                let ox = hx - cxC, oy = hy - cyC;
                const L = Math.hypot(ox, oy) || 1; ox /= L; oy /= L;
                // Cluster anchor: pushed well past the coloured home pocket into the dark margin.
                const FAN_OUT = HS * 3.5;
                const anchorX = hx + ox * FAN_OUT;
                const anchorY = hy + oy * FAN_OUT;
                const dot = HS * 0.22;
                const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
                // Hard floor: no fan may sit closer to the hub than the home hex (plus a
                // margin), so the crowd gathers OUT in the dark margin instead of spilling
                // back over the coloured field.
                const homeR = Math.hypot(hx - cxC, hy - cyC);
                const MIN_R = homeR + HS * 1.7;
                const fans = [];
                for (let i = 0; i < total; i++) {
                  const isDie = i < D;                 // diehards fill the front row, casuals fan out behind
                  const ang = i * 2.39996;             // golden-angle phyllotaxis = natural crowd packing
                  const rad = Math.sqrt(i + 0.6) * dot * 1.4;
                  let fx = anchorX + Math.cos(ang) * rad        + ox * rad * 0.15;
                  let fy = anchorY + Math.sin(ang) * rad * 0.85 + oy * rad * 0.15;
                  // Any fan that landed inside the field gets pushed back out along the radius.
                  let dx = fx - cxC, dy = fy - cyC;
                  const dist = Math.hypot(dx, dy) || 1;
                  if (dist < MIN_R) { fx = cxC + (dx / dist) * MIN_R; fy = cyC + (dy / dist) * MIN_R; }
                  fx = clamp(fx, 4, SVG_W - 4); fy = clamp(fy, 4, SVG_H - 4);
                  fans.push({ i, isDie, fx, fy });
                }
                const fx = fanFx[s.id];
                return (
                  <g key={`fans-${s.id}`} style={{pointerEvents:"none"}}>
                    {fans.map(({ i, isDie, fx: px, fy: py }) => {
                      const r   = isDie ? dot * 1.25 : dot * 0.95;
                      const hr  = r * 0.55;            // head radius
                      const hcy = py - r * 0.5;        // head centre
                      const sw  = r * 1.0;             // shoulder half-width
                      const shY = py + r * 0.55;       // shoulder line
                      const col = isDie ? sc : '#cfe0ff';
                      const sww = isDie ? 1.25 : 0.85;
                      const op  = isDie ? 0.95 : 0.6;
                      const dur = 3.4 + (i % 5) * 0.35;
                      const delay = -(((i * 0.37) % dur)).toFixed(2);
                      return (
                        <g key={i} style={{animation:`fan-bob ${dur}s ease-in-out infinite`, animationDelay:`${delay}s`}}>
                          {/* soft glow — the crowd reads as a sea of lights */}
                          <circle cx={px} cy={py} r={r * 1.7} fill={sc}
                            opacity={isDie ? 0.20 : 0.10} style={{filter:`blur(${r * 0.9}px)`}}/>
                          {/* shoulders outline */}
                          <path d={`M ${px - sw} ${shY} Q ${px} ${py - r * 0.1} ${px + sw} ${shY}`}
                            fill="none" stroke={col} strokeWidth={sww} strokeLinecap="round" opacity={op}/>
                          {/* head outline */}
                          <circle cx={px} cy={hcy} r={hr} fill="none" stroke={col} strokeWidth={sww} opacity={op}/>
                          {/* diehards: a filled head so the devoted core reads brighter */}
                          {isDie && <circle cx={px} cy={hcy} r={hr * 0.55} fill={sc} opacity={0.85}/>}
                        </g>
                      );
                    })}
                    {/* Crowd-size tag */}
                    {total > 0 && (
                      <text x={anchorX} y={anchorY + (oy > 0 ? HS * 1.7 : -HS * 1.4)}
                        textAnchor="middle" fontSize={HS * 0.4} fontWeight="bold"
                        fill={sc} opacity={0.85} stroke="#000" strokeWidth={0.3}
                        style={{filter:`drop-shadow(0 0 3px ${sc})`}}>
                        🎤 {total}
                      </text>
                    )}
                    {/* Transient reaction burst */}
                    {fx && fx.kind === 'gain' && (
                      <text key={fx.key} x={anchorX} y={anchorY - HS * 0.7} textAnchor="middle"
                        fontSize={HS * 0.6} fontWeight="bold" fill={sc} stroke="#000" strokeWidth={0.4}
                        style={{animation:"floatUp 1.2s ease-out forwards", filter:`drop-shadow(0 0 4px ${sc})`}}>
                        +{fx.n} 🎤
                      </text>
                    )}
                    {fx && fx.kind === 'scatter' && (
                      <g key={fx.key}>
                        <g transform={`translate(${anchorX} ${anchorY})`}>
                          <circle cx={0} cy={0} r={HS * 1.6} fill="none" stroke="#ff5544" strokeWidth={2}
                            style={{animation:"fx-ring 1s ease-out forwards"}}/>
                        </g>
                        <text x={anchorX} y={anchorY - HS * 0.7} textAnchor="middle"
                          fontSize={HS * 0.6} fontWeight="bold" fill="#ff6655" stroke="#000" strokeWidth={0.4}
                          style={{animation:"floatUp 1.2s ease-out forwards", filter:"drop-shadow(0 0 4px #ff3333)"}}>
                          −{fx.n} 💔
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Hexes */}
              {ALL_HEXES.map(hex => {
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const sp = spiritByNum[hex.num];

                return (
                  <g key={hex.num} className="hex-g"
                    onClick={() => onHexClick(hex.num)}
                    onMouseEnter={() => setHovered(hex.num)}
                    onMouseLeave={() => setHovered(null)}>
                    <polygon
                      points={pointyCorners(cx, cy, HS)}
                      fill={hexFill(hex)}
                      stroke={hexStroke(hex)}
                      strokeWidth={hexStrokeW(hex)}
                    />
                    {/* Turn-start hex pulse */}
                    {pulsingHex === hex.num && sp && (
                      <polygon
                        points={pointyCorners(cx, cy, HS * 1.18)}
                        fill="none"
                        stroke={sp.color}
                        strokeWidth={3}
                        style={{
                          pointerEvents: "none",
                          animation: "hex-turn-pulse 1.8s ease-out forwards",
                          filter: `drop-shadow(0 0 8px ${sp.color}) drop-shadow(0 0 16px ${sp.color})`,
                        }}
                      />
                    )}

                    {/* Spirit standee */}
                    {sp && !slideOffAnimations[sp.id] && (() => {
                      const isActing = acting?.id === sp.id;
                      const isRumbling = rumblingIds.has(sp.id);
                      const cornerColor = sp.corner ? (CORNER_LABELS[sp.corner]?.color ?? sp.color) : sp.color;
                      const sc = cornerColor;
                      const baseR = HS * 0.62;
                      const cardW = HS * 3;
                      const cardH = HS * 3;
                      const cardX = cx - cardW / 2;
                      const cardY = cy - baseR - cardH + HS * 1;
                      const useMirror = isMirrorFacing(sp.facing ?? 0);
                      const spriteSrc = useMirror
                        ? (MIRROR_SPRITES[sp.id] ?? sp.imageSrc)
                        : sp.imageSrc;
                      const imgOffset = sp.imageOffset ?? { x: 0, y: 0 };
                      // The mirror sprite flips the artwork horizontally, so any
                      // x-correction for off-centre art must flip with it — otherwise
                      // the standee drifts off its hex when facing left (the
                      // Metalness Monster bug).
                      const imgOffX = useMirror ? -imgOffset.x : imgOffset.x;
                      return (
                        <g key="spirit-token"
                          style={isRumbling ? {animation:"rumble 0.08s linear infinite"} : undefined}>
                          {/* Base plate shadow */}
                          <ellipse cx={cx+2} cy={cy+3} rx={baseR} ry={baseR*0.32}
                            fill="#000" opacity={0.35} style={{pointerEvents:"none"}}/>
                          {/* Base plate glow ring */}
                          <circle cx={cx} cy={cy} r={baseR}
                            fill={sc+"18"} stroke={sc}
                            strokeWidth={isActing ? 2.2 : 1.4}
                            style={{pointerEvents:"none"}}
                            filter={isActing ? `drop-shadow(0 0 4px ${sc})` : undefined}/>
                          {/* Facing arrow now rendered as a top-layer hover overlay — see below */}
                          {/* 🌀 Persistent affliction aura — while ANY debuff is active,
                              a slow-pulsing dashed ring + status icons mark the victim */}
                          {(() => {
                            const nsB = noteStates[sp.id] ?? {};
                            const afflictions = [
                              (nsB.mojoDrain ?? 0) > 0  && { icon:'💧', color:'#4499ff', tip:'Mojo Drained' },
                              nsB.stagger               && { icon:'⚡', color:'#ff8800', tip:'Staggered' },
                              nsB.tripped               && { icon:'🌀', color:'#44ddff', tip:'Tripped' },
                              nsB.dazed                 && { icon:'😵', color:'#ff66ff', tip:'Dazed' },
                              nsB.instrumentDropped     && { icon:'🎸', color:'#ff4444', tip:'Dropped instrument' },
                            ].filter(Boolean);
                            if (afflictions.length === 0) return null;
                            const iconSize = HS * 0.42;
                            const rowW = afflictions.length * iconSize;
                            return (
                              <g style={{pointerEvents:"none"}}>
                                <circle cx={cx} cy={cy} r={baseR * 1.3}
                                  fill="none" stroke={afflictions[0].color} strokeWidth={2}
                                  strokeDasharray="5 6"
                                  style={{animation:"affliction-pulse 1.8s ease-in-out infinite",
                                    filter:`drop-shadow(0 0 5px ${afflictions[0].color})`}}/>
                                {afflictions.map((a, i) => (
                                  <text key={i}
                                    x={cx - rowW / 2 + iconSize * (i + 0.5)}
                                    y={cardY - HS * 0.34}
                                    textAnchor="middle" fontSize={iconSize}
                                    style={{animation:"affliction-pulse 1.8s ease-in-out infinite",
                                      filter:`drop-shadow(0 0 3px ${a.color})`}}>
                                    {a.icon}
                                  </text>
                                ))}
                              </g>
                            );
                          })()}
                          {/* Standee sprite */}
                          <image
                            href={spriteSrc}
                            x={cardX + imgOffX}
                            y={cardY + imgOffset.y}
                            width={cardW}
                            height={cardH}
                            preserveAspectRatio="xMidYMid meet"
                            style={{pointerEvents:"none"}}
                          />
                          {/* Respawn flash */}
                          {respawnFlashes[sp.id] && (
                            <circle cx={cx} cy={cy} r={baseR * 1.8}
                              fill={sc+"33"} stroke={sc} strokeWidth={2}
                              style={{pointerEvents:"none", animation:"life-pulse 0.3s ease-in-out infinite"}}/>
                          )}
                          {/* 🤘 MASTER OF MOSHPITS — fans flood in and rock the battered rival */}
                          {moshpitTargets[sp.id] && (() => {
                            const ring = baseR * 1.7;     // how far out the fans circle the rival
                            const fanW = HS * 1.5;        // crowd cluster size
                            // Six clusters ringed around the hex, alternating pink/blue fan art
                            const fans = [0,1,2,3,4,5].map(i => {
                              const ang = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                              return {
                                i,
                                fx: cx + Math.cos(ang) * ring,
                                fy: cy + Math.sin(ang) * ring * 0.62, // squashed = pseudo-perspective
                                src: i % 2 === 0 ? crowdPinkImg : crowdBlueImg,
                                tilt: (i % 2 === 0 ? 4 : -4),
                                delay: (i * 0.07).toFixed(2),
                              };
                            });
                            return (
                              <g style={{pointerEvents:"none"}}>
                                {/* pulsing pit glow under the rival */}
                                <ellipse cx={cx} cy={cy} rx={ring*1.15} ry={ring*0.8}
                                  fill="#ffcc0022" stroke="#ffcc0066" strokeWidth={1.5}
                                  style={{animation:"life-pulse 0.5s ease-in-out infinite"}}/>
                                {fans.sort((a,b)=>a.fy-b.fy).map(f => (
                                  <image key={f.i} href={f.src}
                                    x={f.fx - fanW/2} y={f.fy - fanW/2}
                                    width={fanW} height={fanW}
                                    preserveAspectRatio="xMidYMid meet"
                                    style={{
                                      mixBlendMode:"screen",
                                      transformOrigin:`${f.fx}px ${f.fy}px`,
                                      ['--mosh-tilt']: `${f.tilt}deg`,
                                      animation:`moshpit-pop 0.22s ease-out ${f.delay}s both, moshpit-bob 0.5s ease-in-out ${f.delay}s infinite`,
                                    }}/>
                                ))}
                                {/* the rival is jostled — a little 🤘 over their head */}
                                <text x={cx} y={cardY - HS * 0.5} textAnchor="middle" fontSize={HS * 0.6}
                                  style={{animation:"moshpit-bob 0.4s ease-in-out infinite",
                                    filter:"drop-shadow(0 0 6px #ffcc00)"}}>🤘</text>
                              </g>
                            );
                          })()}
                          {/* 💥 Status-effect flash — shockwave rings + floating neon label */}
                          {effectFlashes.filter(f => f.spiritId === sp.id).map((f, fi) => (
                            <g key={f.key} style={{pointerEvents:"none"}}>
                              {/* expanding shockwave rings */}
                              <circle cx={cx} cy={cy} r={baseR * 1.1}
                                fill="none" stroke={f.color} strokeWidth={3}
                                style={{animation:"fx-ring 1.3s ease-out infinite",
                                  transformOrigin:`${cx}px ${cy}px`,
                                  filter:`drop-shadow(0 0 6px ${f.color})`}}/>
                              <circle cx={cx} cy={cy} r={baseR * 1.1}
                                fill="none" stroke={f.color} strokeWidth={2}
                                style={{animation:"fx-ring 1.3s ease-out infinite",
                                  animationDelay:"0.43s",
                                  transformOrigin:`${cx}px ${cy}px`}}/>
                              {/* hot core glow on the base plate */}
                              <circle cx={cx} cy={cy} r={baseR}
                                fill={f.color + "30"} stroke={f.color} strokeWidth={1.5}
                                style={{animation:"life-pulse 0.55s ease-in-out infinite",
                                  filter:`drop-shadow(0 0 8px ${f.color})`}}/>
                              {/* floating label */}
                              <g style={{animation:"fx-label 2.7s ease-out forwards"}}>
                                <text x={cx} y={cardY - HS * 0.62 - fi * HS * 0.58}
                                  textAnchor="middle" fontSize={HS * 0.5} fontWeight="900"
                                  fill={f.color} stroke="#000000" strokeWidth={1} paintOrder="stroke"
                                  style={{fontFamily:"'Orbitron',sans-serif", letterSpacing:1,
                                    filter:`drop-shadow(0 0 7px ${f.color})`}}>
                                  {f.icon} {f.label}
                                </text>
                              </g>
                            </g>
                          ))}
                          {/* Floating damage numbers */}
                          {floatingDmg.filter(f => f.spiritId === sp.id).map(f => (
                            <text key={f.key}
                              x={cx} y={cardY}
                              textAnchor="middle"
                              fontSize={HS * 0.7}
                              fontWeight="bold"
                              fill="#ff4444"
                              stroke="#000" strokeWidth={0.5}
                              style={{pointerEvents:"none", animation:"floatUp 1.2s ease-out forwards"}}>
                              -{f.amount}
                            </text>
                          ))}
                          {/* Vibe health bar above standee */}
                          {(() => {
                            const barW = HS * 1.8;
                            const barH = HS * 0.18;
                            const barX = cx - barW / 2;
                            const barY = cardY - barH - 1;
                            const pct  = sp.vibe / sp.maxVibe;
                            const barColor = pct > 0.5 ? "#44cc66" : pct > 0.25 ? "#ffaa22" : "#ff4444";
                            return (
                              <g style={{pointerEvents:"none"}}>
                                {/* Track */}
                                <rect x={barX} y={barY} width={barW} height={barH}
                                  rx={barH/2} fill="#00000055"/>
                                {/* Fill */}
                                <rect x={barX} y={barY} width={barW * pct} height={barH}
                                  rx={barH/2} fill={barColor}
                                  style={{filter:`drop-shadow(0 0 2px ${barColor}88)`}}/>
                                {/* Border */}
                                <rect x={barX} y={barY} width={barW} height={barH}
                                  rx={barH/2} fill="none"
                                  stroke={sp.color+"66"} strokeWidth={0.4}/>
                              </g>
                            );
                          })()}
                        </g>
                      );
                    })()}
                  </g>
                );
              })}

              {/* Slide-off animations */}
              {Object.values(slideOffAnimations).map(anim => {
                const cornerColor = anim.corner ? (CORNER_LABELS[anim.corner]?.color ?? anim.color) : anim.color;
                return (
                  <g key={anim.id} style={{
                    transform: `translate(${anim.dx}px, ${anim.dy}px)`,
                    transition: "transform 4s cubic-bezier(0.3, 0, 1, 0.7)",
                    animation: "slideOff 4s ease-in forwards",
                  }}>
                    <image
                      href={anim.imageSrc}
                      x={anim.cx - HS * 1.5}
                      y={anim.cy - HS * 2.5}
                      width={HS * 3}
                      height={HS * 3}
                      preserveAspectRatio="xMidYMid meet"
                      style={{pointerEvents:"none"}}
                    />
                  </g>
                );
              })}

              {/* ── AMP TOKENS ── */}
              {amps.map(amp => {
                const hex = HEX_BY_NUM[amp.hexNum];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.7;
                const pts = pointyCorners(cx, cy, r);
                // Auto-connection: check which spirits are in range
                const connectedSpirits = spirits.filter(s => {
                  if (s.knockedOut || s.id !== amp.ownerId) return false; // only the OWNER can plug in
                  const sh = HEX_BY_NUM[s.num];
                  const ah = HEX_BY_NUM[amp.hexNum];
                  if (!sh || !ah) return false;
                  return axialDist(sh.q, sh.r, ah.q, ah.r) <= AMP_RANGE;
                });
                const isUnplugged = !!amp.unplugged;
                const isConnected = !isUnplugged && connectedSpirits.length > 0;
                const ownerColor  = amp.ownerColor;
                const isRoadieTarget =
                  (roadieAction?.phase === 'selectHex' && (
                    amp.hexNum === roadieAction?.adjHexNum ||
                    getFlatTopNeighborSlots(HEX_BY_NUM[roadieAction?.adjHexNum ?? -1] ?? {q:999,r:999})
                      .some(n => n.num === amp.hexNum)
                  )) ||
                  (roadieAction?.phase === 'selectHex' && !roadieAction?.adjHexNum);
                return (
                  <g key={amp.id} style={{pointerEvents:"none"}}>
                    {/* Hover range ring — shown when this amp's hex is hovered */}
                    {hovered === amp.hexNum && (
                      <>
                        <circle cx={cx} cy={cy} r={AMP_UNPLUG_DIST * HS * 1.95}
                          fill={ownerColor + "0d"} stroke={ownerColor} strokeWidth={1.5}
                          strokeDasharray="6 4" opacity={0.7}
                          style={{pointerEvents:"none"}}/>
                        <text x={cx} y={cy - AMP_UNPLUG_DIST * HS * 1.95 - 5}
                          textAnchor="middle" fontSize={HS * 0.28}
                          fill={ownerColor} opacity={0.85}
                          style={{fontFamily:"monospace", pointerEvents:"none"}}>
                          range ({AMP_UNPLUG_DIST})
                        </text>
                      </>
                    )}
                    {/* Range ring (subtle, always visible) */}
                    {isConnected && (
                      <circle cx={cx} cy={cy} r={AMP_RANGE * HS * 1.15}
                        fill="none" stroke={ownerColor} strokeWidth={0.6}
                        opacity={0.18} strokeDasharray="4 6"/>
                    )}
                    {/* Hex body */}
                    <polygon points={pts}
                      fill={isUnplugged ? "#110808" : isConnected ? ownerColor+"33" : "#0a1020"}
                      stroke={isUnplugged ? "#662222" : isConnected ? ownerColor : "#444466"}
                      strokeWidth={isConnected ? 2 : 1}
                      strokeDasharray={isUnplugged ? "4 3" : undefined}
                      style={isConnected ? {
                        filter:`drop-shadow(0 0 6px ${ownerColor}) drop-shadow(0 0 12px ${ownerColor}88)`,
                        animation:"outline-pulse-soft 2s ease-in-out infinite",
                      } : undefined}
                    />
                    {/* Speaker circle */}
                    <circle cx={cx} cy={cy - HS*0.06} r={r*0.38}
                      fill="none" stroke={isUnplugged ? "#442222" : isConnected ? ownerColor : "#556688"} strokeWidth={1}/>
                    <circle cx={cx} cy={cy - HS*0.06} r={r*0.18}
                      fill={isUnplugged ? "#221111" : isConnected ? ownerColor+"88" : "#223344"}
                      stroke={isUnplugged ? "#442222" : isConnected ? ownerColor : "#556688"} strokeWidth={0.5}/>
                    {/* Knob row */}
                    {[-1,0,1].map(k => (
                      <circle key={k} cx={cx + k * r*0.22} cy={cy + r*0.42} r={r*0.07}
                        fill={isUnplugged ? "#441111" : isConnected ? ownerColor : "#445566"}/>
                    ))}
                    {/* Label */}
                    <text x={cx} y={cy + r*0.75} textAnchor="middle" fontSize={r*0.28}
                      fill={isUnplugged ? "#662222" : isConnected ? ownerColor : "#556688"}
                      style={{fontFamily:"monospace"}}>{isUnplugged ? "DEAD" : "AMP"}</text>
                    {/* Unplugged icon */}
                    {isUnplugged && (
                      <text x={cx} y={cy - r*0.1} textAnchor="middle" fontSize={r*0.55}
                        style={{pointerEvents:"none"}}>🔌</text>
                    )}
                    {/* Connected spirits count badge */}
                    {isConnected && (
                      <text x={cx + r*0.6} y={cy - r*0.6} textAnchor="middle"
                        fontSize={r*0.35} fontWeight="bold"
                        fill={ownerColor} stroke="#000" strokeWidth={0.3}>
                        ×{connectedSpirits.length}
                      </text>
                    )}
                    {isRoadieTarget && (
                      <polygon points={pts} fill="none" stroke="#ffcc44" strokeWidth={2}
                        style={{animation:"hex-turn-pulse 1s ease-in-out infinite",pointerEvents:"none"}}/>
                    )}
                  </g>
                );
              })}

              {/* ── EVENT HEXES — neon marquee stars ── */}
              {eventHexes.map(num => {
                const hex = HEX_BY_NUM[num];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.52;
                // 4-point sparkle star path
                const star = `M ${cx} ${cy - r} Q ${cx + r*0.18} ${cy - r*0.18} ${cx + r} ${cy} ` +
                             `Q ${cx + r*0.18} ${cy + r*0.18} ${cx} ${cy + r} ` +
                             `Q ${cx - r*0.18} ${cy + r*0.18} ${cx - r} ${cy} ` +
                             `Q ${cx - r*0.18} ${cy - r*0.18} ${cx} ${cy - r} Z`;
                return (
                  <g key={`ev-${num}`} style={{pointerEvents:'none', color:'#ff44dd',
                    animation:'event-hex-pulse 1.8s ease-in-out infinite',
                    animationDelay:`${(num % 5) * 0.25}s`}}>
                    {/* Hex ring */}
                    <polygon
                      points={pointyCorners(cx, cy, HS * 0.96)}
                      fill="#ff44dd14" stroke="#ff44dd" strokeWidth={1.4}
                      strokeDasharray="5 3"/>
                    {/* Sparkle star */}
                    <path d={star} fill="#ff88ee" stroke="#ffffff" strokeWidth={0.6} opacity={0.95}/>
                    {/* EVENT label */}
                    <text x={cx} y={cy + HS * 0.78} textAnchor="middle"
                      fontSize={6.5} fill="#ff88ee" letterSpacing={1.5}
                      fontFamily="'Orbitron',sans-serif" fontWeight={700}>EVENT</text>
                  </g>
                );
              })}

              {/* ── FLAMING DISCS — Disco Inferno hazard ── */}
              {flamingHexes.roundsLeft > 0 && flamingHexes.hexes.map(num => {
                const hex = HEX_BY_NUM[num];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.46;
                return (
                  <g key={`fd-${num}`} style={{pointerEvents:'none'}}>
                    {/* Scorch glow on the hex */}
                    <polygon
                      points={pointyCorners(cx, cy, HS * 0.96)}
                      fill="#ff440018" stroke="#ff6622" strokeWidth={1}
                      style={{filter:'drop-shadow(0 0 5px #ff662288)'}}/>
                    {/* Vinyl disc */}
                    <circle cx={cx} cy={cy + r*0.18} r={r*0.62} fill="#120a08" stroke="#ff8844" strokeWidth={1}/>
                    <circle cx={cx} cy={cy + r*0.18} r={r*0.36} fill="none" stroke="#ff884466" strokeWidth={0.7}/>
                    <circle cx={cx} cy={cy + r*0.18} r={r*0.12} fill="#ffaa55"/>
                    {/* Flames */}
                    <g style={{animation:'flame-flicker 0.55s ease-in-out infinite',
                      animationDelay:`${(num % 4) * 0.13}s`, transformOrigin:`${cx}px ${cy}px`}}>
                      <text x={cx} y={cy - r*0.12} textAnchor="middle" fontSize={r*1.05}
                        style={{filter:'drop-shadow(0 0 4px #ff6622)'}}>🔥</text>
                    </g>
                  </g>
                );
              })}

              {/* ── FAME SPARKS — collectible gold glints ── */}
              {sparkHexes.map(num => {
                const hex = HEX_BY_NUM[num];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.3;
                const spark = `M ${cx} ${cy - r} Q ${cx + r*0.22} ${cy - r*0.22} ${cx + r} ${cy} ` +
                              `Q ${cx + r*0.22} ${cy + r*0.22} ${cx} ${cy + r} ` +
                              `Q ${cx - r*0.22} ${cy + r*0.22} ${cx - r} ${cy} ` +
                              `Q ${cx - r*0.22} ${cy - r*0.22} ${cx} ${cy - r} Z`;
                return (
                  <g key={`spark-${num}`} style={{pointerEvents:'none', color:'#ffd700',
                    animation:'event-hex-pulse 1.4s ease-in-out infinite',
                    animationDelay:`${(num % 7) * 0.18}s`}}>
                    <path d={spark} fill="#ffd700" stroke="#fff6cc" strokeWidth={0.5} opacity={0.95}/>
                    <circle cx={cx} cy={cy} r={r*0.16} fill="#ffffff"/>
                  </g>
                );
              })}

              {/* ── BOARD CARDS — floating face-down card icons ── */}
              {boardCards.map(bc => {
                const hex = HEX_BY_NUM[bc.hexNum];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                const r  = HS * 0.42;
                return (
                  <g key={bc.id} style={{pointerEvents:'none',
                    animation:`card-float 2.4s ease-in-out infinite`,
                    animationDelay:`${(bc.hexNum % 7) * 0.3}s`}}>
                    {/* Card body */}
                    <rect x={cx - r*0.62} y={cy - r*0.9} width={r*1.24} height={r*1.7}
                      rx={r*0.16} ry={r*0.16}
                      fill="#0d1530" stroke="#aa88ff" strokeWidth={1.2}
                      style={{filter:'drop-shadow(0 0 4px #aa88ff88)'}}/>
                    {/* Card back pattern — subtle cross */}
                    <line x1={cx - r*0.4} y1={cy - r*0.7} x2={cx + r*0.4} y2={cy + r*0.7}
                      stroke="#aa88ff33" strokeWidth={0.8}/>
                    <line x1={cx + r*0.4} y1={cy - r*0.7} x2={cx - r*0.4} y2={cy + r*0.7}
                      stroke="#aa88ff33" strokeWidth={0.8}/>
                    {/* Question mark */}
                    <text x={cx} y={cy + r*0.18} textAnchor="middle"
                      fontSize={r*0.82} fill="#aa88ff" style={{pointerEvents:'none',fontWeight:700}}>?</text>
                    {/* Subtle glow ring */}
                    <ellipse cx={cx} cy={cy + r*0.9} rx={r*0.55} ry={r*0.12}
                      fill="#aa88ff22"/>
                  </g>
                );
              })}

              {/* ── ROADIE direction-target highlights ── */}
              {roadieAction?.phase === 'selectDir' && (() => {
                const adjHex = HEX_BY_NUM[roadieAction.adjHexNum];
                if (!adjHex) return null;
                return getFlatTopNeighborSlots(adjHex).map(nb => {
                  const cx = Math.round(nb.px * SCALE);
                  const cy = Math.round(nb.py * SCALE);
                  return (
                    <g key={nb.num} style={{cursor:"pointer"}} onClick={() => roadieMoveAmp(nb.num)}>
                      <polygon points={pointyCorners(cx, cy, HS * 0.85)}
                        fill="#ffcc4422" stroke="#ffcc44" strokeWidth={1.5}
                        style={{animation:"hex-turn-pulse 1s ease-in-out infinite"}}/>
                      <text x={cx} y={cy+4} textAnchor="middle" fontSize={HS*0.35}
                        fill="#ffcc44" style={{pointerEvents:"none"}}>→</text>
                    </g>
                  );
                });
              })()}
              {/* ── ROADIE: cooldown ghost tokens on amps ── */}
              {amps.map(amp => {
                // Find any spirit whose roadie is on cooldown and owns this amp
                const ghostRoadie = spirits.find(sp => {
                  const ns = noteStates[sp.id];
                  return (ns?.roadies ?? []).some(r => r.cooldownTurns > 0 && sp.id === amp.ownerId);
                });
                if (!ghostRoadie) return null;
                const ns = noteStates[ghostRoadie.id];
                const roadie = (ns?.roadies ?? []).find(r => r.cooldownTurns > 0);
                if (!roadie) return null;
                const hex = HEX_BY_NUM[amp.hexNum];
                if (!hex) return null;
                const cx = Math.round(hex.px * SCALE);
                const cy = Math.round(hex.py * SCALE);
                return (
                  <g key={`ghost-${amp.id}`} style={{pointerEvents:'none'}}>
                    {/* Small wrench ghost sitting on amp */}
                    <circle cx={cx + HS * 0.55} cy={cy - HS * 0.55} r={HS * 0.28}
                      fill="#0a1020cc" stroke={ghostRoadie.color + '88'} strokeWidth={0.8}/>
                    <text x={cx + HS * 0.55} y={cy - HS * 0.55 + 4}
                      textAnchor="middle" fontSize={HS * 0.3}
                      fill={ghostRoadie.color + 'aa'} style={{pointerEvents:'none'}}>🔧</text>
                    <text x={cx + HS * 0.55} y={cy - HS * 0.22}
                      textAnchor="middle" fontSize={HS * 0.22}
                      fill={ghostRoadie.color + '99'} style={{pointerEvents:'none',fontFamily:'monospace'}}>
                      {roadie.cooldownTurns}t
                    </text>
                  </g>
                );
              })}

              {/* ── ROADIE: animated token sliding from spirit → amp → destination ── */}
              {roadieAnimations.map(anim => {
                const fromCx = Math.round(anim.fromHex.px * SCALE);
                const fromCy = Math.round(anim.fromHex.py * SCALE);
                const ampCx  = Math.round(anim.toAmpHex.px * SCALE);
                const ampCy  = Math.round(anim.toAmpHex.py * SCALE);
                const toCx   = Math.round(anim.toFinalHex.px * SCALE);
                const toCy   = Math.round(anim.toFinalHex.py * SCALE);
                // Midpoint: interpolate from→amp→final via animateMotion
                const pathD = `M ${fromCx} ${fromCy} L ${ampCx} ${ampCy} L ${toCx} ${toCy}`;
                return (
                  <g key={anim.id} style={{pointerEvents:'none'}}>
                    {/* Token */}
                    <g style={{animation:'roadie-run 2.8s ease-in-out forwards'}}>
                      <animateMotion dur="2.4s" fill="freeze" path={pathD}
                        keyTimes="0;0.45;1" calcMode="spline"
                        keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
                      <circle r={HS * 0.32} fill={anim.spiritColor + '33'}
                        stroke={anim.spiritColor} strokeWidth={1.2}/>
                      <text textAnchor="middle" dominantBaseline="central"
                        fontSize={HS * 0.35} style={{pointerEvents:'none'}}>🔧</text>
                    </g>
                    {/* "En route…" label that fades in near the amp */}
                    <text
                      x={ampCx} y={ampCy - HS * 1.4}
                      textAnchor="middle" fontSize={HS * 0.32}
                      fill={anim.spiritColor}
                      stroke="#000" strokeWidth={0.3}
                      style={{
                        pointerEvents:'none',
                        animation:'roadie-label-fade 2.8s ease-in-out forwards',
                        fontFamily:'monospace',
                      }}>
                      🔧 Roadie en route…
                    </text>
                  </g>
                );
              })}

              <ScoreTrackOverlay spirits={spirits} startingLives={startingLives} />

              {/* ── NEON FACING ARROW — top layer, hover only ── */}
              {(() => {
                if (hovered === null) return null;
                const hovHex = HEX_BY_NUM[hovered];
                if (!hovHex) return null;
                const sp = spirits.find(s => s.num === hovered && !s.knockedOut);
                if (!sp) return null;
                const cx  = Math.round(hovHex.px * SCALE);
                const cy  = Math.round(hovHex.py * SCALE);
                const f   = sp.facing ?? 0;
                const sc  = sp.corner ? (CORNER_LABELS[sp.corner]?.color ?? sp.color) : sp.color;
                // Arrow starts at edge of hex, tip reaches ~1.6 hexes out
                const tailR = HS * 0.72;
                const tipR  = HS * 2.6;
                const x1 = cx + Math.cos(f) * tailR;
                const y1 = cy + Math.sin(f) * tailR;
                const x2 = cx + Math.cos(f) * tipR;
                const y2 = cy + Math.sin(f) * tipR;
                // Arrowhead
                const wingAngle = 0.45;
                const wingLen   = HS * 0.55;
                const wx1 = x2 + Math.cos(f + Math.PI - wingAngle) * wingLen;
                const wy1 = y2 + Math.sin(f + Math.PI - wingAngle) * wingLen;
                const wx2 = x2 + Math.cos(f + Math.PI + wingAngle) * wingLen;
                const wy2 = y2 + Math.sin(f + Math.PI + wingAngle) * wingLen;
                const filterId = `neon-arrow-${sp.id}`;
                return (
                  <g style={{pointerEvents:"none"}}>
                    <defs>
                      <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="2.8" result="blur"/>
                        <feMerge>
                          <feMergeNode in="blur"/>
                          <feMergeNode in="blur"/>
                          <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                      </filter>
                    </defs>
                    {/* Glow layer */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={sc} strokeWidth={7} strokeLinecap="round" opacity={0.35}
                      filter={`url(#${filterId})`}/>
                    {/* Shaft */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={sc} strokeWidth={2.8} strokeLinecap="round"
                      filter={`url(#${filterId})`}/>
                    {/* Bright core */}
                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="#ffffff" strokeWidth={1.0} strokeLinecap="round" opacity={0.75}/>
                    {/* Arrowhead wings — glow */}
                    <line x1={x2} y1={y2} x2={wx1} y2={wy1}
                      stroke={sc} strokeWidth={7} strokeLinecap="round" opacity={0.35}
                      filter={`url(#${filterId})`}/>
                    <line x1={x2} y1={y2} x2={wx2} y2={wy2}
                      stroke={sc} strokeWidth={7} strokeLinecap="round" opacity={0.35}
                      filter={`url(#${filterId})`}/>
                    {/* Arrowhead wings — solid */}
                    <line x1={x2} y1={y2} x2={wx1} y2={wy1}
                      stroke={sc} strokeWidth={2.8} strokeLinecap="round"
                      filter={`url(#${filterId})`}/>
                    <line x1={x2} y1={y2} x2={wx2} y2={wy2}
                      stroke={sc} strokeWidth={2.8} strokeLinecap="round"
                      filter={`url(#${filterId})`}/>
                    {/* Arrowhead wings — bright core */}
                    <line x1={x2} y1={y2} x2={wx1} y2={wy1}
                      stroke="#ffffff" strokeWidth={1.0} strokeLinecap="round" opacity={0.75}/>
                    <line x1={x2} y1={y2} x2={wx2} y2={wy2}
                      stroke="#ffffff" strokeWidth={1.0} strokeLinecap="round" opacity={0.75}/>
                  </g>
                );
              })()}
            </svg>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{display:"flex",flexDirection:"column",gap:0}}>

          {/* TURN ORDER */}
          <div>
            <div className="stitle">Turn Order</div>
            <div className="card" style={{padding:"5px 8px"}}>
              <NeonStrikeFX color="#f6ad55"/>
              {queuedSpirits.map((s, i) => (
                <div key={s.id} style={{
                  display:"flex", alignItems:"center", gap:6,
                  padding:"3px 4px", marginBottom:2, borderRadius:3,
                  background: i === 0 ? s.color+"22" : "transparent",
                  border: i === 0 ? `1px solid ${s.color}66` : "1px solid transparent",
                  transition:"background .3s",
                }}>
                  <div style={{
                    width:14, height:14, borderRadius:"50%", background:s.color,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:7, fontWeight:700, color:"#000", flexShrink:0,
                  }}>{i+1}</div>
                  <div style={{fontSize:8, color: i === 0 ? s.color : "#7090b0", fontWeight: i === 0 ? 700 : 400, flex:1}}>
                    {s.name.split(" ")[0]}
                  </div>
                  {i === 0 && <div style={{fontSize:6,color:"#f6ad55",fontWeight:700}}>▶ NOW</div>}
                </div>
              ))}
              <div style={{fontSize:7,color:"#3a5a7a",marginTop:3}}>↑ acts next · ↓ waits</div>
            </div>
          </div>


          {/* ── 🎤 CROWD ── */}
          <div>
            <div className="stitle" style={{marginTop:4}}>Crowd</div>
            {(() => {
              if (!acting) return <div style={{fontSize:8,color:'#2a3a50',padding:'4px 8px'}}>No active player</div>;
              const ns = noteStates[acting.id] ?? {};
              const D = ns.diehards ?? FAN_DIEHARD_START, C = ns.casuals ?? 0;
              const m = crowdMultiplier(D, C);
              const pct = Math.min(100, ((m - 1) / (FAN_MULT_CAP - 1)) * 100);
              return (
                <div className="card" style={{padding:'6px 8px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
                    <span style={{fontSize:8,color:'#ff66aa',fontWeight:700}}>🎤 Fame ×{m.toFixed(2)}</span>
                    <span style={{fontSize:7,color:'#3a5a7a'}}>cap ×{FAN_MULT_CAP.toFixed(1)}</span>
                  </div>
                  <div style={{background:'#0d1a2a',borderRadius:2,height:5,marginBottom:5}}>
                    <div style={{width:`${pct}%`,height:5,borderRadius:2,background:'#ff66aa',transition:'width .3s'}}/>
                  </div>
                  <div style={{display:'flex',gap:10,fontSize:8}}>
                    <span style={{color:'#ffcc44'}} title="Diehards — loyal core">♥ {D}<span style={{color:'#3a5a7a'}}>/{FAN_DIEHARD_CAP}</span></span>
                    <span style={{color:'#66ccff'}} title="Casuals — fickle fringe">👥 {C}<span style={{color:'#3a5a7a'}}>/{FAN_CASUAL_CAP}</span></span>
                    {(ns.fanLag ?? 0) > 0 && <span style={{color:'#ff5544'}} title="Shaken from a demolition — no crowd gain">💔 {ns.fanLag}t</span>}
                  </div>
                  {unsurePool > 0 && <div style={{fontSize:7,color:'#aa88cc',marginTop:5}}>❓ {unsurePool} Unsure fan{unsurePool !== 1 ? 's' : ''} on the centre — win them over!</div>}
                </div>
              );
            })()}
          </div>


          {/* ── MODULATION CARDS ── */}
          <div>
            <div className="stitle" style={{marginTop:4}}>Mod Cards</div>
            {(() => {
              if (!acting) return <div style={{fontSize:8,color:'#2a3a50',padding:'4px 8px'}}>No active player</div>;
              const ns = noteStates[acting.id] ?? {};
              const cards = ns.modCards ?? [];
              if (cards.length === 0) return <div style={{fontSize:8,color:'#2a3a50',padding:'4px 8px'}}>No cards in hand</div>;
              return (
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {cards.map(card => {
                    const def = {
                      chromatic_shift: { icon:'🎼', name:'Chromatic Shift', color:'#44ffaa',
                        desc:'Rewrite all discord notes → in-scale', when:'After pivot' },
                      transpose:       { icon:'🔄', name:'Transpose',       color:'#ffcc44',
                        desc:'Pick any stock note as your new Root', when:'During pivot' },
                      overdrive:       { icon:'⚡', name:'Overdrive',       color:'#ff8844',
                        desc:'1 discord note counts as in-scale', when:'Before commit' },
                    }[card.type] ?? { icon:'?', name:'Unknown', color:'#888', desc:'', when:'' };

                    const canPlay = !card.exhausted;
                    const isTransposePending = ns.transposeCardPending === card.id;

                    return (
                      <div key={card.id} style={{
                        position:'relative',
                        width:'100%',
                        aspectRatio:'5/7',
                        borderRadius:8,
                        overflow:'hidden',
                        opacity: card.exhausted ? 0.4 : 1,
                        transition:'all .15s',
                        boxShadow: card.exhausted ? 'none' : `0 0 16px ${def.color}55, 0 4px 12px #00000088`,
                        filter: card.exhausted ? 'grayscale(0.6)' : 'none',
                      }}>
                        {/* Card background image */}
                        <img src={rlCardImg} alt="card" style={{
                          position:'absolute', inset:0, width:'100%', height:'100%',
                          objectFit:'cover', display:'block',
                        }}/>
                        {/* Colour tint overlay */}
                        <div style={{
                          position:'absolute', inset:0,
                          background:`radial-gradient(ellipse at 50% 30%, ${def.color}22 0%, transparent 70%)`,
                          pointerEvents:'none',
                        }}/>
                        {!card.exhausted && <NeonStrikeFX color={def.color} calm/>}
                        {/* Card content — bottom half */}
                        <div style={{
                          position:'absolute', bottom:0, left:0, right:0,
                          padding:'8px 10px 10px',
                          background:'linear-gradient(transparent, #050a1acc 40%, #050a1aee 100%)',
                          fontFamily:"'Orbitron',sans-serif",
                          textAlign:'center',
                        }}>
                          <div style={{fontSize:16, marginBottom:3}}>{def.icon}</div>
                          <div style={{fontSize:9, fontWeight:700, color: card.exhausted ? '#3a5070' : def.color,
                            letterSpacing:1, lineHeight:1.2, marginBottom:3}}>
                            {def.name}
                            {card.exhausted && <div style={{fontSize:7,color:'#3a5070',marginTop:1}}>USED</div>}
                            {isTransposePending && <div style={{fontSize:7,color:'#ffcc44',marginTop:1}}>← PICK NOTE</div>}
                          </div>
                          <div style={{fontSize:7, color:'#7090a0', lineHeight:1.3, marginBottom:5}}>{def.desc}</div>
                          <div style={{fontSize:6, color:'#3a5a7a', marginBottom: canPlay ? 6 : 0}}>{def.when} · refreshes next turn</div>
                          {canPlay && (
                            <button
                              onClick={() => playModCard(card.id)}
                              style={{
                                fontFamily:'inherit', fontSize:9, padding:'5px 14px',
                                background:`${def.color}22`, border:`1px solid ${def.color}88`,
                                borderRadius:4, color:def.color, cursor:'pointer',
                                whiteSpace:'nowrap', lineHeight:1, width:'100%',
                                boxShadow:`0 0 8px ${def.color}44`,
                              }}>
                              ▶ Play
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* COMBAT LOG */}
          <div>
            <div className="stitle">Log</div>
            <div style={{position:"relative"}}>
              <div className="card" style={{maxHeight:200,overflowY:"auto",fontSize:8,lineHeight:1.8,padding:"5px 8px"}}>
                {log.map((entry,i) => (
                  <div key={i} style={{color:i===0?"#e2e8f0":"#3a5a7a",
                    borderBottom:i===0?"1px solid #1a2a40":"none",paddingBottom:i===0?2:0}}>
                    {entry}
                  </div>
                ))}
              </div>
              <NeonStrikeFX calm/>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
