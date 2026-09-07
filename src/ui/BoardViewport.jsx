import { useEffect, useRef, useState } from 'react';
import { SVG_W, SVG_H } from '../board/constants.js';

// Keep the actual React board in both views: duplicating its targeting and
// ability layers would let a renderer offer actions the match cannot take.
export function BoardViewport({ enabled, immersive = false, onDisable, children }) {
  const mount = useRef(null);
  const layer = useRef(null);
  const runtime = useRef(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const host = mount.current;
    const element = layer.current;
    import('../board/arenaRenderer.js').then(({ mountArena }) => {
      if (cancelled) return;
      setStatus('Loading arena…');
      runtime.current = mountArena(host, element, {
        onReady: () => { if (!cancelled) setStatus(''); },
        onError: () => { if (!cancelled) setStatus('3D unavailable. Return to 2D to continue the match.'); },
      });
    }).catch(() => { if (!cancelled) setStatus('3D unavailable. Return to 2D to continue the match.'); });
    return () => {
      cancelled = true;
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [enabled]);

  return <div data-board-view={enabled ? '3d' : '2d'} style={enabled
    ? { position: 'relative', width: '100%', ...(immersive ? { height: '100%' } : { aspectRatio: `${SVG_W}/${SVG_H}` }), minHeight: 360, overflow: 'hidden', background: '#030611', borderRadius: 8 }
    : { display: 'contents' }}>
    <style>{`
      [data-board-view="3d"] .arena-tactical { width:${SVG_W}px; height:${SVG_H}px; }
      [data-board-view="3d"] .arena-tactical > svg { width:${SVG_W}px !important; height:${SVG_H}px !important; overflow:visible; }
      [data-board-view="3d"] .arena-tactical > svg > image { display:none; }
      [data-board-view="3d"] .arena-tactical { pointer-events:auto; }
    `}</style>
    <div ref={mount} style={enabled ? { position: 'absolute', inset: 0 } : { display: 'contents' }} />
    <div ref={layer} className="arena-tactical">{children}</div>
    {enabled && <div style={{ position: 'absolute', right: 8, bottom: 8, zIndex: 30, display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '75%' }}>
      {status && <span role="status" style={{ color: '#ffd89b', background: '#090e20ee', padding: 6, fontSize: 11 }}>{status}</span>}
      <button className="btn" onClick={() => runtime.current?.view('tactical')}>Tactical</button>
      <button className="btn" onClick={() => runtime.current?.view('arena')}>Arena</button>
      <button className="btn" onClick={() => runtime.current?.zoom(0.85)} aria-label="Zoom into arena">+</button>
      <button className="btn" onClick={() => runtime.current?.zoom(1.18)} aria-label="Zoom out of arena">−</button>
      <button className="btn" onClick={onDisable}>2D board</button>
      <span style={{ width: '100%', color: '#a9bbd5', fontSize: 9, textAlign: 'right', pointerEvents: 'none' }}>Click to play · right-drag to orbit · wheel to zoom</span>
    </div>}
  </div>;
}
