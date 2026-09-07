import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { preserveTacticalLayer, keepGameplayClicks } from './arenaDom.js';

const dom = new JSDOM('<main><section><div id="layer"><button>Hex</button></div><aside>Camera</aside></section><div id="camera"></div></main>');
const document = dom.window.document;
const layer = document.querySelector('#layer');
const parent = layer.parentNode;
const sibling = layer.nextSibling;
const camera = document.querySelector('#camera');
for (let cycle = 0; cycle < 3; cycle++) {
  const restore = preserveTacticalLayer(layer);
  camera.appendChild(layer);
  layer.style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
  if (cycle === 1) sibling.remove();
  restore();
  assert.equal(layer.parentNode, parent, 'switching back restores the same live layer');
  assert.equal(layer.getAttribute('style'), null, '3D transforms cannot leak into 2D');
  if (cycle === 0) assert.equal(layer.nextSibling, sibling, 'original sibling order survives');
}
layer.setAttribute('style', 'color: red');
const restore = preserveTacticalLayer(layer);
camera.appendChild(layer); layer.style.transform = 'translateX(5px)'; restore();
assert.equal(layer.getAttribute('style'), 'color: red', 'pre-existing styles survive');

camera.appendChild(layer);
let captures = 0, clicks = 0;
camera.addEventListener('pointerdown', () => captures++);
document.querySelector('main').addEventListener('click', () => clicks++);
const release = keepGameplayClicks(camera);
const down = (pointerType, button) => {
  const event = new dom.window.MouseEvent('pointerdown', { bubbles: true, button });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  layer.firstChild.dispatchEvent(event);
};
for (const type of ['mouse', 'touch', 'pen']) {
  down(type, 0);
  layer.firstChild.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
}
assert.equal(captures, 0, 'camera never captures gameplay taps');
assert.equal(clicks, 3, 'gameplay clicks still reach the React root container');
down('mouse', 2); down('mouse', 1);
assert.equal(captures, 2, 'right and middle gestures still reach camera controls');
release(); down('mouse', 0);
assert.equal(captures, 3, 'unmount removes interception');
dom.window.close();
console.log('PASS: repeated 2D/3D restoration, removed sibling, style preservation, mouse/touch/pen clicks, camera gestures, cleanup');
