import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ABILITY_DEMO } from './abilityDemo.js';

/**
 * 🎬 THE ABILITY POP-OUT (Alex, 2026-10-01): hover an ability in the loadout and
 * a little window pops out beside it and PLAYS the move — the real standees,
 * the real Shukuchi blink, the real Bushido strike (`abilityDemo.js`).
 * The hover timing and the shared player are `abilityDemoHooks.js`; where the
 * window goes is `popoutPlace` (pure, in `abilityDemo.js`).
 */

/**
 * The window. `variant`: 'popout' (fixed, beside the row) or 'inline' (inside
 * the Field Guide dialog).
 */
export function AbilityDemoWindow({ demo, skill, color, rivalColor, look = ABILITY_DEMO, variant = 'popout', place = null, keep = null }) {
  const pic = useRef(null), root = useRef(null);
  const [sound, setSound] = useState(() => demo?.sound ?? look.sound === 'on');
  useEffect(() => {
    if (!demo || !pic.current) return undefined;
    demo.attach(pic.current, root.current);
    demo.play(skill.id, { color, rivalColor });
    return () => demo.stop();
  }, [demo, skill.id, color, rivalColor]);
  const style = { '--demo-color':color, '--demo-rival':rivalColor };
  if (variant === 'popout' && place) Object.assign(style, { left:place.left, top:place.top, width:place.width, '--demo-arrow':`${place.arrow}px` });
  else style.width = '100%';
  const win = <div ref={root} className={`ability-demo is-${variant}${place ? ` from-${place.where}` : ''}${look.frame === 'glow' ? ' is-glow' : ''}`}
    style={style} role="img" aria-label={`${skill.label}, shown as a short animation`} {...(keep ?? {})}>
    <div className="ability-demo-head">
      <span className="draft-eyebrow">WATCH <b>{skill.icon} {skill.label}</b></span>
      <button type="button" className="ability-demo-sound" aria-pressed={sound} title={sound ? 'Sound on' : 'Sound off'}
        onClick={() => { const on = !sound; setSound(on); demo?.setSound(on); }}>{sound ? '🔊' : '🔈'}</button>
    </div>
    <div className="ability-demo-pic" ref={pic} style={{ aspectRatio:`${1 / look.aspect}` }}>
      <div className="ability-demo-chips" data-demo="chips"/>
      <div className="ability-demo-card" data-demo="card"/>
    </div>
    <div className="ability-demo-caption" data-demo="caption" aria-live="off"/>
  </div>;
  // ⚠️ The pop-out is PORTALLED to <body>: `position:fixed` inside a transformed
  // ancestor (the lobby's panels animate) is fixed to THAT box, not the screen.
  return variant === 'popout' && globalThis.document ? createPortal(win, document.body) : win;
}
