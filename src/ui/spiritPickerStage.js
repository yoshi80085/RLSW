// 🎭 SPIRIT PICKER STAGE — the select screen's cards show the real board
// standee, it POPS when you hover, and its backstory appears if you stay.
//
// Alex, 2026-09-25: "When choosing a Spirit in the selection screen - when the
// mouse hovers over a character - have it 'pop out' - if it hovers over even
// longer, have its backstory revealed - place holder story for the time being.
// Change the buttons so that the 3D standee shows - not just the picture."
//
// ⭐ EVERY NUMBER HERE IS ALEX'S DIAL-IN off `.scratch/spirit-picker-preview.html`
// (2026-09-25): 2 of 31 levers moved — `panelLook` glass → tint, and `compare`
// (a preview-only switch). `spiritPickerCheck.mjs` §0 fails if the page and this
// file drift apart, so move a number here → move it on the page too.
//
// 📌 ONE RENDERER FOR EVERY CARD. A single transparent canvas covers the roster
// (pointer-events off) and draws each card's standee into that card's
// rectangle plus a `bleed` margin — the room it has to pop OUT of the card. One
// canvas per card would be one WebGL context per card, and a page gets a
// handful; the arena spends two. It is the same trick as `arenaRenderer`'s
// foreground pass. The popped card is drawn last so it lands over its neighbours.
//
// ⚠️ THE CANVAS SCROLLS WITH THE CARDS — it lives IN the panel that scrolls
// (`position:absolute`), not fixed over the window. It used to be fixed and
// redrawn every frame at the cards' new place, and the browser scrolls the page
// on its own thread, ahead of the script: every scroll moved the cards a frame
// before the standees, which then visibly JUMPED to catch up (Alex, 2026-10-03).
// Now the browser moves the canvas with the cards in the same paint, and what is
// drawn on it only depends on where a card sits RELATIVE to the canvas — which a
// scroll never changes. The backstory panel lives there too, for the same reason.
//
// 📌 TWO HALVES, like `standee.js`: the top is pure (timing, framing, which side
// the story goes) and is what the suite reads; the bottom owns three and the DOM.
// React (`SpiritDraft.jsx`) only renders the cards and reports hover/focus/pick.
import * as THREE from 'three';
import { createStandee, STANDEE } from '../board/standee.js';
import { SPIRIT_DEFS, IN_DEVELOPMENT } from '../data/spirits.js';
import { NEUTRAL_SPIRIT_COLOR } from '../data/corners.js';
import { storyFor } from '../data/spiritStories.js';

export const SPIRIT_PICKER = Object.freeze({
  panelLook:'tint', halo:'on', fit:0.72, footPad:54, elev:10, fov:28, locked:'silhouette',
  idle:'sway', idleYaw:-16, swayDeg:8, swaySpeed:0.5,
  popDelay:120, popSpeed:12, popScale:1.3, popLift:0.35, popTurn:'on', popGlow:2, popRing:'on',
  cardLift:6, dimOthers:0.35, bleed:110, selectSpin:'on',
  storyDelay:1300, storyAt:'beside', storyWidth:300, storyCps:160, storyStats:'on',
});

// ── pure ─────────────────────────────────────────────────────────────────────

const DEG = Math.PI / 180;

/** Pop (1) or rest (0), from how long the card has been hovered. Locked Spirits never pop. */
export function popTarget(heldMs, P = SPIRIT_PICKER, { locked = false } = {}) {
  return !locked && heldMs != null && heldMs >= P.popDelay ? 1 : 0;
}

/** One frame of the pop easing toward its target — exponential, so it never overshoots. */
export function easePop(p, target, dt, P = SPIRIT_PICKER, reduced = false) {
  if (reduced) return target;
  const next = p + (target - p) * (1 - Math.exp(-P.popSpeed * dt));
  return Math.abs(next - target) < 1e-3 ? target : next;
}

/** Is the backstory up? It needs the whole `storyDelay` of hover, and Escape puts it away. */
export const storyShowing = (heldMs, P = SPIRIT_PICKER, dismissed = false) =>
  !dismissed && heldMs != null && heldMs >= P.storyDelay;

/** How many characters of the story have typed on. Reduced motion or cps 0 → all of it. */
export function typedChars(msShown, total, P = SPIRIT_PICKER, reduced = false) {
  if (reduced || P.storyCps <= 0) return total;
  return Math.max(0, Math.min(total, Math.floor(msShown / 1000 * P.storyCps)));
}

/**
 * 📐 Where the camera stands for one card. The standee is sized as a SHARE OF THE
 * CARD (`fit`), not in world units, so it fits the 220px desktop card and the
 * 190px tablet card the same way. `ppu` is screen px per world unit at the
 * standee; the distance follows from it and the lens, and the feet land
 * `footPad` px above the card's bottom edge, clear of the caption.
 */
export function pickerFraming(rect, P = SPIRIT_PICKER, standeeHeight = STANDEE.height) {
  const B = P.bleed;
  const vx = rect.left - B, vy = rect.top - B, vw = rect.width + 2 * B, vh = rect.height + 2 * B;
  const ppu = P.fit * rect.height / (standeeHeight + 0.15);
  const dist = vh / (2 * Math.tan(P.fov / 2 * DEG) * ppu);
  const lookY = (B + rect.height - P.footPad - vh / 2) / ppu;
  const e = P.elev * DEG;
  return { vx, vy, vw, vh, ppu, dist, lookY, camY:lookY + dist * Math.sin(e), camZ:dist * Math.cos(e) };
}

/** Resting yaw: the three-quarter angle that lets the acrylic's thickness read, plus the sway. */
export function idleYaw(t, phase, P = SPIRIT_PICKER, reduced = false) {
  const base = P.idleYaw * DEG;
  if (reduced || P.idle === 'still') return base;
  if (P.idle === 'turntable') { const a = base + t * P.swaySpeed * 1.5 + phase; return Math.atan2(Math.sin(a), Math.cos(a)); }
  return base + P.swayDeg * DEG * Math.sin(t * P.swaySpeed * 2 + phase);
}

/** The story panel beside the card: the right side if it fits, else the left, always on screen. */
export function storyX(rect, width, viewportW, gap = 14) {
  const x = rect.right + gap + width <= viewportW - 8 ? rect.right + gap : rect.left - gap - width;
  return Math.max(8, Math.min(viewportW - width - 8, x));
}

// ── three + DOM ──────────────────────────────────────────────────────────────

/**
 * Can this browser draw the stage at all? three r180 needs WebGL2. ⚠️ jsdom (the
 * `test:loadoutui` run) has no WebGL2RenderingContext, and asking a jsdom canvas
 * for a context prints a "not implemented" error — so ask the WINDOW, not a canvas.
 */
export function canUseWebGL() {
  return typeof window !== 'undefined' && typeof window.WebGL2RenderingContext !== 'undefined';
}

/**
 * Every SCROLLING ancestor, nearest first. The nearest one is where the canvas
 * lives, so it scrolls with the cards and is clipped by that panel for free — a
 * standee must not draw over the header it scrolled under. ⚠️ Scrollers only, not
 * `overflow:hidden`: the workbench is `hidden` for its rounded corners, and
 * living in it would stop the pop at the panel's edge, which is the one place
 * Alex asked it to break out of.
 */
function scrollersOf(el) {
  const out = [];
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === 'auto' || o === 'scroll') out.push(p);
  }
  return out;
}

/**
 * The stage. Throws if WebGL cannot start — the caller falls back to the flat art.
 * `register(id, card, slot)` hands it a card; hover/leave/dismiss/picked are the
 * card's events; `dispose()` takes the canvas, the story and every GPU buffer away.
 *
 * 🎨 `color` is the CHOOSING PLAYER'S colour, and every card wears it — edge,
 * base, rim light, story panel (Alex, 2026-09-25: no Spirit has a colour of its
 * own). `setColor` re-cuts every standee when the seat that is choosing changes;
 * the canvas and its one WebGL context stay.
 */
export function createSpiritPickerStage({ P = SPIRIT_PICKER, color = NEUTRAL_SPIRIT_COLOR } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'draft-standee-layer';
  canvas.setAttribute('aria-hidden', 'true');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true, powerPreference:'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;           // as arenaRenderer
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  // 📌 left/top start at 0 so `place()` can steer the canvas by the difference
  // between where it IS and where it should be, whatever its containing block.
  canvas.style.left = '0px'; canvas.style.top = '0px';
  document.body.appendChild(canvas);

  // The story rides beside the canvas (same parent, same containing block), so
  // it scrolls with the card it belongs to.
  const story = document.createElement('div');
  story.className = 'draft-story';
  story.id = 'spirit-story';
  story.setAttribute('role', 'tooltip');
  document.body.appendChild(story);

  // 🏠 The host: the cards' nearest scrolling panel, else <body> (the page
  // itself scrolls). Chosen at the first `register`, when there is a card to ask.
  // A static scroller is made `relative` so it is the canvas's containing block —
  // otherwise an absolute child would not scroll with it; put back on dispose.
  let host = null, hostPosition = null;
  function mount(slot) {
    if (host) return;
    const s = scrollersOf(slot)[0];
    host = s ?? document.body;
    if (s && getComputedStyle(s).position === 'static') { hostPosition = s.style.position; s.style.position = 'relative'; }
    host.append(canvas, story);
  }
  /** The host's visible width in viewport px — the canvas never widens the page sideways. */
  function hostSpan() {
    if (host === document.body) return { x0:0, x1:document.documentElement.clientWidth || window.innerWidth };
    const r = host.getBoundingClientRect();
    return { x0:r.left + host.clientLeft, x1:r.left + host.clientLeft + host.clientWidth };
  }
  /**
   * 📐 Size and place the canvas over every card + its bleed; returns its box in
   * viewport px. Only a LAYOUT change moves it — a scroll moves the cards and the
   * canvas together, so the box it wants and the box it has stay equal.
   */
  function place() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of cards.values()) {
      const r = c.slot.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    }
    if (!(x1 > x0)) return null;
    const span = hostSpan();
    x0 = Math.floor(Math.max(span.x0, x0 - P.bleed)); x1 = Math.ceil(Math.min(span.x1, x1 + P.bleed));
    y0 = Math.floor(y0 - P.bleed); y1 = Math.ceil(y1 + P.bleed);
    const w = x1 - x0, h = y1 - y0, at = canvas.getBoundingClientRect();
    if (Math.abs(at.left - x0) > 0.5 || Math.abs(at.top - y0) > 0.5) {
      canvas.style.left = `${parseFloat(canvas.style.left) + x0 - at.left}px`;
      canvas.style.top = `${parseFloat(canvas.style.top) + y0 - at.top}px`;
    }
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) renderer.setSize(w, h);
    return { x0, y0, w, h };
  }

  const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const cards = new Map();
  let raf = 0, last = performance.now(), storyKey = '';

  function build(id, el, slot) {
    const sp = { ...SPIRIT_DEFS[id], color };
    const scene = new THREE.Scene();
    // 📌 The arena's foreground lights verbatim, so the sheet reads the same here
    // as on the board — plus a rim in the PLAYER'S colour so the edge catches.
    const hemi = new THREE.HemisphereLight(0xddeaff, 0x34314f, 2.5);
    const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(5, 12, 7);
    const rim = new THREE.DirectionalLight(new THREE.Color(sp.color), 1.4); rim.position.set(-4, 4, -6);
    scene.add(hemi, key, rim);
    const standee = createStandee(sp, { T:{ ...STANDEE, panelLook:P.panelLook } });
    scene.add(standee.group);
    const byOrder = o => standee.parts.find(m => m.renderOrder === o);
    const art = byOrder(10), edge = byOrder(9);
    const locked = IN_DEVELOPMENT.has(id);
    if (locked && P.locked !== 'full') {
      art.material.color.set(P.locked === 'silhouette' ? 0x000000 : 0x6b7385);
      art.material.emissiveIntensity = P.locked === 'silhouette' ? 0 : 0.2;
      edge.material.emissive.set(0x4a5670);
    }
    return { id, sp, el, slot, locked, scene, standee, art, edge,
      artBase:art.material.emissiveIntensity, edgeBase:edge.material.emissiveIntensity,
      lights:[hemi, key, rim], lightBase:[hemi.intensity, key.intensity, rim.intensity],
      cam:new THREE.PerspectiveCamera(P.fov, 1, 0.1, 200), clips:scrollersOf(slot),
      hoverSince:null, p:0, spinAt:-1, shownAt:-1, dismissed:false, phase:cards.size * 1.7 };
  }

  function storyHTML(c, typed) {
    const s = storyFor(c.id);
    story.replaceChildren();
    const eyebrow = document.createElement('div'); eyebrow.className = 'draft-eyebrow';
    eyebrow.textContent = 'BACKSTORY';
    if (s.placeholder) { const tag = document.createElement('i'); tag.textContent = 'PLACEHOLDER'; eyebrow.append(tag); }
    const h = document.createElement('h3'); h.textContent = c.sp.name;
    const sub = document.createElement('small');
    sub.textContent = c.locked ? 'IN DEVELOPMENT' : `${c.sp.style} / ${c.sp.speed} speed`;
    story.append(eyebrow, h, sub);
    let left = typed;
    for (const t of s.paragraphs) {
      // ⭐ The untyped rest is laid out but invisible, so the panel is its final
      // size from the first frame and nothing jumps as the text types on.
      const n = Math.max(0, Math.min(t.length, left)); left -= t.length;
      const p = document.createElement('p'), on = document.createElement('span'), rest = document.createElement('span');
      on.textContent = t.slice(0, n); rest.textContent = t.slice(n); rest.className = 'ghost';
      p.append(on, rest); story.append(p);
    }
    if (P.storyStats === 'on' && !c.locked) {
      const row = document.createElement('div'); row.className = 'draft-story-stats';
      for (const [k, v] of [['DRIVE', c.sp.drive], ['SUSTAIN', c.sp.sustain], ['VIBE', c.sp.maxVibe], ['SPEED', c.sp.speed]]) {
        const chip = document.createElement('span'), b = document.createElement('b');
        chip.textContent = `${k} `; b.textContent = v; chip.append(b); row.append(chip);
      }
      story.append(row);
    }
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const t = now / 1000, reduced = !!reducedQuery?.matches;
    const W = window.innerWidth, H = window.innerHeight;
    const box = place();
    renderer.setScissorTest(false);
    renderer.clear();
    if (!box) return;

    let maxP = 0, storyCard = null;
    for (const c of cards.values()) {
      const held = c.hoverSince == null ? null : now - c.hoverSince;
      c.p = easePop(c.p, popTarget(held, P, { locked:c.locked }), dt, P, reduced);
      if (storyShowing(held, P, c.dismissed)) { storyCard = c; if (c.shownAt < 0) c.shownAt = now; } else c.shownAt = -1;
      maxP = Math.max(maxP, c.p);
    }

    for (const c of [...cards.values()].sort((a, b) => a.p - b.p)) {
      const p = c.p, dim = 1 - P.dimOthers * Math.max(0, maxP - p);
      c.el.style.transform = p > 0 ? `translateY(${-P.cardLift * p}px)` : '';
      c.el.classList.toggle('is-popped', p > 0.5);
      c.el.style.filter = dim < 0.999 ? `brightness(${0.55 + 0.45 * dim})` : '';

      const f = pickerFraming(c.el.getBoundingClientRect(), P);
      // On screen at all? (The viewport AND every panel it scrolls in.) Only the
      // story asks — the drawing itself is clipped by the host panel for free.
      let cx0 = 0, cy0 = 0, cx1 = W, cy1 = H;
      for (const el of c.clips) { const r = el.getBoundingClientRect(); cx0 = Math.max(cx0, r.left); cy0 = Math.max(cy0, r.top); cx1 = Math.min(cx1, r.right); cy1 = Math.min(cy1, r.bottom); }
      c.visible = Math.min(cx1, f.vx + f.vw) > Math.max(cx0, f.vx) && Math.min(cy1, f.vy + f.vh) > Math.max(cy0, f.vy);
      // ⚠️ Scissor to the CANVAS only, in canvas px. Clipping to the viewport or
      // the panel here would be measured a frame behind a threaded scroll — the
      // jump this layout exists to remove, moved to the standee's cut edge.
      const fx = f.vx - box.x0, fy = f.vy - box.y0;
      const sx0 = Math.max(0, fx), sy0 = Math.max(0, fy), sx1 = Math.min(box.w, fx + f.vw), sy1 = Math.min(box.h, fy + f.vh);
      if (!(sx1 > sx0 && sy1 > sy0)) continue;

      c.cam.fov = P.fov; c.cam.aspect = f.vw / f.vh; c.cam.updateProjectionMatrix();
      c.cam.position.set(0, f.camY, f.camZ); c.cam.lookAt(0, f.lookY, 0);

      const rest = idleYaw(t, c.phase, P, reduced);
      let yaw = P.popTurn === 'on' ? rest * (1 - p) : rest;
      if (P.selectSpin === 'on' && c.spinAt > 0 && !reduced) {
        const k = Math.min(1, (now - c.spinAt) / 700);
        yaw += Math.PI * 2 * (1 - (1 - k) ** 3);
        if (k >= 1) c.spinAt = -1;
      }
      c.standee.group.scale.setScalar(1 + (P.popScale - 1) * p);
      c.standee.group.position.y = P.popLift * p;
      c.standee.group.rotation.y = yaw;
      c.standee.frame(t + c.phase, { acting:P.popRing === 'on' && p > 0.5, reduced });
      c.edge.material.emissiveIntensity = c.edgeBase * (1 + (P.popGlow - 1) * p) * dim;
      c.art.material.emissiveIntensity = c.artBase * dim;
      c.lights.forEach((l, i) => { l.intensity = c.lightBase[i] * dim; });

      renderer.setViewport(fx, box.h - fy - f.vh, f.vw, f.vh);
      renderer.setScissor(sx0, box.h - sy1, sx1 - sx0, sy1 - sy0);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(c.scene, c.cam);
    }

    if (storyCard && storyCard.visible) {
      const s = storyFor(storyCard.id), total = s.paragraphs.join('').length;
      const typed = typedChars(now - storyCard.shownAt, total, P, reduced);
      const k = `${storyCard.id}|${typed}`;
      if (k !== storyKey) { storyHTML(storyCard, typed); storyKey = k; }
      story.style.setProperty('--spirit-color', storyCard.sp.color);
      story.style.width = `${P.storyWidth}px`;
      // Placed in viewport px as before, then written in the host's px — the
      // canvas's own left/top are the exchange rate (same containing block).
      const r = storyCard.el.getBoundingClientRect();
      const vx = storyX(r, P.storyWidth, W), vy = Math.max(8, Math.min(H - story.offsetHeight - 8, r.top + r.height * 0.12));
      story.style.left = `${parseFloat(canvas.style.left) + vx - box.x0}px`;
      story.style.top = `${parseFloat(canvas.style.top) + vy - box.y0}px`;
      story.classList.add('show');
    } else { story.classList.remove('show'); storyKey = ''; }
  }
  raf = requestAnimationFrame(tick);

  return {
    register(id, el, slot) {
      if (!el || !slot || cards.has(id) || !SPIRIT_DEFS[id]) return;
      mount(slot);
      cards.set(id, build(id, el, slot));
    },
    hover(id) { const c = cards.get(id); if (c && c.hoverSince == null) { c.hoverSince = performance.now(); c.dismissed = false; } },
    leave(id) { const c = cards.get(id); if (c) c.hoverSince = null; },
    dismiss(id) { const c = cards.get(id); if (c) c.dismissed = true; },
    picked(id) { const c = cards.get(id); if (c) c.spinAt = performance.now(); },
    setColor(next) {
      if (!next || next === color) return;
      color = next;
      // Rebuild in place: hover, pop and spin carry over so a switch mid-hover
      // does not snap the card back to rest.
      for (const [id, c] of cards) {
        c.standee.dispose(); c.scene.clear();
        const n = build(id, c.el, c.slot);
        Object.assign(n, { hoverSince:c.hoverSince, p:c.p, spinAt:c.spinAt, shownAt:c.shownAt, dismissed:c.dismissed, phase:c.phase });
        cards.set(id, n);
      }
    },
    dispose() {
      cancelAnimationFrame(raf);
      for (const c of cards.values()) {
        c.standee.dispose(); c.scene.clear();
        c.el.style.transform = ''; c.el.style.filter = ''; c.el.classList.remove('is-popped');
      }
      cards.clear();
      renderer.dispose(); renderer.forceContextLoss();
      canvas.remove(); story.remove();
      if (hostPosition != null) host.style.position = hostPosition;
      host = null;
    },
  };
}
