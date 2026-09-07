import { createContext, useContext, useId, useState } from 'react';

const SurfaceContext = createContext({ immersive: false, panel: 'turn' });
const STEPS = { chord: '1 · Build chord', melody: '2 · Compose melody', move_act: '3 · Move & act' };

// Layout owns only disclosure state. Game owns turns, permissions and all actions.
// Keep these wrappers mounted in both views: conditional trees/portals here would
// remount note controls and the live SVG while a player is composing or targeting.
export function MatchSurface({ immersive, spirit, turnNumber, step, canAct, ap, tutorial, children }) {
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
    <div className="match-surface" data-match-layout={immersive ? 'immersive' : 'classic'} data-hud-tutorial={tutorial || undefined}>
      <style>{SURFACE_CSS}</style>
      {immersive && <div className="match-hud-bar">
        <div className="match-turn-summary" role="status" aria-live="polite">
          <strong style={{ color: spirit?.color }}>{spirit?.name ?? 'Arena'}</strong>
          <span>{canAct ? STEPS[step] : 'Watching their turn'}{step === 'move_act' ? ` · ${ap} AP` : ''}</span>
        </div>
        <nav aria-label="Arena panels" className="match-panel-nav">
          {[['turn', 'Turn'], ['spirit', 'Spirit'], ['rivals', 'Rivals']].map(([name, label]) =>
            <button key={name} className="btn" aria-expanded={tutorial || panel === name}
              aria-controls={`${id}-${name}`} onClick={() => select(name)}>{label}</button>)}
        </nav>
      </div>}
      {children}
    </div>
  </SurfaceContext.Provider>;
}

export function HudRegion({ name, children }) {
  const { immersive, panel, tutorial, id } = useContext(SurfaceContext);
  return <section id={`${id}-${name}`} data-hud-region={name}
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
  [data-match-layout="immersive"] { position:relative; display:block; height:calc(100dvh - 110px); min-height:640px; flex:none; isolation:isolate; }
  [data-match-layout="immersive"] .match-hud-column { display:contents; }
  [data-match-layout="immersive"] .match-board-column,
  [data-match-layout="immersive"] .match-board-frame { position:absolute; inset:0; width:100%; height:100%; max-width:none; }
  .match-hud-bar { position:absolute; top:12px; left:12px; right:12px; z-index:40; display:flex; justify-content:space-between; gap:12px; pointer-events:none; }
  .match-turn-summary { display:flex; flex-direction:column; gap:4px; background:#080f20ed; border:1px solid #314366; border-radius:8px; padding:10px 14px; font-size:12px; }
  .match-turn-summary strong { font-size:15px; }
  .match-panel-nav { display:flex; gap:6px; align-items:flex-start; pointer-events:auto; }
  .match-panel-nav .btn { min-height:36px; padding:6px 12px; background:#080f20ed; }
  .match-panel-nav .btn[aria-expanded="true"] { border-color:#83beff; color:#d5eaff; }
  [data-match-layout="immersive"] [data-hud-region] { position:absolute; left:12px; bottom:56px; width:480px; max-width:calc(100% - 24px); max-height:calc(100% - 150px); overflow:auto; overscroll-behavior:contain; padding:10px; box-sizing:border-box; background:#080f20ed; border:1px solid #314366; border-radius:8px; z-index:30; scrollbar-width:thin; }
  [data-match-layout="immersive"] [data-hud-region][hidden] { display:none; }
  [data-match-layout="immersive"] [data-hud-region="turn"] { max-height:48%; }
  [data-match-layout="immersive"][data-hud-tutorial] .match-hud-column { display:block; position:absolute; top:90px; bottom:56px; left:12px; width:480px; max-width:calc(100% - 24px); overflow:auto; z-index:30; }
  [data-match-layout="immersive"][data-hud-tutorial] [data-hud-region] { position:relative; inset:auto; width:100%; max-width:none; max-height:none; overflow:visible; margin-bottom:8px; }
  [data-match-layout="immersive"] .match-board-preparation { position:absolute; inset:86px 12px 68px 510px; pointer-events:none; z-index:10; }
  [data-match-layout="immersive"] .match-board-preparation > * { pointer-events:auto; }
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="chord-stack"] { pointer-events:none; }
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="commit-track"] { left:0 !important; right:0 !important; }
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="drive-stack"],
  [data-match-layout="immersive"] .match-board-preparation [data-tip-anchor="sustain-stack"] { bottom:0 !important; }
  /* Small screens keep a real board above controls. Overlays must never cover
     every legal target just because a phone cannot fit two desktop panels. */
  @media (max-width:1000px) {
    [data-match-layout="immersive"] { display:flex; flex-direction:column; height:auto; min-height:0; padding-top:82px; background:#030611; }
    [data-match-layout="immersive"] .match-board-column { position:relative; height:620px; width:100%; order:1; }
    [data-match-layout="immersive"] .match-hud-column,
    [data-match-layout="immersive"][data-hud-tutorial] .match-hud-column { display:flex; position:relative; inset:auto; width:100%; max-width:none; box-sizing:border-box; padding:0 12px 12px; order:2; }
    [data-match-layout="immersive"] [data-hud-region] { position:relative; inset:auto; width:100%; max-width:none; max-height:50dvh; margin-bottom:8px; }
    [data-match-layout="immersive"] .match-board-preparation { inset:12px 16px 68px; }
    .match-hud-bar { flex-wrap:wrap; }
    .match-turn-summary { padding:6px 10px; font-size:10px; }
    .match-turn-summary strong { font-size:12px; }
  }
  @media (max-width:600px) {
    .immersive-match .match-header { flex-wrap:wrap; }
    .immersive-match .match-header-status { flex-wrap:wrap; min-width:0; }
    [data-match-layout="immersive"] { padding-top:120px; }
    [data-match-layout="immersive"] .match-board-column { height:540px; }
    .match-hud-bar { gap:6px; }
  }
`;
