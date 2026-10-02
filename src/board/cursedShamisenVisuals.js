// ─── 🎸 CURSED SHAMISEN — the curse on the board (the three.js half) ────────
// `cursedShamisen.js` holds the rules and every number; this draws the five
// moments Alex asked for (2026-10-02, `RONIN_ABILITY_DESIGN.md` §2.3.00):
//
//   ① TUNING — a ghost shamisen hangs over the Ronin. A tuned string pulls taut
//     in violet and plucks; an untuned one hangs slack and dim. Rivals can count
//     the lit strings from across the board: that is the tell. A hit can SNAP one.
//   ② THE CAST — the world hushes and goes violet (`dim`/`tint`/`flicker` are
//     handed back for the caller's lights), each phrase note flares its string,
//     then three HITODAMA (ghost-fire wisps) leave the three strings — each string
//     goes dark as its wisp leaves — and arc across the board. The last one
//     strikes the rival and BECOMES the OFUDA charm (呪) on their standee.
//   ③ THE INFECTION — their neon edge (and base, and halo) turns a sick violet, miasma rises off them,
//     the two wisps that are left circle them, and the fans fall out of time
//     (`fans.sync`, for the caller's crowd).
//   ④ THE COUNTDOWN — the two wisps ARE the 2 turns: `burnOne()` burns one out.
//   ⑤ EXORCISM — the ofuda burns from the bottom up, the wisps scatter, the edge
//     flashes back, the crowd cheers (`fans.cheer`). EXPIRY — it peels and falls.
//
// ⭐ THE PIECES ARE POSED, NOT OWNED: the instrument and the wisps follow the
// standees' positions every frame but are never parented to the Ronin (his
// carrier is squashed and scaled by every hop). Only the ofuda is a child of
// the rival's group — it must ride a shove with them — and the edge tint is put
// back exactly as it was found (`dispose`).
//
// ✅ IN THE GAME since 2026-10-02 — `arenaVisuals.js` mounts one per instrument
// (`createShamisenStage` there); `.scratch/cursed-shamisen-preview` and the
// loadout's pop-out (`ui/abilityDemo.js`) drive it too.
import * as THREE from 'three';
import { CURSED_SHAMISEN, STRINGS, CURSE_TURNS, WISP_COLORS, STRING_COLORS, planCast, hushAt, wispArc, orbitPoint, easeInOut } from './cursedShamisen.js';

const additive = (color, opacity = 0) => new THREE.MeshBasicMaterial({ color, transparent:true, opacity, depthWrite:false,
  blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });
const clamp01 = v => Math.max(0, Math.min(1, v));

// ── canvas textures (made once per visuals; nothing here ships an image) ──
function canvasTex(w, h, draw) {
  const c = globalThis.document?.createElement('canvas'); if (!c) return null;
  c.width = w; c.height = h; const g = c.getContext('2d'); if (!g) return null;
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** A hitodama: a round head of cold fire with a tail that licks UP (a sprite, so the tail is always up). */
function flameTex(core, rim) {
  return canvasTex(64, 128, (g, w, h) => {
    const cx = w / 2, cy = h * 0.7;
    const halo = g.createRadialGradient(cx, cy, 2, cx, cy, w / 2);
    halo.addColorStop(0, rim + 'cc'); halo.addColorStop(1, rim + '00');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.beginPath(); g.moveTo(cx, 6);
    g.bezierCurveTo(cx + 10, h * 0.32, cx + 22, h * 0.5, cx + 18, cy + 8);
    g.arc(cx, cy, 18, 0.2, Math.PI - 0.2);
    g.bezierCurveTo(cx - 22, h * 0.5, cx - 6, h * 0.3, cx, 6);
    const body = g.createLinearGradient(0, 6, 0, cy + 18);
    body.addColorStop(0, rim + '00'); body.addColorStop(0.45, rim + 'cc'); body.addColorStop(1, rim);
    g.fillStyle = body; g.fill();
    const hot = g.createRadialGradient(cx, cy + 2, 0, cx, cy + 2, 14);
    hot.addColorStop(0, '#ffffff'); hot.addColorStop(0.5, core); hot.addColorStop(1, core + '00');
    g.fillStyle = hot; g.beginPath(); g.arc(cx, cy + 2, 14, 0, Math.PI * 2); g.fill();
  });
}
const dotTex = () => canvasTex(64, 64, (g) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#fffa'); gr.addColorStop(1, '#fff0'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
});
/** The ofuda: a paper talisman — cream, red borders, the glyph in black brush, a red seal. */
function ofudaTex(glyph) {
  return canvasTex(128, 320, (g, w, h) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(120,90,50,${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = '#b3241c'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); g.lineWidth = 2; g.strokeRect(17, 17, w - 34, h - 34);
    g.fillStyle = '#111'; g.font = 'bold 92px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(glyph, w / 2, h * 0.36);
    g.strokeStyle = '#111'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w / 2, h * 0.55); g.bezierCurveTo(w / 2 - 14, h * 0.65, w / 2 + 16, h * 0.72, w / 2 - 4, h * 0.84); g.stroke();
    g.fillStyle = '#c1271d'; g.fillRect(w / 2 - 15, h * 0.86, 30, 22);
    g.fillStyle = '#efe4c8'; g.font = 'bold 16px serif'; g.fillText('封', w / 2, h * 0.86 + 12);
  });
}
function labelSprite(text, color) {
  const t = canvasTex(128, 64, (g, w, h) => {
    g.font = 'bold 40px Saira, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = '#05030dcc'; g.strokeText(text, w / 2, h / 2); g.fillStyle = color; g.fillText(text, w / 2, h / 2);
  });
  if (!t) return null;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:t, transparent:true, depthWrite:false, depthTest:false, opacity:0 }));
  s.scale.set(0.7, 0.35, 1); s.renderOrder = 160; return s;
}

/**
 * @param o.ronin  the Ronin's `createStandee` api (its `.group` is read for position)
 * @param o.rival  the rival's `createStandee` api — optional; `bindRival` at the cast
 * @param o.color  the Ronin's player colour (for `stringColor: 'player'`)
 * @param o.look   lever overrides (`CURSED_SHAMISEN`)
 */
export function createCursedShamisenVisuals({ ronin, rival, color = '#4488ff', look = {} } = {}) {
  let L = { ...CURSED_SHAMISEN, ...look };
  const group = new THREE.Group(); group.name = 'Cursed Shamisen';
  const dot = dotTex();
  const fx = [];
  const wc = () => WISP_COLORS[L.wispColor] ?? WISP_COLORS.ghost;
  const strCol = () => new THREE.Color(STRING_COLORS[L.stringColor] ?? color);
  const curseCol = () => new THREE.Color(L.edgeColor);

  // ── ① the ghost shamisen ──────────────────────────────────────────────────
  const inst = new THREE.Group(); inst.name = 'ghost shamisen'; group.add(inst);
  const ghostMat = additive(0x9d8cff, 0.25), lineMat = new THREE.LineBasicMaterial({ color:0xc9b8ff, transparent:true, opacity:0.6,
    blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false });
  const bodyGeo = new THREE.BoxGeometry(0.62, 0.66, 0.14), neckGeo = new THREE.BoxGeometry(0.07, 1.9, 0.06), headGeo = new THREE.BoxGeometry(0.11, 0.34, 0.07);
  const parts = [[bodyGeo, [0, 0, 0]], [neckGeo, [0, 1.25, 0]], [headGeo, [0, 2.32, -0.04]]];
  for (const [geo, p] of parts) {
    const m = new THREE.Mesh(geo, ghostMat); m.position.set(...p); m.renderOrder = 12; inst.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat); e.position.set(...p); e.renderOrder = 13; inst.add(e);
  }
  inst.children.at(-1).rotation.x = inst.children.at(-2).rotation.x = -0.35;   // the head (tenjin) bends back
  const pegGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.26, 6).rotateZ(Math.PI / 2);
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(pegGeo, ghostMat); p.position.set(0, 2.2 + i * 0.09, -0.06 - i * 0.025); p.renderOrder = 12; inst.add(p); }
  // strings: bridge on the skin → the nut, a little proud of the front face
  const BRIDGE = -0.18, NUT = 2.14, SPAN = [-0.08, 0, 0.08];
  const strings = SPAN.map((x, i) => {
    const glow = new THREE.Mesh(new THREE.BufferGeometry(), additive(0xb07bff, 0)); glow.renderOrder = 14;
    const core = new THREE.Mesh(new THREE.BufferGeometry(), additive(0xffffff, 0)); core.renderOrder = 15;
    inst.add(glow, core);
    const label = labelSprite('', '#d9c2ff'); if (label) group.add(label);
    return { i, x, glow, core, label, tuned:false, tuneAt:null, pluckAt:null, snapAt:null, spentAt:null, note:'', flare:0 };
  });
  function stringGeo(s, now) {
    const tuneU = s.tuneAt == null ? 0 : clamp01((now - s.tuneAt) / L.tuneMs);
    const taut = s.tuned ? easeInOut(tuneU) : 0;
    const sag = L.slack * (1 - taut);
    const pl = s.pluckAt == null ? 0 : L.pluckWobble * Math.exp(-(now - s.pluckAt) / L.pluckDecayMs);
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const u = k / 10, bow = Math.sin(Math.PI * u);
      const wob = pl * bow * Math.sin((now - (s.pluckAt ?? 0)) * 0.09 + k * 0.4);
      pts.push(new THREE.Vector3(s.x + sag * bow * 0.6 + wob, BRIDGE + (NUT - BRIDGE) * u, 0.085 + sag * bow));
    }
    return new THREE.CatmullRomCurve3(pts);
  }
  function rebuildString(s, now) {
    const curve = stringGeo(s, now);
    s.glow.geometry.dispose(); s.core.geometry.dispose();
    s.glow.geometry = new THREE.TubeGeometry(curve, 16, 0.05, 5, false);
    s.core.geometry = new THREE.TubeGeometry(curve, 16, 0.016, 4, false);
  }
  const stringWorld = (s, u = 0.55) => {
    inst.updateWorldMatrix(true, false);
    return new THREE.Vector3(s.x, BRIDGE + (NUT - BRIDGE) * u, 0.09).applyMatrix4(inst.matrixWorld);
  };

  // ── ② ③ wisps, the ofuda, the miasma ──────────────────────────────────────
  let flame = flameTex(wc().core, wc().rim), flameKey = L.wispColor;
  const wisps = Array.from({ length:STRINGS }, (_, i) => {
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map:flame, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    head.renderOrder = 30; head.visible = false; group.add(head);
    const trail = Array.from({ length:8 }, () => { const t = head.clone(); t.material = head.material.clone(); t.renderOrder = 29; t.visible = false; group.add(t); return t; });
    return { i, head, trail, state:'idle', t0:0, from:null, k:0 };
  });
  const ofudaH = 0.85, ofudaW = 0.34;
  const ofudaGeo = new THREE.PlaneGeometry(ofudaW, ofudaH, 1, 1).translate(0, -ofudaH / 2, 0);   // origin at the TOP edge: it burns upward
  let ofudaKey = L.ofudaGlyph;
  const ofuda = new THREE.Mesh(ofudaGeo, new THREE.MeshBasicMaterial({ map:ofudaTex(L.ofudaGlyph), transparent:true, side:THREE.DoubleSide, depthWrite:false }));
  ofuda.renderOrder = 25; ofuda.visible = false;
  const miasma = (() => {
    const n = 40, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color:curseCol(), map:dot, size:0.2, transparent:true, opacity:0,
      depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false }));
    p.renderOrder = 24; group.add(p); return p;
  })();
  // ⭐ THE RIVAL IS BOUND AT THE CAST, NOT AT BIRTH (2026-10-02, the arena port).
  // In a match the instrument hangs over the Ronin for turns before anyone knows
  // who the curse is for; `bindRival` picks the target when he casts. The preview
  // still passes `rival` up front, which binds it at once.
  let edge = null, edgeWas = null, tinted = [];
  function restoreRival() {
    if (edge && edgeWas) edge.material.emissive.copy(edgeWas);
    for (const p of tinted) { if (p.emissive) p.m.material.emissive.copy(p.emissive); else p.m.material.color.copy(p.color); }
  }
  function bindRival(next) {
    restoreRival();
    rival = next ?? null;
    edge = rival?.parts?.find(m => m.renderOrder === 9) ?? null;   // standee.js: the cut edge is renderOrder 9
    edgeWas = edge ? edge.material.emissive.clone() : null;
    // ⚠️ THE EDGE ALONE IS TOO THIN TO READ (seen in Chromium): the player's colour
    // also lives in the sheet's glow, the base and its halo ring. Every part that
    // carries it turns — but never the PRINT (it has a `map`) and never the shadow
    // (black). Each colour is saved and put back exactly (`dispose`, expiry).
    tinted = (rival?.parts ?? []).filter(m => m !== edge && !m.material.map && (m.material.emissive || (m.material.color && m.material.color.getHex() !== 0)))
      .map(m => ({ m, emissive:m.material.emissive?.clone() ?? null, color:m.material.emissive ? null : m.material.color.clone() }));
  }
  bindRival(rival);

  // ── generic fx: rings, flashes, sparks, smoke ──
  const ringGeo = new THREE.RingGeometry(0.7, 0.82, 40);
  function ring(at, color, size, dur, now, face = null) {
    const m = new THREE.Mesh(ringGeo, additive(color, 0.9)); m.position.copy(at); m.renderOrder = 31;
    if (face) m.lookAt(face); else m.rotation.x = -Math.PI / 2;
    group.add(m); fx.push({ kind:'ring', obj:m, t0:now, dur, size });
  }
  function puff(at, color, size, dur, now, blending = THREE.AdditiveBlending, rise = 0.6) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:dot, color, transparent:true, depthWrite:false, blending, toneMapped:false }));
    s.position.copy(at); s.renderOrder = 32; group.add(s); fx.push({ kind:'puff', obj:s, t0:now, dur, size, rise, y0:at.y });
  }
  function sparks(at, n, color, spread, up, dur, now) {
    if (n <= 0 || !dot) return;
    const pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread;
      pos.set([at.x + Math.cos(a) * r, at.y + (Math.random() - 0.5) * spread, at.z + Math.sin(a) * r], i * 3);
      vel.push([Math.cos(a) * (0.4 + Math.random()), up * (0.5 + Math.random()), Math.sin(a) * (0.4 + Math.random())]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size:0.12, map:dot, transparent:true, depthWrite:false,
      blending:THREE.AdditiveBlending, toneMapped:false }));
    pts.renderOrder = 33; group.add(pts); fx.push({ kind:'sparks', obj:pts, t0:now, dur, vel, last:now });
  }

  // ── state ──
  const S = { phase:'idle', castAt:null, ivs:null, plan:planCast(L), infect:0, infectAt:null, infectTo:0, infectFrom:0, infectDur:1,
    endAt:null, end:null, cheerAt:null, shake:0, turnsLeft:0, slapped:false };
  const rivalPos = () => (rival ?? ronin).group.position;
  const chest = () => rivalPos().clone().add(new THREE.Vector3(0, 1.45, 0));
  const setInfect = (to, dur, now) => { S.infectFrom = S.infect; S.infectTo = to; S.infectAt = now; S.infectDur = Math.max(1, dur); };

  function place(now, t) {
    const p = ronin.group.position;
    inst.position.set(p.x + 0.15, p.y + L.instHeight + Math.sin(t * 1.3) * L.instBob, p.z);
    inst.rotation.set(0.12, 0.35, THREE.MathUtils.degToRad(-L.instTilt));
    inst.scale.setScalar(L.instScale * 0.8);
  }

  // ── the API ───────────────────────────────────────────────────────────────
  const api = {
    group,
    get state() { return { phase:S.phase, tuned:strings.filter(s => s.tuned).length, turnsLeft:S.turnsLeft, infect:S.infect }; },
    setLook(next) { L = { ...CURSED_SHAMISEN, ...next }; S.plan = planCast(L, S.ivs ?? undefined); },
    /** Who the curse is for — called at the cast (the arena) or at birth (the preview). */
    bindRival,
    /** Is anything still moving or showing? (the arena's reduced-motion loop and its clean-up read it) */
    get busy() { return S.phase === 'cast' || S.phase === 'cursed' || (S.endAt != null && performance.now() - S.endAt < Math.max(L.ofudaBurnMs, L.expireMs, L.burnMs) + 1200) || fx.length > 0 || strings.some(s => s.tuned && !s.spentAt); },
    /** ① tune string `i` with `note` (its Iwato degree, shown as a label). */
    tune(i, note = '', now = performance.now()) {
      const s = strings[i]; if (!s || s.tuned) return false;
      Object.assign(s, { tuned:true, tuneAt:now, pluckAt:now + L.tuneMs * 0.75, snapAt:null, spentAt:null, note });
      if (s.label) {
        const t = canvasTex(128, 64, (g, w, h) => { g.font = 'bold 40px Saira, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.lineWidth = 8; g.strokeStyle = '#05030dcc'; g.strokeText(note, w / 2, h / 2); g.fillStyle = '#e6d4ff'; g.fillText(note, w / 2, h / 2); });
        s.label.material.map?.dispose(); s.label.material.map = t; s.label.material.needsUpdate = true;
      }
      return true;
    },
    /** A hit: the LAST tuned string snaps. ⁉️ proposed rule, not ruled. */
    snap(now = performance.now()) {
      const s = [...strings].reverse().find(x => x.tuned && !x.spentAt); if (!s) return false;
      s.tuned = false; s.snapAt = now; s.tuneAt = null; s.pluckAt = now;
      sparks(stringWorld(s, 0.6), 14, strCol(), 0.15, 1.2, 600, now);
      return true;
    },
    /** ② the cast — needs all three strings. */
    /** @param ivs his three strings as intervals above his root — the melody is built on them (`planCast`). */
    cast(now = performance.now(), ivs = null) {
      if (strings.some(s => !s.tuned)) return false;
      S.phase = 'cast'; S.castAt = now; S.ivs = ivs; S.plan = planCast(L, ivs ?? undefined); S.slapped = false; S.turnsLeft = 0;
      for (const w of wisps) { w.state = 'idle'; w.head.visible = false; }
      return true;
    },
    /** ④ a cursed turn ends: one wisp burns out. */
    burnOne(now = performance.now()) {
      const w = [...wisps].reverse().find(x => x.state === 'orbit'); if (!w) return false;
      w.state = 'burning'; w.t0 = now; S.turnsLeft = Math.max(0, S.turnsLeft - 1);
      if (S.turnsLeft === 0) api.expire(now);
      return true;
    },
    /** ⑤ exorcised: the charm burns, the wisps scatter, the crowd cheers. */
    exorcise(now = performance.now()) {
      if (S.phase !== 'cursed' && S.phase !== 'cast') return false;
      S.phase = 'exorcised'; S.endAt = now; S.cheerAt = now; setInfect(0, L.ofudaBurnMs * 0.6, now);
      for (const w of wisps) if (w.state === 'orbit' || w.state === 'flight') { w.state = 'scatter'; w.t0 = now; w.from = w.head.position.clone(); }
      if (L.exorciseFlash === 'on') { ring(chest(), 0xffffff, 2.2, 600, now, null); puff(chest(), 0xffffff, 3, 500, now); }
      return true;
    },
    /** ⑤ the curse simply ran out. */
    expire(now = performance.now()) {
      if (S.phase === 'exorcised' || S.phase === 'expired') return false;
      S.phase = 'expired'; S.endAt = now; setInfect(0, L.expireMs, now);
      for (const w of wisps) if (w.state === 'orbit') { w.state = 'burning'; w.t0 = now; }
      return true;
    },
    reset() {
      S.phase = 'idle'; S.castAt = null; S.infect = 0; S.infectAt = null; S.endAt = null; S.turnsLeft = 0; S.cheerAt = null; S.slapped = false;
      for (const s of strings) Object.assign(s, { tuned:false, tuneAt:null, pluckAt:null, snapAt:null, spentAt:null, note:'' });
      for (const w of wisps) { w.state = 'idle'; w.head.visible = false; w.trail.forEach(t => { t.visible = false; }); }
      ofuda.removeFromParent(); ofuda.visible = false;
    },

    /**
     * Every frame. Returns what the CALLER owns: how hushed and violet the world
     * is (its lights), the spotlight stutter, the lens shake, and the crowd's mood.
     */
    update(now, { reduced = false, camera = null } = {}) {
      const t = now / 1000;
      if (flameKey !== L.wispColor) { flame?.dispose(); flame = flameTex(wc().core, wc().rim); flameKey = L.wispColor;
        for (const w of wisps) [w.head, ...w.trail].forEach(s => { s.material.map = flame; s.material.needsUpdate = true; }); }
      if (ofudaKey !== L.ofudaGlyph) { ofuda.material.map?.dispose(); ofuda.material.map = ofudaTex(L.ofudaGlyph); ofuda.material.needsUpdate = true; ofudaKey = L.ofudaGlyph; }
      place(now, t);
      const P = S.plan, castMs = S.castAt == null ? -1 : now - S.castAt;
      const casting = S.phase === 'cast' && castMs >= 0;

      // ── ① the instrument and its strings ──
      const tunedN = strings.filter(s => s.tuned && !s.spentAt).length;
      const spentAll = strings.every(s => s.spentAt != null);
      const instVis = S.phase === 'idle' || casting ? 1 : spentAll ? Math.max(0, 1 - (now - Math.max(...strings.map(s => s.spentAt))) / 900) : 1;
      ghostMat.opacity = L.instOpacity * instVis * (0.35 + 0.65 * (0.3 + 0.7 * tunedN / STRINGS)) * L.instGlow;
      lineMat.opacity = Math.min(1, 0.4 + 0.5 * tunedN / STRINGS) * instVis * L.instGlow;
      inst.visible = instVis > 0.01;
      for (const s of strings) {
        if (casting) for (const n of P.notes) if (n.string === s.i && castMs >= n.at && castMs < n.at + 60) { s.flare = 1; s.pluckAt = now; }
        s.flare *= Math.exp(-1 / 60 / 0.25);
        if (casting) { const w = P.wisps[s.i]; if (castMs >= w.launch && s.spentAt == null) s.spentAt = now; }
        rebuildString(s, now);
        const sc = strCol();
        const tuneU = s.tuneAt == null ? 0 : clamp01((now - s.tuneAt) / L.tuneMs);
        const lit = s.spentAt != null ? Math.max(0, 1 - (now - s.spentAt) / 250) : s.tuned ? 0.55 + 0.45 * tuneU : 0.12;
        const snapFade = s.snapAt != null ? Math.max(0, 1 - (now - s.snapAt) / L.snapMs) : 0;
        s.glow.material.color.copy(sc); s.core.material.color.copy(sc).lerp(new THREE.Color(0xffffff), 0.6);
        const flick = s.tuned && !reduced ? 0.85 + 0.15 * Math.sin(now * 0.021 + s.i * 2) : 1;
        s.glow.material.opacity = (0.55 * lit * flick + 0.9 * s.flare + 0.6 * snapFade) * instVis * L.instGlow;
        s.core.material.opacity = (lit * 0.9 + s.flare) * instVis;
        if (s.label) {
          const la = s.tuneAt == null ? 1e9 : now - s.tuneAt;
          s.label.visible = L.noteLabel === 'on' && la < 1600 && !reduced;
          if (s.label.visible) { s.label.position.copy(stringWorld(s, 0.95)).add(new THREE.Vector3(0, 0.35 + la / 2500, 0)); s.label.material.opacity = la < 300 ? la / 300 : 1 - (la - 300) / 1300; }
        }
      }

      // ── ② the cast: wisps leave, cross, the last one becomes the ofuda ──
      let dim = 0, tint = 0, flicker = 0;
      if (casting) {
        const h = hushAt(P, castMs, L); dim = h * L.hushDim; tint = h * L.tint;
        flicker = h * L.flicker * (reduced ? 0 : Math.max(0, Math.sin(now * 0.05) * Math.sin(now * 0.013 + 1)));
        for (const w of wisps) {
          const pw = P.wisps[w.i];
          if (w.state === 'idle' && castMs >= pw.launch) { w.state = 'flight'; w.k = w.i; w.t0 = S.castAt + pw.launch; w.from = stringWorld(strings[w.i]);
            puff(w.from, new THREE.Color(wc().rim), 1.2, 500, now); }
        }
        if (!S.slapped && castMs >= P.slapAt) {
          S.slapped = true;
          // ⚠️ ON THE PRINT, NOT THE CARRIER: the sheet LEANS back (standee.js tips
          // it under a high camera), so a charm hung on the carrier floats in
          // front of it seen from the front and sinks INSIDE it seen from behind
          // — which is exactly how it vanished in the arena (2026-10-02). On the
          // print (renderOrder 10, the one with the art) it leans with it.
          const host = rival?.parts?.find(m => m.renderOrder === 10 && m.material?.map) ?? (rival ?? ronin).group;
          host.add(ofuda); ofuda.visible = true;
          ofuda.position.set(0.04, 2.05, 0.11); ofuda.rotation.set(-0.07, 0, 0.1); ofuda.scale.setScalar(L.ofudaSize * 1.35);
          ofuda.material.color.set(0xffffff); ofuda.material.opacity = 1;
          ring(chest(), new THREE.Color(wc().rim), 1.8, 650, now, camera?.position ?? null);
          puff(chest(), 0xffffff, 2.4, 380, now);
          sparks(chest(), reduced ? 0 : 26, new THREE.Color(wc().rim), 0.3, 1.6, 800, now);
          S.shake = Math.max(S.shake, reduced ? 0 : L.slapShake);
          S.turnsLeft = CURSE_TURNS; setInfect(1, L.infectMs, now);
        }
        if (castMs >= P.total) S.phase = 'cursed';
      }
      if (S.phase === 'cursed' || S.phase === 'cast') tint = Math.max(tint, 0.18 * S.infect * L.tint);

      for (const w of wisps) {
        const all = [w.head, ...w.trail];
        if (w.state === 'idle' || w.state === 'gone') { all.forEach(s => { s.visible = false; }); continue; }
        const size = L.wispSize * (0.9 + 0.1 * Math.sin(now * 0.03 + w.i));
        const posAt = ms => {
          if (w.state === 'flight') {
            const u = clamp01((ms - w.t0) / L.wispFlightMs);
            const dest = P.wisps[w.i].slap ? chest() : orbitPoint(rivalPos(), (S.castAt + P.wisps[w.i].arrive) / 1000, w.k, CURSE_TURNS, L);
            return new THREE.Vector3().copy(wispArc(w.from, dest, u, L.wispArc));
          }
          if (w.state === 'scatter') { const u = (ms - w.t0) / 1000, d = w.from.clone().sub(chest()).setY(0.3).normalize(); return w.from.clone().addScaledVector(d, u * L.scatter); }
          return new THREE.Vector3().copy(orbitPoint(rivalPos(), ms / 1000, w.k, CURSE_TURNS, L));
        };
        if (w.state === 'flight' && now - w.t0 >= L.wispFlightMs) {
          if (P.wisps[w.i].slap) { w.state = 'gone'; all.forEach(s => { s.visible = false; }); continue; }
          w.state = 'orbit';
        }
        let alpha = 1, scale = 1;
        if (w.state === 'burning') {
          const u = (now - w.t0) / L.burnMs;
          if (u >= 1) { w.state = 'gone'; puff(w.head.position, 0x6e6a80, 1.6, 900, now, THREE.NormalBlending, 0.9); all.forEach(s => { s.visible = false; }); continue; }
          if (u < 0.3) { scale = 1 + u * 2; } else { scale = 1.6 * (1 - (u - 0.3) / 0.7); alpha = 1 - (u - 0.3) / 0.7; }
          if (!reduced && Math.random() < 0.3) sparks(w.head.position, 2, new THREE.Color(wc().rim), 0.1, 1.4, 500, now);
        }
        if (w.state === 'scatter') { const u = (now - w.t0) / 900; alpha = 1 - u; if (u >= 1) { w.state = 'gone'; all.forEach(s => { s.visible = false; }); continue; } }
        const at = w.state === 'burning' ? orbitPoint(rivalPos(), now / 1000, w.k, CURSE_TURNS, L) : posAt(now);
        w.head.visible = true; w.head.position.copy(at); w.head.scale.set(size * scale, size * 1.7 * scale, 1);
        w.head.material.opacity = alpha * (0.85 + 0.15 * Math.sin(now * 0.04 + w.i * 3));
        w.trail.forEach((s, k) => {
          s.visible = !reduced && k < L.wispTrail && w.state !== 'burning';
          if (!s.visible) return;
          s.position.copy(w.state === 'burning' ? at : posAt(now - (k + 1) * 28));
          const f = 1 - (k + 1) / (L.wispTrail + 1);
          s.scale.set(size * f * 0.9, size * 1.5 * f, 1); s.material.opacity = alpha * 0.45 * f;
        });
      }

      // ── ③ the infection ──
      if (S.infectAt != null) { const u = easeInOut((now - S.infectAt) / S.infectDur); S.infect = S.infectFrom + (S.infectTo - S.infectFrom) * u; }
      if (edge && edgeWas) {
        const k = clamp01(S.infect) * (reduced ? 1 : 0.8 + 0.2 * Math.sin(now * 0.008));
        edge.material.emissive.copy(edgeWas).lerp(curseCol().multiplyScalar(2), k);
        if (S.phase === 'exorcised' && now - S.endAt < 400) edge.material.emissive.lerp(new THREE.Color(3, 3, 3), 1 - (now - S.endAt) / 400);
      }
      for (const p of tinted) {
        const k = clamp01(S.infect);
        if (p.emissive) p.m.material.emissive.copy(p.emissive).lerp(curseCol().multiplyScalar(p.emissive.r + p.emissive.g + p.emissive.b > 0.6 ? 1.2 : 0.4), k);
        else p.m.material.color.copy(p.color).lerp(curseCol().multiplyScalar(1.6), k);
      }
      {
        const pos = miasma.geometry.attributes.position, n = Math.min(pos.count, Math.round(L.miasma)), rp = rivalPos();
        for (let i = 0; i < pos.count; i++) {
          if (i >= n) { pos.setXYZ(i, 0, -50, 0); continue; }
          const seed = i * 12.9898, u = ((t * 0.22 + (Math.sin(seed) * 0.5 + 0.5)) % 1);
          const a = seed + t * 0.4, r = 0.35 + 0.35 * (Math.sin(seed * 3.1) * 0.5 + 0.5);
          pos.setXYZ(i, rp.x + Math.cos(a) * r, rp.y + 0.2 + u * 2.8, rp.z + Math.sin(a) * r);
        }
        pos.needsUpdate = true; miasma.material.color.copy(curseCol()); miasma.material.opacity = 0.75 * clamp01(S.infect);
      }

      // ⚠️ THE CHARM GOES ON THE FACE YOU CAN SEE. A standee is a flat print with
      // its mirror on the back (seen in the arena 2026-10-02: from behind, the
      // opaque print hid the charm completely). So it hops to whichever face
      // looks at the camera — never through the card.
      if (ofuda.parent && camera) {
        ofuda.parent.updateWorldMatrix(true, false);
        const back = ofuda.parent.worldToLocal(camera.position.clone()).z < 0;
        ofuda.position.z = back ? -0.11 : 0.11; ofuda.rotation.y = back ? Math.PI : 0;
      }
      // ⚠️ THE CHARM GOES ON THE FACE YOU CAN SEE. A standee is a sheet with its
      // print seen through it from behind; from behind, a charm on the front is
      // hidden by the sheet. So it hops to whichever face looks at the camera.
      if (ofuda.parent && camera) {
        ofuda.parent.updateWorldMatrix(true, false);
        const back = ofuda.parent.worldToLocal(camera.position.clone()).z < 0;
        ofuda.position.z = back ? -0.11 : 0.11; ofuda.rotation.y = back ? Math.PI : 0;
      }
      // ── ⑤ the ofuda's end ──
      if (ofuda.visible && ofuda.parent) {
        if (S.phase === 'cast' || S.phase === 'cursed') {
          const a = now - (S.castAt + P.slapAt);
          ofuda.scale.setScalar(L.ofudaSize * (a < 180 ? 1.35 - 0.35 * (a / 180) + 0.06 * Math.sin(a * 0.06) : 1));
          ofuda.rotation.z = 0.1 + (reduced ? 0 : 0.03 * Math.sin(now * 0.004));
        } else if (S.phase === 'exorcised') {
          const u = clamp01((now - S.endAt) / L.ofudaBurnMs);
          ofuda.scale.set(L.ofudaSize, L.ofudaSize * Math.max(0.001, 1 - u), 1);   // burns from the bottom up
          ofuda.material.color.setRGB(1, 1 - 0.55 * u, 1 - 0.85 * u);
          if (!reduced && Math.random() < 0.6) {
            ofuda.updateWorldMatrix(true, false);
            const edgeAt = new THREE.Vector3((Math.random() - 0.5) * ofudaW, -ofudaH * (1 - u), 0).applyMatrix4(ofuda.matrixWorld);
            sparks(edgeAt, 2, new THREE.Color(1, 0.55, 0.15), 0.05, 1.1, 700, now);
          }
          if (u >= 1) { puff(chest().add(new THREE.Vector3(0, 0.5, 0)), 0x777777, 1.4, 900, now, THREE.NormalBlending, 1); ofuda.removeFromParent(); ofuda.visible = false; }
        } else if (S.phase === 'expired') {
          const u = clamp01((now - S.endAt) / L.expireMs);
          ofuda.position.y = 2.05 - 1.6 * u * u; ofuda.rotation.z = 0.1 + 1.4 * u; ofuda.material.opacity = 1 - u;
          if (u >= 1) { ofuda.removeFromParent(); ofuda.visible = false; }
        }
      }

      // ── fx ──
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i], a = (now - f.t0) / f.dur;
        if (a >= 1) { group.remove(f.obj); if (f.kind === 'sparks') f.obj.geometry.dispose(); f.obj.material.dispose(); fx.splice(i, 1); continue; }
        if (f.kind === 'ring') { f.obj.scale.setScalar(0.3 + a * f.size); f.obj.material.opacity = 0.9 * (1 - a) ** 1.5; }
        else if (f.kind === 'puff') { f.obj.scale.setScalar(f.size * (0.4 + a)); f.obj.material.opacity = 0.8 * (1 - a); f.obj.position.y = f.y0 + f.rise * a; }
        else if (f.kind === 'sparks') {
          const p = f.obj.geometry.attributes.position, dt = Math.max(0, Math.min(0.1, (now - f.last) / 1000)); f.last = now;
          for (let j = 0; j < f.vel.length; j++) { const v = f.vel[j]; v[1] -= 3 * dt; p.setXYZ(j, p.getX(j) + v[0] * dt, p.getY(j) + v[1] * dt, p.getZ(j) + v[2] * dt); }
          p.needsUpdate = true; f.obj.material.opacity = 1 - a * a;
        }
      }
      S.shake *= Math.exp(-1 / 60 / 0.12);

      // ── the crowd's mood ──
      const cheer = S.cheerAt == null ? 0 : Math.max(0, 1 - (now - S.cheerAt) / 2600);
      const fans = { sync:1 - L.fanDesync * clamp01(S.infect), dim:1 - L.fanDim * clamp01(S.infect), cheer:cheer * (L.cheer - 1), cursed:clamp01(S.infect) };
      return { dim, tint, tintColor:curseCol(), flicker, shake:reduced ? 0 : S.shake, fans, phase:S.phase };
    },
    dispose() {
      restoreRival();
      ofuda.removeFromParent(); ofuda.material.map?.dispose(); ofuda.material.dispose(); ofudaGeo.dispose();
      for (const f of fx) { group.remove(f.obj); f.obj.geometry?.dispose?.(); f.obj.material.dispose(); }
      group.traverse(o => { o.geometry?.dispose?.(); for (const m of [o.material].flat().filter(Boolean)) { if (m.map && m.map !== flame && m.map !== dot) m.map.dispose(); m.dispose(); } });
      flame?.dispose(); dot?.dispose(); ringGeo.dispose(); bodyGeo.dispose(); neckGeo.dispose(); headGeo.dispose(); pegGeo.dispose();
      group.clear(); group.removeFromParent();
    },
  };
  return api;
}
