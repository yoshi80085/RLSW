import { useEffect, useRef, useState } from 'react';
import { SVG_W, SVG_H } from '../board/constants.js';

// Keep the actual React board in both views: duplicating its targeting and
// ability layers would let a renderer offer actions the match cannot take.
export function BoardViewport({ enabled, immersive = false, sceneFrame, onDisable, children }) {
  const mount = useRef(null);
  const layer = useRef(null);
  const runtime = useRef(null);
  const [status, setStatus] = useState('');
  const [quality, setQuality] = useState('auto');
  const [qualityLabel, setQualityLabel] = useState('');
  const latest = useRef({});
  useEffect(() => {
    latest.current = { sceneFrame, quality };
    runtime.current?.update(sceneFrame);
    runtime.current?.quality(quality);
  }, [sceneFrame, quality]);
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
        onQuality: label => { if (!cancelled) setQualityLabel(label); },
        onError: () => { if (!cancelled) setStatus('3D unavailable. Return to 2D to continue the match.'); },
      });
      runtime.current.update(latest.current.sceneFrame);
      runtime.current.quality(latest.current.quality ?? 'auto');
    }).catch(() => { if (!cancelled) setStatus('3D unavailable. Return to 2D to continue the match.'); });
    return () => {
      cancelled = true;
      runtime.current?.dispose();
      runtime.current = null;
    };
  }, [enabled]);

  return <div data-board-view={enabled ? '3d' : '2d'} data-arena-ready={enabled && status === 'ready' || undefined} style={enabled
    ? { position: 'relative', width: '100%', ...(immersive ? { height: '100%' } : { aspectRatio: `${SVG_W}/${SVG_H}` }), minHeight: 360, overflow: 'hidden', background: '#030611', borderRadius: 8 }
    : { display: 'contents' }}>
    <style>{`
      [data-board-view="3d"] .arena-tactical { width:${SVG_W}px; height:${SVG_H}px; }
      [data-board-view="3d"] .arena-tactical > svg { width:${SVG_W}px !important; height:${SVG_H}px !important; overflow:visible; }
      [data-board-view="3d"] .arena-tactical > svg > image { display:none; }
      [data-arena-ready] [data-arena-flat="spirit"] { display:none; }
      [data-board-view="3d"] .arena-tactical { pointer-events:auto; }
      [data-arena-ready] [data-arena-flat="amp-art"] { opacity:0; }
      [data-arena-ready] [data-arena-flat="fall"] { visibility:hidden; }
      .arena-camera-toolbar { position:absolute; right:8px; bottom:8px; z-index:30; width:460px; max-width:calc(100% - 16px); display:flex; gap:4px; flex-wrap:wrap; justify-content:flex-end; padding:5px; border:1px solid #b8d5ff3d; border-radius:8px; background:linear-gradient(155deg,#edf6ff1b,transparent 38%),#080f208f; box-shadow:0 8px 28px #0006,inset 0 1px #ffffff20; backdrop-filter:blur(16px) saturate(1.24); }
      .arena-camera-toolbar .btn { min-height:28px; padding:4px 8px; color:#9eb7d6; background:linear-gradient(155deg,#edf6ff12,transparent 45%),#0b142596; border-color:#9dbfe43b; font-size:8px; }
      .arena-camera-toolbar .btn:hover { color:#e6f5ff; border-color:#75dff0; }
      .arena-camera-toolbar select { min-height:28px; font-size:8px; }
      .arena-camera-help { width:100%; color:#7890ad; font-size:7px; text-align:right; pointer-events:none; letter-spacing:.35px; }
      @media(max-width:600px) { .arena-camera-toolbar { left:8px; right:8px; width:auto; max-width:none; justify-content:center; } .arena-camera-help { display:none; } .arena-camera-toolbar .btn { flex:1 1 auto; padding:4px 6px; } .arena-camera-toolbar select { max-width:86px; } }
    `}</style>
    <div ref={mount} style={enabled ? { position: 'absolute', inset: 0 } : { display: 'contents' }} />
    <div ref={layer} className="arena-tactical">{children}</div>
    {enabled && <div className="arena-camera-toolbar" aria-label="Arena camera controls">
      {status && status !== 'ready' && <span role="status" style={{ color: '#ffd89b', background: '#090e20ee', padding: 6, fontSize: 11 }}>{status}</span>}
      <button className="btn" title="Straight-down tactical camera" onClick={() => runtime.current?.view('tactical')}>⌗ Top</button>
      <button className="btn" title="Reset to the arena camera" onClick={() => runtime.current?.view('arena')}>◈ Arena</button>
      <button className="btn" title="Frame the active spirit" onClick={() => runtime.current?.view('focus')}>◎ Spirit</button>
      <select aria-label="Arena detail" value={quality} onChange={e => setQuality(e.target.value)}
        style={{background:'#0a102099',color:'#bcd8ed',border:'1px solid #9dbfe43b',borderRadius:4}}>
        <option value="auto">Auto detail</option><option value="high">High detail</option><option value="standard">Standard detail</option>
      </select>
      <button className="btn" onClick={() => runtime.current?.zoom(0.85)} aria-label="Zoom into arena">+</button>
      <button className="btn" onClick={() => runtime.current?.zoom(1.18)} aria-label="Zoom out of arena">−</button>
      <button className="btn" onClick={onDisable}>2D board</button>
      <span className="arena-camera-help">{qualityLabel} · click to play · drag to orbit · right-drag to pan · wheel to zoom</span>
    </div>}
  </div>;
}
