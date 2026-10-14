// ─── 🎮 THE HIGHLIGHT — what the D-pad moves and A presses ──────────────────
// Most of the game is still clicked (2026-10-14: ~230 click targets, 3 that knew
// about keyboard focus). Rather than teach every screen about a controller, the
// highlight finds what a MOUSE could click right now and lets the D-pad walk it:
//
//   · WHAT COUNTS: real buttons, links, inputs, ARIA roles, `[tabindex]`, the
//     hand's note chips (`[data-stock-idx]`), board hexes the monolith opens to
//     the pad (`[data-pad-hex]`), anything marked `[data-pad]`, and — the catch-
//     all — anything styled `cursor: pointer` inline, which is how this codebase
//     marks a clickable <div>. `[data-pad="skip"]` opts out.
//   · ⭐ WHAT IS ON TOP: a target only counts if `elementFromPoint` at its centre
//     lands on it. That one test scopes the highlight to the top-most modal,
//     skips anything behind a scrim, and skips `pointer-events:none` decoration —
//     the same things a mouse can't click. No screen has to register itself.
//   · A PRESS IS A CLICK: pointerdown → mousedown → pointerup → mouseup → click at
//     the target's centre, so `onClick`, `onPointerDown` and the arena's own
//     drag-vs-tap filter (`board/arenaDom.js`) all see what a mouse would send.
//   · ⭐ HOVER COMES FREE: landing on a target sends it mouseover/pointerover (and
//     the old one mouseout/pointerout), which is what React's onMouseEnter is built
//     from — so the note tips, the hex preview and the battle-mode previews that
//     used to need a mouse show up under the highlight.
//
// ⚠️ EVERY EVENT WE SEND CARRIES `rlswPad: true`, so `GlobalCursor` can ignore
// it (otherwise the mouse arrow would jump to every button the pad presses), and
// the ring knows a real mouse move from ours.
import { pickNeighbor, nearestTo } from './padNav.js';

/** The ring's look. ✅ Alex's dial-in, 2026-10-14 (Controller Lab): 0 of 7 moved — kept as is. */
export const PAD_RING = Object.freeze({
  color: '#5ef0ff',      // the cursor's own cyan bloom (GlobalCursor)
  width: 2,              // px
  glow: 14,              // px of bloom
  pad: 4,                // px the ring stands off its target
  radius: 8,             // px corner
  pulse: 1.4,            // s per breath; 0 = still
  glide: 90,             // ms to slide between targets; 0 = jump
  hideOnMouse: 6,        // px of real mouse travel that hands control back to the mouse
});

export const PAD_TARGETS = [
  'button', 'a[href]', 'input:not([type=hidden])', 'select', 'textarea', 'summary',
  '[role=button]', '[role=menuitem]', '[role=option]', '[role=tab]', '[role=checkbox]', '[role=switch]', '[role=radio]',
  '[tabindex]:not([tabindex="-1"])', '[data-stock-idx]', '[data-pad-hex]', '[data-pad]',
  '[style*="cursor: pointer"]', '[style*="cursor:pointer"]',
].join(',');
const OFF = '[data-pad="skip"],[inert],[aria-hidden="true"]';
const TEXT_ENTRY = 'input:not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=range]),textarea,select,[contenteditable="true"]';

const tag = ev => { try { Object.defineProperty(ev, 'rlswPad', { value: true }); } catch { /* frozen */ } return ev; };

export function createPadFocus({ doc = globalThis.document, win = globalThis.window, look = PAD_RING } = {}) {
  if (!doc?.body || !win) return null;
  let target = null, shown = false, raf = 0, lastPoint = null, lastCheck = 0, disposed = false;

  // ── the ring ──
  const ring = doc.createElement('div');
  ring.setAttribute('data-pad-ring', '');
  ring.setAttribute('aria-hidden', 'true');
  const reduced = () => !!win.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const styleRing = () => {
    Object.assign(ring.style, {
      position: 'fixed', left: '0px', top: '0px', width: '0px', height: '0px', zIndex: '2147483000',
      pointerEvents: 'none', boxSizing: 'border-box', display: 'none',
      border: `${look.width}px solid ${look.color}`, borderRadius: `${look.radius}px`,
      boxShadow: `0 0 ${look.glow}px ${look.color}, inset 0 0 ${Math.round(look.glow / 2)}px ${look.color}55`,
      transition: reduced() || !look.glide ? 'none'
        : `transform ${look.glide}ms ease-out, width ${look.glide}ms ease-out, height ${look.glide}ms ease-out`,
      animation: reduced() || !look.pulse ? 'none' : `rlsw-pad-breathe ${look.pulse}s ease-in-out infinite`,
    });
  };
  const sheet = doc.createElement('style');
  sheet.textContent = '@keyframes rlsw-pad-breathe{0%,100%{opacity:1}50%{opacity:.62}}';
  doc.head?.appendChild(sheet);
  styleRing();
  doc.body.appendChild(ring);

  // ── finding targets ──
  const vw = () => win.innerWidth || doc.documentElement?.clientWidth || 0;
  const vh = () => win.innerHeight || doc.documentElement?.clientHeight || 0;
  function onTop(el, r) {
    if (typeof doc.elementFromPoint !== 'function') return true;
    for (const [fx, fy] of [[.5, .5], [.25, .3], [.75, .7], [.3, .75], [.7, .25]]) {
      const x = Math.min(vw() - 1, Math.max(0, r.left + r.width * fx));
      const y = Math.min(vh() - 1, Math.max(0, r.top + r.height * fy));
      const hit = doc.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) return true;
    }
    return false;
  }
  function usable(el) {
    if (!el?.isConnected || el === ring) return false;
    if (el.disabled || el.getAttribute?.('aria-disabled') === 'true' || el.closest?.(OFF)) return false;
    const r = el.getBoundingClientRect?.();
    if (!r || r.width < 6 || r.height < 6) return false;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw() || r.top >= vh()) return false;
    const cs = win.getComputedStyle?.(el);
    if (cs && (cs.visibility === 'hidden' || cs.display === 'none')) return false;
    return onTop(el, r);
  }
  /** Every target the pad can reach right now, outermost of any nested pair. */
  function candidates() {
    const all = [...doc.querySelectorAll(PAD_TARGETS)];
    const set = new Set(all);
    const outer = all.filter(el => { for (let p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false; return true; });
    return outer.filter(usable);
  }
  const rectOf = el => el.getBoundingClientRect();
  const centreOf = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

  // ── hover in and out ──
  function send(el, type, init = {}, Ctor = null) {
    const r = rectOf(el), c = centreOf(r);
    const C = Ctor ?? (type.startsWith('pointer') ? (win.PointerEvent ?? win.MouseEvent) : win.MouseEvent);
    const bubbles = !/enter|leave/.test(type);
    const ev = new C(type, { bubbles, cancelable: true, composed: true, clientX: c.x, clientY: c.y, view: win,
      pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0, ...init });
    el.dispatchEvent(tag(ev));
  }
  function hoverTo(next) {
    const prev = target;
    if (prev === next) return;
    if (prev?.isConnected) {
      for (const t of ['pointerout', 'pointerleave', 'mouseout', 'mouseleave']) send(prev, t, { relatedTarget: next ?? null });
    }
    target = next;
    if (next) for (const t of ['pointerover', 'pointerenter', 'mouseover', 'mouseenter']) send(next, t, { relatedTarget: prev ?? null });
  }

  // ── the ring follows its target (a hex moves when the lens turns) ──
  function paint() {
    raf = 0;
    if (!shown || disposed) return;
    const now = win.performance?.now?.() ?? Date.now();
    if (now - lastCheck > 250) {   // ⚠️ throttled: `usable` hit-tests, and a target can vanish mid-turn
      lastCheck = now;
      if (!usable(target)) { const list = candidates(); hoverTo(list.length ? list[nearestTo(lastPoint ?? defaultPoint(), list.map(rectOf))] : null); }   // ⚠️ hoverTo, not land: land() would kick a second rAF loop from inside this one
    }
    if (target) {
      const r = rectOf(target), p = look.pad;
      ring.style.display = 'block';
      ring.style.transform = `translate(${Math.round(r.left - p)}px, ${Math.round(r.top - p)}px)`;
      ring.style.width = `${Math.round(r.width + 2 * p)}px`;
      ring.style.height = `${Math.round(r.height + 2 * p)}px`;
      lastPoint = centreOf(r);
    } else ring.style.display = 'none';
    raf = win.requestAnimationFrame?.(paint) ?? 0;
  }
  const kick = () => { if (!raf && shown) raf = win.requestAnimationFrame?.(paint) ?? 0; if (!win.requestAnimationFrame) paint(); };
  const defaultPoint = () => ({ x: vw() / 2, y: vh() * .62 });
  function land(el) { hoverTo(el ?? null); kick(); }

  /** Show the ring: back where it was, else on `[data-pad-default]`, else nearest the middle. */
  function show() {
    if (disposed) return false;
    const was = shown; shown = true;
    if (!usable(target)) {
      const list = candidates();
      const preferred = list.find(el => el.matches?.('[data-pad-default]'));
      land(preferred ?? (list.length ? list[nearestTo(lastPoint ?? defaultPoint(), list.map(rectOf))] : null));
    } else if (!was) { const t = target; target = null; land(t); }
    kick();
    return !was;
  }
  function hide() {
    if (!shown) return;
    shown = false; hoverTo(null); ring.style.display = 'none';
    if (raf) { win.cancelAnimationFrame?.(raf); raf = 0; }
  }

  /** Move the highlight. Nothing that way → scroll the list it sits in, once, and look again. */
  function move(dir, retried = false) {
    if (!shown) return show();
    const list = candidates();
    if (!target || !list.includes(target)) { land(list.length ? list[nearestTo(lastPoint ?? defaultPoint(), list.map(rectOf))] : null); return true; }
    const rects = list.map(rectOf), from = rects[list.indexOf(target)];
    const i = pickNeighbor(from, rects, dir);
    if (i >= 0) { land(list[i]); return true; }
    if (!retried && scrollToward(target, dir)) { win.setTimeout(() => move(dir, true), 60); return true; }
    return false;
  }
  function scrollToward(el, dir) {
    const vert = dir === 'up' || dir === 'down', sign = dir === 'down' || dir === 'right' ? 1 : -1;
    for (let p = el?.parentElement; p && p !== doc.body; p = p.parentElement) {
      const cs = win.getComputedStyle?.(p);
      const over = vert ? cs?.overflowY : cs?.overflowX;
      if (!/(auto|scroll)/.test(over ?? '')) continue;
      const room = vert ? p.scrollHeight - p.clientHeight : p.scrollWidth - p.clientWidth;
      const at = vert ? p.scrollTop : p.scrollLeft;
      if (room <= 1 || (sign > 0 ? at >= room - 1 : at <= 0)) continue;
      const by = sign * Math.round((vert ? p.clientHeight : p.clientWidth) * .6);
      p.scrollBy?.(vert ? { top: by } : { left: by });
      return true;
    }
    return false;
  }

  /** ←/→ on a slider nudges it (the ☰ volume faders) instead of leaving it. */
  function adjust(dir) {
    const el = target;
    if (!shown || !el || el.tagName !== 'INPUT' || el.type !== 'range' || (dir !== 'left' && dir !== 'right')) return false;
    const min = Number(el.min || 0), max = Number(el.max || 100), step = Number(el.step) || 1;
    const by = Math.max(step, (max - min) / 20) * (dir === 'right' ? 1 : -1);
    const v = Math.min(max, Math.max(min, Number(el.value) + by));
    // ⚠️ React's onChange only hears a value set through the NATIVE setter.
    Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')?.set?.call(el, String(v));
    el.dispatchEvent(tag(new win.Event('input', { bubbles: true })));
    el.dispatchEvent(tag(new win.Event('change', { bubbles: true })));
    return true;
  }

  /** A on the highlight = a mouse click there. A text field takes focus instead (a pad has no keys). */
  function press(el = target) {
    if (!el?.isConnected) return false;
    if (el.matches?.(TEXT_ENTRY)) { el.focus?.(); return true; }
    send(el, 'pointerdown', { buttons: 1 });
    send(el, 'mousedown', { buttons: 1 }, win.MouseEvent);
    send(el, 'pointerup');
    send(el, 'mouseup', {}, win.MouseEvent);
    send(el, 'click', { detail: 1 }, win.MouseEvent);
    return true;
  }
  /** Press the first usable element matching a selector (☰ from the Menu button), and highlight it. */
  function pressSelector(selector) {
    const el = [...doc.querySelectorAll(selector)].find(usable);
    if (!el) return false;
    shown = true; land(el); press(el); return true;
  }

  // A real mouse takes over again.
  const onMouse = e => {
    if (!shown || e.rlswPad) return;
    if (Math.abs(e.movementX ?? 0) + Math.abs(e.movementY ?? 0) >= look.hideOnMouse) hide();
  };
  doc.addEventListener('pointermove', onMouse, { capture: true, passive: true });

  return {
    show, hide, move, press, adjust, pressSelector, candidates,
    visible: () => shown, target: () => target,
    dispose() {
      disposed = true; hide();
      doc.removeEventListener('pointermove', onMouse, { capture: true });
      ring.remove(); sheet.remove();
    },
  };
}
