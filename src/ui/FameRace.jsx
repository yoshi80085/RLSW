// ─── ⭐ THE FAME RACE — one track, one blip per Spirit ───────────────────────
//
// 🪦 THIS REPLACES THE LANE CARD, Alex 2026-08-31. The scoreboard used to be a
// card down in the HUD column: one horizontal bar PER SPIRIT, stacked, sorted by
// Fame, and gated to `!acting || turnStep === 'move_act'` so it was not even on
// screen during the two steps where you build the thing that scores.
//
// ⚠️ FOUR PARALLEL BARS DO NOT SHOW A RACE. Each bar answered "how far along is
// this one spirit", and the question the panel is actually for — "who is ahead,
// and by how much" — had to be reconstructed by eye across four separate
// origins. One shared track with a blip each makes the gap the SHAPE of the
// thing: distance on screen IS distance in points, and the pack reads at a
// glance without reading a single number.
//
// 📌 IT MOVED INTO THE HEADER, which is why the lanes had to go. The strip has
// room for one row, not four, and the trade is the right way round: the race is
// now permanent — visible in steps 1 and 2, where you are choosing what to play
// and the standings are exactly what should inform it — at the cost of the
// per-lane numbers, which were detail nobody was reading mid-build.
//
// ⚠️ THE TIE FAN IS LOAD-BEARING, NOT POLISH. Every match STARTS with every
// spirit on 0 Fame, so the default state of this component is a total collision
// — without the fan, the opening screen of every game shows one blip and three
// invisible ones, and the first thing the scoreboard ever tells you is a lie.
// Ties fan HORIZONTALLY rather than vertically because the header is a strip:
// vertical room is the one thing it does not have, and a pack bunched at the
// start line is the correct picture anyway.

/**
 * @param spirits    the live spirit list (needs id, name, color, knockedOut)
 * @param fameOf     (spiritId) => current Fame — passed in so this file never
 *                   touches noteStates. Same shell/state split as ChannelStrip.
 * @param fameToWin  the target; the right end of the track
 * @param actingId   whose turn it is — their blip gets the ring
 * @param thresholds Stage-FX Fame thresholds, notched into the track
 * @param contested  the leader is inside striking distance of the target and a
 *                   rival is right behind them — presentation only, see
 *                   FAME_RACE_CONTESTED_LEAD in data/gameConstants.js
 */
export function FameRace({ spirits, fameOf, fameToWin, actingId, thresholds = [], contested = false }) {
  const BLIP = 9;
  const board = (spirits ?? []).map(sp => ({ sp, fp: fameOf(sp.id) ?? 0 }));
  if (!board.length) return null;
  const leadFp = Math.max(0, ...board.filter(b => !b.sp.knockedOut).map(b => b.fp));

  /* Blips are positioned by percentage but are 9px wide, so a spirit on 0 and a
     spirit on the target would each hang half a blip off the end. The track's
     usable span is inset by one blip on each side and every position is mapped
     into THAT, which is why this is a calc() and not a bare percentage. */
  const at = (fp) => `calc(${BLIP / 2}px + ${Math.min(100, Math.max(0, (fp / fameToWin) * 100))}% - ${BLIP}px * ${Math.min(1, Math.max(0, fp / fameToWin))})`;

  // Ties fan sideways. Group by score first — see the ⚠️ above.
  const byScore = new Map();
  board.forEach(b => { const k = b.fp; byScore.set(k, [...(byScore.get(k) ?? []), b]); });

  const rail = contested ? "#ff4422" : "#5a4410";

  return (
    <div style={{ flex: 1, minWidth: 190, display: "flex", alignItems: "center", gap: 7 }}
      title={`The Fame race — first to ${fameToWin} FP is crowned a Legend`}>
      <span style={{ fontSize: 7, letterSpacing: 1.4, fontWeight: 800, flexShrink: 0,
        color: contested ? "#ff8855" : "#7d6a3a" }}>
        {contested ? "🤘 FINALE" : "⭐ RACE"}
      </span>

      <div style={{ position: "relative", flex: 1, height: BLIP + 4, minWidth: 90 }}>
        {/* the rail */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 5,
          transform: "translateY(-50%)", borderRadius: 3, background: "#0a0f1c",
          border: `1px solid ${rail}`, boxShadow: "inset 0 1px 2px #000a",
          animation: contested ? "fame-danger 1.1s ease-in-out infinite" : undefined }}/>

        {/* 🎇 Stage-FX thresholds — the same notches the card bar draws, so the
            two readouts of the same milestones cannot drift apart. */}
        {thresholds.filter(t => t < fameToWin).map(t => (
          <div key={t} style={{ position: "absolute", top: "50%", height: 9,
            transform: "translateY(-50%)", width: 1.5, left: at(t),
            background: leadFp >= t ? "#fff6d0aa" : "#ffffff26" }}/>
        ))}

        {/* the finish line */}
        <div style={{ position: "absolute", top: "50%", height: 11, width: 2,
          transform: "translateY(-50%)", right: 0, borderRadius: 1,
          background: contested ? "#ff6644" : "#ffd700",
          boxShadow: `0 0 6px ${contested ? "#ff4422" : "#ffd700"}aa` }}/>

        {[...byScore.values()].map(group => group.map((b, i) => {
          const { sp, fp } = b;
          const out    = sp.knockedOut;
          const isLead = !out && fp === leadFp && leadFp > 0;
          const isYou  = sp.id === actingId;
          /* Fan tied blips INWARD from their shared point, never symmetrically
             about it. ⚠️ A CENTRED FAN WALKS OFF THE TRACK at exactly the two
             places ties are most likely: the start line, where every match
             begins with everyone on 0, and the finish, where a tie is the whole
             drama. Biasing by which half of the track the group sits in keeps
             the pack inside the rail at both ends, and leaves one blip sitting
             on the true mark instead of putting the mark between two of them. */
          const dir = (fp / fameToWin) < 0.5 ? 1 : -1;
          const fan = i * (BLIP * 0.78) * dir;
          return (
            <div key={sp.id}
              title={`${sp.name} — ⭐${fp}/${fameToWin}${
                out ? " · knocked out"
                : fp === leadFp ? (leadFp > 0 ? " · leading" : " · level, nobody has scored")
                : ` · ${leadFp - fp} behind`}`}
              style={{ position: "absolute", left: at(fp), top: "50%",
                transform: `translate(${fan}px, -50%)`,
                width: BLIP, height: BLIP, borderRadius: "50%",
                transition: "left .5s cubic-bezier(.2,.9,.3,1)",
                background: out ? "#1a2230" : sp.color,
                border: `1.5px solid ${out ? "#2a3444" : isYou ? "#ffffff" : `${sp.color}`}`,
                boxSizing: "border-box",
                opacity: out ? 0.45 : 1,
                zIndex: isYou ? 3 : isLead ? 2 : 1,
                boxShadow: out ? "none"
                  : `0 0 ${isYou ? 9 : 5}px ${sp.color}, ${isYou ? `0 0 0 2px ${sp.color}44` : "0 1px 2px #000a"}`,
                animation: isYou ? "fame-crown 1.9s ease-in-out infinite" : undefined }}>
              {isLead && (
                <span style={{ position: "absolute", left: "50%", bottom: "calc(100% + 1px)",
                  transform: "translateX(-50%)", fontSize: 7, lineHeight: 1,
                  pointerEvents: "none", textShadow: "0 0 5px #ffd700" }}>👑</span>
              )}
            </div>
          );
        }))}
      </div>

      {/* 🏆 THE TARGET. The header used to carry a whole chip saying
          "first to ⭐N FP wins"; a race track with its finish line labelled says
          the same thing in three characters and cannot be read as a button. */}
      <span style={{ fontSize: 8.5, fontWeight: 900, flexShrink: 0, letterSpacing: 0.4,
        color: contested ? "#ff8855" : "#ffd700",
        textShadow: `0 0 7px ${contested ? "#ff442288" : "#ffd70066"}` }}>
       ⭐{fameToWin}
      </span>
    </div>
  );
}
