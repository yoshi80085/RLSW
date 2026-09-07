import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { BushidoOverlay, BUSHIDO_LOOK } from '../ui/BushidoOverlay.jsx';

// Execute the recovered preview itself as the independent reference. Its
// controls are not initialized; apply the user's screenshots to its levers.
const html = readFileSync('Claude outputs/bushido-lane-preview.html', 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf("const SLIDERS="));
const dom = new JSDOM('<body></body>');
const ref = new Function('document', script + '; return {L, scene, draw, CASES};')(dom.window.document);
const screenshots = {
  a3: .1, a5: .6, gamma: 1.25, s3: .36, s5: .76, sw: 3.1, swramp: true,
  bloom: 26, bstr: .72, runupMode: 'dim', ra: .03, blockMode: 'wall', ghost: false,
  spine: true, spw: 9, spa: .5, spineTaper: true, arrow: true, rungs: true,
  lab: 110, ring: true, pulse: true, hue: '#4488ff', hotFar: true,
};
assert.deepEqual(BUSHIDO_LOOK, screenshots, 'shipped values match the three screenshots');
Object.assign(ref.L, screenshots);
let checks = 1;
const gallery = [];
const leaves = (root, selector) => [...root.querySelectorAll(selector)].map(el => ({
  tag: el.tagName, text: el.textContent,
  attrs: Object.fromEntries([...el.attributes].filter(a => a.name !== 'style').map(a => [a.name, a.value]).sort()),
}));
for (const scenario of ref.CASES) for (let dir = 0; dir < 6; dir++) {
  const scene = ref.scene({ ...scenario.o, dir });
  const expected = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ref.draw(expected, scene, 'new');
  const props = { spirit: scene.self, blockers: scene.blockers, targets: new Set(scene.hit ? [scene.hit.step.num] : []), scale: 1 };
  const markup = renderToStaticMarkup(<svg><BushidoOverlay {...props} /><BushidoOverlay {...props} layer="labels" /></svg>);
  const actual = new JSDOM(markup).window;
  const lane = actual.document.querySelector('[data-bushido-layer="lane"]');
  const labels = actual.document.querySelector('[data-bushido-layer="labels"]');
  assert.deepEqual(leaves(lane, 'polygon,line'), leaves(expected.children[2], 'polygon,line'), `${scenario.n}, dir ${dir}: lane geometry/fill/edges`);
  assert.deepEqual(leaves(labels, 'text'), leaves(expected.children[4], 'text'), `${scenario.n}, dir ${dir}: labels`);
  const ring = [...expected.children[3].querySelectorAll('circle')].filter(el => el.getAttribute('fill') === 'none');
  const ringRoot = dom.window.document.createElement('div');
  ring.forEach(el => ringRoot.appendChild(el.cloneNode(true)));
  assert.deepEqual(leaves(labels, 'circle'), leaves(ringRoot, 'circle'), `${scenario.n}, dir ${dir}: target ring`);
  assert.equal(lane.querySelectorAll('[style*="lane-pulse"]').length, expected.children[2].querySelectorAll('[style*="lane-pulse"]').length, 'far hex pulse');
  assert.equal(lane.querySelector('feGaussianBlur').getAttribute('stdDeviation'), '26', 'bloom radius');
  checks += 5;
  if (dir === (scenario.o.dir ?? 0)) {
    const picture = expected.cloneNode(true);
    picture.children[2].replaceWith(lane.cloneNode(true));
    // Remove the preview's target ring; the port provides it above pieces.
    [...picture.children[3].querySelectorAll('circle[fill="none"]')].forEach(el => el.remove());
    picture.children[4].replaceWith(labels.cloneNode(true));
    gallery.push(`<section><h2>${scenario.n}</h2><div class="pair"><div>Recovered preview${expected.outerHTML}</div><div>Shipped component${picture.outerHTML}</div></div></section>`);
  }
  actual.close();
}
dom.window.close();
writeFileSync('.scratch/bushido-port-verification.html', `<!doctype html><meta charset="utf-8"><title>Bushido port verification</title><style>body{background:#070b14;color:#c9d6ee;font:14px system-ui;margin:24px}h2{font-size:16px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}svg{width:100%;background:#05080f}section{margin-bottom:28px}@keyframes lane-pulse{0%,100%{opacity:.72}50%{opacity:1}}</style><h1>Psycho Bushido — recovered preview / shipped component</h1><p>Your September 5 screenshot settings. Geometry and paint verified across six facings.</p>${gallery.join('')}`);
console.log(`Bushido overlay: ${checks} checks passed against recovered preview across 11 scenarios and 6 facings.`);
