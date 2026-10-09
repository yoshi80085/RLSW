// ─── 🪤 THE NOROI CARD — the Cursed Shamisen's trap, as a paper (three.js) ────
// Alex, 2026-10-09 (`IWATO_CURSE_V3_SPEC.md` rules 17–18): *"the 'cursed card'
// can appear on Ronin's screen, be invisible to others. If the Spirit steps into
// the card, the shamisen can appear and play out"* → *"yes, the noroi card — lets
// have the paper crumbling to ash be public. Since no one was affected, they at
// least get to see the result publicly."*
//
// ONE PAPER TELLS THE WHOLE STORY. It is the same 呪 ofuda the curse already
// slaps on a Rival (`cursedShamisenVisuals.js` `ofudaTex`), so the trap and the
// curse read as one object travelling from the Ronin, to the Lost Chord, to them.
//
//   ① LAY     (his screen only) — it flicks from his standee in a spinning arc
//              and slaps onto the crystal's face (`lay`).
//   ② ARMED   (his screen only) — it stays stuck to the crystal, fluttering,
//              the 呪 breathing violet, a slow ring on the hex so he can find it.
//   ③ SPRING  (everyone) — the crystal shatters, the card shows out of the shards
//              (a pop for a viewer who never saw it), rises over the hex and
//              hangs there while the ghost shamisen plays (the glyph flares on
//              each note), then flies onto the Rival and lands at the exact
//              moment the curse's own ofuda takes over (`spring`, `landAt`).
//   ④ ASH     (everyone, rule 18) — a wasted trap: the card shows on its crystal
//              and burns away — paper → char → ember edge → gone, with flakes of
//              ash and embers lifting off the burning edge (`crumble`).
//
// ⭐ WHO SEES IT IS THE CALLER'S CALL. This file draws; it never decides who is
// looking. `setShown(false)` hides the whole card (a Rival's screen during ① ②);
// ③ ④ are public, and their `seen` flag says whether THIS viewer already had the
// card on screen (no pop) or not (it appears).
//
// ⭐ IT FACES THE VIEWER. The card turns about the vertical to face the camera
// (the ofuda's lesson from 2026-10-02: a paper seen from behind vanishes), so
// it always shows its face and the 呪 reads from any orbit.
//
// ✅ DIALLED IN by Alex 2026-10-09 (the "Noroi Card Trap" preview): 2 of 35
// levers moved — the 呪 glow off, the ring on the hex off. Everything else is
// as proposed. The game reads these numbers; the preview imports this file.
//
// The burn is done with alpha-test bands over one noise map (no shader): the
// paper keeps the cells above `u + char`, the char the band under it, the ember
// the thin band under that — so the burning edge glows and eats inward.
import * as THREE from 'three';
import { ofudaTex } from './cursedShamisenVisuals.js';

// ── 🎛️ the look — every taste call ──────────────────────────────────────────
export const NOROI_CARD = Object.freeze({
  // ② the card on the crystal
  size: 0.9,           // × the paper (0.34 × 0.85 world); 1.3 is its size on a Spirit
  stickY: 0.36,        // its TOP edge, above the crystal's centre
  stickOut: 0.26,      // out from the crystal's axis toward the viewer
  stickSide: 0.16,     // to the viewer's right, so the crystal's note still reads beside it
  lean: 0.1,           // tipped back (rad)
  tilt: 0.12,          // turned off true (rad)
  flutter: 0.05,       // the paper's flap
  flutterHz: 0.8,
  glyphGlow: 0,        // the 呪 lit violet — ✎ Alex's dial-in 2026-10-09: 1.1 → 0 (the paper's own ink reads best)
  pulse: 0.6,          // how much the slow pulse breathes (0 = steady)
  pulseS: 3.4,         // one breath
  aura: 0.55,          // violet halo behind the card
  floorRing: 0,        // the pulsing ring on its hex — ✎ Alex's dial-in 2026-10-09: 0.55 → 0 (no ring)
  crystalTint: 'cursed', // 'cursed' the crystal turns violet under it · 'keep' it stays its colour
  color: '#8f4dff',
  // ① the lay
  layMs: 760, layArc: 1.5, laySpins: 2, slapPop: 0.35,
  // ③ the spring
  revealMs: 420,       // after the step: the crystal's shatter, when the card shows
  riseMs: 700,         // up off the crystal to its place over the hex
  hoverY: 3.0,         // over the hex while the shamisen plays (the instrument sits at 3.05)
  hoverOut: 0.35,      // toward the viewer
  hoverSide: -0.9,     // beside the instrument (− = the viewer's left), clear of the Rival standing there
  noteFlare: 1,        // the glyph flares on each note of the cast
  flyMs: 650,          // onto the Rival, landing exactly at the curse's slap
  // ④ the ash
  ashRevealMs: 380,    // a viewer who never saw it: the card appears first
  ashHoldMs: 500,      // a beat on the crystal before it catches
  burnMs: 1800,
  burnFrom: 'bottom',  // 'bottom' up · 'corner' from one corner · 'centre' a hole outward
  charBand: 0.1,       // the black edge ahead of the fire
  emberBand: 0.05,     // the glowing edge
  flakes: 40,          // ash flakes that lift off
  embers: 30,          // sparks off the burning edge
  smoke: 'on',
});

const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = u => { u = clamp01(u); return u * u * (3 - 2 * u); };
const easeOutBack = (u, s = 1.9) => { u = clamp01(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const PAPER_W = 0.34, PAPER_H = 0.85;   // the ofuda's own plane (`cursedShamisenVisuals.js`)
const GRID_W = 48, GRID_H = 120;        // the burn map

function canvas2d(w, h) {
  const c = globalThis.document?.createElement('canvas'); if (!c) return null;
  c.width = w; c.height = h; const g = c.getContext('2d'); return g ? { c, g } : null;
}
/** The 呪 alone, in light, on clear — laid over the paper so the glyph can glow. */
function glyphTex(glyph, color) {
  const cv = canvas2d(128, 320); if (!cv) return null;
  const { c, g } = cv;
  g.font = 'bold 92px "Hiragino Mincho ProN","Yu Mincho","Noto Serif JP",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 22; g.fillStyle = color; g.fillText(glyph, 64, 320 * 0.36);
  g.shadowBlur = 8; g.fillStyle = '#ffffff'; g.globalAlpha = 0.55; g.fillText(glyph, 64, 320 * 0.36);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const dotTex = () => {
  const cv = canvas2d(64, 64); if (!cv) return null;
  const gr = cv.g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#fffa'); gr.addColorStop(1, '#fff0'); cv.g.fillStyle = gr; cv.g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv.c);
};
/** A torn flake of ash: an irregular grey scrap with a lighter rim. */
const flakeTex = () => {
  const cv = canvas2d(32, 32); if (!cv) return null;
  const { g } = cv; g.beginPath();
  for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, r = 9 + Math.random() * 6; g[k ? 'lineTo' : 'moveTo'](16 + Math.cos(a) * r, 16 + Math.sin(a) * r); }
  g.closePath(); g.fillStyle = '#3a3633'; g.fill(); g.strokeStyle = '#8a827a'; g.lineWidth = 1.5; g.stroke();
  return new THREE.CanvasTexture(cv.c);
};

/** Seeded value noise, 3 octaves, 0…1. */
function noise2(seed) {
  const h = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  return (x, y) => (v(x, y) * 0.55 + v(x * 2.1, y * 2.1) * 0.3 + v(x * 4.3, y * 4.3) * 0.15);
}
/**
 * 🔥 The burn map: 0 burns first, 1 last. Row 0 is the card's TOP (the texture
 * is flipped onto uv v = 1 at the top). Values stay inside [0.02, 1] so the
 * paper's resting alpha-test (a hair above 0) never bites.
 * @returns {{ grid: Float32Array, tex: THREE.Texture|null }}
 */
export function burnMap(from = 'bottom', seed = 7) {
  const n = noise2(seed), grid = new Float32Array(GRID_W * GRID_H);
  for (let j = 0; j < GRID_H; j++) for (let i = 0; i < GRID_W; i++) {
    const x = i / (GRID_W - 1), y = j / (GRID_H - 1);   // y 0 = top
    const base = from === 'centre' ? Math.hypot((x - 0.5) * 2.5, (y - 0.55) * 1.0)
      : from === 'corner' ? 1 - (y * 0.75 + (1 - x) * 0.45) / 1.2
      : 1 - y;                                            // 'bottom': the bottom edge first
    const v = clamp01(base * 0.72 + n(x * 6, y * 15) * 0.4 - 0.08);
    grid[j * GRID_W + i] = 0.02 + 0.98 * v;
  }
  const cv = canvas2d(GRID_W, GRID_H); let tex = null;
  if (cv) {
    const img = cv.g.createImageData(GRID_W, GRID_H);
    for (let k = 0; k < grid.length; k++) { const b = Math.round(grid[k] * 255); img.data.set([b, b, b, 255], k * 4); }
    cv.g.putImageData(img, 0, 0); tex = new THREE.CanvasTexture(cv.c);
  }
  return { grid, tex };
}

/**
 * 📅 The spring's beats, from the moment of the step (ms). Pure, so the preview,
 * the game and a check read one timeline. `castAt` is when the ghost shamisen's
 * cast starts and `slapAt` its own slap (`planCast(...).slapAt`, from the cast).
 */
export function springPlan(L = NOROI_CARD, { castAt = 600, slapAt = 7230 } = {}) {
  const reveal = L.revealMs, risen = reveal + L.riseMs;
  const land = castAt + slapAt, fly = Math.max(risen, land - L.flyMs);
  return { reveal, risen, fly, land };
}
/**
 * ⏱ THE SPRING'S FIXED CLOCK: the ghost shamisen's cast starts this long after
 * the engine springs the trap (the click). Fixed, so the client's SOUND (which
 * never sees the arena) and the arena's PICTURE start the cast together. It
 * covers the standee's hop onto the hex (~420 ms) and the crystal's shatter,
 * where the card shows (`revealMs`).
 */
export const NOROI_SPRING_CAST_DELAY_MS = 1000;
/** 📅 The ash's beats, from the moment it is wasted (ms). */
export function ashPlan(L = NOROI_CARD, { seen = true } = {}) {
  const shown = seen ? 0 : L.ashRevealMs, burnAt = shown + L.ashHoldMs, burnt = burnAt + L.burnMs;
  return { shown, burnAt, burnt, done:burnt + 1400 };
}

/**
 * @param o.root  the THREE.Group it hangs in (the arena's foreground scene)
 * @param o.look  lever overrides (`NOROI_CARD`)
 * @param o.glyph the charm's glyph (the curse's `ofudaGlyph`, 呪)
 */
export function createNoroiCard({ root, look = {}, glyph = '呪' } = {}) {
  let L = { ...NOROI_CARD, ...look };
  const group = new THREE.Group(); group.name = 'Noroi card'; root?.add(group);
  const violet = () => new THREE.Color(L.color);

  // ── the paper: four layers on ONE deforming plane ─────────────────────────
  const geo = new THREE.PlaneGeometry(PAPER_W, PAPER_H, 2, 14).translate(0, -PAPER_H / 2, 0);   // origin at the TOP edge
  const base = geo.attributes.position.array.slice();
  let burn = burnMap(L.burnFrom), burnKey = L.burnFrom;
  const paperMat = new THREE.MeshBasicMaterial({ map:ofudaTex(glyph), alphaMap:burn.tex, alphaTest:0.001, side:THREE.DoubleSide });
  const charMat = new THREE.MeshBasicMaterial({ color:0x1d120b, alphaMap:burn.tex, alphaTest:0.001, side:THREE.DoubleSide });
  const emberMat = new THREE.MeshBasicMaterial({ color:new THREE.Color('#ff7a1a').multiplyScalar(2.6), alphaMap:burn.tex, alphaTest:0.001,
    transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });
  const glowMat = new THREE.MeshBasicMaterial({ map:glyphTex(glyph, L.color), transparent:true, opacity:0, depthWrite:false,
    blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });
  const card = new THREE.Group(); card.name = 'noroi card'; group.add(card);
  const paper = new THREE.Mesh(geo, paperMat); paper.renderOrder = 42;
  const char = new THREE.Mesh(geo, charMat); char.position.z = -0.008; char.renderOrder = 41;
  const ember = new THREE.Mesh(geo, emberMat); ember.position.z = -0.016; ember.renderOrder = 40;
  const glow = new THREE.Mesh(geo, glowMat); glow.position.z = 0.006; glow.renderOrder = 43;
  card.add(ember, char, paper, glow);
  const dot = dotTex(), flakeMap = flakeTex();
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map:dot, color:violet(), transparent:true, opacity:0, depthWrite:false,
    blending:THREE.AdditiveBlending, toneMapped:false }));
  aura.renderOrder = 39; group.add(aura);
  const ringMat = new THREE.MeshBasicMaterial({ color:violet().multiplyScalar(1.5), transparent:true, opacity:0, depthWrite:false,
    blending:THREE.AdditiveBlending, toneMapped:false, side:THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.9, 6, 1).rotateX(-Math.PI / 2).rotateY(Math.PI / 6), ringMat);
  ring.renderOrder = 38; group.add(ring);

  // ── particles: ash flakes, embers, smoke, flashes (fixed pools) ───────────
  const pool = (n, make) => Array.from({ length:n }, () => { const s = make(); s.visible = false; group.add(s); return { s, t0:0, life:0, v:new THREE.Vector3(), spin:0 }; });
  const flakes = pool(60, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:flakeMap, transparent:true, depthWrite:false })); s.renderOrder = 44; return s; });
  const embers = pool(60, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:dot, color:new THREE.Color('#ff8a2a').multiplyScalar(2), transparent:true,
    depthWrite:false, blending:THREE.AdditiveBlending, toneMapped:false })); s.renderOrder = 45; return s; });
  const puffs = pool(10, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:dot, color:0x7c7680, transparent:true, depthWrite:false })); s.renderOrder = 37; return s; });
  const flashes = pool(4, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:dot, transparent:true, depthWrite:false,
    blending:THREE.AdditiveBlending, toneMapped:false })); s.renderOrder = 46; return s; });
  const free = p => p.find(x => !x.s.visible);
  function emit(p, at, now, life, v, size, color = null) {
    const x = free(p); if (!x) return;
    x.s.visible = true; x.s.position.copy(at); x.t0 = now; x.life = life; x.v.copy(v); x.size = size; x.spin = (Math.random() - 0.5) * 6;
    if (color) x.s.material.color.copy(color);
  }
  function flash(at, now, color, size = 1.6, life = 420) { emit(flashes, at, now, life, new THREE.Vector3(), size, color); }

  // ── state ──
  const S = { phase:'none', t0:0, shown:true, at:null, from:null, target:null, floor:null, landAt:0, castAt:0, beats:[], seen:true,
    plan:null, landScale:1.75, events:[], flagged:new Set() };
  const once = name => { if (!S.flagged.has(name)) { S.flagged.add(name); S.events.push(name); } };
  const start = (phase, now) => { S.phase = phase; S.t0 = now; S.flagged = new Set(); };

  const camYaw = (p, camera) => camera ? Math.atan2(camera.position.x - p.x, camera.position.z - p.z) : 0;
  const toViewer = (p, camera) => { const y = camYaw(p, camera); return new THREE.Vector3(Math.sin(y), 0, Math.cos(y)); };
  const toRight = (p, camera) => { const y = camYaw(p, camera); return new THREE.Vector3(Math.cos(y), 0, -Math.sin(y)); };
  /** Where it sits on its crystal, top edge, facing the viewer. */
  function stuckPose(crystal, camera) {
    return crystal.clone().add(new THREE.Vector3(0, L.stickY, 0)).addScaledVector(toViewer(crystal, camera), L.stickOut)
      .addScaledVector(toRight(crystal, camera), L.stickSide);
  }
  function hoverPose(crystal, camera, t) {
    return crystal.clone().setY(crystal.y + L.hoverY + Math.sin(t * 1.4) * 0.06).addScaledVector(toViewer(crystal, camera), L.hoverOut)
      .addScaledVector(toRight(crystal, camera), L.hoverSide);
  }
  function deform(t, amp, reduced) {
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = base[k * 3], y = base[k * 3 + 1], d = clamp01(-y / PAPER_H);   // 0 at the pinned top → 1 at the bottom (⚠️ clamped: the top row can sit at +1e-17, and a negative ** 1.4 is NaN)
      const w = reduced ? 0 : amp * Math.pow(d, 1.4) * Math.sin(t * Math.PI * 2 * L.flutterHz + d * 3.2 + x * 4);
      pos.setXYZ(k, x + (reduced ? 0 : amp * 0.25 * d * Math.sin(t * 2.3 + d * 2)), y, w);
    }
    pos.needsUpdate = true;
  }
  function burnBands(u) {
    // ⚠️ every alpha-test stays ABOVE 0: crossing 0 recompiles the material.
    paperMat.alphaTest = Math.max(0.001, u + L.charBand);
    charMat.alphaTest = Math.max(0.001, u);
    emberMat.alphaTest = Math.max(0.001, u - L.emberBand);
    char.visible = ember.visible = u > -L.charBand;
  }
  /** A point on the burning edge (`|v − u| small`), in world space — where ash and embers leave from. */
  function edgePoint(u) {
    for (let tries = 0; tries < 24; tries++) {
      const k = Math.floor(Math.random() * burn.grid.length), v = burn.grid[k];
      if (Math.abs(v - u) > 0.035) continue;
      const i = k % GRID_W, j = Math.floor(k / GRID_W);
      return new THREE.Vector3((i / (GRID_W - 1) - 0.5) * PAPER_W, -(j / (GRID_H - 1)) * PAPER_H, 0.01).applyMatrix4(paper.matrixWorld);
    }
    return null;
  }

  const api = {
    group,
    get phase() { return S.phase; },
    /** Is it drawing anything? (the arena's reduced-motion loop reads it) */
    get busy() { return S.phase !== 'none' || [...flakes, ...embers, ...puffs, ...flashes].some(x => x.s.visible); },
    setLook(next) {
      L = { ...NOROI_CARD, ...next };
      if (burnKey !== L.burnFrom) { burn.tex?.dispose(); burn = burnMap(L.burnFrom); burnKey = L.burnFrom;
        for (const m of [paperMat, charMat, emberMat]) { m.alphaMap = burn.tex; m.needsUpdate = true; } }
      glowMat.map?.dispose(); glowMat.map = glyphTex(glyph, L.color); glowMat.needsUpdate = true;
      aura.material.color.copy(violet()); ringMat.color.copy(violet().multiplyScalar(1.5));
    },
    /** Whether THIS viewer may see it (false on a Rival's screen while it is hidden). */
    setShown(v) { S.shown = !!v; },
    /** ① thrown from `from` (his chest) onto the crystal `at()` (live: it bobs). `floor` = its hex, on the stone. */
    lay(now, { from, at, floor }) { start('lay', now); S.from = from.clone(); S.at = at; S.floor = floor?.clone() ?? null; },
    /** ② already on its crystal (a reload, a late join of his own seat). */
    arm(now, { at, floor }) { start('armed', now); S.at = at; S.floor = floor?.clone() ?? null; once('stuck'); },
    /**
     * ③ the step. `at` the crystal's last place (it is shattering), `target()` the
     * Rival's charm point (live), `landAt` the absolute ms the curse's own ofuda
     * appears (castAt + plan.slapAt), `beats` the cast's note times (absolute ms),
     * `seen` whether this viewer already had it on screen, `landScale` its size on them.
     */
    spring(now, { at, target, castAt, slapAt, beats = [], seen = true, landScale = 1.75 }) {
      start('spring', now); S.at = at.clone(); S.target = target; S.castAt = castAt; S.beats = beats; S.seen = seen; S.landScale = landScale;
      S.plan = springPlan(L, { castAt:castAt - now, slapAt });
    },
    /** ④ wasted: it shows (if this viewer never saw it) and burns to ash on its crystal. */
    crumble(now, { at, floor = null, seen = true }) {
      start('ash', now); const a = typeof at === 'function' ? null : at.clone(); S.at = a ? () => a : at; S.floor = floor?.clone() ?? S.floor; S.seen = seen;
      S.plan = ashPlan(L, { seen });
    },
    reset() {
      S.phase = 'none'; S.flagged = new Set(); S.events = []; burnBands(-1);
      for (const x of [...flakes, ...embers, ...puffs, ...flashes]) x.s.visible = false;
    },
    /**
     * Every frame. `now` ms on the caller's clock. Returns the events that fired
     * this frame — 'stuck' · 'shown' · 'peel' · 'landed' · 'burnStart' · 'burnt' · 'done' —
     * and `tint` 0…1, how violet the crystal under it should be (his screen).
     */
    update(now, { camera = null, reduced = false } = {}) {
      S.events = [];
      const t = now / 1000, ms = now - S.t0;
      let pos = null, scale = L.size, flap = L.flutter, spinY = 0, glowK = 0, auraK = 0, ringK = 0, tint = 0, visible = true;
      const breath = () => 1 - L.pulse + L.pulse * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 / L.pulseS));
      if (S.phase === 'none') visible = false;
      else if (S.phase === 'lay') {
        const u = clamp01(ms / L.layMs), e = smooth(u), dest = stuckPose(S.at(), camera);
        pos = S.from.clone().lerp(dest, e); pos.y += Math.sin(u * Math.PI) * L.layArc;
        spinY = (1 - e) * L.laySpins * Math.PI * 2; flap = L.flutter * 3; scale = L.size * (0.7 + 0.3 * e);
        glowK = 0.6; auraK = 0.4 * e;
        if (u >= 1) { start('armed', now); once('stuck'); flash(dest.clone().add(new THREE.Vector3(0, -0.3, 0)), now, violet(), 1.4); }
      }
      if (S.phase === 'armed') {
        const a = now - S.t0, pop = a < 260 ? 1 + L.slapPop * Math.sin(Math.PI * a / 260) : 1;
        pos = stuckPose(S.at(), camera); scale = L.size * pop;
        const k = breath(); glowK = k; auraK = k; ringK = k; tint = 1;
      } else if (S.phase === 'spring') {
        const P = S.plan, crystal = S.at;
        if (ms < P.reveal) {
          pos = stuckPose(crystal, camera); visible = S.seen; glowK = 1; auraK = 0.8; tint = 1;
        } else if (ms < P.risen) {
          once('shown'); once('peel');
          if (!S.flagged.has('flashed')) { S.flagged.add('flashed'); flash(stuckPose(crystal, camera), now, violet(), S.seen ? 1.6 : 2.4, 520); }
          const u = (ms - P.reveal) / L.riseMs, e = smooth(u);
          pos = stuckPose(crystal, camera).lerp(hoverPose(crystal, camera, t), e);
          scale = L.size * (S.seen ? 1 : easeOutBack(clamp01(u * 2.2))) * (1 + 0.35 * e); flap = L.flutter * 2;
          glowK = 1.3; auraK = 1;
        } else if (ms < P.fly) {
          pos = hoverPose(crystal, camera, t); scale = L.size * 1.35; flap = L.flutter * 1.6;
          let flare = 0; for (const b of S.beats) if (now >= b) flare = Math.max(flare, Math.exp(-(now - b) / 180));
          glowK = 1.2 + L.noteFlare * 1.6 * flare; auraK = 0.8 + 0.6 * flare;
        } else if (ms < P.land) {
          const u = clamp01((ms - P.fly) / Math.max(1, P.land - P.fly)), e = u * u;
          const from = hoverPose(crystal, camera, t), to = S.target();
          pos = from.lerp(to, e); pos.y += Math.sin(u * Math.PI) * 0.6;
          scale = L.size * 1.35 + (S.landScale - L.size * 1.35) * e; spinY = (1 - e) * Math.PI * 2; flap = L.flutter * 2.5;
          glowK = 1.8; auraK = 1 - e;
        } else { once('landed'); S.phase = 'none'; visible = false; }
      } else if (S.phase === 'ash') {
        const P = S.plan, crystal = S.at();
        pos = stuckPose(crystal, camera); glowK = breath(); auraK = breath(); ringK = 0.5 * breath(); tint = 1;
        if (ms < P.shown) { const u = ms / Math.max(1, P.shown); scale = L.size * easeOutBack(u); glowK = 1.4; }
        else once('shown');
        if (!S.flagged.has('flashed') && !S.seen) { S.flagged.add('flashed'); flash(pos.clone().add(new THREE.Vector3(0, -0.3, 0)), now, violet().multiplyScalar(0.7), 1.8, 480); }
        if (ms >= P.burnAt) {
          once('burnStart');
          const u = clamp01((ms - P.burnAt) / L.burnMs), uu = -L.charBand + (1 + L.charBand + L.emberBand) * u;
          burnBands(uu);
          glowK *= 1 - u; auraK *= 1 - u; ringK *= 1 - u; tint = 1 - smooth(u); flap = L.flutter * (1 + 2 * u);
          if (!reduced && u < 1) {
            paper.updateWorldMatrix(true, false);
            if (Math.random() < L.flakes / 60) { const p = edgePoint(uu); if (p) emit(flakes, p, now, 1500 + Math.random() * 900,
              new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.35 + Math.random() * 0.45, (Math.random() - 0.5) * 0.5), 0.08 + Math.random() * 0.07); }
            if (Math.random() < L.embers / 60) { const p = edgePoint(uu - L.emberBand * 0.5); if (p) emit(embers, p, now, 500 + Math.random() * 500,
              new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4), 0.07 + Math.random() * 0.05); }
          }
          if (u >= 1 && !S.flagged.has('burnt')) {
            once('burnt');
            if (L.smoke === 'on') for (let k = 0; k < 4; k++) emit(puffs, pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.25, -0.35 + k * 0.08, 0)), now + k * 90,
              1400, new THREE.Vector3(0, 0.35, 0), 0.5 + k * 0.12);
          }
          if (u >= 1) visible = false;
        } else burnBands(-1);
        if (ms >= P.done) { once('done'); S.phase = 'none'; burnBands(-1); }
      }

      // ── place the paper ──
      card.visible = group.visible = S.shown || S.phase === 'spring' || S.phase === 'ash';
      card.visible = card.visible && visible && pos != null;
      if (pos) {
        card.position.copy(pos);
        card.rotation.set(-L.lean, camYaw(pos, camera) + spinY, L.tilt + (reduced ? 0 : 0.04 * Math.sin(t * 1.7)), 'YXZ');
        card.scale.setScalar(scale);
        deform(t, flap, reduced);
        const ctr = pos.clone().add(new THREE.Vector3(0, -PAPER_H * scale * 0.5, 0)).addScaledVector(toViewer(pos, camera), -0.06);
        aura.position.copy(ctr); aura.scale.setScalar(1.25 * scale * (1 + 0.15 * auraK));
      }
      glowMat.opacity = card.visible ? clamp01(L.glyphGlow * glowK * 0.8) : 0;
      aura.visible = card.visible; aura.material.opacity = L.aura * clamp01(auraK) * 0.7;
      ring.visible = !!S.floor && ringK > 0 && card.visible && (S.phase === 'armed' || S.phase === 'ash');
      if (ring.visible) { ring.position.copy(S.floor); ringMat.opacity = L.floorRing * ringK * 0.6; ring.scale.setScalar(1 + (reduced ? 0 : 0.05 * Math.sin(t * Math.PI * 2 / L.pulseS))); }
      if (S.phase !== 'ash') burnBands(-1);
      if (S.phase === 'none' && !S.events.length) burnBands(-1);

      // ── particles ──
      for (const x of flakes) { if (!x.s.visible) continue; const a = (now - x.t0) / x.life; if (a >= 1) { x.s.visible = false; continue; }
        x.s.position.addScaledVector(x.v, 1 / 60); x.v.x += Math.sin(now * 0.004 + x.t0) * 0.004; x.v.y *= 0.995;
        x.s.material.rotation += x.spin / 60; x.s.material.opacity = (a < 0.1 ? a / 0.1 : 1) * (1 - a) * 0.95; x.s.scale.setScalar(x.size * (1 - a * 0.4)); }
      for (const x of embers) { if (!x.s.visible) continue; const a = (now - x.t0) / x.life; if (a >= 1) { x.s.visible = false; continue; }
        x.s.position.addScaledVector(x.v, 1 / 60); x.v.y -= 0.02; x.s.material.opacity = (1 - a) ** 1.4; x.s.scale.setScalar(x.size * (1 - a * 0.5)); }
      for (const x of puffs) { if (!x.s.visible) continue; const a = (now - x.t0) / x.life; if (a < 0) { x.s.material.opacity = 0; continue; } if (a >= 1) { x.s.visible = false; continue; }
        x.s.position.addScaledVector(x.v, 1 / 60); x.s.material.opacity = 0.45 * Math.sin(Math.PI * a); x.s.scale.setScalar(x.size * (0.6 + a)); }
      for (const x of flashes) { if (!x.s.visible) continue; const a = (now - x.t0) / x.life; if (a >= 1) { x.s.visible = false; continue; }
        x.s.material.opacity = (1 - a) ** 1.6; x.s.scale.setScalar(x.size * (0.4 + a)); }
      // A Rival's screen hides the private moments — and their particles with them.
      if (!(S.shown || S.phase === 'spring' || S.phase === 'ash')) for (const x of flashes) x.s.visible = false;
      return { events:S.events, tint:L.crystalTint === 'cursed' ? tint : 0, phase:S.phase };
    },
    dispose() {
      group.removeFromParent();
      group.traverse(o => { o.geometry?.dispose?.(); const m = o.material; if (m) { m.map?.dispose?.(); m.dispose(); } });
      burn.tex?.dispose(); dot?.dispose(); flakeMap?.dispose(); geo.dispose();
    },
  };
  api.reset();
  return api;
}
