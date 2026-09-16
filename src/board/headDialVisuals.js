import * as THREE from 'three';
import { HEAD_DIAL, createHeadDialState } from './headDial.js';
import { DIAL_TICK } from '../ui/dialTick.js';

// ── 🎛️ HEAD DIAL VISUALS — the three.js half of `headDial.js` ───────────────
//
// One rig per visible Spirit: two dial sprites (Drive, Sustain) and a ±N tag,
// all canvas-texture `THREE.Sprite`s with depthTest off — the construction
// `sonicSceneLabel` already uses for text over a pawn, so the arena has ONE way
// of floating things over heads.
//
// ⚠️ THE DIAL IS `ui/ArenaDial.jsx`'s GEOMETRY, REDRAWN ON A CANVAS, not a new
// design: ten blocks over a 270° sweep, bright bracket corners, white head line,
// label under, number in the middle. Two places draw it and they must agree —
// `headDialCheck` asserts the shared constants so a change to one is noticed.
//
// ⚠️ A CANVAS IS ONLY REPAINTED WHEN WHAT IT SHOWS CHANGED (value, flash, flare)
// — a texture upload per frame per dial would be the most expensive thing on the
// arena for something that is usually idle.
//
// 📌 Headless (node, jsdom without canvas): sprites still exist, scale and fade,
// and carry `userData.drawn` so the check can read what would have been painted.

const SIZE = 74, MAX = 10, START = -135, SWEEP = 270;
const R = SIZE * 0.352, SEG = SWEEP / MAX, GAP = 3.8, WIDTH = 5.4, CUT = 10, INSET = 1.2, RUN = CUT + 6;
const TEX = 256, K = TEX / SIZE;
export const HEAD_DIAL_GEOMETRY = Object.freeze({ SIZE, MAX, START, SWEEP, GAP, WIDTH, CUT, INSET });
export const HEAD_DIAL_COLORS = Object.freeze({ drive: '#ff6644', sustain: '#44aaff' });

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v * t + B[i] * (1 - t))).join(',')})`; };
const rad = deg => ((deg - 90) * Math.PI) / 180;

function paintDial(ctx, stat, dial) {
  const color = HEAD_DIAL_COLORS[stat], c = SIZE / 2, [r0, g0, b0] = rgb(color);
  ctx.clearRect(0, 0, TEX, TEX);
  ctx.save(); ctx.scale(K, K);
  // The dark disc: a head dial sits over lasers, pyro and bright hexes, where the
  // pocket's dark HUD glass is not there to hold the contrast.
  ctx.fillStyle = 'rgba(3,6,14,.72)'; ctx.beginPath(); ctx.arc(c, c, R + 5.2, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(c, c, 0, c, c, R - 3);
  g.addColorStop(0, `rgba(${r0},${g0},${b0},.24)`); g.addColorStop(.7, `rgba(${r0},${g0},${b0},.06)`); g.addColorStop(1, `rgba(${r0},${g0},${b0},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, R - 3, 0, Math.PI * 2); ctx.fill();
  const A = INSET, B = SIZE - INSET;
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = .17; ctx.lineWidth = .8; ctx.beginPath();
  ctx.moveTo(A + RUN, A); ctx.lineTo(B - RUN, A); ctx.moveTo(A, A + RUN); ctx.lineTo(A, B - RUN); ctx.moveTo(B, A + RUN); ctx.lineTo(B, B - RUN); ctx.stroke();
  ctx.globalAlpha = .72; ctx.lineWidth = 1.1; ctx.beginPath();
  ctx.moveTo(A, A + RUN); ctx.lineTo(A, A + CUT); ctx.lineTo(A + CUT, A); ctx.lineTo(A + RUN, A);
  ctx.moveTo(B - RUN, A); ctx.lineTo(B - CUT, A); ctx.lineTo(B, A + CUT); ctx.lineTo(B, A + RUN);
  ctx.moveTo(B, B - RUN); ctx.lineTo(B, B - CUT); ctx.lineTo(B - CUT, B); ctx.lineTo(B - RUN, B);
  ctx.moveTo(A + RUN, B); ctx.lineTo(A + CUT, B); ctx.lineTo(A, B - CUT); ctx.lineTo(A, B - RUN); ctx.stroke();
  const block = (i, w) => { ctx.lineWidth = w; ctx.beginPath(); ctx.arc(c, c, R, rad(START + i * SEG + GAP / 2), rad(START + (i + 1) * SEG - GAP / 2)); ctx.stroke(); };
  ctx.lineCap = 'butt';
  const off = mix(color, '#16253f', .26);
  for (let i = 0; i < MAX; i++) { ctx.strokeStyle = off; ctx.globalAlpha = i < dial.lit ? .18 : 1; block(i, WIDTH); }
  ctx.strokeStyle = color; ctx.globalAlpha = .17 + (DIAL_TICK.flarePeak - .17) * dial.flare;
  for (let i = 0; i < dial.lit; i++) block(i, WIDTH + 3.4);
  ctx.globalAlpha = 1; for (let i = 0; i < dial.lit; i++) block(i, WIDTH);
  if (dial.flash) { ctx.strokeStyle = dial.flash.dir > 0 ? '#ffffff' : '#ff3344'; ctx.globalAlpha = dial.flash.fade; block(dial.flash.index, WIDTH + 1.2); }
  if (dial.lit > 0) { ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = .95; block(dial.lit - 1, 1.4); }
  ctx.globalAlpha = .3; ctx.strokeStyle = color; ctx.lineWidth = .5; ctx.beginPath(); ctx.arc(c, c, R - 6.2, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = "400 5.8px 'Saira Stencil One', sans-serif";
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(3,6,14,.85)'; ctx.strokeText(stat.toUpperCase(), c, SIZE - INSET);
  ctx.fillStyle = color; ctx.fillText(stat.toUpperCase(), c, SIZE - INSET);
  ctx.font = "400 17px 'Saira Stencil One', sans-serif";
  ctx.lineWidth = 2.8; ctx.strokeStyle = '#03060e'; ctx.strokeText(String(dial.value), c, c + .5);
  ctx.fillStyle = '#fff'; ctx.fillText(String(dial.value), c, c + .5);
  ctx.restore();
}

function paintTag(ctx, tag) {
  ctx.clearRect(0, 0, 256, 96);
  ctx.font = "400 44px 'Saira Stencil One', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = 256 / Math.max(1, tag.length);
  tag.forEach((t, i) => {
    const txt = t.net > 0 ? `+${t.net}` : `−${-t.net}`;
    ctx.lineWidth = 8; ctx.strokeStyle = '#03060e'; ctx.strokeText(txt, w * (i + .5), 50);
    ctx.fillStyle = t.net > 0 ? '#ffffff' : '#ff5566'; ctx.fillText(txt, w * (i + .5), 50);
  });
}

function canvasSprite(w, h, order) {
  const canvas = globalThis.document?.createElement?.('canvas');
  let ctx = null;
  try { if (canvas) { canvas.width = w; canvas.height = h; ctx = canvas.getContext('2d'); } } catch { /* headless */ }
  const texture = ctx ? new THREE.CanvasTexture(canvas) : null;
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  // toneMapped:false — the dial's white numeral and hot blocks must not be
  // pulled toward grey by ACES; `HEAD_DIAL.glow` is what pushes them into bloom.
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0 });
  const sprite = new THREE.Sprite(material); sprite.renderOrder = order; sprite.visible = false;
  return { sprite, ctx, texture, material, key: '' };
}

export function createHeadDials(root) {
  const group = new THREE.Group(); group.name = 'Head dials'; root.add(group);
  const rigs = new Map();
  const camRight = new THREE.Vector3(), camUp = new THREE.Vector3(), anchor = new THREE.Vector3();

  function rigFor(id, values) {
    let rig = rigs.get(id);
    if (!rig) {
      rig = { state: createHeadDialState(values), dials: { drive: canvasSprite(TEX, TEX, 170), sustain: canvasSprite(TEX, TEX, 170) }, tag: canvasSprite(256, 96, 171) };
      for (const part of [rig.dials.drive, rig.dials.sustain, rig.tag]) group.add(part.sprite);
      rigs.set(id, rig);
    }
    return rig;
  }
  function drop(id) {
    const rig = rigs.get(id); if (!rig) return;
    for (const part of [rig.dials.drive, rig.dials.sustain, rig.tag]) { group.remove(part.sprite); part.texture?.dispose(); part.material.dispose(); }
    rigs.delete(id);
  }

  return {
    /** Feed the public frame. `nowMs` is the arena's own clock. */
    update(spirits, nowMs, { reduced = false } = {}) {
      const live = new Set();
      for (const s of spirits ?? []) {
        // ⚠️ A knocked-out Spirit, or one whose values the frame does not carry,
        // gets no rig — and losing the rig means its return is FIRST SIGHT again,
        // which snaps silently instead of announcing a change nobody made.
        if (s.knockedOut || s.drive == null || s.sustain == null) continue;
        live.add(s.id);
        // A new rig is built ON the current values, so the set() calls below are
        // no-ops for it — first sight never announces anything.
        const rig = rigFor(s.id, { drive: s.drive, sustain: s.sustain });
        rig.state.set('drive', s.drive, nowMs, { reduced });
        rig.state.set('sustain', s.sustain, nowMs, { reduced });
      }
      for (const id of [...rigs.keys()]) if (!live.has(id)) drop(id);
    },

    /** Place and paint every rig for this frame. `pawns` maps id → pawn Object3D. */
    tick(nowMs, camera, pawns, { reduced = false } = {}) {
      if (!camera) return;
      camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      for (const [id, rig] of rigs) {
        const pawn = pawns.get(id);
        const view = rig.state.sample(nowMs, { reduced });
        const parts = [rig.dials.drive, rig.dials.sustain, rig.tag];
        if (!pawn || !view.visible) { for (const p of parts) p.sprite.visible = false; continue; }
        // The pawn's own idle bob is on its position; ride its TARGET instead so
        // the dial does not inherit a double wobble.
        anchor.copy(pawn.userData.target ?? pawn.position);
        anchor.y += HEAD_DIAL.height + (reduced ? 0 : HEAD_DIAL.bob * Math.sin(nowMs / 520 + anchor.x) + HEAD_DIAL.rise * view.rise);
        const size = HEAD_DIAL.screenSize * camera.position.distanceTo(anchor) * view.pop;
        // ⚠️ ALONG THE CAMERA'S UP, not world up: from the Focus and Tactical
        // cameras a world-Y height foreshortens onto the pawn (found in the preview).
        anchor.addScaledVector(camUp, size * HEAD_DIAL.lift);
        rig.dials.drive.sprite.visible = rig.dials.sustain.sprite.visible = false;
        view.dials.forEach((dial, i) => {
          const part = rig.dials[dial.stat];
          part.sprite.visible = true;
          part.sprite.position.copy(anchor).addScaledVector(camRight, (i - (view.dials.length - 1) / 2) * size * HEAD_DIAL.spacing);
          part.sprite.scale.set(size, size, 1);
          part.material.opacity = view.opacity;
          part.material.color.setScalar(HEAD_DIAL.glow);
          const key = `${dial.value}|${dial.flash ? `${dial.flash.index}:${dial.flash.dir}:${dial.flash.fade.toFixed(2)}` : ''}|${dial.flare.toFixed(2)}`;
          if (key !== part.key) {
            part.key = key; part.sprite.userData.drawn = { stat: dial.stat, value: dial.value, lit: dial.lit, flash: dial.flash };
            if (part.ctx) { paintDial(part.ctx, dial.stat, dial); part.texture.needsUpdate = true; }
          }
        });
        const tag = rig.tag;
        tag.sprite.visible = view.tag.length > 0;
        if (tag.sprite.visible) {
          tag.sprite.position.copy(anchor).addScaledVector(camUp, size * .78);
          tag.sprite.scale.set(size * view.dials.length * .62 + size * .2, size * .36, 1);
          tag.material.opacity = view.opacity; tag.material.color.setScalar(Math.min(HEAD_DIAL.glow, 1.3));
          const key = view.tag.map(t => `${t.stat}${t.net}`).join();
          if (key !== tag.key) {
            tag.key = key; tag.sprite.userData.drawn = view.tag;
            if (tag.ctx) { paintTag(tag.ctx, view.tag); tag.texture.needsUpdate = true; }
          }
        }
      }
    },

    /** How many rigs are mid-change — the renderer must keep drawing while any are. */
    active(nowMs) { let n = 0; for (const rig of rigs.values()) if (rig.state.active(nowMs)) n++; return n; },
    rigs,
    dispose() { for (const id of [...rigs.keys()]) drop(id); root.remove(group); },
  };
}

