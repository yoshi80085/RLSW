import { rigRadius, rigTiers } from '../engine/systems/sonicRig.js';

// This is a presentation boundary, not a second engine. Callers remove smoke-
// hidden spirits BEFORE passing them here; no note stock or hidden state crosses.
export function arenaFrame({ spirits = [], noteStates = {}, actingId, turn, battle,
  slides = {}, flashes = [], thump, laser, pyro, smoke, slime = [], fire, vortex,
  bots = [], spotlight, tentacle, lite = false }) {
  const visible = new Set(spirits.map(s => s.id));
  return {
    spirits: spirits.map(s => ({ id:s.id, num:s.num, color:s.color, corner:s.corner,
      imageSrc:s.imageSrc, knockedOut:!!s.knockedOut })),
    rigs: spirits.filter(s => !s.knockedOut).map(s => ({ id:s.id, corner:s.corner,
      color:s.color, ...rigTiers(noteStates[s.id]),
      radius:rigRadius(noteStates[s.id], s.id === actingId), active:s.id === actingId })),
    actingId, turn, lite,
    battle: battle && visible.has(battle.attackerId) && visible.has(battle.defenderId)
      ? { attackerId:battle.attackerId, defenderId:battle.defenderId,
          phase:battle.phase, sonic:!!battle.sonicAttack, round:battle.round ?? 1 } : null,
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
