import { createContext, useContext, useId, useState } from 'react';

const SurfaceContext = createContext({ immersive: false, panel: 'turn' });
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
  return <SurfaceContext.Provider value={context}>
    <div className="match-surface" data-match-layout={immersive ? 'immersive' : 'classic'}
      data-match-step={step} data-hud-tutorial={tutorial || undefined}>
      <style>{SURFACE_CSS}</style>
      {immersive && <>
        <div className="match-phase-rail" aria-label="Turn progress">
          {STEP_ORDER.map((name, index) => <span key={name} data-state={name === step ? 'now' : STEP_ORDER.indexOf(step) > index ? 'done' : 'later'}>
            <i>{String(index + 1).padStart(2, '0')}</i>{STEPS[name].split(' · ')[1]}
          </span>)}
        </div>
        <aside className="match-player-pocket" aria-label="Active spirit summary">
          <button className="match-player-card" onClick={() => select('spirit')}
            aria-expanded={tutorial || panel === 'spirit'} aria-controls={`${id}-spirit`}>
            {hud?.imageSrc && <span className="match-player-art"><img src={hud.imageSrc} alt="" /></span>}
            <span className="match-player-copy">
              <small>{canAct ? `YOUR TURN · ${String(turnNumber).padStart(2, '0')}` : `TURN ${String(turnNumber).padStart(2, '0')}`}</small>
              <strong style={{ color: spirit?.color }}>{spirit?.name ?? 'Arena'}</strong>
              <span className="match-vibe"><i><b style={{ width: `${Math.max(0, Math.min(100, ((hud?.vibe ?? 0) / (hud?.maxVibe || 1)) * 100))}%`, background: spirit?.color }} /></i>VIBE {hud?.vibe ?? '—'}/{hud?.maxVibe ?? '—'}</span>
            </span>
            <span className="match-player-more">＋</span>
          </button>
          <div className="match-sound-readout">
            <span className="drive" data-immersive-stack="drive" ref={hud?.driveRef}><small>DRIVE</small><b>{hud?.drive ?? '—'}</b></span>
            <span className="sustain" data-immersive-stack="sustain" ref={hud?.sustainRef}><small>SUSTAIN</small><b>{hud?.sustain ?? '—'}</b></span>
            <span><small>Db</small><b>{hud?.db ?? '—'}</b></span>
            <span><small>FANS</small><b>{hud?.fans ?? '—'}</b></span>
          </div>
        </aside>
        <div className="match-hud-bar">
          <div className="match-turn-summary" role="status" aria-live="polite">
            <strong>{ACTION_LABELS[hud?.action] ?? (canAct ? STEPS[step] : 'Watching their turn')}</strong>
            <span>{step === 'move_act' ? `${ap} AP remaining` : hud?.noteCount != null ? `${hud.noteCount} notes available` : 'The stage is live'}</span>
          </div>
          <nav aria-label="Arena panels" className="match-panel-nav">
            {[['turn', 'Turn'], ['spirit', 'Spirit'], ['rivals', 'Rivals']].map(([name, label]) =>
              <button key={name} className="btn" aria-expanded={tutorial || panel === name}
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
  [data-match-layout="immersive"] { --hud-edge:12px; --hud-pocket:238px; position:relative; display:block; height:calc(100dvh - 76px); min-height:640px; flex:none; isolation:isolate; }
  [data-match-layout="immersive"] .match-hud-column { display:contents; }
  [data-match-layout="immersive"] .match-board-column,
  [data-match-layout="immersive"] .match-board-frame { position:absolute; inset:0; width:100%; height:100%; max-width:none; }
  .match-phase-rail { position:absolute; top:13px; left:50%; z-index:41; transform:translateX(-50%); display:flex; align-items:center; gap:18px; pointer-events:none; white-space:nowrap; }
  .match-phase-rail span { display:flex; gap:6px; align-items:center; color:#4d627e; font-size:8px; letter-spacing:1.1px; text-transform:uppercase; }
  .match-phase-rail span:not(:last-child)::after { content:'—'; margin-left:12px; color:#25354c; }
  .match-phase-rail i { color:#536b88; font-style:normal; }
  .match-phase-rail [data-state="done"] { color:#7895b8; }
  .match-phase-rail [data-state="now"] { color:#dceaff; text-shadow:0 0 10px #80e8ff66; }
  .match-phase-rail [data-state="now"] i { color:#80e8ff; }
  .match-player-pocket { position:absolute; left:var(--hud-edge); top:58px; z-index:42; width:var(--hud-pocket); display:flex; flex-direction:column; gap:7px; color:#dceaff; }
  .match-player-card, .match-sound-readout { width:100%; box-sizing:border-box; border:1px solid #bdd7ff40; border-radius:9px; background:linear-gradient(155deg,#edf6ff20 0%,#9fc8ff08 27%,transparent 47%),linear-gradient(125deg,#111a31b8,#070d1da3); box-shadow:0 10px 36px #0006,inset 0 1px #ffffff24,inset 0 -18px 32px #02071326; backdrop-filter:blur(18px) saturate(1.28); }
  .match-player-card { min-height:72px; padding:8px; display:flex; align-items:stretch; gap:8px; color:#dceaff; text-align:left; cursor:pointer; }
  .match-player-card:hover { border-color:#80e8ff70; background:linear-gradient(155deg,#edf6ff29 0%,#9fc8ff0c 27%,transparent 47%),linear-gradient(125deg,#17223cbd,#091126a8); }
  .match-player-art { width:42px; position:relative; overflow:hidden; border-radius:5px; background:#0b1222; flex:none; }
  .match-player-art img { position:absolute; width:62px; height:88px; left:50%; top:0; transform:translateX(-50%); object-fit:cover; object-position:top center; opacity:.82; }
  .match-player-copy { min-width:0; flex:1; display:flex; flex-direction:column; justify-content:center; }
  .match-player-copy small { color:#7790b0; font-size:6px; letter-spacing:1.5px; }
  .match-player-copy strong { margin:4px 0 7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:700 12px 'Saira',sans-serif; }
  .match-vibe { display:flex; align-items:center; gap:5px; color:#8da1bd; font-size:7px; white-space:nowrap; }
  .match-vibe > i { width:66px; height:3px; overflow:hidden; background:#243149; border-radius:4px; }
  .match-vibe > i > b { display:block; height:100%; border-radius:inherit; box-shadow:0 0 7px currentColor; }
  .match-player-more { align-self:flex-start; color:#7790b0; font-size:13px; }
  .match-sound-readout { padding:10px; display:grid; grid-template-columns:1fr 1fr 42px; grid-template-rows:1fr 1fr; gap:6px; min-height:92px; }
  .match-sound-readout > span { min-width:0; padding-right:6px; border-right:1px solid #93acd21f; }
  .match-sound-readout > span:last-child { border:0; padding:0; }
  .match-sound-readout small { display:block; color:#7187a4; font-size:6px; letter-spacing:.8px; }
  .match-sound-readout b { display:block; margin-top:3px; color:#dceaff; font-size:12px; }
  .match-sound-readout .drive, .match-sound-readout .sustain { grid-row:1 / 3; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; padding:0 5px 2px; border-right:1px solid #93acd21f; }
  .match-sound-readout .drive::before, .match-sound-readout .sustain::before { content:''; position:absolute; top:1px; left:50%; width:48px; height:48px; transform:translateX(-50%); border-radius:50%; background:radial-gradient(circle at 37% 30%,#3c4558 0 7%,#151c2c 48%,#090e18 72%),repeating-conic-gradient(from 225deg,currentColor 0 2deg,transparent 2deg 25deg); border:1px solid currentColor; box-shadow:inset 0 1px 2px #fff4,0 0 12px color-mix(in srgb,currentColor 28%,transparent); opacity:.9; }
  .match-sound-readout .drive::after, .match-sound-readout .sustain::after { content:''; position:absolute; top:6px; left:calc(50% - 1px); width:2px; height:13px; border-radius:2px; background:currentColor; box-shadow:0 0 7px currentColor; transform-origin:1px 19px; transform:rotate(42deg); }
  .match-sound-readout .drive { color:#ff876c; }
  .match-sound-readout .sustain { color:#70c8ff; }
  .match-sound-readout .drive small, .match-sound-readout .sustain small { position:relative; z-index:1; margin-top:auto; }
  .match-sound-readout .drive b, .match-sound-readout .sustain b { position:absolute; z-index:1; top:14px; left:0; right:0; margin:0; text-align:center; font-size:13px; color:#fff; text-shadow:0 1px 4px #000; }
  .match-sound-readout .drive small, .match-sound-readout .drive b { color:#ff876c; }
  .match-sound-readout .sustain small, .match-sound-readout .sustain b { color:#70c8ff; }
  .match-hud-bar { position:absolute; inset:0; z-index:43; pointer-events:none; }
  .match-turn-summary { position:absolute; left:50%; bottom:12px; transform:translateX(-50%); display:flex; flex-direction:column; gap:3px; min-width:180px; background:linear-gradient(155deg,#edf6ff1b,transparent 38%),#080f2096; border:1px solid #b8d5ff3d; border-radius:8px; padding:8px 12px; font-size:9px; box-shadow:inset 0 1px #ffffff1a; backdrop-filter:blur(16px) saturate(1.24); }
  .match-turn-summary strong { color:#dceaff; font-size:10px; }
  .match-turn-summary span { color:#7890ad; font-size:7px; letter-spacing:.6px; }
  .match-panel-nav { position:absolute; top:58px; right:var(--hud-edge); display:flex; gap:6px; align-items:flex-start; pointer-events:auto; }
  .match-panel-nav .btn { min-height:36px; padding:6px 12px; background:linear-gradient(155deg,#edf6ff18,transparent 40%),#080f20ad; border-color:#b8d5ff35; backdrop-filter:blur(16px) saturate(1.2); }
  .match-panel-nav .btn[aria-expanded="true"] { border-color:#83beff; color:#d5eaff; box-shadow:0 0 14px #80e8ff24,inset 0 1px #ffffff20; }
  [data-match-layout="immersive"] [data-hud-region] { position:absolute; left:var(--hud-edge); bottom:58px; width:480px; max-width:calc(100% - 24px); max-height:calc(100% - 150px); overflow:auto; overflow-x:hidden; overscroll-behavior:contain; padding:10px; box-sizing:border-box; background:linear-gradient(155deg,#edf6ff20 0%,#9fc8ff08 24%,transparent 44%),linear-gradient(125deg,#10182cba,#070d1da6); border:1px solid #b8d5ff42; border-radius:10px; box-shadow:0 12px 42px #0007,inset 0 1px #ffffff24,inset 0 -24px 42px #02071324; backdrop-filter:blur(20px) saturate(1.3); z-index:44; scrollbar-width:thin; }
  [data-match-layout="immersive"] [data-hud-region][data-hud-current] { box-shadow:0 12px 42px #0007,0 0 18px #80e8ff24,inset 0 1px #ffffff29,inset 0 0 28px #80e8ff0a; }
  [data-match-layout="immersive"] [data-hud-region][hidden] { display:none; }
  [data-match-layout="immersive"] [data-hud-region="turn"] { max-height:48%; }
  [data-match-layout="immersive"][data-match-step="move_act"] [data-hud-region="turn"] { left:calc(50% + var(--hud-pocket) / 2); bottom:58px; width:min(740px,calc(100% - var(--hud-pocket) - 56px)); transform:translateX(-50%); max-height:34%; }
  [data-match-layout="immersive"][data-match-step="chord"] [data-hud-region="turn"],
  [data-match-layout="immersive"][data-match-step="melody"] [data-hud-region="turn"] { top:266px; bottom:auto; width:var(--hud-pocket); max-height:calc(100% - 338px); padding:0; overflow:visible; background:none; border:0; box-shadow:none; backdrop-filter:none; }
  [data-match-layout="immersive"] .match-note-stock { box-sizing:border-box; margin:0 !important; padding:11px !important; overflow-y:auto !important; overflow-x:hidden !important; max-height:calc(100dvh - 346px); border:1px solid #bdd7ff40 !important; border-left:1px solid #bdd7ff40 !important; border-radius:9px !important; background:linear-gradient(155deg,#edf6ff20 0%,#9fc8ff08 26%,transparent 47%),linear-gradient(125deg,#111a31b8,#070d1da3) !important; box-shadow:0 10px 36px #0006,inset 0 1px #ffffff24,inset 0 -20px 34px #02071326 !important; backdrop-filter:blur(18px) saturate(1.28); scrollbar-width:thin; }
  [data-match-layout="immersive"] [data-hud-region="turn"][data-hud-current] .match-note-stock { box-shadow:0 10px 36px #0006,0 0 18px #80e8ff20,inset 0 1px #ffffff29,inset 0 0 24px #80e8ff09 !important; }
  [data-match-layout="immersive"] .match-note-stock > div:first-of-type { margin-bottom:8px !important; }
  [data-match-layout="immersive"] .match-note-stock .stitle { color:#a9b9d3 !important; font-size:7px !important; letter-spacing:1.45px; }
  [data-match-layout="immersive"] .match-note-stock .step-active { border-width:1px !important; border-color:#af7ddb55 !important; border-radius:7px !important; background:#120d20a6 !important; box-shadow:none !important; }
  [data-match-layout="immersive"] .match-note-stock [data-tip-anchor="stack-note-grid"] { background:#0b1120a8 !important; border-color:#8daee52c !important; }
  [data-match-layout="immersive"][data-match-step="chord"] .match-turn-summary,
  [data-match-layout="immersive"][data-match-step="melody"] .match-turn-summary { display:none; }
  [data-match-layout="immersive"][data-match-step="move_act"] [data-hud-region="turn"] { padding:10px 12px; border-color:#9fd4ff48; border-radius:9px; background:linear-gradient(155deg,#edf6ff20 0%,#9fc8ff08 28%,transparent 48%),linear-gradient(110deg,#131b2bad,#080d199b); box-shadow:0 10px 36px #0006,0 0 20px #80e8ff26,inset 0 1px #ffffff26,inset 0 0 26px #80e8ff0b; }
  [data-match-layout="immersive"][data-match-step="move_act"] [data-hud-region="turn"] > div > .stitle { margin:0 0 7px !important; color:#aabbd4; font-size:7px; letter-spacing:1.5px; }
  [data-match-layout="immersive"] .immersive-arail { gap:12px !important; }
  [data-match-layout="immersive"] .immersive-arail .arail-row { gap:5px; }
  [data-match-layout="immersive"] .immersive-arail .btn { min-height:30px; padding:4px 9px; border-radius:5px; font-size:9px; transform:none; clip-path:none; background:#111a2bbd; }
  [data-match-layout="immersive"] .immersive-arail .btn:hover { transform:translateY(-1px); }
  [data-match-layout="immersive"] .immersive-arail .btn > .rb-in { transform:none; }
  [data-match-layout="immersive"] [data-hud-region="spirit"] { left:calc(var(--hud-pocket) + 20px); top:58px; bottom:auto; width:min(480px,calc(100% - var(--hud-pocket) - 44px)); max-height:calc(100% - 130px); }
  [data-match-layout="immersive"] [data-hud-region="rivals"] { left:auto; right:var(--hud-edge); top:58px; bottom:auto; width:280px; max-height:calc(100% - 130px); }
  [data-match-layout="immersive"][data-hud-tutorial] .match-hud-column { display:block; position:absolute; top:90px; bottom:56px; left:12px; width:480px; max-width:calc(100% - 24px); overflow:auto; z-index:30; }
  [data-match-layout="immersive"][data-hud-tutorial] [data-hud-region] { position:relative; inset:auto; width:100%; max-width:none; max-height:none; overflow:visible; margin-bottom:8px; }
  [data-match-layout="immersive"] .match-board-preparation { position:absolute; inset:62px 12px 72px calc(var(--hud-pocket) + 30px); pointer-events:none; z-index:10; }
  [data-match-layout="immersive"] .match-board-preparation > * { pointer-events:auto; }
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="chord-stack"] { pointer-events:none; }
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="commit-track"] { left:0 !important; right:0 !important; }
  [data-match-layout="immersive"] .match-board-preparation [data-immersive-track] { left:50% !important; right:auto !important; }
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="drive-stack"],
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="sustain-stack"] { bottom:0 !important; }
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
    .match-sound-readout { grid-template-columns:1fr 1fr 34px; }
    .match-phase-rail { top:13px; }
    .match-panel-nav { top:43px; }
    .match-turn-summary { padding:6px 10px; font-size:10px; }
    .match-turn-summary strong { font-size:12px; }
  }
  @media (max-width:600px) {
    .immersive-match .match-header { flex-wrap:wrap; }
    .immersive-match .match-header-status { flex-wrap:wrap; min-width:0; }
    [data-match-layout="immersive"] { padding-top:116px; }
    [data-match-layout="immersive"] .match-board-column { height:540px; }
    .match-phase-rail { width:calc(100% - 24px); justify-content:center; gap:5px; }
    .match-phase-rail span { font-size:0; gap:3px; }
    .match-phase-rail span i { font-size:7px; }
    .match-phase-rail span:not(:last-child)::after { margin-left:4px; font-size:7px; }
    .match-player-pocket { width:160px; }
    .match-player-card { min-height:58px; padding:6px; }
    .match-player-art { display:none; }
    .match-player-copy strong { margin:3px 0 5px; font-size:10px; }
    .match-sound-readout { padding:6px; grid-template-columns:1fr 1fr 30px; min-height:76px; }
    .match-sound-readout .drive::before, .match-sound-readout .sustain::before { width:38px; height:38px; }
    .match-sound-readout .drive::after, .match-sound-readout .sustain::after { top:4px; height:9px; transform-origin:1px 15px; }
    .match-sound-readout .drive b, .match-sound-readout .sustain b { top:11px; font-size:10px; }
    .match-sound-readout b { font-size:9px; }
    .match-turn-summary { display:none; }
  }
`;
