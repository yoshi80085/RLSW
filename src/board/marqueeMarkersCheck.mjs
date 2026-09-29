// 🎪 test:marqueemarkers — the marquee spaces in the 3D arena (board/marqueeMarkers.js).
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  MARQUEE_LOOK as T, marqueePose, bulbLevel, marqueeMarkerList, createMarqueeMarkers, marqueeColor,
} from './marqueeMarkers.js';
import { arenaFrame } from './arenaFrame.js';
import { isSolidMesh } from './solidLayer.js';
import { HEX_BY_NUM } from './hexMap.js';
import { quadrantOf } from '../engine/systems/marqueeSpaces.js';
import { playerColor } from '../data/corners.js';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

// ── pure ─────────────────────────────────────────────────────────────────────
{
  const born = 1000;
  const start = marqueePose({ nowMs: born, bornMs: born });
  ok(start.show === 0 && start.cardScale === 0, 'a new marquee starts from nothing');
  ok(start.cardY > T.cardY + 1, '…its card dropping in from above');
  const mid = marqueePose({ nowMs: born + T.appearMs * 0.6, bornMs: born });
  ok(mid.cardScale > 1, 'the card overshoots as it lands (a pop, not a fade)');
  const done = marqueePose({ nowMs: born + T.appearMs, bornMs: born });
  ok(Math.abs(done.cardScale - 1) < 1e-9 && done.show === 1, 'then settles at full size');
  ok(Math.abs(done.cardY - T.cardY) <= T.bobAmp + 1e-9, '…bobbing within bobAmp of its height');
  const a = marqueePose({ nowMs: 5000, bornMs: 0 }), b = marqueePose({ nowMs: 5000 + T.spinS * 250, bornMs: 0 });
  ok(Math.abs((b.spin - a.spin) - Math.PI / 2) < 1e-6, 'it turns once per spinS');
  const leaving = marqueePose({ nowMs: 9000 + T.leaveMs / 2, bornMs: 0, goneMs: 9000 });
  ok(leaving.cardScale > 0 && leaving.cardScale < 1 && leaving.cardY > T.cardY, 'a taken card shrinks as it lifts away');
  ok(marqueePose({ nowMs: 9000 + T.leaveMs, bornMs: 0, goneMs: 9000 }).gone, '…and is gone after leaveMs');
  const still = [0, 700, 3100].map(t => marqueePose({ nowMs: t, bornMs: t, reduced: true }));
  ok(still.every(p => p.cardScale === 1 && p.show === 1 && p.spin === still[0].spin && p.cardY === T.cardY),
    'reduced motion: no pop, no spin, no bob');
  ok(marqueePose({ nowMs: 0, bornMs: 0, goneMs: 0, reduced: true }).gone, 'reduced motion: a taken marquee goes at once');

  const levels = [...Array(T.bulbs).keys()].map(i => bulbLevel(i, 0));
  ok(levels.every(l => l >= T.bulbLow - 1e-9 && l <= 1 + 1e-9), 'bulbs stay between bulbLow and full');
  ok(Math.max(...levels) > 0.95 && Math.min(...levels) < 0.3, 'the ring has a bright head and dark bulbs');
  const later = [...Array(T.bulbs).keys()].map(i => bulbLevel(i, T.chaseS * 1000 / T.bulbs));
  ok(Math.abs(later[1] - levels[0]) < 1e-9, 'the light chases round the ring, one bulb per chaseS/bulbs');
  ok([0, 500, 900].every(t => bulbLevel(3, t, { reduced: true }) === bulbLevel(3, 0, { reduced: true })), 'reduced motion: the bulbs hold still');

  const list = marqueeMarkerList([36, 68, NaN], quadrantOf, playerColor);
  eq(list, [{ hex: 36, corner: 'blue', color: playerColor('blue'), community: false }, { hex: 68, corner: 'red', color: playerColor('red'), community: false }],
    'the frame list names each marquee\'s quadrant and seat colour');
  eq(arenaFrame({ marquees: list }).marquees, list, 'arenaFrame carries the marquees');
  eq(arenaFrame({}).marquees, [], '…and an empty list when there are none');
}

// ── three.js ─────────────────────────────────────────────────────────────────
{
  const root = new THREE.Group();
  const pointFor = (num, y) => { const h = HEX_BY_NUM[num]; return h ? new THREE.Vector3((h.px - 3255) / 200, y, (h.py - 2415) / 200) : null; };
  const mm = createMarqueeMarkers(root, { pointFor });
  mm.update(marqueeMarkerList([36, 30, 64, 68], quadrantOf, playerColor));
  mm.tick(1000);
  eq(mm.diagnostics().hexes.sort((x, y) => x - y), [30, 36, 64, 68], 'one marker per marquee');
  ok(mm.active(1000) === 4, 'all four are popping in');
  mm.tick(1000 + T.appearMs + 10);
  ok(mm.active(1000 + T.appearMs + 10) === 0, '…and settled after appearMs (nothing keeps a reduced-motion loop awake)');
  eq(mm.diagnostics().cards, 4, 'four prize cards');
  const cards = []; mm.solidRoot.traverse(o => { if (o.name === 'Marquee card') cards.push(o); });
  ok(cards.length === 4 && cards.every(isSolidMesh), '🧱 the prize cards are SOLID — re-drawn above the SVG layer');
  // Headless there is no canvas, so no texture — prove the rule with one, since
  // a TEXTURED card that blends (`transparent`) would drop out of the solid layer.
  { const m = cards[0].material.clone(); m.map = new THREE.Texture();
    ok(isSolidMesh({ isMesh: true, material: m }), '🧱 …still solid once the logo texture is on it (alpha-tested, not blended)'); }
  const floor = []; root.traverse(o => { if (o.isMesh && o.name !== 'Marquee card') floor.push(o); });
  ok(floor.length > 0 && floor.every(o => !isSolidMesh(o)), 'the floor pieces are glow, not solid');
  const pivot = mm.solidRoot.children[0], base = pointFor(36, 0);
  ok(Math.abs(pivot.position.x - base.x) < 1e-6 || mm.solidRoot.children.some(c => Math.abs(c.position.x - pointFor(36, 0).x) < 1e-6),
    'a card floats over its hex');

  // Taken: 36 goes, 26 lights.
  mm.update(marqueeMarkerList([26, 30, 64, 68], quadrantOf, playerColor));
  mm.tick(5000);
  eq(mm.diagnostics().leaving, [36], 'the taken marquee is leaving');
  ok(mm.diagnostics().hexes.includes(26), 'the new one is there');
  mm.tick(5000 + T.leaveMs + 10);
  eq(mm.diagnostics().leaving, [], '…and the old one is gone after leaveMs');
  ok(!mm.diagnostics().hexes.includes(36), '…for good');
  // Relit on the same hex before it finished leaving: it stays.
  mm.update(marqueeMarkerList([30, 64, 68], quadrantOf, playerColor)); mm.tick(9000);
  mm.update(marqueeMarkerList([26, 30, 64, 68], quadrantOf, playerColor)); mm.tick(9050);
  ok(mm.diagnostics().hexes.includes(26) && !mm.diagnostics().leaving.includes(26), 'relit mid-leave: it stays lit');
  // Reduced motion: a taken one goes at once.
  mm.update(marqueeMarkerList([30, 64, 68], quadrantOf, playerColor)); mm.tick(12000, { reduced: true });
  ok(!mm.diagnostics().hexes.includes(26) && !mm.diagnostics().leaving.includes(26), 'reduced motion: gone at once');
  mm.dispose();
  ok(root.children.length === 0, 'dispose leaves nothing behind');
}

// ── the appearance options (the dial-in page's switches) ────────────────────
{
  const pointFor = (num, y) => { const h = HEX_BY_NUM[num]; return h ? new THREE.Vector3((h.px - 3255) / 200, y, (h.py - 2415) / 200) : null; };
  const make = o => { const root = new THREE.Group(); const mm = createMarqueeMarkers(root, { pointFor, T: o });
    mm.update(marqueeMarkerList([36], quadrantOf, playerColor)); mm.tick(0); mm.tick(T.appearMs + 5); return { root, mm }; };
  const count = (root, test) => { let k = 0; root.traverse(o => { if (o.isMesh && o.visible && test(o)) k++; }); return k; };
  const bulbsOf = root => count(root, o => o.renderOrder === 59);
  eq(make({}).mm.look.cardStyle, 'card', 'defaults are the game\'s look');
  eq(bulbsOf(make({}).root), T.bulbs, 'marquee floor: the bulbs');
  eq(bulbsOf(make({ floorStyle: 'ring' }).root), 0, 'ring floor: no bulbs');
  eq(bulbsOf(make({ floorStyle: 'glow' }).root), 0, 'glow floor: no bulbs');
  { const { root } = make({ floorStyle: 'none', cardStyle: 'card' }); eq(count(root, o => o.renderOrder === 58), 0, 'no floor: nothing on the floor'); }
  { const { mm } = make({ cardStyle: 'none' }); eq(mm.diagnostics().cards, 0, 'no prize: no card'); eq(mm.solidRoot.children.length, 0, '…and nothing solid'); }
  { const { mm } = make({ cardStyle: 'coin' }); const c = []; mm.solidRoot.traverse(o => { if (o.name === 'Marquee card') c.push(o); });
    ok(c.length === 1 && c[0].geometry.type === 'CircleGeometry' && isSolidMesh(c[0]), 'coin: a solid disc'); }
  { const { mm } = make({ cardScale: .5 }); ok(Math.abs(mm.solidRoot.children[0].scale.x - .5) < 1e-6, 'cardScale shrinks the prize'); }
  { const { root } = make({ size: .6 }); ok(root.children[0].children[0].scale.x === .6, 'size shrinks the floor mark'); }
  eq(marqueeColor('#4488ff', { ...T, colorMode: 'owner' }), '#4488ff', 'owner colour mode takes the seat colour');
  eq(marqueeColor('#4488ff', { ...T, colorMode: 'gold' }), T.gold, 'gold mode');
  eq(marqueeColor('#4488ff', T), T.color, 'pink by default');
  // 🎤 Community marquees (§13) are gold, whatever the colour mode.
  const kinds = { 36: 'community' };
  const list = marqueeMarkerList([36, 68], quadrantOf, playerColor, h => kinds[h] ?? 'solo');
  eq(list.map(m => m.community), [true, false], 'the frame list says which marquees are community');
  eq(arenaFrame({ marquees: list }).marquees.map(m => m.community), [true, false], '…and arenaFrame carries it');
  const root = new THREE.Group(); const mm = createMarqueeMarkers(root, { pointFor, T: { colorMode: 'owner' } });
  mm.update(list); mm.tick(0);
  eq(mm.diagnostics().community, [36], 'the markers know which is community');
  const rims = []; root.traverse(o => { if (o.isMesh && o.geometry?.type === 'CircleGeometry' && o.renderOrder === 58) rims.push(o); });
  ok(rims.some(r => r.material.color.getHexString() === new THREE.Color(T.communityColor).getHexString()), 'a community marquee is drawn gold');
  mm.update(marqueeMarkerList([36, 68], quadrantOf, playerColor, () => 'solo')); mm.tick(10);
  eq(mm.diagnostics().community, [], 'a kind flipped in place is rebuilt');
}

console.log(`🎪 test:marqueemarkers — ${n} checks: pop-in, spin, bob, chasing bulbs, leave, reduced motion, solid cards, the frame list.`);
