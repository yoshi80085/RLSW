// =============================================================================
// riff/arrowHighwayEngine.test.mjs — the engine mounts, and every knob is live
// -----------------------------------------------------------------------------
//   node src/riff/arrowHighwayEngine.test.mjs
//
// The engine is the prototype lifted out of a browser page, so the risk is that
// the lift left a dangling reference to something the page provided. These stubs
// are the minimum DOM + WebAudio surface it touches; if anything else creeps in,
// this fails loudly instead of at runtime in the game.
// =============================================================================
// Minimal DOM/audio stubs so the engine can mount headless. If the extraction
// left a dangling reference, this is where it surfaces.
const noop = () => {};
const ctxStub = new Proxy({}, { get: (_, k) =>
  k === 'canvas' ? { width: 900, height: 600 }
  : k === 'createLinearGradient' || k === 'createRadialGradient'
      ? () => ({ addColorStop: noop })
  : k === 'measureText' ? () => ({ width: 10 })
  : noop });
globalThis.window = { addEventListener: noop, removeEventListener: noop, devicePixelRatio: 1, AudioContext: null };
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = noop;
globalThis.ResizeObserver = class { observe(){} disconnect(){} };
globalThis.CanvasRenderingContext2D = { prototype: { roundRect: noop } };
class AC {
  constructor(){ this.currentTime=0; this.destination={}; this.state='running'; }
  createGain(){ return { gain:{value:1,setValueAtTime:noop,linearRampToValueAtTime:noop,
    exponentialRampToValueAtTime:noop,setTargetAtTime:noop,cancelScheduledValues:noop},
    connect:noop, disconnect:noop }; }
  createOscillator(){ return { type:'', frequency:{value:440,setValueAtTime:noop,
    linearRampToValueAtTime:noop,cancelScheduledValues:noop},
    detune:{setValueAtTime:noop}, connect:noop, start:noop, stop:noop }; }
  createBiquadFilter(){ return { type:'', frequency:{value:1000,setValueAtTime:noop,
    linearRampToValueAtTime:noop,exponentialRampToValueAtTime:noop,cancelScheduledValues:noop},
    Q:{value:1}, gain:{value:0}, connect:noop }; }
  createWaveShaper(){ return { curve:null, oversample:'', connect:noop }; }
  resume(){} close(){}
}
globalThis.AudioContext = AC; globalThis.window.AudioContext = AC;

const canvas = { width:900, height:600, style:{}, getContext: () => ctxStub,
                 parentElement: { getBoundingClientRect: () => ({ width:900, height:600 }) } };

const { mountArrowHighway } = await import('./arrowHighwayEngine.js');
const h = mountArrowHighway(canvas);

let fails=0; const ok=(c,m)=>{ if(!c){ console.log('  ❌ '+m); fails++; } };

ok(h && h.K && h.S, 'mount returns a handle with K and S');
const KNOBS=['persp','depth','far','lead','space','len','tier','genre','style','arch',
             'gemForm','colorMode','palette','gemSize','showNums','susRate','drive',
             'bendRate','chordRate','bendDepth','bendTravel'];
for(const k of KNOBS) ok(k in h.K, `knob "${k}" present on K`);

let riffInfo=null, statsSeen=null;
h.onRiff = (r) => { riffInfo = r; };
h.onStats = (s) => { statsSeen = s; };

for (const genre of ['classic_rock','hard_rock','metal','thrash','doom','punk','prog']) {
  for (const style of [null,'Shred','Groove','Flair']) {
    h.K.genre=genre; h.K.style=style;
    h.newRiff();
    ok(h.S.notes.length>0, `${genre}/${style}: riff built`);
    ok(riffInfo && riffInfo.count===h.S.notes.length, `${genre}/${style}: onRiff fired`);
    for(const n of h.S.notes){
      ok(['up','down','same'].includes(n.dir), `${genre}: dir valid`);
      ok(n.string>=0 && n.string<=5, `${genre}: string in range`);
      ok(Number.isFinite(n.pitch), `${genre}: pitch finite`);
    }
    ok(h.S.notes.some(n=>n.sustain>0), `${genre}/${style}: has a sustain`);
  }
}
for (const arch of ['pedal','chug','gallop','run','arch_run','chromatic','blues_box','power_plane','alt_cell']) {
  h.K.arch=arch; h.newRiff();
  ok(h.S.notes.length>0, `archetype ${arch} builds`);
}
h.K.arch=null;

h.start();
ok(h.isRunning(), 'start() begins a run');
h.replay();
ok(true, 'replay() does not throw');
ok(typeof h.readabilityNote()[0]==='string', 'readabilityNote returns copy');
h.setDrive(0.4); ok(h.K.drive===0.4, 'setDrive writes K');
h.destroy();
ok(true, 'destroy() does not throw');

console.log(fails ? `\n❌ ${fails} failures` : `\n✅ engine mounts headless and every knob is live`);
process.exit(fails?1:0);
