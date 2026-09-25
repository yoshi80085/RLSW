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
// 📌 ONE RENDERER FOR EVERY CARD. A single transparent canvas sits over the whole
// page (pointer-events off) and draws each card's standee into that card's
// rectangle plus a `bleed` margin — the room it has to pop OUT of the card. One
// canvas per card would be one WebGL context per card, and a page gets a
// handful; the arena spends two. It is the same trick as `arenaRenderer`'s
// foreground pass. The popped card is drawn last so it lands over its neighbours.
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
 * Every SCROLLING ancestor — a standee must not draw over the header it scrolled
 * under. ⚠️ Scrollers only, not `overflow:hidden`: the workbench is `hidden` for
 * its rounded corners, and clipping to it would stop the pop at the panel's edge,
 * which is the one place Alex asked it to break out of.
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
  document.body.appendChild(canvas);

  // The story lives on <body> too: a transformed ancestor would turn `fixed`
  // into "fixed to that ancestor", and the lobby has a few.
  const story = document.createElement('div');
  story.className = 'draft-story';
  story.id = 'spirit-story';
  story.setAttribute('role', 'tooltip');
  document.body.appendChild(story);

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
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== W || size.y !== H) renderer.setSize(W, H, false);
    renderer.setScissorTest(false);
    renderer.clear();

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
      // Clip to the viewport AND the scrolling panel the card lives in.
      let cx0 = 0, cy0 = 0, cx1 = W, cy1 = H;
      for (const el of c.clips) { const r = el.getBoundingClientRect(); cx0 = Math.max(cx0, r.left); cy0 = Math.max(cy0, r.top); cx1 = Math.min(cx1, r.right); cy1 = Math.min(cy1, r.bottom); }
      const sx0 = Math.max(cx0, f.vx), sy0 = Math.max(cy0, f.vy), sx1 = Math.min(cx1, f.vx + f.vw), sy1 = Math.min(cy1, f.vy + f.vh);
      c.visible = sx1 > sx0 && sy1 > sy0;
      if (!c.visible) continue;

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

      renderer.setViewport(f.vx, H - f.vy - f.vh, f.vw, f.vh);
      renderer.setScissor(sx0, H - sy1, sx1 - sx0, sy1 - sy0);
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
      const r = storyCard.el.getBoundingClientRect();
      story.style.left = `${storyX(r, P.storyWidth, W)}px`;
      story.style.top = `${Math.max(8, Math.min(H - story.offsetHeight - 8, r.top + r.height * 0.12))}px`;
      story.classList.add('show');
    } else { story.classList.remove('show'); storyKey = ''; }
  }
  raf = requestAnimationFrame(tick);

  return {
    register(id, el, slot) {
      if (!el || !slot || cards.has(id) || !SPIRIT_DEFS[id]) return;
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
    },
  };
}
