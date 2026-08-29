// ─── 🖥️ A BROWSER, JUST BARELY ───────────────────────────────────────────────
//
// The smallest set of globals that lets `rlsw-simulator-v3_8_1.jsx` be imported
// and rendered by `react-dom/server` under plain Node.
//
// ⚠️ WHY NOT JSDOM. It will not install on this machine — `npm install jsdom`
// hangs on the network the local VM is given, the same reason `npm run build`
// is unavailable here. A real DOM would let a test CLICK things; this shim only
// lets one RENDER. That is a smaller check than SEQUENCING.md §5 asked for, and
// the gap is stated plainly in clientRenderCheck's own output rather than
// papered over.
//
// 📌 Everything here is inert. Nothing records calls, because nothing asserts on
// them — the assertions are about what the RENDER produced. If a future check
// needs to observe a side effect, give that thing a real fake rather than
// growing this file into a fake browser nobody trusts.

const noop = () => {};
const el = () => ({
  style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  appendChild: noop, removeChild: noop, remove: noop, setAttribute: noop, removeAttribute: noop,
  addEventListener: noop, removeEventListener: noop, getBoundingClientRect: () => rect(),
  querySelector: () => null, querySelectorAll: () => [], focus: noop, blur: noop, click: noop,
  offsetTop: 0, offsetLeft: 0, offsetWidth: 0, offsetHeight: 0, scrollIntoView: noop,
  getContext: () => null, play: () => Promise.resolve(), pause: noop, innerHTML: '', textContent: '',
});
const rect = () => ({ top:0, left:0, right:0, bottom:0, width:0, height:0, x:0, y:0 });

const doc = {
  createElement: el, createElementNS: el, createTextNode: () => ({}),
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  addEventListener: noop, removeEventListener: noop,
  body: el(), documentElement: el(), head: el(),
  visibilityState: 'visible', hidden: false, cookie: '',
};

const store = new Map();
const storage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: k => { store.delete(k); }, clear: () => store.clear(),
  key: i => [...store.keys()][i] ?? null, get length() { return store.size; },
};

class AudioCtxStub {
  constructor() { this.destination = {}; this.currentTime = 0; this.state = 'running'; }
  createOscillator() { return { connect: noop, start: noop, stop: noop, frequency: { value: 0, setValueAtTime: noop }, type: 'sine' }; }
  createGain() { return { connect: noop, gain: { value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, exponentialRampToValueAtTime: noop } }; }
  createBiquadFilter() { return { connect: noop, frequency: { value: 0, setValueAtTime: noop }, Q: { value: 0 }, type: 'lowpass' }; }
  createWaveShaper() { return { connect: noop, curve: null, oversample: 'none' }; }
  createDynamicsCompressor() { return { connect: noop, threshold:{value:0}, knee:{value:0}, ratio:{value:0}, attack:{value:0}, release:{value:0} }; }
  createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
  createBufferSource() { return { connect: noop, start: noop, stop: noop, buffer: null }; }
  createConvolver() { return { connect: noop, buffer: null }; }
  createStereoPanner() { return { connect: noop, pan: { value: 0, setValueAtTime: noop } }; }
  createAnalyser() { return { connect: noop, fftSize: 2048, getByteFrequencyData: noop, getByteTimeDomainData: noop, frequencyBinCount: 1024 }; }
  resume() { return Promise.resolve(); } close() { return Promise.resolve(); }
}

// ⚠️ NODE 22 SHIPS SOME OF THESE ITSELF, AS GETTER-ONLY GLOBALS. `navigator` is
// the one that bites: a plain assignment throws "Cannot set property navigator
// of #<Object> which has only a getter". defineProperty overwrites it cleanly and
// keeps the property configurable so a later run can do it again.
const win = globalThis;
const set = (k, v) => Object.defineProperty(win, k, { value: v, writable: true, configurable: true });
win.window = win;
set('document', doc);
set('navigator', { userAgent: 'node', language: 'en-US', mediaDevices: { getUserMedia: () => Promise.reject(new Error('no media in the shim')) }, clipboard: { writeText: () => Promise.resolve() } });
set('localStorage', storage);
set('sessionStorage', storage);
set('location', { href: 'http://localhost/', search: '', hash: '', pathname: '/', origin: 'http://localhost', reload: noop });
set('history', { pushState: noop, replaceState: noop });
set('matchMedia', () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop, removeListener: noop }));
set('requestAnimationFrame', cb => setTimeout(() => cb(Date.now()), 0));
set('cancelAnimationFrame', clearTimeout);
set('getComputedStyle', () => ({ getPropertyValue: () => '' }));
set('scrollTo', noop);
set('addEventListener', noop);
set('removeEventListener', noop);
set('innerWidth', 1440);
set('innerHeight', 900);
set('devicePixelRatio', 1);
set('AudioContext', AudioCtxStub);
set('webkitAudioContext', AudioCtxStub);
set('Image', class { constructor() { this.onload = null; this.onerror = null; } set src(_) {} });
set('Audio', class { constructor() {} play() { return Promise.resolve(); } pause() {} });
set('WebSocket', class { constructor() {} send() {} close() {} addEventListener() {} });
set('HTMLElement', class {});
set('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
set('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });

export const BROWSER_SHIM_INSTALLED = true;
