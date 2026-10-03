// =============================================================================
// ui/MarqueeHand.jsx — 🃏 the acting player's MARQUEE PRIZE CARDS, in the rail.
// MARQUEE_QUIZ_DESIGN.md §10. Presentational, display only.
//
// Since 2026-09-29 (second pass) a card is PLAYED AT THE ROLL — the
// "🃏 Use a card" button above the battle's Roll button spins the hand out
// (`MarqueeCardPick.jsx`). The rail just shows what you are holding.
// =============================================================================
import { RailBtn } from "./ActionRail.jsx";

const GOLD = "#ffcc44";

/** @param {object[]} cards  card defs in hand order (`cardDef` from marqueeCards.js) */
export function MarqueeHand({ cards = [] }) {
  const held = cards.filter(Boolean);
  if (!held.length) return null;
  return (
    <RailBtn className="btn" disabled data-marquee-hand={held.length}
      style={{ borderColor: GOLD, color: GOLD, cursor: "help", opacity: 1 }}
      title={`🃏 Your cards:\n${held.map(c => `${c.icon} ${c.name} — ${c.text}`).join("\n")}\n\nPlay one at the roll: press "Use a card" above the Roll button in a Thrash or a Sonic.`}>
      🃏 {held.map(c => c.icon).join(" ")}
    </RailBtn>
  );
}
