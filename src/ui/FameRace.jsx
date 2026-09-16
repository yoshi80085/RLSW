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
//
// ═════════════════════════════════════════════════════════════════════════════
// 🎸 2026-09-16 — IT DRAWS TWO DIFFERENT SCOREBOARDS NOW.
//
// `WIN_CONDITIONS_DESIGN.md` split how a match ends into a setting, and on
// 2026-09-15 the DEFAULT became 🎸 Battle of the Bands: ten rounds, then the
// buzzer, and most Fame wins. That mode has **no finish line**, and this
// component was built entirely around one — `FAME_TRACK_REDESIGN.md` §1 counts
// `fameToWin` load-bearing in SEVEN places, starting with `at()`, which is not
// a number but the coordinate system.
//
// 🚨 AND IT WAS LYING RATHER THAN CRASHING. `battleFlow.fameToWin` returns
// Infinity in that mode precisely so nothing can be crowned — but the client
// never called it. `rlsw-simulator-v3_8_1.jsx` computed its own
// `startingLives × fpPerLife(playerCount)` and passed THAT, so the strip went on
// drawing a finish line at ⭐18, and tooltips went on reading "⭐7/18", through
// every match of a mode where neither the 18 nor the finish exists. A visible
// Infinity would have been found in a day; a plausible wrong number lasted.
//
// 🎯 THE SCALE IS 🅱️ FIXED (§3), AND THE REASON IS §2, NOT TASTE. The obvious
// answer — pin the leader to the right end, place everyone else by deficit —
// shows the gap perfectly and makes every other blip slide LEFT whenever the
// leader scores, though nobody else lost anything. Motion on this strip means
// "somebody scored"; a leader-anchored scale makes it mean "somebody scored, or
// somebody else did", and the player cannot tell which from the thing that is
// moving. A fixed scale is the only candidate where a blip moves **if and only
// if that Spirit scored**, which is every good property today's track has.
//
// 📏 Its right-hand end is `fameScaleFor(playerCount)` — MEASURED off 150
// matches a seat count, not guessed. See `data/gameConstants.js`.
// ═════════════════════════════════════════════════════════════════════════════

// ⭐ Gold means Fame — the shared colour table, also used by the HUD Fame bar.
import { FAME, FAME_NEUTRAL, fameSet } from "../data/fameTheme.js";
import { fameScaleFor } from "../data/gameConstants.js";

/**
 * @param spirits    the live spirit list (needs id, name, color, knockedOut)
 * @param fameOf     (spiritId) => current Fame — passed in so this file never
 *                   touches noteStates. Same shell/state split as ChannelStrip.
 * @param fameToWin  🏆 Legend Run's target. Infinity in Battle of the Bands,
 *                   where it is not used at all — see `scaleMax` below.
 * @param actingId   whose turn it is — their blip gets the ring
 * @param thresholds Stage-FX Fame thresholds, notched into the track
 * @param contested  the leader is inside striking distance of the target and a
 *                   rival is right behind them — presentation only, see
 *                   FAME_RACE_CONTESTED_LEAD in data/gameConstants.js
 * @param round      🎸 the current round, 1-based. Battle of the Bands only.
 * @param roundLimit 🎸 rounds before the buzzer, or null in Legend Run.
 *                   ⚠️ THIS IS THE MODE SWITCH. `roundLimit != null` is the one
 *                   test in this file; everything else reads `rounds` off it, so
 *                   there is no second definition of which game is being played.
 */
export function FameRace({ spirits, fameOf, fameToWin, actingId, thresholds = [],
                           contested = false, round = 1, roundLimit = null }) {
  const BLIP = 9;
  const board = (spirits ?? []).map(sp => ({ sp, fp: fameOf(sp.id) ?? 0 }));
  if (!board.length) return null;
  const live   = board.filter(b => !b.sp.knockedOut);
  /* ⚠️ SORTED, NOT FILTERED. The runner-up is "the second-highest SCORE ON THE
     BOARD", not "the highest score strictly below the leader" — those are the
     same number right up until the top is TIED, where the filter empties and
     the runner-up collapses to 0. A dead heat at ⭐28 then reported a margin of
     +28 and shaded the whole rail as though the leader were 28 clear, which is
     the exact failure this component's header exists to forbid: "the first
     thing the scoreboard ever tells you is a lie". Caught by SSR, not by eye. */
  const sortedFp = live.map(b => b.fp).sort((a, b) => b - a);
  const leadFp   = sortedFp[0] ?? 0;
  const secondFp = sortedFp[1] ?? 0;
  const margin   = leadFp - secondFp;

  /* 🎸 THE MODE, DERIVED ONCE. */
  const rounds = roundLimit != null;

  /* ⭐📏 THE COORDINATE SYSTEM — the single most important line in the file.
     In Legend Run it is the target, because reaching the target IS the game. In
     Battle of the Bands there is no target, so it is a measured scale keyed on
     how many are playing (`fameScaleFor`). ⚠️ NOT `fameToWin`, which is Infinity
     there and would collapse every blip onto 0.
     ⚠️ IT TAKES THE ROUND LIMIT TOO. A 20-round match scores roughly two and a
     half times a 10-round one — and not linearly, because fans compound — so a
     scale keyed on player count alone would put every long match off the chart
     and every short one bunched at the left. */
  const scaleMax = rounds ? fameScaleFor(board.length, roundLimit) : fameToWin;

  /* Blips are positioned by percentage but are 9px wide, so a spirit on 0 and a
     spirit on the scale's end would each hang half a blip off the end. The
     track's usable span is inset by one blip on each side and every position is
     mapped into THAT, which is why this is a calc() and not a bare percentage. */
  const frac = (fp) => Math.min(1, Math.max(0, fp / scaleMax));
  const at = (fp) => `calc(${BLIP / 2}px + ${frac(fp) * 100}% - ${BLIP}px * ${frac(fp)})`;

  // Ties fan sideways. Group by score first — see the ⚠️ above.
  const byScore = new Map();
  board.forEach(b => { const k = b.fp; byScore.set(k, [...(byScore.get(k) ?? []), b]); });

  /* 🎨 ONE TERNARY, AT THE TOP. `FAME` and `FAME_CONTESTED` carry the same role
     keys (data/fameTheme.js), so nothing below this line branches on `contested`
     again — which is what keeps this readout and the HUD Fame bar from drifting
     into two different reds. */
  const P = fameSet(contested);

  /* ⏳ THE CLOCK, AND WHY IT IS NOT A CHIP. `FAME_TRACK_REDESIGN.md` §6: the
     strip already carries `🔥💿 DISCO INFERNO — N rounds left`, and a second
     "N rounds left" pill beside it would read as the same KIND of thing — a
     temporary board effect — when it is in fact the match clock. So the clock
     takes the LEFT-HAND LABEL, a slot that was already wrong in this mode
     ("⭐ RACE" describes a race that is not happening), plus a muted fill along
     the rail. Different rank, different shape, and it costs no strip width —
     which §7 says is the scarce resource. */
  const roundsLeft = rounds ? Math.max(0, roundLimit - round + 1) : 0;
  const lastCall   = rounds && roundsLeft <= 1;
  const timeFrac   = rounds ? Math.min(1, Math.max(0, (round - 1) / roundLimit)) : 0;

  const leftLabel  = rounds ? (lastCall ? "🔥 LAST CALL" : `⏳ ${round}/${roundLimit}`)
                            : (contested ? "🤘 FINALE" : "⭐ RACE");
  const leftColor  = rounds && lastCall ? "#ff8a2a" : P.label;

  return (
    <div style={{ flex: 1, minWidth: 190, display: "flex", alignItems: "center", gap: 7 }}
      title={rounds
        ? `🎸 Battle of the Bands — round ${round} of ${roundLimit}. When the buzzer goes, the most Fame wins.`
        : `The Fame race — first to ${fameToWin} FP is crowned a Legend`}>
      <span style={{ fontSize: 7, letterSpacing: 1.4, fontWeight: 800, flexShrink: 0,
        color: leftColor,
        animation: lastCall ? "fame-danger 1.1s ease-in-out infinite" : undefined }}>
        {leftLabel}
      </span>

      <div style={{ position: "relative", flex: 1, height: BLIP + 4, minWidth: 90 }}>
        {/* the rail */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 5,
          transform: "translateY(-50%)", borderRadius: 3, background: P.ground,
          border: `1px solid ${P.edge}`, boxShadow: "inset 0 1px 2px #000a",
          overflow: "hidden",
          animation: contested ? "fame-danger 1.1s ease-in-out infinite" : undefined }}>
          {/* ⏳ Time elapsed, as a muted wash INSIDE the rail. ⚠️ Deliberately
              furniture-coloured and dim: on a strip where left-to-right means
              SCORE, a bright fill from the left would be read as somebody's
              progress. It is here for the peripheral sense of the match running
              out; the countable number is in the label. */}
          {rounds && (
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${timeFrac * 100}%`, background: `${P.mark}14`,
              borderRight: `1px solid ${P.mark}2a`,
              transition: "width .6s ease" }}/>
          )}
        </div>

        {/* 🎯 THE GAP AS A SHAPE (§5). A dim band on the rail from the runner-up
            to the leader, so "by how much" is a length and not only a number.
            §4: the gap is the SHAPE of the thing — and this costs no width. */}
        {rounds && margin > 0 && leadFp > 0 && (
          <div style={{ position: "absolute", top: "50%", height: 5,
            transform: "translateY(-50%)", left: at(secondFp),
            width: `calc(${(frac(leadFp) - frac(secondFp)) * 100}% - ${BLIP}px * ${frac(leadFp) - frac(secondFp)})`,
            background: `${P.mark}22`, borderRadius: 3, pointerEvents: "none" }}/>
        )}

        {/* 🎇 Stage-FX thresholds — the same notches the card bar draws, so the
            two readouts of the same milestones cannot drift apart. */}
        {thresholds.filter(t => t < scaleMax).map(t => (
          <div key={t} style={{ position: "absolute", top: "50%", height: 9,
            transform: "translateY(-50%)", width: 1.5, left: at(t),
            background: leadFp >= t ? `${P.lit}aa` : FAME_NEUTRAL.notchUnlit }}/>
        ))}

        {/* 🏁 THE FINISH LINE — ⚠️ LEGEND RUN ONLY.
            This is the element the whole redesign exists to remove. In Battle of
            the Bands there is nothing at the right-hand end to reach: the scale
            ends there, the GAME does not, and a bright bar pinned to the edge of
            a scoreboard is the single clearest way to say "get here and win".
            §4/§10: the race is not going away, so it still draws when there IS
            one. */}
        {!rounds && (
          <div style={{ position: "absolute", top: "50%", height: 11, width: 2,
            transform: "translateY(-50%)", right: 0, borderRadius: 1,
            background: P.mark,
            boxShadow: `0 0 6px ${P.glow}aa` }}/>
        )}

        {[...byScore.values()].map(group => group.map((b, i) => {
          const { sp, fp } = b;
          const out    = sp.knockedOut;
          const isLead = !out && fp === leadFp && leadFp > 0;
          const isYou  = sp.id === actingId;
          /* 📈 OFF THE CHART (§3🅱️). A fixed scale can be beaten, and a measured
             ~7–9% of matches do beat it. §3🅱️ calls that "an opportunity rather
             than a defect", so an over-run blip pins at the end and is MARKED,
             rather than silently clamping and reading as a bug. */
          const over = rounds && !out && fp > scaleMax;
          /* Fan tied blips INWARD from their shared point, never symmetrically
             about it. ⚠️ A CENTRED FAN WALKS OFF THE TRACK at exactly the two
             places ties are most likely: the start line, where every match
             begins with everyone on 0, and the finish, where a tie is the whole
             drama. Biasing by which half of the track the group sits in keeps
             the pack inside the rail at both ends, and leaves one blip sitting
             on the true mark instead of putting the mark between two of them.
             ⚠️ RE-DERIVED, NOT CARRIED OVER (§4). The rule was keyed to
             `fp / fameToWin`, which is `fp / Infinity` → 0 in this mode: every
             group would fan the same way and the pack at the top of the scale
             would walk straight off the right-hand end. It is keyed to the
             SCALE, whatever the scale currently is. */
          const dir = frac(fp) < 0.5 ? 1 : -1;
          const fan = i * (BLIP * 0.78) * dir;
          const behind = leadFp - fp;
          return (
            <div key={sp.id}
              title={rounds
                ? `${sp.name} — ⭐${fp}${
                    out ? " · knocked out"
                    : fp === leadFp ? (leadFp > 0 ? ` · leading by ${margin}` : " · level, nobody has scored")
                    : ` · ${behind} behind`}${over ? " · off the chart" : ""}`
                : `${sp.name} — ⭐${fp}/${fameToWin}${
                    out ? " · knocked out"
                    : fp === leadFp ? (leadFp > 0 ? " · leading" : " · level, nobody has scored")
                    : ` · ${behind} behind`}`}
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
                  /* ⚠️ `FAME`, NOT `P` — the crown stays gold even in the FINALE.
                     It is not furniture reporting the state of the race, it is
                     the thing being raced FOR, and a red crown reads as "the
                     crown is in danger" rather than "the lead is". */
                  pointerEvents: "none", textShadow: `0 0 5px ${FAME.glow}` }}>👑</span>
              )}
              {over && (
                <span style={{ position: "absolute", left: "calc(100% + 1px)", top: "50%",
                  transform: "translateY(-50%)", fontSize: 7, lineHeight: 1,
                  color: sp.color, pointerEvents: "none",
                  textShadow: `0 0 4px ${sp.color}` }}>»</span>
              )}
            </div>
          );
        }))}
      </div>

      {/* 🏆 THE RIGHT-HAND SLOT.
          In 🏆 Legend Run it names the finish line, which is what it was built
          for: a race track with its finish labelled says "first to N" in three
          characters and cannot be read as a button.
          🎯 In 🎸 Battle of the Bands there is no finish line to name, so §5
          takes the vacated slot for the question Alex actually asked — "by HOW
          MUCH is the winner winning". `+N` is the smallest, most direct answer,
          and it is narrower than the `⭐N` it replaces, which matters at the
          `minWidth:190` §7 warns about.
          ⚠️ THREE STATES, NOT ONE. `+0` is noise at kickoff and a lie at a dead
          heat: at 0–0 nobody is ahead (`–`), and a tie at a real score is the
          most dramatic thing this strip can say (`=`), not a zero. */}
      <span style={{ fontSize: 8.5, fontWeight: 900, flexShrink: 0, letterSpacing: 0.4,
        color: rounds && leadFp === 0 ? P.label : P.value,
        textShadow: rounds && leadFp === 0 ? "none" : `0 0 7px ${P.glow}${P.haloA}` }}
        title={rounds
          ? (leadFp === 0 ? "Nobody has scored yet"
             : margin === 0 ? "Dead heat at the top"
             : `The leader is ${margin} clear of second place`)
          : undefined}>
       {rounds
         ? (leadFp === 0 ? "–" : margin === 0 ? "=" : `+${margin}`)
         : `⭐${fameToWin}`}
      </span>
    </div>
  );
}
