// ─── 🎸 THE IWATO CURSE IN THE ARENA — instruments and curses on the real board ─
// `cursedShamisenVisuals.js` draws the five moments; this file decides WHEN, from
// the frame the client hands the arena (`arenaFrame.js` → `shamisen`), so the
// visuals stay a pure picture and the arena stays a pure reader.
//
//   frame.shamisen = {
//     instruments: [{ roninId, color, strings:[label, …] }]   // a Ronin holding it
//     curses:      [{ key, roninId, targetId, ivs, turnsLeft, ended }]
//   }
//
// ⭐ ONE VISUALS PER INSTRUMENT, HANDED TO ITS CURSE AT THE CAST. While he tunes,
// the visuals belong to the Ronin (keyed by his id). The cast moves them to the
// curse (keyed by the cast's key), binds the rival and plays the cast; the next
// take-up builds a fresh instrument. ⚠️ So a Ronin can take the shamisen up again
// while an old curse is still burning down on a rival — the cooldown (2 rounds)
// is shorter than a curse can last — and the two never share a set of strings.
//
// The diff, per frame:
//   · a string count that grew        → `tune(i, label)` (the pluck is the client's)
//   · a curse key not seen before     → transfer + `bindRival` + `cast(now, ivs)`
//   · its `turnsLeft` going down      → `burnOne()` (the second one expires it)
//   · `ended: 'exorcised'`            → `exorcise()`
//   · ended and finished animating    → dispose (the rival's colours are put back)
import { createCursedShamisenVisuals } from './cursedShamisenVisuals.js';
import { STRINGS, CURSE_TURNS, planCast, CURSED_SHAMISEN } from './cursedShamisen.js';

/** How long a put-away instrument waits for a curse that names it (two-frame writes). */
const PARK_MS = 1500;
/** How long after the end a finished curse's visuals are kept (the burn, the fall, a margin). */
const END_HOLD_MS = Math.max(CURSED_SHAMISEN.ofudaBurnMs, CURSED_SHAMISEN.expireMs, CURSED_SHAMISEN.burnMs) + 1600;

/**
 * @param o.root    the THREE.Group the instruments and wisps hang in (the main scene)
 * @param o.standee id → that Spirit's `createStandee` api, or null (a block pawn, smoke)
 * @param o.now     the clock (performance.now) — injectable for the checks
 */
export function createShamisenStage({ root, standee, now = () => performance.now() } = {}) {
  const instruments = new Map();   // roninId → { vis, tuned }
  const curses = new Map();        // cast key → { vis, turnsLeft, ended, endedAt, targetId }
  const seen = new Set();          // cast keys already played (a frame repeated must not re-cast)
  const parked = new Map();        // roninId → { inst, at } — put away, kept a moment (see below)

  function make(roninId, color) {
    const ronin = standee(roninId); if (!ronin) return null;
    const vis = createCursedShamisenVisuals({ ronin, color });
    root.add(vis.group);
    return vis;
  }
  function drop(vis) { vis.dispose(); }

  function update(frame = {}) {
    const t = now();
    const wantInst = new Map((frame.instruments ?? []).map(i => [i.roninId, i]));
    // ── the instruments ──
    for (const [id, want] of wantInst) {
      let inst = instruments.get(id);
      if (!inst) { const vis = make(id, want.color); if (!vis) continue; inst = { vis, tuned: 0 }; instruments.set(id, inst); }
      const labels = want.strings ?? [];
      while (inst.tuned < Math.min(labels.length, STRINGS)) { inst.vis.tune(inst.tuned, labels[inst.tuned], t); inst.tuned++; }
    }
    // ── the curses ──
    for (const c of frame.curses ?? []) {
      let cur = curses.get(c.key);
      // ⚠️ An ENDED curse this stage never saw (a late join) is history, not a show.
      if (!cur && !seen.has(c.key) && c.ended) { seen.add(c.key); continue; }
      if (!cur && !seen.has(c.key)) {
        seen.add(c.key);
        const rival = standee(c.targetId);
        const inst = instruments.get(c.roninId) ?? parked.get(c.roninId)?.inst;
        let vis = inst?.tuned >= STRINGS ? inst.vis : null;
        let late = false;
        if (vis) { instruments.delete(c.roninId); parked.delete(c.roninId); }   // handed to the curse — no longer his
        else {
          // ⚠️ A curse with no instrument on the board to play it — the page was
          // reloaded, a spectator joined, or the Ronin was hidden in smoke as he
          // cast. Draw the curse as it STANDS, without replaying the cast.
          vis = make(c.roninId, c.color); if (!vis) continue;
          for (let i = 0; i < STRINGS; i++) vis.tune(i, '', t - 10000);
          late = true;
        }
        vis.bindRival(rival);
        const plan = planCast(CURSED_SHAMISEN, c.ivs ?? undefined);
        vis.cast(late ? t - plan.total - 50 : t, c.ivs ?? null);
        cur = { key: c.key, vis, turnsLeft: CURSE_TURNS, wantTurns: CURSE_TURNS, wantEnded: null, ended: null, endedAt: null, targetId: c.targetId };
        curses.set(c.key, cur);
      }
      if (!cur) continue;
      // What the rules say NOW; `settle` plays it out once the cast has landed.
      cur.wantTurns = Math.max(0, c.turnsLeft ?? CURSE_TURNS);
      if (c.ended) cur.wantEnded = c.ended;
    }
    // ⚠️ ONLY NOW are instruments the frame dropped put away — AFTER the curses,
    // because the cast's own frame is the one that drops his instrument (the
    // sheet's `shamisen` is cleared by the cast) and it must be handed to the
    // curse first, not disposed. One left over was put away without a cast (a
    // knock-out, a reload): it simply goes.
    // ⚠️ AND PARKED, NOT DISPOSED: if the client's two sheet writes (his strings
    // spent, the rival cursed) ever land in two frames, the curse arrives one
    // frame after the instrument left — it still finds it here (`PARK_MS`).
    for (const [id, inst] of instruments) if (!wantInst.has(id)) { parked.set(id, { inst, at: t }); instruments.delete(id); }
    // A curse the frame no longer lists has run its course on the client's side.
    const listed = new Set((frame.curses ?? []).map(c => c.key));
    for (const cur of curses.values()) if (!listed.has(cur.key) && !cur.wantEnded) cur.wantEnded = 'expired';
  }

  // ⚠️ THE RULES CAN RUN AHEAD OF THE PICTURE. A cursed bot can finish its whole
  // turn while the cast is still on screen, and a wisp cannot burn out before it
  // has arrived (`burnOne` needs it orbiting). So the frame only records what is
  // wanted, and the countdown and the ending are played here, every tick, as soon
  // as the cast has finished — in order, one step at a time.
  function settle(cur, t) {
    if (cur.ended || cur.vis.state.phase !== 'cursed') return;
    if (cur.wantEnded === 'exorcised') { cur.ended = 'exorcised'; cur.endedAt = t; cur.vis.exorcise(t); return; }
    if (cur.turnsLeft > (cur.wantTurns ?? CURSE_TURNS)) { cur.vis.burnOne(t); cur.turnsLeft--; }
    if (cur.turnsLeft <= 0 || cur.wantEnded === 'expired') {
      cur.ended = 'expired'; cur.endedAt = t;
      if (cur.vis.state.phase === 'cursed') cur.vis.expire(t);   // burnOne may already have expired it
    }
  }

  /** Every frame. Returns the strongest light the curses ask for (the cast's hush). */
  function tick(time, { reduced = false, camera = null } = {}) {
    const t = now();
    let dim = 0, shake = 0, tint = 0, tintColor = null;
    const step = vis => {
      const out = vis.update(t, { reduced, camera });
      if (out.dim > dim) dim = out.dim;
      if (out.shake > shake) shake = out.shake;
      if (out.tint > tint) { tint = out.tint; tintColor = out.tintColor; }
    };
    for (const inst of instruments.values()) step(inst.vis);
    for (const [id, p] of parked) if (t - p.at > PARK_MS) { drop(p.inst.vis); parked.delete(id); } else step(p.inst.vis);
    for (const [key, cur] of curses) {
      step(cur.vis);
      settle(cur, t);
      if (cur.ended && t - cur.endedAt > END_HOLD_MS) { drop(cur.vis); curses.delete(key); }
    }
    return { dim, shake, tint, tintColor };
  }

  const api = {
    update, tick,
    /** Something on the board is moving or showing (the reduced-motion loop draws while it is). */
    get busy() { return instruments.size > 0 || curses.size > 0 || parked.size > 0; },
    diagnostics: () => ({ instruments: instruments.size, curses: curses.size,
      tuned: [...instruments.values()].map(i => i.tuned), phases: [...curses.values()].map(c => c.vis.state.phase) }),
    dispose() { for (const i of instruments.values()) drop(i.vis); for (const p of parked.values()) drop(p.inst.vis); for (const c of curses.values()) drop(c.vis); instruments.clear(); parked.clear(); curses.clear(); },
  };
  return api;
}
