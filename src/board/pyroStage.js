// ─── 🎆 PYRO STAGE — the mortars on the real board, and the shove onto one ───
// The three.js half of pyro v2 (Alex, 2026-10-02; the rules are the engine's,
// `data/stageEffects.js`). `arenaVisuals` mounts it and feeds it the public
// frame; it draws three things:
//
//   1. THE MORTARS (Astra's, `pyroMortars.js`). Each armed WAVE is one set: it
//      rises when the engine arms it, fires as a rolling salvo at END TURN
//      (`volleyTimes`), and folds away `holdS` after its last shot — while the
//      next wave is already rising on its new hexes. The wave number is the
//      set's identity, so a volley and a re-arm batched into one React frame
//      still read as "that set fired, this one rose".
//   2. THE SHOVE (`pyroShove.js`, Alex's dial-in). When a Spirit is shoved onto
//      an armed mortar the engine stops it there (`stageFx.struck`). The
//      approach is the game's own skate (`standeeSteps`); at the instant that
//      skate LANDS (`landed`, its `onLand` hook) the reaction takes the piece:
//      fuse, ❄ hit-stop, slow motion, the launch and the spin, the landing back
//      ON the mortar, the daze. The struck mortar is redrawn on the reaction's
//      own clock (a one-mortar set), so the flame, the shell and the standee
//      freeze and crawl TOGETHER — the arena itself never slows.
//   3. THE SOUND — my voices (`audio/pyroSfx.js`) on Astra's beats, through the
//      SFX fader: the machinery on deploy / retract, the salvo, and the hit.
//
// ⚠️ THE "−3 VIBE" AND "🔥 BURN" LABELS SAY WHAT THE ENGINE DID — they read
// PYRO_DAMAGE. The scorch on the print and the flames licking it are a
// DISPLAY-ONLY stand-in for the Burn status (what Burn does is `BURN_TICKED`).
//
// ⚠️ Owns a pawn ONLY while its reaction runs (`pose`), and hands it back at
// rest, the same carrier contract `standeeSteps` keeps. Never touches
// `pawn.visible`. A reaction ends early if the engine moves the Spirit off the
// mortar (a knockout respawn), so it never drags a respawned piece.
import * as THREE from 'three';
import { createPyroMortars, MORTAR_LOOK, MORTAR_TIMING } from './pyroMortars.js';
import { PYRO_SHOVE, timeline, reactionAt, cues, shakeAt, makeShowClock,
  deployCues, retractCues, volleyTimes, volleyCues, retractAt } from './pyroShove.js';
import { createBlastFx } from './pyroBlast.js';
import { playPyroCue } from '../audio/pyroSfx.js';
import { STANDEE, STANDEE_Y } from './standee.js';
import { PYRO_DAMAGE } from '../data/stageEffects.js';

/** The look Astra's mortars get from a `PYRO_SHOVE`-shaped dial-in (the page's own mapping). */
export function mortarLookFor(L = PYRO_SHOVE) {
  return { ...MORTAR_LOOK, cannons:false, curtain:false, guides:true,
    fireworks:L.shell === 'on' && L.crown > 0, width:Math.max(0.5, Math.min(1.8, L.fireball || 0.5)),
    burst:3.6 * Math.max(0.3, L.crown), density:Math.max(0.05, L.sparks), column:L.column };
}

const LATE = 0.25;            // s — a cue this late (a hidden tab) is dropped, never replayed as a backlog
const PENDING_FOR = 1.2;      // s — a strike whose landing never arrives starts on its own
const EMBER = new THREE.Color(1, 0.4, 0.1);

/**
 * @param root the arena scene group
 * @param o.pointFor `(num, y) → Vector3 | null` — `arenaPoint`
 * @param o.sfx a `createPyroSfx()` (null = silent: headless, tests)
 * @param o.label `(text, color, w, h) → { sprite, write }` — the arena's plate maker (null = no labels)
 * @param o.L the look — `PYRO_SHOVE` (Alex's dial-in)
 */
export function createPyroStage(root, { pointFor, sfx = null, label = null, L = PYRO_SHOVE } = {}) {
  const group = new THREE.Group(); group.name = 'Pyro mortars'; root.add(group);
  const look = mortarLookFor(L), T = timeline(L);
  const sets = [];                    // { wave, hexes, mortars, cue, fired, reacted:Set }
  // A reaction has two lives: POSING (it owns the Spirit's piece, until T.end)
  // and the TAIL (its one-mortar set, the scorch and the smoke, which run until
  // the wave folds away). Only posing blocks a second shove on the same Spirit,
  // and only posing lets go when the engine moves the Spirit off the mortar.
  const reactions = [];
  const posingOf = id => reactions.find(r => r.spiritId === id && r.posing) ?? null;
  const pending = [];                 // { spiritId, hexNum, at }
  const landings = new Map();         // spiritId → { toNum, from, to, at }
  const seen = new Set();             // `${wave}:${hex}` strikes already handled
  const queue = [];                   // show cues on the arena clock
  let clock = 0, lastClock = 0, pixelScale = 800, lastPyro = null, reducedNow = false, ticked = false;
  sfx?.setMix?.(L.volume, L.bass);

  const play = c => { if (sfx) playPyroCue(sfx, c, L); };
  const enqueue = list => { for (const c of list) queue.push(c); queue.sort((a, b) => a.at - b.at); };

  function newSet(wave, hexes, at) {
    const mortars = createPyroMortars(group, hexes);
    mortars.resize(pixelScale);
    const set = { wave, hexes, mortars, fired:false, reacted:new Set(),
      cue:{ deployedAt:at, fireAt:hexes.map(() => Infinity), endAt:Infinity, showAt:Infinity, hit:[], contact:{} } };
    sets.push(set);
    // ⚠️ A frame can land before the first tick, when `clock` is still 0: that
    // set would be "deployed" at second 0 — fully up at once, its machinery
    // dropped as a stale backlog. It rises on the first tick instead.
    if (ticked) enqueue(deployCues(at, hexes.length, L)); else set.deferred = true;
    return set;
  }
  function fireSet(set, at) {
    if (set.fired) return;
    set.fired = true;
    const struck = set.hexes.map((h, i) => (set.reacted.has(h) ? i : -1)).filter(i => i >= 0);
    set.cue.fireAt = volleyTimes(at, set.hexes.length, L, set.cue.fireAt);
    set.cue.endAt = retractAt(set.cue.fireAt, L);
    enqueue([...volleyCues(set.cue.fireAt, L, { skip:struck }), ...retractCues(set.cue.endAt, set.hexes.length, L)]);
  }
  function retireAll(at) {
    for (const s of sets) {
      if (!s.fired) fireSet(s, at);
      if (!Number.isFinite(s.cue.endAt)) { s.cue.endAt = at; enqueue(retractCues(at, s.hexes.length, L)); }
    }
  }

  function startReaction(spiritId, hexNum, contactAt, dir) {
    const set = [...sets].reverse().find(s => s.hexes.includes(hexNum));
    if (!set || posingOf(spiritId) || set.reacted.has(hexNum)) return;
    const C = makeShowClock(L, { reduced:reducedNow }), at = pointFor(hexNum, 0);
    if (!at) return;
    const idx = set.hexes.indexOf(hexNum);
    set.reacted.add(hexNum);
    set.cue.hit.push(hexNum); set.cue.contact[hexNum] = contactAt;
    set.cue.fireAt[idx] = contactAt + C.realAt(T.ti);     // the struck mortar's bang, in arena seconds
    const solo = createPyroMortars(group, [hexNum]); solo.resize(pixelScale);
    const fx = createBlastFx(group); fx.place(at.x, 0, at.z);
    const plates = label && L.popups === 'on'
      ? { vibe:label(`−${PYRO_DAMAGE} VIBE`, '#ff6a3a', 2.2, 0.5), burn:label('🔥 BURN', '#ffa040', 2.2, 0.5) } : null;
    if (plates) for (const p of Object.values(plates)) { p.sprite.visible = false; group.add(p.sprite); }
    reactions.push({ spiritId, hexNum, set, solo, fx, C, t0:contactAt, at, dir, plates,
      cues:cues(L), lastAge:-Infinity, o:null, yaw:null, standee:null, posing:true });
  }
  /** Hand the piece back (at rest, untinted); the tail runs on. */
  function release(r) {
    if (!r.posing) return;
    r.posing = false;
    if (r.standee) { untint(r.standee); r.standee = null; }
    // ⭐ Hand the piece back AT REST — level, full size, on its hex, facing the
    // way it was (the spin is whole turns) — like `standeeSteps` after a step.
    // Without this the daze's last few micro-degrees of tilt stayed on it.
    if (r.pawn) { r.pawn.rotation.x = 0; r.pawn.rotation.z = 0; r.pawn.rotation.y = r.yaw; r.pawn.scale.setScalar(1); r.pawn.position.set(r.at.x, STANDEE_Y, r.at.z); r.pawn = null; }
    if (r.plates) for (const p of Object.values(r.plates)) p.sprite.visible = false;
  }
  function endReaction(r) {
    release(r);
    r.solo.dispose(); r.fx.dispose();
    if (r.plates) for (const p of Object.values(r.plates)) { group.remove(p.sprite); p.sprite.material.map?.dispose(); p.sprite.material.dispose(); }
    reactions.splice(reactions.indexOf(r), 1);
  }

  // 🎨 Heat and scorch on the print — the page's `tint`, restored exactly.
  function tint(st, heat, char) {
    const art = st.parts[3], edge = st.parts[2], panel = st.parts[1];
    st.__pyroOrig ??= { artColor:art.material.color.clone(), artEm:art.material.emissive.clone(), artEI:art.material.emissiveIntensity,
      edgeEm:edge.material.emissive.clone(), edgeEI:edge.material.emissiveIntensity, panelEm:panel.material.emissive.clone() };
    const o = st.__pyroOrig, h = Math.min(1, heat);
    art.material.color.copy(o.artColor).multiplyScalar(1 - 0.78 * char);
    art.material.emissive.setRGB(1, 1 - 0.62 * h, 1 - 0.9 * h);
    art.material.emissiveIntensity = o.artEI * (1 - 0.72 * char) + heat * 0.45;
    edge.material.emissive.copy(o.edgeEm).lerp(EMBER, h); edge.material.emissiveIntensity = o.edgeEI * (1 + heat * 1.8);
    panel.material.emissive.copy(o.panelEm).lerp(EMBER, h * 0.6);
  }
  function untint(st) {
    const o = st.__pyroOrig; if (!o) return;
    const art = st.parts[3], edge = st.parts[2], panel = st.parts[1];
    art.material.color.copy(o.artColor); art.material.emissive.copy(o.artEm); art.material.emissiveIntensity = o.artEI;
    edge.material.emissive.copy(o.edgeEm); edge.material.emissiveIntensity = o.edgeEI; panel.material.emissive.copy(o.panelEm);
    delete st.__pyroOrig;
  }

  return {
    group,
    /** The public frame changed. Diffs the engine's pyro against what is on the board. */
    update(frame) {
      const p = frame?.pyro?.v ? frame.pyro : null;
      // a reaction whose Spirit the engine moved off the mortar (a knockout
      // respawn) lets go at once — never drag a respawned piece
      for (const r of reactions) {
        const s = frame?.spirits?.find(x => x.id === r.spiritId);
        if (r.posing && (!s || s.num !== r.hexNum)) release(r);
      }
      if (!p) { if (lastPyro) retireAll(clock); lastPyro = null; return; }
      let cur = sets.at(-1);
      if (!cur || cur.wave !== p.wave) {
        if (cur) fireSet(cur, clock);                       // a volley we never saw as its own frame
        const hexes = [...new Set([...p.hexes, ...(p.struck ?? []).map(x => x.hexNum)])];
        cur = newSet(p.wave, hexes, clock);
      }
      for (const s of p.struck ?? []) {
        const key = `${p.wave}:${s.hexNum}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const land = landings.get(s.spiritId);
        if (land && land.toNum === s.hexNum && clock - land.at < 1) startReaction(s.spiritId, s.hexNum, land.at, land.dir);
        else pending.push({ spiritId:s.spiritId, hexNum:s.hexNum, at:clock });
      }
      if (p.phase === 'spent') fireSet(cur, clock);
      lastPyro = p;
    },
    /** `standeeSteps`' onLand: a piece touched down. A pending strike on that hex starts NOW. */
    landed({ id, from, to, toNum }) {
      const d = new THREE.Vector3().subVectors(to, from).setY(0);
      const dir = d.lengthSq() > 1e-9 ? { x:d.normalize().x, z:d.z } : { x:0, z:1 };
      landings.set(id, { toNum, at:clock, dir });
      const i = pending.findIndex(q => q.spiritId === id && q.hexNum === toNum);
      if (i >= 0) { pending.splice(i, 1); startReaction(id, toNum, clock, dir); }
    },
    /** Advance everything to arena second `time`. */
    tick(time, { reduced = false } = {}) {
      lastClock = clock; clock = time; reducedNow = reduced;
      if (!ticked) {
        ticked = true;
        for (const s of sets) if (s.deferred) { s.deferred = false; s.cue.deployedAt = clock; enqueue(deployCues(clock, s.hexes.length, L)); }
      }
      for (let i = pending.length - 1; i >= 0; i--) {
        if (clock - pending[i].at > PENDING_FOR) { const q = pending.splice(i, 1)[0]; startReaction(q.spiritId, q.hexNum, clock, { x:0, z:1 }); }
      }
      while (queue.length && queue[0].at <= clock) { const c = queue.shift(); if (clock - c.at <= LATE) play(c); }
      for (let i = sets.length - 1; i >= 0; i--) {
        const s = sets[i];
        s.mortars.update(clock, look, s.cue);
        // ⭐ OVERRIDE AFTER THE UPDATE: a struck mortar is drawn by its reaction's
        // one-mortar set, on the reaction's clock — hide the arena-clock copy.
        for (const h of s.reacted) { const m = s.mortars.mortarByHex.get(h); if (m) m.g.visible = false; }
        if (clock > s.mortars.doneAt(s.cue)) { s.mortars.dispose(); sets.splice(i, 1); }
      }
      for (const r of [...reactions]) {
        const age = r.C.ageAt(clock - r.t0);
        const toS = t => (Number.isFinite(t) ? r.C.ageAt(t - r.t0) : t);
        r.o = reactionAt(age, L, { dir:r.dir, reduced });
        r.solo.update(age, look, { deployedAt:toS(r.set.cue.deployedAt), fireAt:[T.ti], endAt:toS(r.set.cue.endAt), showAt:Infinity, hit:r.hexNum, contact:{ [r.hexNum]:0 } });
        const pos = new THREE.Vector3(r.at.x + r.o.x, STANDEE_Y + r.o.y, r.at.z + r.o.z);
        const land = reactionAt(T.tl + 0.001, L, { dir:r.dir });
        r.fx.update({ age, L, reduced, time:clock, astra:true,
          standee:{ pos:new THREE.Vector3(pos.x - r.at.x, pos.y, pos.z - r.at.z), height:STANDEE.height, burn:r.o.burn, land:{ x:land.x, z:land.z } } });
        for (const c of r.cues) if (c.at > r.lastAge && c.at <= age) play(c);
        r.lastAge = age;
        if (r.plates && r.posing) {
          const a = age - T.ti, head = pos.y + STANDEE.height * r.o.sy + 0.35;
          const vib = a >= 0 && a < 1.5, burn = r.o.ignited && r.o.burn > 0.02 && L.burnMs > 0;
          r.plates.vibe.sprite.visible = vib; r.plates.vibe.sprite.material.opacity = vib ? Math.max(0, 1 - a / 1.5) : 0;
          r.plates.vibe.sprite.position.set(pos.x, head + Math.max(0, a) * 0.6, pos.z);
          r.plates.burn.sprite.visible = burn; r.plates.burn.sprite.material.opacity = Math.min(1, r.o.burn * 1.5);
          r.plates.burn.sprite.position.set(pos.x, head + 0.55, pos.z);
        }
        // the piece is handed back at T.end; the fire and the struck mortar run on until its set folds away
        if (age > T.end) release(r);
        if (!r.posing && clock > r.solo.doneAt({ endAt:r.set.cue.endAt })) endReaction(r);
      }
    },
    /**
     * While `spiritId`'s reaction runs, pose its pawn (position, yaw, tilt,
     * squash, the scorch tint) and return `{ lift, ko }` for the standee's
     * frame; `null` = not ours, the caller drives the pawn as usual.
     */
    pose(spiritId, pawn) {
      const r = posingOf(spiritId);
      if (!r || !r.o) return null;
      const st = pawn.userData.standee; if (!st) return null;
      r.yaw ??= pawn.userData.targetFacing ?? pawn.rotation.y;
      r.standee = st; r.pawn = pawn;
      const o = r.o;
      pawn.position.set(r.at.x + o.x, STANDEE_Y + o.y, r.at.z + o.z);
      pawn.rotation.x = o.pitch; pawn.rotation.y = r.yaw + o.yaw; pawn.rotation.z = o.roll;
      pawn.scale.set(o.sxz, o.sy, o.sxz);
      tint(st, o.heat, o.char);
      return { lift:o.y / Math.max(0.05, o.sy), ko:o.ko };
    },
    /** After `standee.frame()`: lay the print down by `ko` (the shipped 78° fall pose). */
    applyKo(standee, ko) {
      if (!(ko > 0)) return;
      for (const m of standee.parts.slice(1, 4)) { m.rotation.x -= THREE.MathUtils.degToRad(STANDEE.koTilt) * ko; m.position.y += (0.05 + STANDEE.sink) * ko; }
    },
    /** The lens's share of the hit: a shake offset (world units) and a fov multiplier. */
    camera(reduced = false) {
      if (reduced || !reactions.length) return null;
      let x = 0, y = 0, punch = 0;
      for (const r of reactions) {
        const age = r.C.ageAt(clock - r.t0), sh = shakeAt(age, L), a = age - T.ti;
        x += sh.x; y += sh.y;
        punch = Math.max(punch, L.punch * (a >= 0 ? Math.exp(-a * 5) * Math.min(1, a * 40) : 0));
      }
      return { x, y, fov:1 - punch * 7 / 40 };
    },
    resize(h) { pixelScale = h; for (const s of sets) s.mortars.resize(h); for (const r of reactions) r.solo.resize(h); },
    get busy() { return sets.length > 0 || reactions.length > 0 || queue.length > 0; },
    get live() { return { sets:sets.length, reactions:reactions.length, posing:reactions.filter(r => r.posing).length, pending:pending.length, queued:queue.length }; },
    reactionOf: id => posingOf(id),
    setsNow: () => sets.map(s => ({ wave:s.wave, hexes:[...s.hexes], fired:s.fired, cue:{ ...s.cue, fireAt:[...s.cue.fireAt], hit:[...s.cue.hit] } })),
    dispose() {
      for (const r of [...reactions]) endReaction(r);
      for (const s of sets) s.mortars.dispose();
      sets.length = 0; queue.length = 0; pending.length = 0;
      root.remove(group);
    },
  };
}
