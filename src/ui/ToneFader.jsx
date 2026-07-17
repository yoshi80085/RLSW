import { useState, useRef, useEffect } from "react";

// Compact vertical "mixer" fader — same value/onChange/onCommit contract as AmpKnob
// but slides up/down (~50px throw). Drag the handle, scroll to nudge, double-click resets.
export function ToneFader({ label, value, onChange, onCommit, defaultValue = 0.5, color = "#ffcc44", title }) {
  const TRACK = 50, HANDLE = 9;
  const trackRef = useRef(null);
  const valueRef = useRef(value);  valueRef.current = value;
  const cbRef    = useRef({ onChange, onCommit }); cbRef.current = { onChange, onCommit };
  function setFromClientY(clientY) {
    const el = trackRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const frac = 1 - (clientY - r.top) / r.height;
    cbRef.current.onChange(Math.max(0, Math.min(1, frac)));
  }
  function onPointerDown(e) {
    e.preventDefault(); e.stopPropagation();
    const el = e.currentTarget;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    setFromClientY(e.clientY);
    const move = ev => setFromClientY(ev.clientY);
    const up = ev => {
      try { el.releasePointerCapture(ev.pointerId); } catch (_) {}
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (cbRef.current.onCommit) cbRef.current.onCommit();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  useEffect(() => {
    const el = trackRef.current; if (!el) return;
    let commitT = null;
    const onWheel = e => {
      e.preventDefault(); e.stopPropagation();
      const step = (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.015 : 0.06);
      cbRef.current.onChange(Math.max(0, Math.min(1, valueRef.current + step)));
      clearTimeout(commitT);
      commitT = setTimeout(() => { if (cbRef.current.onCommit) cbRef.current.onCommit(); }, 350);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); clearTimeout(commitT); };
  }, []);
  const fillH   = Math.round(value * (TRACK - 2));
  const handleB = Math.round(value * (TRACK - HANDLE));
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, userSelect:"none" }} title={title}>
      <div ref={trackRef} onPointerDown={onPointerDown}
        onDoubleClick={() => { cbRef.current.onChange(defaultValue); if (cbRef.current.onCommit) cbRef.current.onCommit(); }}
        style={{ position:"relative", width:16, height:TRACK, borderRadius:8, cursor:"ns-resize", touchAction:"none",
          background:"#0a0e1a", border:"1px solid #283850", boxShadow:"inset 0 1px 3px #000000aa" }}>
        <div style={{ position:"absolute", left:2, right:2, bottom:1, height:fillH, borderRadius:6, background:color, opacity:0.32 }}/>
        <div style={{ position:"absolute", left:-3, width:22, height:HANDLE, bottom:handleB, borderRadius:3,
          background:"linear-gradient(180deg,#3a4c68,#10141f)", border:`1px solid ${color}`,
          boxShadow:`0 0 5px ${color}66, inset 0 1px 1px #ffffff22` }}/>
      </div>
      <span style={{ fontSize:6, color:"#7a90aa", letterSpacing:1, fontFamily:"'Saira Stencil One',sans-serif" }}>{label}</span>
    </div>
  );
}
