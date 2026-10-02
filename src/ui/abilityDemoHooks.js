import { useCallback, useEffect, useRef, useState } from 'react';
import { ABILITY_DEMO, createAbilityDemo, hasDemo } from './abilityDemo.js';
import { canUseWebGL } from './spiritPickerStage.js';

/**
 * 🎬 THE ABILITY POP-OUT (Alex, 2026-10-01): hover an ability in the loadout and
 * a little window pops out beside it and PLAYS the move — the real standees,
 * the real Shukuchi blink, the real Bushido strike (`abilityDemo.js`).
 *
 * Three pieces, so the preview page draws these and not a copy:
 *   · `useAbilityDemo()`  — the one shared player (one WebGL canvas), made on
 *     first use and disposed with the screen. ⚠️ null without WebGL2 (jsdom, an
 *     old browser): every row simply keeps today's text guide.
 *   · `useAbilityPopout()` — hover/focus timing and where the window goes.
 *   · `AbilityDemoWindow` (`AbilityDemo.jsx`) — the window itself (picture,
 *     caption, dice, 🔈). The hooks live here so that file exports only components.
 */
export function useAbilityDemo(look = ABILITY_DEMO) {
  const ref = useRef(null);
  const [ok] = useState(() => canUseWebGL());
  const get = useCallback(() => {
    if (!ok) return null;
    // 📌 Made on first USE, not on mount: a player who never hovers an ability
    // never pays for a second WebGL context.
    if (!ref.current) { try { ref.current = createAbilityDemo({ look }); } catch { return null; } }
    return ref.current;
  }, [ok, look]);
  useEffect(() => { ref.current?.setLook(look); }, [look]);
  useEffect(() => () => { ref.current?.dispose(); ref.current = null; }, []);
  return ok ? get : null;
}

/** Hover/focus → open after `openDelay`; leave → close after `closeDelay` (the window itself counts as staying). */
export function useAbilityPopout(look = ABILITY_DEMO) {
  const [open, setOpen] = useState(null);
  const timer = useRef(0);
  const clear = () => { clearTimeout(timer.current); timer.current = 0; };
  useEffect(() => clear, []);
  const show = (skill, el) => {
    clear();
    if (!hasDemo(skill.id)) { setOpen(null); return; }
    timer.current = setTimeout(() => setOpen({ skill, rect:el.getBoundingClientRect() }), open ? 0 : look.openDelay);
  };
  const hide = () => { clear(); timer.current = setTimeout(() => setOpen(null), look.closeDelay); };
  const bind = skill => ({
    onPointerEnter:e => show(skill, e.currentTarget), onPointerLeave:hide,
    onFocus:e => show(skill, e.currentTarget), onBlur:hide,
    onKeyDown:e => { if (e.key === 'Escape') { clear(); setOpen(null); } },
  });
  // 📌 The window is placed off the row's rect AT OPEN; a scroll would leave it
  // pointing at nothing, so a scroll closes it (the next hover re-opens it).
  useEffect(() => {
    if (!open) return undefined;
    const off = () => { clearTimeout(timer.current); setOpen(null); };
    addEventListener('scroll', off, true);
    return () => removeEventListener('scroll', off, true);
  }, [open]);
  const keep = { onPointerEnter:clear, onPointerLeave:hide };
  return { open, bind, keep, close:() => { clear(); setOpen(null); } };
}

