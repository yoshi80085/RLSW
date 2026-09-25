import { useEffect, useRef, useState } from 'react';
import { SVG_W, SVG_H } from '../board/constants.js';

// Keep the actual React board in both views: duplicating its targeting and
// ability layers would let a renderer offer actions the match cannot take.
// ⌗ `topView` is the top-down camera (arenaRenderer `topView`): the client owns
// it, persists it and stamps a bout started under it as realtime. The arena
// reports back through `onTopView(false)` when the player tilts off its axis.
// 🎛️ THE CAMERA TOOLBAR MOVED INTO THE ☰ MENU, 2026-09-25. Alex: *"its taking up
// way too much space on the screen for what it does."* The board keeps only what
// has to be ON the board: the loading / 3D-unavailable status with Retry, and
// Follow battle while a player holds the lens mid-battle. Everything else — the
// views, detail, zoom — reaches the runtime through `cameraRef`, which the
// client's ☰ rows call. `quality` is the client's now, and `onQualityLabel`
// reports what "Auto detail" resolved to so the menu can say so.
// 🪦 The Hold button went with the toolbar: it was the ☰ Auto camera switch inverted,
// and with both in one menu it would be the same switch listed twice.
export function BoardViewport({ enabled = true, immersive = false, sceneFrame, autoCamera = true, topView = false, onTopView,
  quality = 'auto', onQualityLabel, cameraRef, children }) {
  const mount = useRef(null);
  const layer = useRef(null);
  const runtime = useRef(null);
  const [status, setStatus] = useState('');
  const [attempt, setAttempt] = useState(0);
  // 🎥 What the camera is doing — only 'battle-manual' is read, for Follow battle.
  const [cameraState, setCameraState] = useState(null);
  const latest = useRef({});
  useEffect(() => {
    latest.current = { sceneFrame, quality, autoCamera, topView, onTopView, onQualityLabel };
    runtime.current?.update(sceneFrame);
    runtime.current?.quality(quality);
    runtime.current?.autoCamera(autoCamera);
  }, [sceneFrame, quality, autoCamera, topView, onTopView, onQualityLabel]);
  // ☰ → runtime. The view names keep the old toolbar's meaning exactly: ⌗ Top
  // turns top-down ON and frames it; Arena and Spirit leave top-down first.
  useEffect(() => {
    if (!cameraRef) return undefined;
    cameraRef.current = {
      view(name) {
        if (name === 'top') { latest.current.onTopView?.(true); runtime.current?.view('tactical'); return; }
        latest.current.onTopView?.(false);
        runtime.current?.view(name === 'spirit' ? 'focus' : 'arena');
      },
      zoom(factor) { runtime.current?.zoom(factor); },
    };
    return () => { cameraRef.current = null; };
  }, [cameraRef]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const host = mount.current;
    const element = layer.current;
    import('../board/arenaRenderer.js').then(({ mountArena }) => {
      if (cancelled) return;
      setStatus('Loading arena…');
      runtime.current = mountArena(host, element, {
        onReady: () => { if (!cancelled) setStatus('ready'); },
        onQuality: label => { if (!cancelled) latest.current.onQualityLabel?.(label); },
        onCamera: state => { if (!cancelled) setCameraState(state); },
        onTopView: on => { if (!cancelled) latest.current.onTopView?.(on); },
        onError: () => { if (!cancelled) setStatus('3D unavailable. Enable WebGL in your browser, then retry the arena.'); },
      });
      runtime.current.update(latest.current.sceneFrame);
      runtime.current.quality(latest.current.quality ?? 'auto');
      runtime.current.autoCamera(latest.current.autoCamera ?? true);
      // A saved top-down choice comes back locked, straight from the first frame.
      if (latest.current.topView) runtime.current.view('tactical');
    }).catch(() => { if (!cancelled) setStatus('3D unavailable. Enable WebGL in your browser, then retry the arena.'); });
    return () => {
      cancelled = true;
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [enabled, attempt]);

  return <div data-board-view={enabled ? '3d' : '2d'} data-swing-phase={sceneFrame?.battle?.swingClash ? sceneFrame.battle.phase : undefined} data-sonic-phase={sceneFrame?.battle?.volley ? sceneFrame.battle.phase : undefined} data-arena-ready={enabled && status === 'ready' || undefined} style={enabled
    ? { position: 'relative', width: '100%', ...(immersive ? { height: '100%' } : { aspectRatio: `${SVG_W}/${SVG_H}` }), minHeight: 360, overflow: 'hidden', background: '#030611', borderRadius: 8 }
    : { display: 'contents' }}>
    <style>{`
      [data-board-view="3d"] .arena-tactical { width:${SVG_W}px; height:${SVG_H}px; }
      [data-board-view="3d"] .arena-tactical > svg { width:${SVG_W}px !important; height:${SVG_H}px !important; overflow:visible; }
      /* The SVG stays mounted only as the input/targeting surface.  Its painted
         plate and hex outlines otherwise sit in the CSS3D layer above WebGL and
         slice through the physical standees. */
      [data-board-view="3d"] .arena-tactical > svg > image,
      [data-board-view="3d"] .arena-tactical .board-outline-glow,
      [data-board-view="3d"] .arena-tactical .board-outline-img { display:none; }
      [data-board-view="3d"] .arena-tactical .hex-g > polygon { stroke:transparent; }
      [data-arena-ready] [data-arena-flat="spirit"] { display:none; }
      /* The WebGL arena owns equivalent smoke, laser, pyro, and bot effects.
         Leaving the SVG copy above the canvas makes it draw through its 3D
         stand-ins, so suppress that duplicate only once the arena is ready. */
      [data-arena-ready] [data-arena-flat="stage-fx"] { display:none; }
      [data-arena-ready] [data-arena-flat="crowd"] { display:none; }
      [data-board-view="3d"] .arena-tactical { pointer-events:auto; }
      [data-arena-ready] [data-arena-flat="amp-art"] { opacity:0; }
      [data-arena-ready] [data-arena-flat="fall"] { visibility:hidden; }
      /* 🟪 The arena draws the move tiles itself (board/moveTiles.js). The SVG's
         9% white fill under them is the old highlight, so hide it once ready. */
      [data-arena-ready] .arena-tactical [data-move-tile] { fill:transparent; }
      /* What is left of the camera toolbar: a small corner chip that appears only
         when there is something to say (loading, 3D unavailable, Follow battle). */
      .arena-board-status { position:absolute; right:8px; bottom:8px; z-index:30; display:flex; gap:6px; align-items:center; flex-wrap:wrap; justify-content:flex-end; max-width:calc(100% - 16px); pointer-events:auto; }
      .arena-board-status .btn { min-height:26px; padding:4px 9px; color:#9eb7d6; background:#0b1425e6; border-color:#9dbfe43b; font-size:8px; }
      .arena-board-status .btn:hover { color:#e6f5ff; border-color:#75dff0; }
      .arena-board-status [role="status"] { color:#ffd89b; background:#090e20ee; padding:6px 8px; font-size:11px; border-radius:4px; }
    `}</style>
    <div ref={mount} style={enabled ? { position: 'absolute', inset: 0 } : { display: 'contents' }} />
    <div ref={layer} className="arena-tactical">{children}</div>
    {enabled && (status && status !== 'ready' || (autoCamera && cameraState?.mode === 'battle-manual')) &&
      <div className="arena-board-status" aria-label="Arena status">
        {autoCamera && cameraState?.mode === 'battle-manual' && <button className="btn" onClick={() => runtime.current?.followBattle()}>🎥 Follow battle</button>}
        {status && status !== 'ready' && <span role="status">{status}</span>}
        {status.startsWith('3D unavailable') && <button className="btn" onClick={() => { setStatus('Loading arena…'); setAttempt(n => n + 1); }}>Retry arena</button>}
      </div>}
  </div>;
}
