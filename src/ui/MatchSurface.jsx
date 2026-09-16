import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import ArenaDial, { DIAL_CSS } from './ArenaDial.jsx';
import Bracket, { BRACKET_CSS } from './Bracket.jsx';
import NoteHex from './NoteHex.jsx';
// ⚠️ The board's own panels live in NoteCommitOverlay, but their CSS ships
// here: `.match-surface` renders in BOTH layouts and is always an ancestor of
// them, so the arena keeps ONE stylesheet instead of three.
import { COMMIT_CSS } from './NoteCommitOverlay.jsx';

const SurfaceContext = createContext({ immersive: false, panel: 'turn' });
// The pocket's own internal gap. The step-1 drawer sits below the pocket, so it
// is separated from SOUND by the same air SOUND is separated from SPIRIT by —
// which is what makes the three read as one column of frames rather than a stack
// with one panel resting on another.
const HUD_POCKET_GAP = 7;
// 🟢 THE ROOT'S COLOUR IS NOT A NEW CHOICE. Seat 0 of the commit track has drawn
// the root in '#44ff88' since the track existed; the badge borrows it so the
// letter in the pocket and the letter on the bar are visibly the same fact.
// 🩷 And '#ff99dd' is the KEY PLATE's own "your track ended on X" pink, for the
// span where this is next round's root rather than this one's.
const ROOT_C = '#44ff88', NEXT_ROOT_C = '#ff99dd';

/* 🔑 THE ROOT IN THE SPIRIT CARD — why it is here, and why that is not the badge
 * that was retired.
 *
 * 📌 A 48px root badge came out of the note-stock panel on 2026-08-29 for
 * duplicating the KEY PLATE a few inches below it. This is not that: the plate
 * lives in `HudRegion name="spirit"`, and in the arena exactly ONE region is
 * disclosed at a time. During the chord and melody steps the Turn region is the
 * one that is up, so the root — the note every choice in those two steps is
 * measured against — is behind a nav chip. Alex, 2026-09-12, looking at the gap
 * beside the portrait: *"can you put the Root note for the melody for that turn
 * here?"*
 * ⚠️ THE ONE STATE WHERE BOTH ARE ON SCREEN is a tutorial, which discloses every
 * region at once. That is transient and supervised; the 2026-08 complaint was a
 * permanent side-by-side in one column.
 *
 * ⚠️ AND THE ROOT MEANS TWO DIFFERENT THINGS DEPENDING ON WHEN YOU ASK. Commit
 * writes the track's last note straight into `rootNote`, so from the commit
 * onward this is NEXT round's letter, not the one the turn was played against.
 * `KeyPlate` already solved that by saying so; the badge says so the same way
 * rather than inventing a second policy, or quietly printing a letter that is
 * true of a turn you have already finished. */
function RootBadge({ root, next }) {
  if (!root) return null;
  return <span className="match-player-key" data-next={next || undefined}
    aria-label={`${next ? 'Next round root note' : 'Root note'} ${root}`}>
    <NoteHex hue={next ? NEXT_ROOT_C : ROOT_C} letter={root} size={40} />
    <small>{next ? 'NEXT' : 'ROOT'}</small>
  </span>;
}

/* 📌 THE DRAWER MEASURES THE POCKET; IT DOES NOT ASSUME IT.
 *
 * ⚠️ THIS REPLACED A HARDCODED `top:266px`, AND THE NUMBER WAS THE BUG. The
 * pocket is SPIRIT + 7px + SOUND, absolutely positioned at 58px, and 266 was the
 * sum of those boxes at the one font stack and one spirit the number was read
 * on. Every input to that sum is live: SOUND's height is driven by `ArenaDial`'s
 * `max-width:74px` against whatever column the pocket's width leaves it, the
 * card carries a spirit name and a VIBE rail of `maxVibe` pips, and both
 * breakpoints move the pocket and narrow it. Any of those growing past 208px of
 * content puts the drawer's frame — and its nameplate, which straddles its top
 * edge — on top of SOUND. A measured floor cannot drift; a constant did.
 *
 * 📌 `ResizeObserver` IS GUARDED and the CSS keeps `266px` as its fallback: the
 * DOM journey suites run this component under jsdom, where the observer does not
 * exist, and SSR never runs the effect at all. Both get today's layout rather
 * than a drawer stuck at the top of the arena.
 *
 * ⚠️ BOTH ELEMENTS SHARE ONE OFFSET PARENT — the surface root, which
 * `[data-match-layout="immersive"]` makes `position:relative`. That is the only
 * reason `offsetTop + offsetHeight` is directly comparable with the drawer's
 * `top`; a positioned element introduced between them would need this to switch
 * to `getBoundingClientRect` against the root. */
function usePocketFloor(immersive) {
  const rootRef = useRef(null);
  const pocketRef = useRef(null);
  useEffect(() => {
    const root = rootRef.current, pocket = pocketRef.current;
    if (!immersive || !root || !pocket) return undefined;
    const measure = () => root.style.setProperty('--hud-pocket-floor',
      `${Math.round(pocket.offsetTop + pocket.offsetHeight + HUD_POCKET_GAP)}px`);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    // The pocket grows with its CONTENT (a longer spirit name, more VIBE pips)
    // and with the ROOT (both breakpoints narrow it, which makes the dials
    // shorter), so both are watched.
    const ro = new ResizeObserver(measure);
    ro.observe(pocket); ro.observe(root);
    return () => ro.disconnect();
  }, [immersive]);
  return [rootRef, pocketRef];
}
const STEPS = { chord: '1 · Build chord', melody: '2 · Compose melody', move_act: '3 · Move & act' };
const STEP_ORDER = ['chord', 'melody', 'move_act'];
const ACTION_LABELS = {
  move: 'Choose a lit hex', face: 'Choose a facing', swing: 'Choose a Swing target',
  smash: 'Choose a Smash target', sonic: 'Choose a Sonic target', shukuchi: 'Choose a Shukuchi landing',
  psycho_bushido: 'Choose a Bushido target', move_shadow: 'Move the Shadow',
};
// Layout owns only disclosure state. Game owns turns, permissions and all actions.
// Keep these wrappers mounted in both views: conditional trees/portals here would
// remount note controls and the live SVG while a player is composing or targeting.
export function MatchSurface({ immersive, spirit, turnNumber, step, canAct, ap, tutorial, hud, children }) {
  const [selection, setSelection] = useState(null);
  const id = useId();
  // A new turn always brings its controls back, without remounting any content.
  const owner = `${turnNumber}:${spirit?.id}:${step}`;
  const panel = selection?.owner === owner ? selection.panel : 'turn';
  const select = next => setSelection({ owner, panel: next === panel ? null : next });
  // Tutorials can point at any original HUD anchor, including collapsed details.
  // Show all panels during a walkthrough so its internal page changes stay valid.
  const context = { immersive, panel, tutorial, id };
  /* 🪦 THE "NOW" WINDOW IS GONE, 2026-09-12, AND THIS IS WHAT IT KNEW.
   * It was a third bracket at bottom-centre whose headline was the STEP NAME —
   * which the phase rail above already prints, and which the step-3 drawer
   * prints again on its own title row. Three statements of one fact, and the
   * bottom-centre one overlapped both the drawer and the arena camera strip.
   * Alex: *"I'm not really sure the Now window really needs to even exist."*
   * 🎯 SO ONLY THE TWO LIVE FACTS SURVIVE, and they move ONTO the rail's active
   * step rather than into a window of their own — the rail was already saying
   * WHICH step, so it is the one place where "and here is how much of it you
   * have left" is not a repetition.
   * ⚠️ THE TARGETING PROMPT OUTRANKS THE COUNT. "Choose a Swing target" is a
   * question the game is waiting on an answer to; AP remaining is background. */
  const liveDetail = !canAct ? 'Watching their turn'
    : ACTION_LABELS[hud?.action]
      ?? (step === 'move_act' ? `${ap} AP remaining`
        : hud?.noteCount != null ? `${hud.noteCount} notes available` : null);
  const [rootRef, pocketRef] = usePocketFloor(immersive);
  return <SurfaceContext.Provider value={context}>
    <div ref={rootRef} className="match-surface" data-match-layout={immersive ? 'immersive' : 'classic'}
      data-match-step={step} data-hud-tutorial={tutorial || undefined}>
      <style>{SURFACE_CSS}</style>
      {immersive && <>
        <div className="match-phase-rail" aria-label="Turn progress">
          {STEP_ORDER.map((name, index) => {
            const state = name === step ? 'now' : STEP_ORDER.indexOf(step) > index ? 'done' : 'later';
            // ⚠️ `data-state` and the text stay exactly where they were: the arena
            // suite reads this element's textContent for /BUILD CHORD/i.
            return <Bracket key={name} corner="sm" open={state !== 'now'}
              className="match-phase-step" data-state={state}>
              <span><i>{String(index + 1).padStart(2, '0')}</i>{STEPS[name].split(' · ')[1]}</span>
              {state === 'now' && liveDetail && <em className="match-phase-live">{liveDetail}</em>}
              <b className="match-phase-bars" aria-hidden="true">
                {[0, 1, 2].map(k => <i key={k} data-on={state === 'done' || (state === 'now' && k < 2) || undefined} />)}
              </b>
            </Bracket>;
          })}
        </div>
        <aside ref={pocketRef} className="match-player-pocket" aria-label="Active spirit summary">
          <Bracket plate="SPIRIT" className="match-player-frame" color="var(--hud-spirit,#7fe0ff)"
            style={{ '--hud-spirit': spirit?.color || '#7fe0ff' }}>
          <button className="match-player-card" onClick={() => select('spirit')}
            aria-expanded={tutorial || panel === 'spirit'} aria-controls={`${id}-spirit`}>
            {hud?.imageSrc && <span className="match-player-art"><img src={hud.imageSrc} alt="" /></span>}
            <span className="match-player-copy">
              <small>{canAct ? `YOUR TURN · ${String(turnNumber).padStart(2, '0')}` : `TURN ${String(turnNumber).padStart(2, '0')}`}</small>
              <strong style={{ color: spirit?.color }}>{spirit?.name ?? 'Arena'}</strong>
              <span className="match-vibe">
                <i aria-hidden="true" style={{ color: spirit?.color }}>
                  {Array.from({ length: Math.max(1, Math.min(12, hud?.maxVibe || 1)) }, (_, k) => {
                    const on = k < (hud?.vibe ?? 0);
                    return <b key={k} data-on={on || undefined} data-head={on && k === (hud?.vibe ?? 0) - 1 || undefined} />;
                  })}
                </i>VIBE {hud?.vibe ?? '—'}/{hud?.maxVibe ?? '—'}</span>
            </span>
            <RootBadge root={hud?.root} next={hud?.rootIsNext} />
            <span className="match-player-more">＋</span>
          </button>
          </Bracket>
          <Bracket plate="SOUND" className="match-sound-frame">
          <div className="match-sound-readout">
            <span className="drive" data-immersive-stack="drive" data-dial-value={hud?.drive ?? undefined}
              role="img" aria-label={`Drive ${hud?.drive ?? "unknown"} of 10`} ref={hud?.driveRef}>
              <ArenaDial stat="drive" label="DRIVE" value={hud?.drive} snapKey={spirit?.id} /></span>
            <span className="sustain" data-immersive-stack="sustain" data-dial-value={hud?.sustain ?? undefined}
              role="img" aria-label={`Sustain ${hud?.sustain ?? "unknown"} of 10`} ref={hud?.sustainRef}>
              <ArenaDial stat="sustain" label="SUSTAIN" value={hud?.sustain} snapKey={spirit?.id} /></span>
            <span><small>Db</small><b>{hud?.db ?? '—'}</b></span>
            <span><small>FANS</small><b>{hud?.fans ?? '—'}</b></span>
          </div>
          </Bracket>
        </aside>
        <div className="match-hud-bar">
          <nav aria-label="Arena panels" className="match-panel-nav">
            {[['turn', 'Turn'], ['spirit', 'Spirit'], ['rivals', 'Rivals']].map(([name, label]) =>
              <button key={name} className="match-nav-chip" aria-expanded={tutorial || panel === name}
                aria-controls={`${id}-${name}`} onClick={() => select(name)}>{label}</button>)}
          </nav>
        </div>
      </>}
      {children}
    </div>
  </SurfaceContext.Provider>;
}

export function HudRegion({ name, children }) {
  const { immersive, panel, tutorial, id } = useContext(SurfaceContext);
  return <section id={`${id}-${name}`} data-hud-region={name}
    data-hud-current={immersive && (tutorial || panel === name) || undefined}
    aria-label={name === 'turn' ? 'Turn controls' : name === 'spirit' ? 'Active spirit details' : 'Rival spirits'}
    hidden={immersive && !tutorial && panel !== name}>
    {children}
  </section>;
}

// The CSS is intentionally a layout contract, not a replacement skin. A later
// presentation pass can restyle each named region without moving game handlers.
const SURFACE_CSS = `
  .match-surface { display:grid; grid-template-columns:minmax(430px,480px) minmax(0,1fr); gap:12px; align-items:start; flex:1; min-width:0; }
  .match-hud-column { display:flex; flex-direction:column; gap:0; min-width:0; }
  [data-hud-region] { min-width:0; }
  .match-board-column { display:flex; flex-direction:column; align-items:center; position:relative; min-width:0; }
  .match-board-frame { position:relative; width:100%; max-width:1040px; overflow:visible; border-radius:8px; border:1px solid #1a2a40; }
  /* 🔑 '--root-hex' RIDES WITH THE OTHER LAYOUT CONSTANTS ON PURPOSE, so the
     badge follows the pocket down through both breakpoints from one place and a
     preview page can drive it live by setting the variable on this element.
     Dialled on '.scratch/root-note-size.html'. */
  [data-match-layout="immersive"] { --hud-edge:12px; --hud-pocket:238px; --root-hex:52px; position:relative; display:block; height:calc(100dvh - 76px); min-height:640px; flex:none; isolation:isolate; }
  [data-match-layout="immersive"] .match-hud-column { display:contents; }
  [data-match-layout="immersive"] .match-board-column,
  [data-match-layout="immersive"] .match-board-frame { position:absolute; inset:0; width:100%; height:100%; max-width:none; }
  .match-phase-rail { position:absolute; top:13px; left:50%; z-index:41; transform:translateX(-50%); display:flex; align-items:center; gap:18px; pointer-events:none; white-space:nowrap; }
  .match-phase-rail .rlsw-brk-plate { display:none }
  .match-phase-step { display:flex; flex-direction:column; padding:5px 11px 6px; color:#33496b; }
  .match-phase-step > .rlsw-brk-body > span { display:flex; gap:6px; align-items:center; color:#4d627e;
    font-size:8px; letter-spacing:1.1px; text-transform:uppercase; white-space:nowrap; }
  .match-phase-step i { font-style:normal; color:#536b88 }
  .match-phase-bars { display:flex; gap:2px; height:2px; margin-top:5px }
  .match-phase-bars i { flex:1; background:#1d2e4a }
  .match-phase-bars i[data-on] { background:currentColor; box-shadow:0 0 5px currentColor }
  .match-phase-step[data-state="done"] { color:#3f5f85 }
  .match-phase-step[data-state="done"] > .rlsw-brk-body > span { color:#7895b8 }
  .match-phase-step[data-state="now"] { color:#80e8ff }
  .match-phase-step[data-state="now"] > .rlsw-brk-body > span { color:#dceaff; text-shadow:0 0 10px #80e8ff66 }
  .match-phase-step[data-state="now"] i { color:#80e8ff }
  .match-player-pocket { position:absolute; left:var(--hud-edge); top:58px; z-index:42; width:var(--hud-pocket); display:flex; flex-direction:column; gap:7px; color:#dceaff; }
  /* 🪦 THE FROSTED SLAB IS GONE. This rule gave the card and the readout a
     gradient fill, an inset white gloss and 'backdrop-filter: blur(14px)'. Blur
     destroys the detail behind it even at low alpha, and these sit directly on
     the Cosmic Arena. The frame is a bracket now — see 'ui/Bracket.jsx'. */
  .match-player-frame, .match-sound-frame { width:100%; box-sizing:border-box }
  .match-player-frame { --brk-scrim:rgba(6,12,26,.44) }
  .match-sound-frame { --brk-scrim:rgba(6,12,26,.34) }
  /* ⭐ THE CARD GROWS WITH THE BADGE, AND THAT IS SAFE NOW. 'min-height' not
     'height': a taller root hex makes this card taller, which pushes SOUND down,
     which moves the step-1 drawer — all of which 'usePocketFloor' measures rather
     than assumes. Before that hook this constant could not have moved at all. */
  .match-player-card { min-height:72px; padding:9px; display:flex; align-items:stretch; gap:9px;
    color:#dceaff; text-align:left; cursor:pointer; background:none; border:0; width:100%; font:inherit }
  .match-player-frame:hover > .rlsw-brk-c { opacity:1 }
  .match-player-frame:hover > .rlsw-brk-e { opacity:.34 }
  .match-player-art { width:44px; position:relative; overflow:hidden; background:#0b1222; flex:none;
    clip-path:polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px);
    box-shadow:inset 0 0 0 1px #7fe0ff33 }
  .match-player-art img { position:absolute; width:62px; height:88px; left:50%; top:0; transform:translateX(-50%); object-fit:cover; object-position:top center; opacity:.82; }
  .match-player-copy { min-width:0; flex:1; display:flex; flex-direction:column; justify-content:center; }
  .match-player-copy small { color:#7790b0; font-size:6px; letter-spacing:1.5px; }
  .match-player-copy strong { margin:4px 0 7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:700 12px 'Saira',sans-serif; }
  .match-vibe { display:flex; align-items:center; gap:5px; color:#8da1bd; font-size:7px; white-space:nowrap; }
  .match-vibe > i { display:flex; gap:2px; width:70px; height:3px }
  .match-vibe > i > b { flex:1; background:#22324c }
  .match-vibe > i > b[data-on] { background:currentColor; box-shadow:0 0 6px currentColor }
  .match-vibe > i > b[data-head] { background:#fff }
  .match-player-more { align-self:flex-start; color:#7790b0; font-size:13px; }
  /* 🔑 THE ROOT BADGE, in the air the copy column leaves beside the name.
     📌 THE SVG IS SIZED IN CSS, NOT BY THE 'size' PROP. NoteHex writes width and
     height as ATTRIBUTES, which CSS outranks without !important — so the badge
     can follow the pocket down through both breakpoints from here instead of
     needing a hand-written size at each one, exactly as '.rlsw-dial' does. */
  .match-player-key { flex:none; align-self:center; display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:1px; color:${ROOT_C}; }
  .match-player-key[data-next] { color:${NEXT_ROOT_C} }
  .match-player-key svg { width:var(--root-hex,52px); height:var(--root-hex,52px) }
  .match-player-key small { font:400 5.6px 'Saira Stencil One',sans-serif;
    letter-spacing:1.7px; color:currentColor; opacity:.92; }
  .match-sound-readout { padding:10px; display:grid; grid-template-columns:1fr 1fr 42px; grid-template-rows:1fr 1fr; gap:6px; min-height:92px; }
  .match-sound-readout > span { min-width:0; padding-right:6px; border-right:1px solid #93acd21f; }
  .match-sound-readout > span:last-child { border:0; padding:0; }
  .match-sound-readout small { display:block; color:#7187a4; font-size:6px; letter-spacing:.8px; }
  .match-sound-readout b { display:block; margin-top:3px; color:#dceaff; font-size:12px; }
  .match-sound-readout .drive, .match-sound-readout .sustain { grid-row:1 / 3; position:relative; display:flex; align-items:center; justify-content:center; padding:0 1px; border-right:1px solid #93acd21f; }
  .match-sound-readout .drive { color:#ff6644; }
  .match-sound-readout .sustain { color:#44aaff; }
  /* 🎸 THE STEP-1 DRAWER'S CHROME — unscoped ON PURPOSE. This drawer renders in
     BOTH layouts (it is a child of the HUD column either way), and the bracket
     language is now the game's language in both, so scoping these under
     [data-match-layout="immersive"] would leave the 2D board wearing the panel
     the arena just retired. */
  /* the chamfered chip — the same two stacked clip-paths as .match-nav-chip,
     because a real CSS border cannot follow a 45 degree cut. */
  .stack-chip { position:relative; border:0; cursor:pointer; isolation:isolate; font:600 8.5px 'Saira',sans-serif;
    letter-spacing:1.3px; text-transform:uppercase; padding:6px 9px; color:#8fb0d4; background:#46648c;
    flex:none; transition:color .15s, background .15s;
    clip-path:polygon(7px 0,calc(100% - 7px) 0,100% 7px,100% calc(100% - 7px),
      calc(100% - 7px) 100%,7px 100%,0 calc(100% - 7px),0 7px) }
  .stack-chip::before { content:''; position:absolute; inset:1px; background:#070f1de6; z-index:-1;
    clip-path:polygon(6.3px 0,calc(100% - 6.3px) 0,100% 6.3px,100% calc(100% - 6.3px),
      calc(100% - 6.3px) 100%,6.3px 100%,0 calc(100% - 6.3px),0 6.3px) }
  .stack-chip:hover:not(:disabled) { color:#d5eaff; background:#6f9ac9 }
  /* ⚠️ THE ARMED CHIP TAKES ITS COLOUR INLINE, from the stat it belongs to —
     Drive red, Sustain blue — so this rule only has to darken the inner plate. */
  .stack-chip[aria-pressed="true"]::before { background:#0c1a2ae6 }
  .stack-chip:disabled { opacity:.32; cursor:not-allowed }
  .stack-chip.is-go { width:100%; color:#7fe6b0; background:#2f7f5a; text-align:center }
  .stack-chip.is-go:hover { color:#d9fff0; background:#3fa876 }
  /* the commit budget, as segments on the frame line */
  .stack-budget { display:inline-flex; gap:3px; align-items:center; vertical-align:middle }
  .stack-budget i { width:11px; height:3px; background:color-mix(in srgb,currentColor 26%,#16253f) }
  .stack-budget i[data-on] { background:currentColor; box-shadow:0 0 6px currentColor }
  ${DIAL_CSS}
  ${BRACKET_CSS}
  ${COMMIT_CSS}
  .match-hud-bar { position:absolute; inset:0; z-index:43; pointer-events:none; }
  /* 🪦 '.match-turn-summary' — the NOW window — stood here. See the note beside
     'liveDetail'. Its two live facts are the line below; its headline was the
     step name, which two other elements were already printing. */
  .match-phase-live { display:block; margin-top:4px; max-width:210px; font-style:normal;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    font-size:7.5px; letter-spacing:.6px; color:#dceaff; }
  .match-panel-nav { position:absolute; top:58px; right:var(--hud-edge); display:flex; gap:6px; align-items:flex-start; pointer-events:auto; }
  /* the nav chips: a 45° chamfer drawn as two stacked clip-paths, because a real
     CSS border cannot follow one. ⚠️ THE BUTTON KEEPS THE LABEL AS ITS ONLY TEXT
     — the arena suite finds it with 'el.textContent === 'Spirit''. */
  .match-nav-chip { position:relative; padding:10px 15px; border:0; cursor:pointer;
    font:600 9.5px 'Saira',sans-serif; letter-spacing:1.4px; text-transform:uppercase;
    color:#8fb0d4; background:#46648c; pointer-events:auto; isolation:isolate;
    clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),
      calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px) }
  .match-nav-chip::before { content:''; position:absolute; inset:1px; background:#070f1de6; z-index:-1;
    clip-path:polygon(7.3px 0,calc(100% - 7.3px) 0,100% 7.3px,100% calc(100% - 7.3px),
      calc(100% - 7.3px) 100%,7.3px 100%,0 calc(100% - 7.3px),0 7.3px) }
  .match-nav-chip:hover { color:#cfe6ff; background:#6f9ac9 }
  .match-nav-chip[aria-expanded="true"] { background:#80e8ff; color:#d9f4ff }
  .match-nav-chip[aria-expanded="true"]::before { background:#0c2b3ae6 }
  /* 🪦 The drawers were the fifth frosted slab. Same treatment: a flat scrim and
     a chamfered edge, so the arena still reads behind an open panel. */
  [data-match-layout="immersive"] [data-hud-region] { position:absolute; left:var(--hud-edge); bottom:58px;
    width:480px; max-width:calc(100% - 24px); max-height:calc(100% - 150px); overflow:auto; overflow-x:hidden;
    overscroll-behavior:contain; padding:12px; box-sizing:border-box; z-index:44; scrollbar-width:thin;
    background:rgba(6,12,26,.46); box-shadow:inset 0 0 0 1px #80e8ff1f;
    clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 9px,100% calc(100% - 9px),
      calc(100% - 9px) 100%,9px 100%,0 calc(100% - 9px),0 9px) }
  [data-match-layout="immersive"] [data-hud-region][data-hud-current] { box-shadow:inset 0 0 0 1px #80e8ff4d,0 0 26px -8px #80e8ff }
  [data-match-layout="immersive"] [data-hud-region][hidden] { display:none; }
  [data-match-layout="immersive"] [data-hud-region="turn"] { max-height:48%; }
  /* 🪦 THE FLOATING STEP-3 DOCK IS GONE, 2026-09-12. It sat bottom-centre over
     the arena at 'min(740px, …)' wide — which it had to, while steps 1 and 2
     owned the HUD column. But once the chord and melody panels come down the
     column below SOUND is empty for the whole of step 3. Alex: *"once the
     chord/melody commits are done and out of the way the space opens back up
     below the Sound window — lets put the Move and Act window below that."*
     Dialled on '.scratch/step3-dock.html'.
     🎯 SO ALL THREE STEPS DOCK IN ONE PLACE — the rule below is a selector list,
     not three positions. The step changes WHAT is in the column, never where the
     column is, and the arena floor is left to the arena.
     ⭐ IT ALSO RETIRED A NUMBER COUPLED TO ANOTHER FILE. The old dock had to clear
     '.arena-camera-toolbar' in 'ui/BoardViewport.jsx' by hand, so that toolbar
     growing a row would silently break this one. It no longer goes near it: the
     coupling is deleted rather than tuned.
     ⚠️ AND IT IS WHY 'ActionRail' TAKES 'stack'. At 238px the rail's 40/60 column
     split leaves UNIVERSAL about 84px — narrower than the 'Sonic 4d6 (2AP)'
     button on its own. The arena passes 'stack={board3D}'; the 2D board's rail is
     ~470px and keeps its columns. */
  /* ⚠️ 266px IS THE FALLBACK, NOT THE NUMBER. '--hud-pocket-floor' is written by
     'usePocketFloor' from the pocket's real rendered bottom plus its own 7px gap
     — see the note above the hook for why a constant could not hold this. The
     72px below is the bottom furniture (the turn summary and its margin) that
     the drawer must not run into, and is unrelated to the pocket. */
  [data-match-layout="immersive"][data-match-step="chord"] [data-hud-region="turn"],
  [data-match-layout="immersive"][data-match-step="melody"] [data-hud-region="turn"],
  [data-match-layout="immersive"][data-match-step="move_act"] [data-hud-region="turn"] { top:var(--hud-pocket-floor,266px); bottom:auto; width:var(--hud-pocket); max-height:calc(100% - var(--hud-pocket-floor,266px) - 72px); padding:7px 0 2px; overflow-y:auto; overflow-x:hidden; scrollbar-width:thin; background:none; border:0; box-shadow:none; clip-path:none; }
  /* ⚠️ THE DRAWER IS THE ONE SCROLLER, AND THAT IS THE WHOLE FIX FOR THE BLEED.
     It used to be 'overflow:visible' with '.match-note-stock' inside doing the
     scrolling against its OWN max-height — and the two were measured off
     DIFFERENT BOXES: this one is 100% of the arena root, that one was 100dvh of
     the VIEWPORT. The root is 'calc(100dvh - 76px)' with a 'min-height:640px'
     floor, so on any short window the inner box was allowed to be hundreds of
     pixels taller than the outer one, and being 'visible' the outer one let it
     hang straight out of the bottom of the arena. Alex, 2026-09-12, with a
     screenshot of the note pool sitting on his editor's status bar: *"the note
     pool area bleeds way off the 3D arena into the bottom… make sure nothing
     ever bleeds out of the immersive 3D board area."*
     🎯 SO THERE IS NOW EXACTLY ONE MAX-HEIGHT AND ONE OVERFLOW IN THIS CHAIN,
     both on this element, both measured against the root. A second scroller
     inside it can only ever disagree with it again.
     📌 The 7px of top padding is the bracket nameplate's clearance, moved here
     with the overflow — a scroller with no top padding slices 'CHORD STACK'
     through the middle. It is clearance, not spacing; the horizontal padding
     must stay 0 or the frames stop lining up with SPIRIT and SOUND. */
  /* 🪦 THE OUTER WINDOW DIED HERE, 2026-09-12c. This rule wrapped the step-1
     drawer in a SECOND chamfered box — a flat scrim, a 1px cyan outline and its
     own 9px clip-path — around the CHORD STACK bracket, which draws all three of
     those things itself. Two frames deep, and its 12px of horizontal padding made
     the inner one 214px against SPIRIT and SOUND's 238px, so it read as a panel
     inside a panel rather than the third frame in one column. Alex, 2026-09-12:
     *"I'd like this window gone so the Chord stack window can match up with the
     other 2."*
     ⚠️ WHAT IT STILL HAS TO DO IS SCROLL. The stock grid is eleven notes for the
     Ronin in a 238px column, so this element is the scroller whether or not it is
     also a box — which is why the overflow and the max-height survive while every
     painted property goes.
     ⚠️ AND THE REMAINING VERTICAL PADDING IS NOT SPACING, IT IS CLEARANCE. The
     bracket's nameplate straddles its own top edge ('translateY(-50%)'), so a
     scroller with no top padding clips "CHORD STACK" through the middle. The
     HORIZONTAL padding is the one that has to be 0, or the frames stop lining up
     again — which was the whole complaint. */
  /* 🪦 ITS MAX-HEIGHT, ITS OVERFLOW AND ITS PADDING ALL MOVED UP TO THE DRAWER,
     2026-09-12 — see the note there. This element is now only the step-1 panel's
     transparent wrapper; it measures nothing and clips nothing. */
  [data-match-layout="immersive"] .match-note-stock { box-sizing:border-box; margin:0 !important;
    padding:0 !important; overflow:visible !important; max-height:none !important;
    border:0 !important; border-radius:0 !important;
    background:none !important; box-shadow:none !important; clip-path:none; scrollbar-width:thin }
  /* 🪦 And the focus ring that lit that box when the drawer was the open panel.
     The CHORD STACK bracket already brightens its own corners through
     '.step-active', which is the system's way of saying the same thing. */
  [data-match-layout="immersive"] .match-note-stock > div:first-of-type { margin-bottom:8px !important; }
  [data-match-layout="immersive"] .match-note-stock .stitle { color:#a9b9d3 !important; font-size:7px !important; letter-spacing:1.45px; }
  /* 🪦 TWO OVERRIDES DIED HERE, 2026-09-12, AND THEIR TARGETS DIED WITH THEM.
     They softened the step-1 drawer's pink 2D card and its note-pool box — a
     'border-radius:7px' and a filled background forced onto '.step-active' and
     '[data-tip-anchor="stack-note-grid"]'. Both are Brackets now: no border, no
     radius, no fill, so the rules had nothing left to soften and would only have
     bolted a border back onto a frame that draws its own corners. The drawer
     needs no immersive special-casing at all, which is the point of putting it
     in the system. */
  [data-match-layout="immersive"] .match-note-stock .stack-commit { margin-bottom:2px }
  /* 🪦 Two rules hid the NOW window during steps 1 and 2 — it only ever showed
     during step 3. They went with it; a selector for a class nothing wears is
     indistinguishable from one that matters. */
  /* 🪦 The dock's own scrim, outline and title rule went with it. The step-3
     panel is a Bracket now, like the three frames above it, so a second box drawn
     around it would be the 'window inside a window' the chord drawer just lost —
     and the '.stitle' those rules styled no longer exists (the nameplate says it). */
  [data-match-layout="immersive"] .immersive-arail { gap:12px !important; }
  [data-match-layout="immersive"] .immersive-arail .arail-row { gap:5px; }
  /* ⚠️ '.arail''s own rule shears these buttons and counter-shears their labels;
     the immersive rail has always cancelled both. It now also carries the
     chamfer, so step 3 speaks the same language as the rest of the arena. */
  [data-match-layout="immersive"] .immersive-arail .btn { min-height:31px; padding:5px 11px; border-radius:0;
    font-size:9px; transform:none; background:#0b1526e0; border-color:#35507a;
    clip-path:polygon(7px 0,calc(100% - 7px) 0,100% 7px,100% calc(100% - 7px),
      calc(100% - 7px) 100%,7px 100%,0 calc(100% - 7px),0 7px); }
  [data-match-layout="immersive"] .immersive-arail .btn:hover { border-color:#80e8ff; color:#d5eaff }
  [data-match-layout="immersive"] .immersive-arail .btn:hover { transform:translateY(-1px); }
  [data-match-layout="immersive"] .immersive-arail .btn > .rb-in { transform:none; }
  [data-match-layout="immersive"] [data-hud-region="spirit"] { left:calc(var(--hud-pocket) + 20px); top:58px; bottom:auto; width:min(480px,calc(100% - var(--hud-pocket) - 44px)); max-height:calc(100% - 130px); }
  [data-match-layout="immersive"] [data-hud-region="rivals"] { left:auto; right:var(--hud-edge); top:106px; bottom:auto; width:300px; max-height:calc(100% - 178px); }
  [data-match-layout="immersive"][data-hud-tutorial] .match-hud-column { display:block; position:absolute; top:90px; bottom:56px; left:12px; width:480px; max-width:calc(100% - 24px); overflow:auto; z-index:30; }
  [data-match-layout="immersive"][data-hud-tutorial] [data-hud-region] { position:relative; inset:auto; width:100%; max-width:none; max-height:none; overflow:visible; margin-bottom:8px; }
  [data-match-layout="immersive"] .match-board-preparation { position:absolute; inset:62px 12px 72px calc(var(--hud-pocket) + 30px); pointer-events:none; z-index:10; }
  [data-match-layout="immersive"] .match-board-preparation > * { pointer-events:auto; }
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="chord-stack"] { pointer-events:none; }
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="commit-track"] { left:0 !important; right:0 !important; }
  [data-match-layout="immersive"] .match-board-preparation [data-immersive-track] { left:50% !important; right:auto !important; }
  /* 🪦 A 'bottom:0 !important' ON BOTH STACK ANCHORS DIED HERE, 2026-09-12b. It
     dates from when the panels were 'visibility:hidden' in 3D and only a
     tutorial tip ever revealed them, so where they landed barely mattered. They
     are permanent arena furniture now and carry the preview's own 'bottom:3%',
     which is the number Alex saw; an !important here would quietly overrule it
     and pin them to the floor of the preparation box. */
  /* Small screens keep a real board above controls. Overlays must never cover
     every legal target just because a phone cannot fit two desktop panels. */
  @media (max-width:1000px) {
    [data-match-layout="immersive"] { display:flex; flex-direction:column; height:auto; min-height:0; padding-top:108px; background:#030611; }
    [data-match-layout="immersive"] .match-board-column { position:relative; height:620px; width:100%; order:1; }
    [data-match-layout="immersive"] .match-hud-column,
    [data-match-layout="immersive"][data-hud-tutorial] .match-hud-column { display:flex; position:relative; inset:auto; width:100%; max-width:none; box-sizing:border-box; padding:0 12px 12px; order:2; }
    [data-match-layout="immersive"] [data-hud-region] { position:relative; inset:auto; width:100%; max-width:none; max-height:50dvh; margin-bottom:8px; }
    [data-match-layout="immersive"][data-match-step] [data-hud-region] { left:auto; right:auto; top:auto; bottom:auto; width:100%; max-width:none; transform:none; }
    [data-match-layout="immersive"] .match-board-preparation { inset:12px 16px 68px; }
    .match-player-pocket { top:43px; left:12px; width:208px; }
    [data-match-layout="immersive"] { --root-hex:44px }
    .match-sound-readout { grid-template-columns:1fr 1fr 34px; }
    .match-phase-rail { top:13px; }
    .match-panel-nav { top:43px; }
  }
  @media (max-width:600px) {
    .immersive-match .match-header { flex-wrap:wrap; }
    .immersive-match .match-header-status { flex-wrap:wrap; min-width:0; }
    [data-match-layout="immersive"] { padding-top:116px; }
    [data-match-layout="immersive"] .match-board-column { height:540px; }
    .match-phase-rail { width:calc(100% - 24px); justify-content:center; gap:5px; }
    .match-phase-step > .rlsw-brk-body > span { font-size:0; gap:3px }
    .match-phase-step i { font-size:7px }
    /* ⚠️ The label collapses to font-size:0 at this width; the live line must NOT
       go with it — it is the only thing left saying what the game wants next. */
    .match-phase-live { max-width:140px; font-size:7px }
    .match-player-pocket { width:160px; }
    .match-player-card { min-height:58px; padding:6px; }
    .match-player-art { display:none; }
    [data-match-layout="immersive"] { --root-hex:38px }
    .match-player-copy strong { margin:3px 0 5px; font-size:10px; }
    .match-sound-readout { padding:6px; grid-template-columns:1fr 1fr 30px; min-height:76px; }
    .match-sound-readout b { font-size:9px; }
  }
`;
