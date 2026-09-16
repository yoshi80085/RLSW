import { rigRadius, rigTiers } from '../engine/systems/sonicRig.js';

// This is a presentation boundary, not a second engine. Callers remove smoke-
// hidden spirits BEFORE passing them here; no note stock or hidden state crosses.
export function arenaFrame({ spirits = [], noteStates = {}, actingId, turn, battle,
  slides = {}, flashes = [], thump, laser, pyro, smoke, slime = [], fire, vortex,
  bots = [], spotlight, tentacle, shadowDecoy = null, lite = false, stats = {} }) {
  const visible = new Set(spirits.map(s => s.id));
  return {
    spirits: spirits.map(s => ({ id:s.id, num:s.num, color:s.color, corner:s.corner,
      facing:s.facing ?? 0, imageSrc:s.imageSrc, knockedOut:!!s.knockedOut,
      // 🎛️ For the head dial. ⭐ PUBLIC FOR EVERY SPIRIT (Alex, 2026-09-16) — a
      // rival's Drive was shown nowhere before this; he chose to reveal it. The
      // CLIENT computes these (spiritChord), so this file stays free of rules.
      // Only visible spirits reach this map, so smoke still hides the numbers.
      drive:Number.isFinite(stats[s.id]?.drive) ? stats[s.id].drive : null,
      sustain:Number.isFinite(stats[s.id]?.sustain) ? stats[s.id].sustain : null,
      pendingSustainFray:(noteStates[s.id]?.pendingSonicAttacks??0)>0
        ? Math.min(2,noteStates[s.id].pendingSonicAttacks,Math.max(0,(noteStates[s.id].sustainStack?.length??0)-1)):0,
    })),
    decoys:shadowDecoy ? [{ id:`${shadowDecoy.id}:shadow`, sourceId:shadowDecoy.id,
      num:shadowDecoy.num, color:shadowDecoy.color, corner:shadowDecoy.corner,
      facing:shadowDecoy.facing ?? 0, shadow:true }] : [],
    rigs: spirits.filter(s => !s.knockedOut).map(s => ({ id:s.id, corner:s.corner,
      color:s.color, ...rigTiers(noteStates[s.id]),
      radius:rigRadius(noteStates[s.id], s.id === actingId), active:s.id === actingId })),
    actingId, turn, lite,
    battle: battle && visible.has(battle.attackerId) && visible.has(battle.defenderId)
      ? { attackerId:battle.attackerId, defenderId:battle.defenderId,
          phase:battle.phase, sonic:!!battle.sonicAttack, round:battle.round ?? 1,
          ...(battle.sonicAttack && !battle.riffOff && battle.diceHits ? {
            volley:true, key:battle.sonicId ?? `${turn}:${battle.attackerId}:${battle.defenderId}`,
            sonicStartedAt:battle.sonicStartedAt,sonicInterrupted:battle.sonicInterrupted,
            dicePool:[...(battle.dicePool ?? [])], diceVals:[...(battle.diceVals ?? [])],
            diceHits:[...battle.diceHits], shieldValue:battle.shieldValue,
            sonicChordNotes:[...(battle.sonicChordNotes ?? [])],
            sustainChordNotes:[...(battle.sustainChordNotes ?? [])],
            hitCount:battle.hitCount, damage:battle.damage,
            fame:battle.sonicFame, knockback:battle.knockback,
          } : {}),
        } : null,
    slides:Object.values(slides).filter(s => visible.has(s.id)).map(s => ({
      id:s.id, cx:s.cx, cy:s.cy, dx:s.dx, dy:s.dy, color:s.color, imageSrc:s.imageSrc })),
    flashes:flashes.filter(f => visible.has(f.spiritId)).map(f => ({
      key:f.key, spiritId:f.spiritId, color:f.color })),
    thump:thump && visible.has(thump.id) ? {id:thump.id,key:thump.key} : null,
    laser:laser?.beams?.map(b => [...b.hexes]) ?? [],
    pyro:pyro ? {hexes:[...pyro.hexes], phase:pyro.phase} : null,
    smoke:smoke ? {radius:smoke.radius} : null,
    slime:slime.map(s => s.num ?? s.hex), fire:[...(fire?.hexes ?? [])],
    vortex:vortex ? {hex:vortex.hex} : null,
    bots:(bots??[]).map(b => ({hex:b.num, color:b.color})), spotlight,
    // The arm's visible trail is already public board geometry.
    tentacle:tentacle ? {key:tentacle.key, pts:tentacle.pts.map(p=>({x:p.x,y:p.y}))} : null,
  };
}
