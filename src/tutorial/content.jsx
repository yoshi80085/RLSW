// ─── TUTORIAL ────────────────────────────
// Self-contained illustrated tutorial: mock components + section content + the
// Tutorial overlay. Extracted from the main file (only `Tutorial` is used outside).
import React, { useState } from "react";

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
      <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:1, marginBottom:4}}>
        MELODY LINE <span style={{color:"#ffcc44", marginLeft:6}}>RN: {rootNote}</span>
      </div>
      <div style={{display:"flex", gap:3, flexWrap:"wrap", marginBottom:4}}>
        {notes.map((n, i) => (
          <MockNoteHex key={i} note={n} type={noteTypes?.[i] || "inScale"} />
        ))}
      </div>
    </div>
  );
}

function MockRigPool({ pool, label }) {
  // pool: array of die sizes, e.g. [8,8,6,6]; label: e.g. "2d8+2d6"
  return (
    <div style={{display:"flex", gap:4, alignItems:"center"}}>
      {pool.map((sides,i) => (
        <div key={i} style={{
          padding:"2px 8px", borderRadius:3, fontSize:10, fontWeight:700,
          fontFamily:"'Saira Stencil One',sans-serif",
          background: sides===8 ? "#1a1200" : "#080f1e",
          border: `1px solid ${sides===8 ? "#ff884488" : "#88ffcc88"}`,
          color: sides===8 ? "#ff8844" : "#88ffcc",
          boxShadow: sides===8 ? "0 0 8px #ff884444" : "none",
        }}>d{sides}</div>
      ))}
      {label && <span style={{fontSize:9, color:"#6a8a9a", marginLeft:4}}>= {label}</span>}
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
      fontFamily:"'Saira Stencil One',sans-serif", fontSize:13, fontWeight:700,
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
        Rock Legends: Spirit Wars is a hex-grid battle game powered by music theory.
        Each turn you build a sequence of notes called a <span style={{color:"#aa88ff"}}>Melody Line</span>,
        lock it in, move your Spirit across the board, then unleash a
        <span style={{color:"#f6ad55"}}> Sonic Attack</span> on any enemy in range.
        The notes you pick — and the patterns they spell out — decide how hard you hit
        and which special effects fire.
      </p>
      {/* Turn flow diagram */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:10}}>TURN FLOW</div>
        <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
          {[
            { label:"Build Melody Line", icon:"🎵", color:"#aa55ff" },
            { label:"Commit", icon:"✓", color:"#44ff88" },
            { label:"Move", icon:"🚶", color:"#44cc88" },
            { label:"Sonic Attack", icon:"⚡", color:"#f6ad55" },
          ].map((step, i) => (
            <React.Fragment key={i}>
              <div style={{display:"flex", flexDirection:"column", alignItems:"center", gap:3}}>
                <div style={{fontSize:18}}>{step.icon}</div>
                <div style={{fontSize:8, color:step.color, fontFamily:"'Saira Stencil One',sans-serif", textAlign:"center", maxWidth:60}}>{step.label}</div>
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
        Every Spirit has three stats: <span style={{color:"#44cc66"}}>Vibe</span> (health),
        <span style={{color:"#ff6644"}}> Drive</span> (attack) and
        <span style={{color:"#44aaff"}}> Sustain</span> (defence).
        Drop to zero Vibe and you're Knocked Down; run out of stands and you're KO'd for good.
        Winning a clash earns <span style={{color:"#ffd700"}}>⭐ Fame Points</span> —
        the wider your margin of victory, the more Fame you walk away with — while the
        loser gets <span style={{color:"#ff8866"}}>knocked back</span> across the board:
        one hex from a glancing Swing, up to three from a crushing Sonic defeat.
      </p>
      <div style={{background:"#14110a", border:"1px solid #ffd70044", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ffd700", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>⭐ FAME — THE WIN CONDITION</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          The first Spirit to hit the Fame target wins. Fame comes from winning
          clashes (bigger margin, bigger payout) and playing legendary riffs — and
          every FP you earn is multiplied by your fan crowd, so building an audience
          (clean performances, holding centre stage, resolving 🎯 Cadence Objectives —
          ending consecutive turns on the right scale degrees, C → F → G → C for THE
          FULL RESOLVE — and acing rock trivia) pays off indirectly. Holding the
          Limelight or being the last Spirit standing can also win it for you, but
          Fame is the path of legends.
        </p>
      </div>
      <div style={{background:"#0c0a18", border:"1px solid #aa88ff44", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ccaaff", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>🎼 THE RIFFBOOK</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Hidden in the note system are legendary riffs — everything from Beethoven's
          four fateful knocks to the slyest jazz lick. Lay a riff's opening intervals
          on your track (any key works; only the spacing between notes matters) and hit
          CONFIRM — the full riff plays out in its real rhythm and pays bonus Fame.
          Being first to discover one scores big. The Riffbook (📖 in the header) logs
          what's been found and hints at what's still out there.
        </p>
      </div>
      <div style={{background:"#0c0818", border:"1px solid #ff44dd44", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ff88ee", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>✨ EVENT SPACES</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          A pink marquee hex pulses somewhere on the board. Step onto it to draw a card
          ripped straight from rock history — flaming disc riots, dubious bat snacks,
          séances, payola, stage dives and more. Events can reshape the board, buff or
          curse Spirits, or drag <em>everyone</em> into a community dice roll. Once
          triggered, a marquee burns out — and a new one lights up elsewhere a few turns later.
        </p>
      </div>
      <div style={{background:"#08140e", border:"1px solid #44cc8844", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#44cc88", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>⚡ YOUR RIG</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Every Spirit starts wired into a Main Amp at their corner — you're always electric.
          Unlock Amp tiers for more dice, Power tiers for stronger dice, and Range tiers to
          extend your rig's reach across the board. Your Ultimate charges from Decibills.
        </p>
      </div>
    </div>
  );
}

function TutSection_Board() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        The arena is a grid of hexes, and your Spirit travels across it every turn.
        Position is everything: linger on an <span style={{color:"#ff4400"}}>edge hex</span> and
        a hard enough hit can knock you clean off the board.
      </p>
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>HEX TYPES</div>
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
          Once you commit your Melody Line, you get one hex of movement per note you placed.
          Lit hexes show where you can go — click one to move there. You'll need to lock in
          your track before you can move.
        </p>
      </div>
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:6}}>BOARD LAYOUT</div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(5,36px)", gap:2, justifyContent:"start"}}>
          {[null,"⚠",null,"⚠",null,"⚠","✦","🟦","✦","⚠",null,"✦","✦","✦",null,"⚠","✦","🟥","✦","⚠",null,"⚠",null,"⚠",null].map((c,i)=>{
            const isEdge = c==="⚠";
            const isHome = c==="🟦"||c==="🟥";
            return <MockHex key={i} edge={isEdge} active={isHome} small/>;
          })}
        </div>
        <p style={{fontSize:8, color:"#3a5a7a", margin:"6px 0 0"}}>Simplified view. ⚠ = edge hexes · coloured = home hexes.</p>
      </div>
    </div>
  );
}

function TutSection_NoteTrack() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        Before you attack, you assemble a <span style={{color:"#aa55ff"}}>Melody Line</span> — a
        sequence of notes pulled from your Note Stock. Which notes you pick, and the
        patterns they spell out, set both your combat power and any special effects you trigger.
      </p>

      {/* Note Stock */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>NOTE STOCK — your available notes</div>
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

      {/* Root & pivot */}
      <div style={{background:"#14110a", border:"1px solid #ffcc4444", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#ffcc44", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:6}}>⚡ THE PIVOT — set your key first</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Before you can build, you pivot: pick your <span style={{color:"#ffcc44"}}>Root note</span> and
          declare <span style={{color:"#aaccff"}}>Major</span> or <span style={{color:"#ff88aa"}}>Minor</span>.
          That choice sets your scale — which notes count as in-scale, and how every interval is
          measured from the Root. Mod Cards can bend this on the fly.
        </p>
      </div>

      {/* Assembled track */}
      <MockNoteTrack notes={["C","D","E","F","G"]} rootNote="C"
        noteTypes={["inScale","inScale","majorThird","fourth","fifth"]}/>
      <p style={{fontSize:9, color:"#6a8a9a", lineHeight:1.6, margin:0}}>
        ↑ A clean five-note track, every note in scale. Hit <span style={{color:"#44ff88"}}>✓ Commit</span> and
        every effect fires — plus you bank 5 hexes of movement.
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
        <span style={{color:"#ffcc44"}}>Decibills</span> (DB) is what clean playing
        earns you — the currency you bank toward <span style={{color:"#44ffaa"}}>upgrades</span>.
        End your tracks on strong intervals and string together tidy, in-scale patterns to
        rack up points; a Dischord note just trims a single point off the track. Fill the meter and you
        cash it in for a new skill. (Your attack <em>die</em> comes from Amps, not DB — see the next tab.)
      </p>

      {/* Upgrade threshold */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:10}}>HOW DB BECOMES POWER</div>
        <div style={{display:"flex", flexDirection:"column", gap:7}}>
          {[
            {step:"1", color:"#88ffcc", text:"Earn DB from clean, in-scale play (see below)."},
            {step:"2", color:"#ffcc44", text:"Set a target skill in the upgrade tree — each costs 8 to 20 DB."},
            {step:"3", color:"#ff8844", text:"When your meter reaches that cost, the skill unlocks."},
            {step:"4", color:"#44ffaa", text:"Leftover points carry over toward your next pick."},
          ].map((r,i)=>(
            <div key={i} style={{display:"flex", alignItems:"flex-start", gap:8}}>
              <div style={{minWidth:16, height:16, borderRadius:"50%", background:r.color+"22",
                border:`1px solid ${r.color}88`, color:r.color, fontSize:8, fontWeight:700,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}>{r.step}</div>
              <div style={{fontSize:9, color:"#a0b8cc", lineHeight:1.5}}>{r.text}</div>
            </div>
          ))}
        </div>
        <p style={{fontSize:8.5, color:"#6a8a9a", margin:"9px 0 0", lineHeight:1.5}}>
          A Dischord note costs the track a single DB — no longer a blanket zero, so a little dissonance is affordable.
        </p>
      </div>

      {/* What earns points */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>WHAT EARNS DECIBILLS</div>
        {[
          {icon:"🎶", label:"End on 4th or 5th",       pts:"+2 pts", color:"#cc55ff"},
          {icon:"🎶", label:"Octave resolution",        pts:"+3 pts + die floor", color:"#44aaff"},
          {icon:"✨", label:"Major 3rd end",            pts:"+1 pt + cleanse", color:"#44ffaa"},
          {icon:"⚔️", label:"Drive overflow (non-stack)",pts:"+varies", color:"#ffaa44"},
          {icon:"🛡️", label:"Sustain overflow (non-stack)",pts:"+varies", color:"#88ccff"},
        ].map((r,i)=>(
          <div key={i} style={{display:"flex", alignItems:"center", gap:8, marginBottom:5}}>
            <span style={{fontSize:13}}>{r.icon}</span>
            <span style={{fontSize:9, color:"#a0b8cc", flex:1}}>{r.label}</span>
            <span style={{fontSize:9, color:r.color, fontWeight:700}}>{r.pts}</span>
          </div>
        ))}
      </div>

      <div style={{background:"#0c0a18", border:"1px solid #aa88ff44", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ccaaff", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>🌳 WHERE IT GOES</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Your DB meter sits at the top of the Melody Line panel. Spend it across the Skill
          Tree — Amp & Power tiers, Range upgrades, Stances, Theory unlocks, and
          your Spirit's exclusive arsenal. (More on those next.)
        </p>
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
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:10}}>DRIVE BOOST — diatonic step runs</div>
        <MockNoteTrack notes={["C","D","E","F","G"]} rootNote="C"
          noteTypes={["inScale","inScale","majorThird","fourth","fifth"]}/>
        <div style={{marginTop:8, display:"flex", gap:6, alignItems:"center"}}>
          <MockFlashBadge text="⚔️ Drive +2" color="#ffaa44"/>
          <div style={{fontSize:9, color:"#6a8a9a"}}>← five steps = +3; the four shown here give +2</div>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"8px 0 0", lineHeight:1.6}}>
          String together notes that step straight up or down the scale (C→D→E→F…).
          Three in a row earns +1 Drive, four earns +2, five earns +3. The bonus is
          spent the next time you attack.
        </p>
      </div>

      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:10}}>FEEDBACK BOOST — repeat patterns</div>
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
          <MockFlashBadge text="🛡️ Sustain +2" color="#88ccff"/>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"8px 0 0", lineHeight:1.6}}>
          Both patterns count only when every note is in-scale. Three notes = +1,
          four = +2, five = +3. The boost holds until the next attack lands on you,
          then it's spent.
        </p>
      </div>

      <div style={{background:"#0e0c18", border:"1px solid #aa55ff44", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#aa55ff", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:6}}>NON-STACKING RULE</div>
        <div style={{display:"flex", gap:8, alignItems:"center", fontSize:9, color:"#a0b8cc"}}>
          <span style={{color:"#ffaa44"}}>+1 Drive active</span>
          <span style={{color:"#3a5a7a"}}>→ earn</span>
          <span style={{color:"#ffaa44"}}>+2 Drive</span>
          <span style={{color:"#3a5a7a"}}>→</span>
          <span style={{color:"#ffcc44"}}>old +1 → DB</span>
          <span style={{color:"#3a5a7a"}}>+</span>
          <span style={{color:"#ffaa44"}}>keep +2</span>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"6px 0 0"}}>
          Boosts never stack — the higher value always wins, and the one it replaces is
          converted into Decibills.
        </p>
      </div>
    </div>
  );
}

function TutSection_Intervals() {
  const intervals = [
    { note:"F",  label:"4th",      color:"#cc55ff", effect:"DB",         icon:"💜", desc:"A stable, consonant interval — score DB by ending your track here." },
    { note:"G",  label:"5th",      color:"#ff55aa", effect:"DB",         icon:"💗", desc:"The strong perfect fifth — also banks DB when it ends your track." },
    { note:"E",  label:"Maj 3rd",  color:"#44ffaa", effect:"🔒 Cleanse / Shield", icon:"✨", desc:"EARNED (Borrowed Chord, Minor key only): end on the major third to cleanse a status — or, if you're clean, raise a shield that blocks the next one." },
    { note:"Bb", label:"Min 7th",  color:"#4499ff", effect:"🔒 Mojo Drain",  icon:"🎷", desc:"EARNED (Blues Lick): end here to arm a Mojo Drain debuff on your next target." },
    { note:"F#", label:"Tritone",  color:"#ff3300", effect:"🔒 Burn",       icon:"🔥", desc:"The devil's interval. EARNED (Devil's Interval): end your track on it to arm a Burn — your next hit sets the rival alight for 2 turns." },
    { note:"C",  label:"Octave",   color:"#44aaff", effect:"Die Floor +2",      icon:"🎶", desc:"Open and close on the same note to raise your attack die's floor — no more low rolls." },
  ];
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        An <span style={{color:"#aa88ff"}}>interval</span> is the musical distance between your
        Root Note and a note you play. The <span style={{color:"#cc55ff"}}>4th</span>, <span style={{color:"#ff55aa"}}>5th</span> and <span style={{color:"#44aaff"}}>octave</span> endings
        work from your very first turn. The <span style={{color:"#44ffaa"}}>Maj 3rd</span>, <span style={{color:"#4499ff"}}>Min 7th</span> and <span style={{color:"#ff3300"}}>Tritone</span> effects
        (marked 🔒) are <span style={{color:"#66ccff"}}>earned</span> — they come online as you climb the Music Theory ladder.
      </p>
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>INTERVAL REFERENCE (Root = C)</div>
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
        <span style={{color:"#ff6600"}}>Dischord</span> notes sit outside your scale, so they
        earn no Decibills — but they're far from dead weight. Played right, they
        unleash brutal combat effects all their own.
      </p>

      {/* Dischord track */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>CHROMATIC RUN → STAGGER</div>
        <MockNoteTrack notes={["C","C#","D","D#","E"]} rootNote="C"
          noteTypes={["inScale","dischord","inScale","dischord","majorThird"]}/>
        <div style={{marginTop:6, display:"flex", gap:6, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{fontSize:8, color:"#ff6600", padding:"2px 6px", background:"#1f0d00", borderRadius:3, border:"1px solid #ff660044"}}>
            ⚡ 2 Dischord notes
          </div>
          <MockFlashBadge text="⚡ Chromatic ×3 — Stagger 2t" color="#ff8800"/>
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"8px 0 0", lineHeight:1.6}}>
          Three or more semitone steps in a row hits your target with <span style={{color:"#ff8800"}}>Stagger</span>,
          hiding two of their Note Stock slots for several turns.
        </p>
      </div>

      {/* Stagger card */}
      <MockSpiritCard name="Metalness Monster" style="Shred" drive={7} sustain={6} vibe={3} maxVibe={5} color="#ffcc00"
        status="⚡ STAGGER 2t"/>

      {/* Mojo Drain */}
      <div style={{background:"#050c18", border:"1px solid #1155ff33", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#4499ff", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>MOJO DRAIN</div>
        <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:6}}>
          <MockNoteHex note="Bb" type="minorSeventh"/>
          <div style={{fontSize:9, color:"#a0b8cc"}}>Finish your track on the minor 7th, then attack to slap Mojo Drain on your enemy.</div>
        </div>
        <div style={{fontSize:8, color:"#4499ff", padding:"4px 8px", background:"#05101a", border:"1px solid #1155ff66",
          borderRadius:3, display:"inline-block"}}>💧 MOJO DRAIN 3t</div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"8px 0 0"}}>
          While Mojo Drained, a Spirit can't benefit from any of its bonuses — Drive,
          Sustain and the rest are all locked out for several turns.
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
        Four Spirits, each with its own musical identity, combat style and stat balance.
        Pick the one that fits how you want to fight.
      </p>
      {spirits.map(s => (
        <div key={s.id} style={{background:"#050c18", border:`1px solid ${s.color}33`,
          borderLeft:`3px solid ${s.color}`, borderRadius:6, padding:"10px 12px"}}>
          <div style={{display:"flex", gap:10, marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Saira Stencil One',sans-serif", fontSize:11, color:s.color, marginBottom:2}}>{s.name}</div>
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
                <span style={{fontSize:8, color:"#44aaff", width:40}}>🛡️ Sus</span>
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

function TutSection_Attacks() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        You get one attack per turn — your <span style={{color:"#f6ad55"}}>Action Token</span> —
        and two ways to spend it. <span style={{color:"#f6ad55"}}>Sonic</span> hits from range;
        <span style={{color:"#ff6644"}}> Swing</span> gets up close. Either way the clash pits your
        <span style={{color:"#ff6644"}}> Drive</span> against the defender's
        <span style={{color:"#44aaff"}}> Sustain</span> — roll high, win, and deal damage scaled to your margin.
      </p>

      <div style={{background:"#14100a", border:"1px solid #f6ad5544", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#f6ad55", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>🔊 SONIC ATTACK — ranged</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Your main weapon, powered by the Melody Line you just committed. It fires a narrow
          three-hex beam straight ahead, so facing matters. Every Spirit is wired in from turn 1
          — your <span style={{color:"#ffcc44"}}>Amp Deck</span> at your corner drives the attack.
          Inside your rig's Range you roll the full dice pool (keep highest); outside it, baseline 1d6.
        </p>
      </div>

      <div style={{background:"#140a0a", border:"1px solid #ff664444", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#ff6644", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>🥊 SWING ATTACK — close combat</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:"0 0 8px"}}>
          Step next to a rival and swing — no amp required. But committing to a swing drops your guard:
          your Sustain falls 1 until your next turn, so melee is a real risk (ranged Sonic keeps you safe).
          A plain swing still lands (and flashes a vintage dance-craze name), but the CQC skill route bolts
          on nasty riders — and unlocks the COUNTER: swing back when a rival barely beats you. No CQC, no riposte.
        </p>
        {[
          {icon:"🌀", name:"Trip",            desc:"target's movement is halved next turn"},
          {icon:"💥", name:"Drop Instrument", desc:"target loses Drive until they recover it"},
          {icon:"😵", name:"Dazed",           desc:"target's next move lurches off in a random direction"},
        ].map((s,i)=>(
          <div key={i} style={{display:"flex", gap:8, alignItems:"baseline", marginBottom:4}}>
            <span style={{fontSize:11}}>{s.icon}</span>
            <span style={{fontSize:9, color:"#ffaa88", fontWeight:700, minWidth:104}}>{s.name}</span>
            <span style={{fontSize:9, color:"#6a8a9a"}}>{s.desc}</span>
          </div>
        ))}
      </div>

      <div style={{background:"#0a0e18", border:"1px solid #ff886644", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ff8866", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>💥 KNOCKBACK</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Lose a clash and you're shoved back — one hex from a Swing, up to three from a big Sonic
          hit. Near an <span style={{color:"#ff4400"}}>edge</span>, that shove can launch you clean off the board.
        </p>
      </div>
    </div>
  );
}

function TutSection_Amps() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        Every Spirit starts wired into a <span style={{color:"#ffcc44"}}>Main Amp</span> at their home
        corner — you're always electric. Your rig never moves; it grows at your corner as you invest,
        engine-builder style. Three upgrade axes shape your Sonic Attack.
      </p>

      {/* Amp tiers */}
      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#ffcc44", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:10}}>🔊 AMPS — HOW MANY DICE YOU ROLL</div>
        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          {[
            {t:"Baseline", pool:[6],       label:"1d6",      desc:"Every Spirit starts here — roll one d6, keep the highest."},
            {t:"Amp I",     pool:[6,6],     label:"2d6",      desc:"+1d6 to the pool. More dice, more consistency."},
            {t:"Amp II",    pool:[6,6,6],   label:"3d6",      desc:"+1d6 again. Variance narrows further."},
            {t:"Amp III",   pool:[6,6,6,6], label:"4d6",      desc:"The wall of sound is complete."},
          ].map((r,i)=>(
            <div key={i} style={{display:"flex", gap:10, alignItems:"center"}}>
              <span style={{fontSize:9, color:"#ffcc44", fontWeight:700, minWidth:56}}>{r.t}</span>
              <MockRigPool pool={r.pool} label={r.label}/>
            </div>
          ))}
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"10px 0 0", lineHeight:1.6}}>
          The roll is <span style={{color:"#88ffcc"}}>keep-highest</span>: roll the whole pool, the single best die is your result.
          More dice means fewer bad rolls — Amp buys consistency.
        </p>
      </div>

      {/* Power tiers */}
      <div style={{background:"#050c18", border:"1px solid #ff884444", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#ff8844", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:10}}>🎛️ POWER — HOW STRONG YOUR DICE ARE</div>
        <div style={{display:"flex", flexDirection:"column", gap:6}}>
          {[
            {t:"Power I",   pool:[8,6,6],   label:"d8+2d6",   desc:"One die in the pool upgrades from d6 to d8."},
            {t:"Power II",  pool:[8,8,6],   label:"2d8+d6",   desc:"A second die upgrades. Requires Amp II."},
            {t:"Power III", pool:[8,8,8,6], label:"3d8+d6",   desc:"Three d8s — maximum wattage. Requires Amp III."},
          ].map((r,i)=>(
            <div key={i} style={{display:"flex", gap:10, alignItems:"center"}}>
              <span style={{fontSize:9, color:"#ff8844", fontWeight:700, minWidth:56}}>{r.t}</span>
              <MockRigPool pool={r.pool} label={r.label}/>
            </div>
          ))}
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"10px 0 0", lineHeight:1.6}}>
          Each Power tier needs the matching Amp tier first — the head needs a cabinet to drive.
          Power buys ceiling: d8s top out at 8, not 6.
        </p>
      </div>

      {/* Range tiers */}
      <div style={{background:"#0a0a18", border:"1px solid #aa55ff44", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#aa88ff", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>📡 RANGE — HOW FAR YOUR RIG REACHES</div>
        <div style={{display:"flex", flexDirection:"column", gap:4}}>
          {[
            {t:"Start",     r:"2 hexes",  desc:"Your corner pocket only.",              c:"#5a7a8a"},
            {t:"Range I",   r:"4 hexes",  desc:"The approaches — one hex shy of centre.", c:"#88aacc"},
            {t:"Range II",  r:"7 hexes",  desc:"The Limelight is inside your field.",    c:"#aa88ff"},
            {t:"Range III", r:"∞",        desc:"Fully wired. The whole venue is your stage.", c:"#ff88ee"},
          ].map((r,i)=>(
            <div key={i} style={{display:"flex", gap:8, alignItems:"baseline"}}>
              <span style={{fontSize:9, color:r.c, fontWeight:700, minWidth:56}}>{r.t}</span>
              <span style={{fontSize:9, color:"#a0b8cc", minWidth:48}}>{r.r}</span>
              <span style={{fontSize:9, color:"#6a8a9a"}}>{r.desc}</span>
            </div>
          ))}
        </div>
        <p style={{fontSize:9, color:"#6a8a9a", margin:"10px 0 0", lineHeight:1.6}}>
          Inside your Range radius, the full rig applies — every Amp and Power upgrade counts.
          Outside it, you fall back to the <span style={{color:"#88ffcc"}}>baseline 1d6</span> (the Main Amp's board-wide floor).
          While aiming a Sonic Attack, a <span style={{color:"#e648f0"}}>neon radius ring</span> pulses from your corner so you can see exactly where your rig reaches.
        </p>
      </div>

      <div style={{background:"#14110a", border:"1px solid #ffcc4444", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ffcc44", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>⚡ THE AMP DECKS</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Your rig is visible as two stacks flanking your home corner — one for Amps, one for Power.
          They grow physically as you upgrade, readable at a glance across the table. Range shows as
          lightning arcs crawling over the cabinets: the higher the tier, the brighter the storm.
        </p>
      </div>
    </div>
  );
}

function TutSection_Crowd() {
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        Fans never hand you Fame directly — they <span style={{color:"#ff66aa"}}>multiply</span> it.
        Every Fame-earning deed is scaled by your crowd, from ×1 in an empty house up to a ×2 ceiling
        when the place is packed.
      </p>

      <div style={{background:"#160a12", border:"1px solid #ff66aa44", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#ff66aa", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>TWO KINDS OF FAN</div>
        <div style={{display:"flex", gap:8, alignItems:"baseline", marginBottom:5}}>
          <span style={{fontSize:9, color:"#ffcc44", fontWeight:700, minWidth:72}}>♥ Diehards</span>
          <span style={{fontSize:9, color:"#6a8a9a"}}>your loyal core — each adds a lot to the multiplier and almost never leaves.</span>
        </div>
        <div style={{display:"flex", gap:8, alignItems:"baseline"}}>
          <span style={{fontSize:9, color:"#66ccff", fontWeight:700, minWidth:72}}>👥 Casuals</span>
          <span style={{fontSize:9, color:"#6a8a9a"}}>the fickle fringe — they pile in fast, add a little each, and bail the moment you go cold.</span>
        </div>
      </div>

      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>WORK THE ROOM — gain by zone</div>
        {[
          {zone:"🌟 Mainstage (centre)", note:"biggest gain · hardens Diehards · wins over Unsure fans · demolition risk", c:"#ff66aa"},
          {zone:"🔥 The Pit (ring 1)",   note:"still a heavy draw, just a touch less than centre",                       c:"#ff8844"},
          {zone:"👣 The Floor (mid)",    note:"a small, safe trickle — but no hardening or recruiting",                  c:"#88aacc"},
          {zone:"🚪 Backstage (edges)",  note:"no gain; linger out here and bored Casuals drift off",                   c:"#5a7a8a"},
        ].map((r,i)=>(
          <div key={i} style={{marginBottom:6}}>
            <div style={{fontSize:9, color:r.c, fontWeight:700, marginBottom:1}}>{r.zone}</div>
            <div style={{fontSize:8.5, color:"#6a8a9a", lineHeight:1.5}}>{r.note}</div>
          </div>
        ))}
        <p style={{fontSize:9, color:"#6a8a9a", margin:"6px 0 0", lineHeight:1.6}}>
          You grow the crowd by committing <em>clean</em> tracks in the inner zones. Perform
          centre-stage several turns running and Casuals harden into permanent Diehards.
        </p>
      </div>

      <div style={{background:"#160808", border:"1px solid #ff444444", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#ff5544", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>💔 GETTING DEMOLISHED</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Take a beating in the spotlight and the magic curdles: a wave of Casuals scatters — some
          defecting straight to whoever beat you — and you're locked out of crowd gain for a few turns
          while you regroup.
        </p>
      </div>
    </div>
  );
}

function TutSection_ModCards() {
  const cards = [
    {icon:"🎼", name:"Chromatic Shift", color:"#44ffaa", when:"after the pivot",  desc:"Rewrites every discord note on your track into an in-scale note — an instant clean-up."},
    {icon:"🔄", name:"Transpose",       color:"#ffcc44", when:"during the pivot",  desc:"Pick any note in your stock and make it your new Root, re-spelling the whole scale around it."},
    {icon:"⚡", name:"Overdrive",       color:"#ff8844", when:"before you commit", desc:"Lets one discord note count as in-scale, so it scores instead of breaking your harmony."},
  ];
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        <span style={{color:"#aa88ff"}}>Mod Cards</span> are one-shot rule-benders for your Melody Line.
        Play one per turn; they recharge by your next turn. Each fires at a specific moment around the
        <span style={{color:"#ffcc44"}}> pivot</span> — where you lock in your Root and declare Major or Minor.
      </p>
      {cards.map((c,i)=>(
        <div key={i} style={{background:"#050c18", border:`1px solid ${c.color}44`,
          borderLeft:`3px solid ${c.color}`, borderRadius:6, padding:"10px 12px"}}>
          <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:4}}>
            <span style={{fontSize:16}}>{c.icon}</span>
            <span style={{fontSize:11, color:c.color, fontWeight:700, fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:1}}>{c.name}</span>
            <span style={{marginLeft:"auto", fontSize:7.5, color:c.color, padding:"1px 6px", borderRadius:3,
              background:c.color+"22", border:`1px solid ${c.color}44`}}>{c.when}</span>
          </div>
          <div style={{fontSize:9, color:"#8a9aaa", lineHeight:1.55}}>{c.desc}</div>
        </div>
      ))}
      <p style={{fontSize:9, color:"#6a8a9a", lineHeight:1.6, margin:0}}>
        Played at the right moment, a card can rescue a track that would otherwise count as Dischord —
        turning wasted notes into Decibills and a clean, fan-pleasing performance.
      </p>
    </div>
  );
}

function TutSection_Winning() {
  const cadences = [
    {icon:"🙏", name:"Amen Cadence",         formula:"I → IV → I",         fp:"2 FP"},
    {icon:"🎭", name:"Deceptive Cadence",    formula:"I → V → vi",         fp:"3 FP"},
    {icon:"👑", name:"The Full Resolve",     formula:"I → IV → V → I",     fp:"4 FP"},
    {icon:"🌀", name:"Circle of Resolution", formula:"I → vi → ii → V → I", fp:"6 FP"},
  ];
  return (
    <div style={{display:"flex", flexDirection:"column", gap:14}}>
      <p style={{fontSize:10, color:"#a0b8cc", lineHeight:1.7, margin:0}}>
        Two roads lead to victory — Fame and force. Between them sits the Limelight: not a win on its own, but a contested Fame faucet that feeds the first.
      </p>

      <div style={{background:"#14110a", border:"1px solid #ffd70044", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:9, color:"#ffd700", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:1, marginBottom:5}}>⭐ FAME LEGEND</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          The headline route: be first to <span style={{color:"#ffd700"}}>25 Fame Points</span>. Fame pours
          in from winning clashes (multiplied by your crowd), discovering riffs, holding the Limelight,
          and resolving the Cadence Objectives below.
        </p>
      </div>

      <div style={{background:"#100a16", border:"1px solid #cc66ff44", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:9, color:"#cc88ff", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:1, marginBottom:5}}>🌟 HOLD THE LIMELIGHT</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          Seize the centre stage and hold it: start and end a turn on the Limelight and the spotlight pays
          out bonus Fame, multiplied by your crowd. No instant win — but it's a contested objective that
          feeds your Fame, and it paints a target on your back. The crowd loves a showboat.
        </p>
      </div>

      <div style={{background:"#160a0a", border:"1px solid #ff664444", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:9, color:"#ff6644", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:1, marginBottom:5}}>💥 LAST SPIRIT STANDING</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          The brute-force option: knock down every rival's stands until you're the only act left on the bill.
        </p>
      </div>

      <div style={{background:"#08140e", border:"1px solid #44cc8844", borderRadius:6, padding:"8px 12px"}}>
        <div style={{fontSize:8, color:"#44cc88", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:5}}>🔦 THE SPOTLIGHT</div>
        <p style={{fontSize:9.5, color:"#a0b8cc", lineHeight:1.6, margin:0}}>
          A roaming searchlight drifts across the board, moving once each round. End your turn standing in it
          and you heal +1 Vibe — a handy patch-up if you can read where it's headed next.
        </p>
      </div>

      <div style={{background:"#050c18", border:"1px solid #1a2a40", borderRadius:6, padding:"10px 14px"}}>
        <div style={{fontSize:8, color:"#3a5a7a", fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:2, marginBottom:8}}>🎯 CADENCE OBJECTIVES — end turns on these scale degrees, any key</div>
        {cadences.map((c,i)=>(
          <div key={i} style={{display:"flex", alignItems:"center", gap:8, marginBottom:5}}>
            <span style={{fontSize:12}}>{c.icon}</span>
            <span style={{fontSize:9, color:"#c0d0e0", fontWeight:700, minWidth:132}}>{c.name}</span>
            <span style={{fontSize:9, color:"#8a9aaa", flex:1}}>{c.formula}</span>
            <span style={{fontSize:9, color:"#ffd700", fontWeight:700}}>{c.fp}</span>
          </div>
        ))}
        <p style={{fontSize:8.5, color:"#6a8a9a", margin:"6px 0 0", lineHeight:1.5}}>
          Finish consecutive turns on the right degrees — the root, then the 4th, then home — to bank the bonus.
        </p>
      </div>
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
  attacks:          TutSection_Attacks,
  amps:             TutSection_Amps,
  crowd:            TutSection_Crowd,
  mod_cards:        TutSection_ModCards,
  winning:          TutSection_Winning,
  spirits:          TutSection_Spirits,
};

const TUTORIAL_SECTIONS = [
  { id:"overview",        title:"What Is RLSW?",        icon:"⚡", color:"#f6ad55" },
  { id:"board",           title:"The Board",            icon:"🗺️", color:"#44cc88" },
  { id:"note_track",      title:"The Melody Line",       icon:"🎵", color:"#aa55ff" },
  { id:"harmonic_charge", title:"Decibills",      icon:"💰", color:"#ffcc44" },
  { id:"drive_sustain",   title:"Drive & Sustain",      icon:"⚔️", color:"#ff6644" },
  { id:"intervals",       title:"Interval Effects",     icon:"🎶", color:"#44aaff" },
  { id:"dischord",        title:"Dischord & Status",    icon:"⚡", color:"#ff8800" },
  { id:"attacks",         title:"Swing & Sonic",        icon:"🥊", color:"#ff6644" },
  { id:"amps",            title:"Your Rig",             icon:"🔊", color:"#ffcc44" },
  { id:"crowd",           title:"The Crowd",            icon:"🎤", color:"#ff66aa" },
  { id:"mod_cards",       title:"Mod Cards",            icon:"🎼", color:"#aa88ff" },
  { id:"winning",         title:"Winning the Game",     icon:"🏆", color:"#ffd700" },
  { id:"spirits",         title:"The Spirits",          icon:"🌟", color:"#cc55ff" },
];

export function Tutorial({ onBack }) {
  const [activeSection, setActiveSection] = useState("overview");
  const section = TUTORIAL_SECTIONS.find(s => s.id === activeSection);
  const SectionContent = TUTORIAL_SECTION_COMPONENTS[activeSection];
  const activeIdx = TUTORIAL_SECTIONS.findIndex(s => s.id === activeSection);

  return (
    <div style={{minHeight:"100vh", background:"#050810", display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Share Tech Mono','Courier New',monospace", padding:16}}>
      <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Saira+Stencil+One&family=Saira:wght@400;600;700&display=swap" rel="stylesheet"/>
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
              <div style={{fontFamily:"'Saira Stencil One',sans-serif", fontSize:16, color:"#f6ad55", letterSpacing:3}}>📖 HOW TO PLAY</div>
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
                  fontFamily:"'Saira Stencil One',sans-serif", letterSpacing:0.5, lineHeight:1.4}}>
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
                  <div style={{fontFamily:"'Saira Stencil One',sans-serif", fontSize:13, color:section.color, letterSpacing:2}}>
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
