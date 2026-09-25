import { rigRadius, rigTiers } from '../engine/systems/sonicRig.js';

// This is a presentation boundary, not a second engine. Callers remove smoke-
// hidden spirits BEFORE passing them here; no note stock or hidden state crosses.
export function arenaFrame({ spirits = [], noteStates = {}, actingId, turn, battle,
  slides = {}, flashes = [], thump, laser, pyro, smoke, slime = [], fire, vortex,
  bots = [], spotlight, tentacle, shadowDecoy = null, shadowDecoys = shadowDecoy ? [shadowDecoy] : [], vortices = vortex ? [vortex] : [], lite = false, stats = {}, reach = null, crowdSpirits = spirits }) {
  const visible = new Set(spirits.map(s => s.id));
  return {
    crowds:crowdSpirits.filter(s=>!s.knockedOut).map(s=>({id:s.id,corner:s.corner,color:s.color,
      diehards:noteStates[s.id]?.diehards??0,casuals:noteStates[s.id]?.casuals??0})),
    spirits: spirits.map(s => ({ id:s.id, num:s.num, color:s.color, corner:s.corner,
      facing:s.facing ?? 0, imageSrc:s.imageSrc, knockedOut:!!s.knockedOut,
      vibe:s.vibe,maxVibe:s.maxVibe,fallen:!!noteStates[s.id]?.fallen,
      hitBackCount:s.hitBackCount??0,
      // 🎛️ For the head dial. ⭐ PUBLIC FOR EVERY SPIRIT (Alex, 2026-09-16) — a
      // rival's Drive was shown nowhere before this; he chose to reveal it. The
      // CLIENT computes these (spiritChord), so this file stays free of rules.
      // Only visible spirits reach this map, so smoke still hides the numbers.
      drive:Number.isFinite(stats[s.id]?.drive) ? stats[s.id].drive : null,
      sustain:Number.isFinite(stats[s.id]?.sustain) ? stats[s.id].sustain : null,
      pendingSustainFray:(noteStates[s.id]?.pendingSonicAttacks??0)>0
        ? Math.min(2,noteStates[s.id].pendingSonicAttacks,Math.max(0,(noteStates[s.id].sustainStack?.length??0)-1)):0,
    })),
    decoys:shadowDecoys.map(d => ({id:`${d.id}:shadow`,sourceId:d.id,num:d.num,
      color:d.color,corner:d.corner,facing:d.facing ?? 0,shadow:true})),
    rigs: spirits.filter(s => !s.knockedOut).map(s => ({ id:s.id, corner:s.corner,
      color:s.color, ...rigTiers(noteStates[s.id]),
      radius:rigRadius(noteStates[s.id], s.id === actingId), active:s.id === actingId })),
    actingId, turn, lite,
    // 🟪 Where the acting Spirit (or its Shadow) can step — moveTiles.js. Board
    // geometry the SVG already shows, so nothing new is revealed; dropped when the
    // owner is smoke-hidden, or the Shadow's decoy is not in the frame.
    reach:reach && (reach.kind === 'shadow' ? !!shadowDecoy : visible.has(reach.ownerId))
      ? { kind:reach.kind === 'shadow' ? 'shadow' : 'move', ownerId:reach.ownerId, turn:reach.turn,
          near:[...(reach.near ?? [])], steps:reach.steps ?? 0,
          ...(Number.isFinite(reach.max) ? { max:reach.max } : {}), hover:reach.hover ?? null } : null,
    battle: battle && visible.has(battle.attackerId) && visible.has(battle.defenderId)
      ? { attackerId:battle.attackerId, defenderId:battle.defenderId,
          phase:battle.phase, sonic:!!battle.sonicAttack, round:battle.round ?? 1,
          // ⚠️ The two ROLL marks MUST cross into the frame: `arenaVisuals`
          // runs both staged clocks off them, and a frame without them is a
          // battle frozen at t=0 (the 2026-09-24 "bugged out" report).
          ...(battle.swingClash ? {swingClash:true,key:battle.swingKey,swingStartedAt:battle.swingStartedAt,
            swingRollAt:battle.swingRollAt,swingRivalRollAt:battle.swingRivalRollAt,viewer:battle.viewer,
            diceVals:[...battle.diceVals],defenderDiceVals:[...battle.defenderDiceVals],
            dicePool:[...battle.dicePool],defenderDicePool:[...battle.defenderDicePool],
            atkTotal:battle.atkTotal,defTotal:battle.defTotal,damage:battle.damage,tied:battle.tied,
            attackerWon:battle.attackerWon} : {}),
          ...(battle.sonicAttack && !battle.riffOff && battle.diceHits ? {
            volley:true, key:battle.sonicId ?? `${turn}:${battle.attackerId}:${battle.defenderId}`,
            sonicStartedAt:battle.sonicStartedAt,sonicInterrupted:battle.sonicInterrupted,
            dicePool:[...(battle.dicePool ?? [])], diceVals:[...(battle.diceVals ?? [])],
            diceHits:[...battle.diceHits], shieldValue:battle.shieldValue,
            sonicVersion:battle.sonicVersion, sonicRollStartedAt:battle.sonicRollStartedAt,
            sonicShieldRollAt:battle.sonicShieldRollAt, sonicDriveRollAt:battle.sonicDriveRollAt,
            // Whose chair the director films from — the local player's side.
            viewer:battle.viewer,
            // ⌗ Top-down bout: no hit-stops, no slow burst (sonicBarrageTiming).
            realtime:!!battle.realtime,
            sustainRolls:[...(battle.sustainRolls??[])], sustainPool:[...(battle.sustainPool??[])],
            shots:battle.shots?.map(s=>({...s})), breakIndex:battle.breakIndex,
            shieldRemaining:battle.shieldRemaining,strengthThrough:battle.strengthThrough,
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
    vortices:vortices.map(v => ({hex:v.hex})),
    bots:(bots??[]).map(b => ({hex:b.num, color:b.color})), spotlight,
    // The arm's visible trail is already public board geometry.
    tentacle:tentacle ? {key:tentacle.key, pts:tentacle.pts.map(p=>({x:p.x,y:p.y}))} : null,
  };
}
