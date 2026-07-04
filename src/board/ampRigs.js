import { HEX_BY_NUM } from "./hexMap.js";
import { axialDist } from "./hexGeometry.js";
import { AMP_LINK_DIST, AMP_RANGE } from "../data/gameConstants.js";

// ── AMP RIGS ─────────────────────────────────────────────────────────────────
// One instrument cable runs from a Spirit to its rig; amps then daisy-chain to
// EACH OTHER (within AMP_LINK_DIST) to form that rig. The Sonic die is set by the
// size of the connected chain the Spirit is plugged into — build a cable run and
// stay near any point of it; severing a link (Pranksta/unplug) splits the chain.
export function ampLinked(a, b) {
  const ha = HEX_BY_NUM[a.hexNum], hb = HEX_BY_NUM[b.hexNum];
  if (!ha || !hb) return false;
  return axialDist(ha.q, ha.r, hb.q, hb.r) <= AMP_LINK_DIST;
}
export function ampMstEdges(nodes) {
  if (nodes.length < 2) return [];
  const dist = (a, b) => {
    const ha = HEX_BY_NUM[a.hexNum], hb = HEX_BY_NUM[b.hexNum];
    return axialDist(ha.q, ha.r, hb.q, hb.r);
  };
  const inTree = new Set([nodes[0].id]);
  const edges = [];
  let guard = 0;
  while (inTree.size < nodes.length && guard++ < nodes.length + 2) {
    let best = null;
    nodes.forEach(a => {
      if (!inTree.has(a.id)) return;
      nodes.forEach(b => {
        if (inTree.has(b.id)) return;
        const d = dist(a, b);
        if (!best || d < best.d) best = { a, b, d };
      });
    });
    if (!best) break;
    inTree.add(best.b.id);
    edges.push([best.a, best.b]);
  }
  return edges;
}
// Rig data per owner: connected chains of their plugged-in amps, which chains are
// powered (owner within AMP_RANGE of one), the set of powered amp ids, and the
// best (largest) powered chain per owner.
export function computeAmpRigs(amps, spirits) {
  const byOwner = {};
  amps.forEach(a => { if (!a.unplugged) (byOwner[a.ownerId] ??= []).push(a); });
  const poweredAmpIds = new Set();
  const chainsByOwner = {};
  const rigByOwner = {};
  for (const ownerId in byOwner) {
    const list = byOwner[ownerId];
    const seen = new Set();
    const comps = [];
    list.forEach(a => {
      if (seen.has(a.id)) return;
      const stack = [a], comp = [];
      seen.add(a.id);
      while (stack.length) {
        const cur = stack.pop(); comp.push(cur);
        list.forEach(o => { if (!seen.has(o.id) && ampLinked(cur, o)) { seen.add(o.id); stack.push(o); } });
      }
      comps.push(comp);
    });
    const spirit = spirits.find(s => s.id === ownerId);
    const sh = spirit && !spirit.knockedOut ? HEX_BY_NUM[spirit.num] : null;
    const chains = comps.map(comp => {
      const powered = !!sh && comp.some(a => {
        const ah = HEX_BY_NUM[a.hexNum];
        return ah && axialDist(sh.q, sh.r, ah.q, ah.r) <= AMP_RANGE;
      });
      if (powered) comp.forEach(a => poweredAmpIds.add(a.id));
      return { amps: comp, edges: ampMstEdges(comp), powered };
    });
    chainsByOwner[ownerId] = chains;
    let best = null;
    chains.forEach(c => { if (c.powered && (!best || c.amps.length > best.amps.length)) best = c; });
    if (best) rigByOwner[ownerId] = best;
  }
  return { poweredAmpIds, chainsByOwner, rigByOwner };
}
