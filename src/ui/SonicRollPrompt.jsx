import { useEffect, useState } from 'react';

// ─── 🎲 THE BATTLE ROLL PROMPT — both staged battles, both throws ───────────
// PRESENTATION ONLY: the engine has already rolled and stored every face before
// this mounts, so pressing ROLL decides *when* the table sees the result, never
// what it is. Nothing here dispatches an action or touches the seeded stream.
//
// ⭐ 2026-09-24: one prompt for every throw in a Sonic or a Swing — the Rival's
// shield, the attacker's volley, either side's Swing. `prompt` says WHO is
// rolling and WHY (`lead`/`sub`), and:
//   • a local human sees a ROLL button with a countdown — Alex: "give at least
//     5 seconds before auto rolling" (the client owns the timer; `autoAt` is
//     only what the countdown reads);
//   • a remote human's throw shows `waiting` — the same card, no button;
//   • a bot never mounts this at all.
export function SonicRollPrompt({ prompt, onRoll }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!prompt?.autoAt) return;
    const timer = setInterval(() => tick(n => n + 1), 250);
    return () => clearInterval(timer);
  }, [prompt?.autoAt]);
  if (!prompt) return null;
  const { lead = 'Roll', sub = '', label = 'Roll', color = '#66dcff', waiting = false, autoAt = null } = prompt;
  const left = autoAt == null ? null : Math.max(0, Math.ceil((autoAt - performance.now()) / 1000));
  return (
    <div className="sonic-roll-prompt" role="group" aria-label={waiting ? lead : `${lead} — roll`} data-roll-waiting={waiting ? "" : undefined}>
      <style>{`
        .sonic-roll-prompt {
          position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%);
          z-index: 90; display: flex; align-items: center; gap: 14px;
          padding: 11px 14px 11px 18px; border-radius: 10px;
          border: 1px solid #9dbfe44d;
          background: linear-gradient(155deg, #edf6ff14, transparent 42%), #070f1fef;
          box-shadow: 0 10px 34px #000a, inset 0 1px #ffffff1f;
          backdrop-filter: blur(14px) saturate(1.2);
          font-family: 'Share Tech Mono', 'Courier New', monospace;
          max-width: calc(100vw - 24px);
        }
        .sonic-roll-prompt .srp-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .sonic-roll-prompt .srp-lead { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #e8f6ff; }
        .sonic-roll-prompt .srp-sub { font-size: 10px; letter-spacing: .1em; color: #7f9ab8; }
        .sonic-roll-prompt .srp-sub b { color: #cfe4f7; font-weight: 400; }
        .sonic-roll-prompt button {
          flex: 0 0 auto; cursor: pointer; font-family: inherit;
          font-size: 14px; letter-spacing: .18em; text-transform: uppercase;
          padding: 11px 22px; border-radius: 7px; color: #04101c;
          border: 1px solid var(--srp-accent); background: var(--srp-accent);
          box-shadow: 0 0 0 1px #ffffff1f inset, 0 0 24px -4px var(--srp-accent);
          animation: srp-breathe 1.9s ease-in-out infinite;
        }
        .sonic-roll-prompt button:hover { filter: brightness(1.12); }
        .sonic-roll-prompt button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
        @keyframes srp-breathe { 50% { box-shadow: 0 0 0 1px #ffffff1f inset, 0 0 8px -4px var(--srp-accent); } }
        @media (prefers-reduced-motion: reduce) { .sonic-roll-prompt button { animation: none; } }
        @media (max-width: 560px) {
          .sonic-roll-prompt { left: 12px; right: 12px; transform: none; bottom: 14px; }
          .sonic-roll-prompt button { padding: 10px 14px; font-size: 12px; }
        }
      `}</style>
      <div className="srp-copy">
        <span className="srp-lead">{lead}</span>
        <span className="srp-sub">{sub}{left != null ? <> · <b>{waiting ? `rolls in ${left}s` : `auto-roll in ${left}s`}</b></> : null}</span>
      </div>
      {waiting ? null : (
        <button type="button" style={{ '--srp-accent': color }} onClick={onRoll} autoFocus>
          {label}
        </button>
      )}
    </div>
  );
}
