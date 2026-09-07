import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { SCALE, SVG_W, SVG_H } from './constants.js';
import { preserveTacticalLayer, keepGameplayClicks } from './arenaDom.js';

// The GLB is scenery only. The live SVG carries every piece, target, hazard and
// effect, including hidden-information rules, with its original React handlers.
export function mountArena(host, tacticalElement, { onReady, onError }) {
  const restoreLayer = preserveTacticalLayer(tacticalElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#030611');
  const overlayScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 400);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.appendChild(renderer.domElement);
  const overlay = new CSS3DRenderer();
  Object.assign(overlay.domElement.style, { position: 'absolute', inset: '0' });
  host.appendChild(overlay.domElement);
  const plane = new CSS3DObject(tacticalElement);
  plane.scale.setScalar(1 / (200 * SCALE));
  plane.rotation.x = -Math.PI / 2;
  plane.position.set((SVG_W / (2 * SCALE) - 3255) / 200, 0.10, (SVG_H / (2 * SCALE) - 2415) / 200);
  overlayScene.add(plane);
  const controls = new OrbitControls(camera, overlay.domElement);
  // OrbitControls captures the pointer even when LEFT is mapped to null. That
  // retargets the browser's click to its container, swallowing the hex click.
  // Touch taps also belong to the board; camera buttons serve touch devices.
  const releaseInput = keepGameplayClicks(overlay.domElement);
  // Left clicks always belong to gameplay. Camera gestures cannot consume AP.
  controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.minDistance = 12;
  controls.maxDistance = 75;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = Math.PI * 0.34;
  controls.enableDamping = false;
  scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x363852, 2));
  const key = new THREE.DirectionalLight(0xaad8ff, 2.2);
  key.position.set(7, 20, -16); scene.add(key);
  const rim = new THREE.DirectionalLight(0xae72ff, 1.6);
  rim.position.set(-15, 9, 12); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x72aaff, 2.4);
  fill.position.set(4, -3, -18); scene.add(fill);
  const positions = [];
  for (let i = 0; i < 900; i++) {
    const t = i * 2.399963, u = 1 - 2 * (i + 0.5) / 900, r = Math.sqrt(1 - u * u);
    positions.push(100 * r * Math.cos(t), 100 * u, 100 * r * Math.sin(t));
  }
  const stars = new THREE.BufferGeometry();
  stars.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0x9ebbdc, size: 0.15 })));
  let disposed = false;
  const render = () => {
    if (disposed) return;
    renderer.render(scene, camera);
    overlay.render(overlayScene, camera);
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const nextAspect = width / height;
    // Preserve the player's relative zoom while keeping the arena's width in
    // frame when the board column narrows. Canvas resizing alone crops it.
    const fit = aspect => Math.max(1, (SVG_W / SVG_H) / aspect);
    camera.position.sub(controls.target).multiplyScalar(fit(nextAspect) / fit(camera.aspect)).add(controls.target);
    camera.aspect = nextAspect; camera.updateProjectionMatrix();
    renderer.setSize(width, height); overlay.setSize(width, height); render();
  };
  const view = name => {
    controls.target.set(0, -0.5, 0);
    const distance = 35 * Math.max(1, (SVG_W / SVG_H) / Math.max(camera.aspect, 0.25));
    camera.position.set(name === 'arena' ? distance * 0.32 : 0, distance * (name === 'arena' ? 0.72 : 0.94), distance * (name === 'arena' ? 0.66 : 0.34));
    controls.update(); render();
  };
  controls.addEventListener('change', render);
  const observer = new ResizeObserver(resize); observer.observe(host);
  resize(); view('tactical');
  const releaseScene = object => object.traverse(child => {
    child.geometry?.dispose();
    const materials = child.material ? (Array.isArray(child.material) ? child.material : [child.material]) : [];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
      material.dispose();
    }
  });
  const lost = event => { event.preventDefault(); onError(); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  new GLTFLoader().load(`${import.meta.env.BASE_URL}cosmic-arena/cosmic-arena.glb`, gltf => {
    if (disposed) { releaseScene(gltf.scene); return; }
    // Undo the export's image-Y inversion so north stays at the top of the live
    // board. Both the model and CSS plane now map original image Y to +world Z.
    gltf.scene.scale.z = -1;
    scene.add(gltf.scene); render(); onReady();
  }, undefined, () => { if (!disposed) onError(); });
  return {
    view,
    zoom(factor) {
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      controls.update(); render();
    },
    dispose() {
      disposed = true; observer.disconnect(); controls.dispose();
      releaseInput();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      // Restore React's ownership before it removes/reuses this subtree.
      restoreLayer();
      releaseScene(scene); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove(); overlay.domElement.remove();
    },
  };
}
