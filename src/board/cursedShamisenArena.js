// ─── 🎸 THE IWATO CURSE IN THE ARENA — curses on the real board ───────────────
// `cursedShamisenVisuals.js` and `noroiCard.js` draw the moments; this file
// decides WHEN, from the frame the client hands the arena (`arenaFrame.js` →
// `shamisen`), so the visuals stay a pure picture and the arena a pure reader.
//
//   frame.shamisen = {
//     instruments: []                                   // v1 only — always empty in v3
//     curses: [{ key, roninId, targetId, fromHex, ivs, lifted, turnsLeft, ended }]   // public
//     trap:   { key, hexNum, note, roninId } | null     // ⚠️ THIS VIEWER'S OWN trap only (his seat)
//     ashes:  [{ key, trapKey, hexNum, roninId, how }]  // public: a trap that caught no one
//   }
//
// ⭐ v3 "THE TRAP" + 🪤 THE NOROI CARD (Alex, 2026-10-09, `IWATO_CURSE_V3_SPEC.md`
// rules 17–18, dialled in on the "Noroi Card Trap" preview). One 呪 paper tells
// the whole story:
//   · the viewer's own trap appears → the card is THROWN from his standee onto
//     the crystal (`lay`) — or, already armed when this stage boots, just
//     stuck there (`arm`). Only his frame ever carries `trap`, so only his
//     screen draws it.
//   · a new curse springs → the card shows out of the crystal as it SHATTERS
//     (`onShatter`, from the Lost Chord layer, once the standee is really on
//     the hex), rises beside the ghost shamisen, and lands on the Rival at the
//     cast's slap. A viewer who never saw the card gets it popping in.
//   · a new ash → the card shows on its crystal and burns to ash (public); the
//     crystal turns violet for everyone while it burns.
//
// The curse's diff, per frame:
//   · a curse key not seen before → its ghost shamisen is cast on `fromHex`
//     `castDelayMs` after the spring (`NOROI_SPRING_CAST_DELAY_MS`: the client's
//     SOUND waits the same, so picture and score start together). A curse that
//     is already part-way through (a reload, a late join) is drawn as it
//     stands, without replaying the cast or the card.
//   · its `lifted` count going up → `burnOne()` per lift (a ghost rises and burns)
//   · `ended: 'exorcised'`         → the last ghosts burn, then `exorcise()`
//   · `ended: 'expired'`           → `expire()`
//   · ended and finished animating → dispose (the rival's colours are put back)
import * as THREE from 'three';
import { createCursedShamisenVisuals } from './cursedShamisenVisuals.js';
import { STRINGS, CURSE_TURNS, HAUNTED_NOTES, planCast, CURSED_SHAMISEN } from './cursedShamisen.js';
import { createNoroiCard, NOROI_CARD, NOROI_SPRING_CAST_DELAY_MS } from './noroiCard.js';

/** How long after the end a finished curse's visuals are kept (the burn, the fall, a margin). */
const END_HOLD_MS = Math.max(CURSED_SHAMISEN.ofudaBurnMs, CURSED_SHAMISEN.expireMs, CURSED_SHAMISEN.burnMs) + 1600;
/** The longest the card waits for its crystal to shatter (the Lost Chord layer waits ≤ 2.5 s for the standee). */
const SHATTER_WAIT_MS = 2600;

/**
 * @param o.root       the THREE.Group the ghost shamisen and wisps hang in (the main scene)
 * @param o.floatRoot  where the card hangs — with the crystals and standees (the foreground)
 * @param o.standee    id → that Spirit's `createStandee` api, or null (a block pawn, smoke)
 * @param o.pointFor   hex number → a THREE.Vector3 on the board (`arenaPoint`); the spring's anchor
 * @param o.crystals   the Lost Chords (`createLostChords` api) — the card sticks to `floatAt`, the ash tints `setClaim`
 * @param o.castDelayMs the spring's cast waits this long (the checks pass 0 to test the cast alone)
 * @param o.now        the clock (performance.now) — injectable for the checks
 */
export function createShamisenStage({ root, floatRoot = root, standee, pointFor = null, crystals: crystalsIn = null,
  castDelayMs = NOROI_SPRING_CAST_DELAY_MS, look = NOROI_CARD, now = () => performance.now() } = {}) {
  const curses = new Map();        // curse key → { vis, castAt, ivs, lifted, wantLifted, wantEnded, ended, endedAt, targetId, anchor }
  const seen = new Set();          // curse keys already played (a frame repeated must not re-cast)
  const cards = new Map();         // trap key → { card, hexNum, roninId, shown, spring, ash, prevClaim }
  const seenAsh = new Set();
  const shatters = new Map();      // hex → { at, pos } — the Lost Chord layer's real shatter
  let booted = false, crystals = crystalsIn;

  /** The spring's anchor: an invisible point on the cursed hex, posed like a standee. */
  function anchorAt(hex, fallback) {
    if (hex != null && pointFor) {
      const group = new THREE.Group(); group.position.copy(pointFor(hex)); root.add(group);
      return { group, parts: [], owned: true };
    }
    return fallback;
  }
  function make(anchor, color) {
    if (!anchor) return null;
    const vis = createCursedShamisenVisuals({ ronin: anchor, color });
    root.add(vis.group);
    return vis;
  }
  function drop(cur) { cur.vis?.dispose(); if (cur.anchor?.owned) cur.anchor.group.removeFromParent(); }

  // ── 🪤 the card ───────────────────────────────────────────────────────────
  const crystalPos = hex => crystals?.floatAt?.(hex) ?? (pointFor ? pointFor(hex).add(new THREE.Vector3(0, 0.82, 0)) : new THREE.Vector3());
  const floorPos = hex => (pointFor ? pointFor(hex).add(new THREE.Vector3(0, 0.032, 0)) : null);
  const chestOf = id => { const s = standee(id); return s ? s.group.position.clone().add(new THREE.Vector3(0.2, 1.75, 0)) : null; };
  const charmOf = id => () => { const s = standee(id); return s ? s.group.position.clone().add(new THREE.Vector3(0.04, 2.15, 0)) : new THREE.Vector3(); };
  function cardFor(key, hexNum, roninId) {
    let e = cards.get(key);
    if (!e) { e = { card: createNoroiCard({ root: floatRoot, look, glyph: CURSED_SHAMISEN.ofudaGlyph }), hexNum, roninId, shown: false, spring: null, ash: false, prevClaim: undefined };
      cards.set(key, e); }
    return e;
  }
  /** Whether THIS seat sees the card now: his own armed trap, or one it already had on screen as it springs or burns. */
  const visibleTo = e => e.shown || !!(e.spring?.seen) || !!e.ashSeen;
  const dropCard = key => { const e = cards.get(key); if (!e) return; restoreTint(e); e.card.dispose(); cards.delete(key); };
  function restoreTint(e) {
    if (e.prevClaim === undefined || !crystals?.setClaim) return;
    crystals.setClaim(e.hexNum, e.prevClaim); e.prevClaim = undefined;
  }

  function update(frame = {}) {
    const t = now();
    // ── the viewer's own trap (his seat only) ──
    const mine = frame.trap && Number.isFinite(frame.trap.hexNum) ? frame.trap : null;
    if (mine && !cards.has(mine.key)) {
      const e = cardFor(mine.key, mine.hexNum, mine.roninId);
      const from = chestOf(mine.roninId);
      if (booted && from) e.card.lay(t, { from, at: () => crystalPos(mine.hexNum), floor: floorPos(mine.hexNum) });
      else e.card.arm(t, { at: () => crystalPos(mine.hexNum), floor: floorPos(mine.hexNum) });
    }
    // ⚠️ `wasShown` is read by the spring and the ash: the engine clears the trap
    // in the SAME step that springs or wastes it, so by then it has left the frame.
    for (const [key, e] of cards) { e.wasShown = e.shown; e.shown = !!mine && mine.key === key; }

    // ── the curses ──
    for (const c of frame.curses ?? []) {
      let cur = curses.get(c.key);
      // ⚠️ An ENDED curse this stage never saw (a late join) is history, not a show.
      if (!cur && !seen.has(c.key) && c.ended) { seen.add(c.key); continue; }
      if (!cur && !seen.has(c.key)) {
        const rival = standee(c.targetId);
        if (!rival) continue;   // hidden (smoke) or not mounted yet: try again next frame
        seen.add(c.key);
        // A curse already part-way through is drawn as it stands, not re-cast.
        const late = !booted || (c.lifted ?? 0) > 0 || (c.turnsLeft ?? CURSE_TURNS) < CURSE_TURNS;
        const ivs = c.ivs?.length === STRINGS ? c.ivs : null;
        const plan = planCast(CURSED_SHAMISEN, ivs ?? undefined);
        cur = { key: c.key, vis: null, rival, color: c.color, fromHex: c.fromHex, ivs, late,
          castAt: late ? t - plan.total - 50 : t + castDelayMs, anchor: null,
          lifted: 0, wantLifted: 0, wantEnded: null, ended: null, endedAt: null, targetId: c.targetId };
        curses.set(c.key, cur);
        // 🪤 the card that sprang it — his own (already on screen) or a new one that pops in
        if (!late && Number.isFinite(c.fromHex)) {
          const own = [...cards.entries()].find(([k, e]) => e.hexNum === c.fromHex && !e.spring && !e.ash && (String(c.key).startsWith(`${k}>`) || e.roninId === c.roninId));
          const [, e] = own ?? [null, cardFor(`spring:${c.key}`, c.fromHex, c.roninId)];
          e.spring = { wantAt: t, castAt: cur.castAt, plan, targetId: c.targetId, started: false, seen: !!(e.wasShown || e.shown) };
        }
        if (late || cur.castAt <= t) begin(cur, t);
      }
      if (!cur) continue;
      // What the rules say NOW; `settle` plays it out once the cast has landed.
      cur.wantLifted = Math.max(cur.wantLifted, Math.min(HAUNTED_NOTES, c.lifted ?? 0));
      if (c.ended) cur.wantEnded = c.ended;
    }
    // A curse the frame no longer lists has run its course on the client's side.
    const listed = new Set((frame.curses ?? []).map(c => c.key));
    for (const cur of curses.values()) if (!listed.has(cur.key) && !cur.wantEnded) cur.wantEnded = 'expired';

    // ── the ash (public) ──
    for (const a of frame.ashes ?? []) {
      if (!a?.key || seenAsh.has(a.key)) continue;
      seenAsh.add(a.key);
      if (!booted || !Number.isFinite(a.hexNum)) continue;   // a late join: history
      const e = cardFor(a.trapKey ?? `ash:${a.key}`, a.hexNum, a.roninId);
      if (e.spring) continue;
      e.ash = true; e.ashSeen = !!(e.wasShown || e.shown);
      const live = crystals?.floatAt?.(a.hexNum);
      e.card.crumble(t, { at: live ? () => crystalPos(a.hexNum) : crystalPos(a.hexNum), floor: floorPos(a.hexNum), seen: e.ashSeen });
      // The crystal's own claim is read at the next TICK, after the Lost Chord
      // layer has applied this frame (his 'cursed' mark is gone by then).
      e.tintPending = !!live;
    }
    booted = true;
  }

  /** 💥 the Lost Chord layer: the crystal on `hex` is shattering NOW (its standee arrived). */
  function onShatter(hex, pos = null) { shatters.set(hex, { at: now(), pos: pos?.clone?.() ?? null }); }

  function begin(cur, t) {
    if (cur.vis) return;
    cur.anchor = anchorAt(cur.fromHex, cur.rival);
    const vis = make(cur.anchor, cur.color); if (!vis) return;
    for (let i = 0; i < STRINGS; i++) vis.tune(i, '', t - 10000);
    vis.bindRival(cur.rival);
    vis.cast(cur.castAt, cur.ivs);
    cur.vis = vis;
  }

  // ⚠️ THE RULES CAN RUN AHEAD OF THE PICTURE. A cursed bot can lift a ghost
  // while the spring is still on screen, and a wisp cannot burn out before it
  // has arrived (`burnOne` needs it orbiting). So the frame only records what is
  // wanted, and the lifts and the ending are played here, every tick, once the
  // cast has finished — in order, one step at a time.
  function settle(cur, t) {
    if (cur.ended || !cur.vis || cur.vis.state.phase !== 'cursed') return;
    if (cur.lifted < cur.wantLifted) { cur.vis.burnOne(t); cur.lifted++; return; }
    if (cur.wantEnded === 'exorcised') {
      while (cur.lifted < HAUNTED_NOTES) { cur.vis.burnOne(t); cur.lifted++; }
      cur.ended = 'exorcised'; cur.endedAt = t; cur.vis.exorcise(t); return;
    }
    if (cur.wantEnded === 'expired') { cur.ended = 'expired'; cur.endedAt = t; cur.vis.expire(t); }
  }

  /** Every frame. Returns the strongest light the curses ask for (the cast's hush). */
  function tick(time, { reduced = false, camera = null } = {}) {
    const t = now();
    let dim = 0, shake = 0, tint = 0, tintColor = null;
    for (const [key, cur] of curses) {
      if (!cur.vis && t >= cur.castAt) begin(cur, t);
      if (!cur.vis) continue;
      const out = cur.vis.update(t, { reduced, camera });
      if (out.dim > dim) dim = out.dim;
      if (out.shake > shake) shake = out.shake;
      if (out.tint > tint) { tint = out.tint; tintColor = out.tintColor; }
      settle(cur, t);
      if (cur.ended && t - cur.endedAt > END_HOLD_MS) { drop(cur); curses.delete(key); }
    }
    for (const [key, e] of cards) {
      const sp = e.spring;
      if (sp && !sp.started) {
        const sh = shatters.get(e.hexNum);
        const shattered = sh && sh.at >= sp.wantAt - 50;
        if (shattered || t - sp.wantAt > (crystals ? SHATTER_WAIT_MS : 450)) {
          sp.started = true;
          const at = sh?.pos ?? crystalPos(e.hexNum);
          e.card.spring(t, { at, target: charmOf(sp.targetId), castAt: sp.castAt, slapAt: sp.plan.slapAt,
            beats: sp.plan.notes.map(n => sp.castAt + n.at), seen: sp.seen,
            landScale: CURSED_SHAMISEN.ofudaSize * 1.35 });
          shatters.delete(e.hexNum);
        }
      }
      // Kept on screen through the beat between the step and the shatter, for the viewer who had it.
      e.card.setShown(visibleTo(e));
      if (e.tintPending && crystals?.tokens) { e.tintPending = false; e.prevClaim = crystals.tokens().find(x => x.num === e.hexNum)?.claim ?? null; }
      const out = e.card.update(t, { camera, reduced });
      // ④ the ash is public: the crystal glows violet under the burning card for everyone, then is itself again.
      if (e.ash && e.prevClaim !== undefined && crystals?.setClaim) crystals.setClaim(e.hexNum, out.tint > 0.5 ? 'cursed' : e.prevClaim);
      if (out.events.includes('landed') || out.events.includes('done')) dropCard(key);
    }
    return { dim, shake, tint, tintColor };
  }

  const api = {
    update, tick, onShatter,
    /** The Lost Chords, once the arena has made them (they are built after this stage). */
    attachCrystals(c) { crystals = c; },
    /** Something on the board is moving or showing (the reduced-motion loop draws while it is). */
    get busy() { return curses.size > 0 || [...cards.values()].some(e => e.spring || e.ash || e.card.phase === 'lay'); },
    diagnostics: () => ({ instruments: 0, curses: curses.size,
      lifted: [...curses.values()].map(c => c.lifted), phases: [...curses.values()].map(c => c.vis ? c.vis.state.phase : 'waiting'),
      cards: [...cards.entries()].map(([key, e]) => ({ key, hex: e.hexNum, phase: e.card.phase, shown: visibleTo(e) })) }),
    dispose() { for (const c of curses.values()) drop(c); curses.clear(); for (const k of [...cards.keys()]) dropCard(k); },
  };
  return api;
}
