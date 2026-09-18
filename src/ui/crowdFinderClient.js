// =============================================================================
// ui/crowdFinderClient.js  —  🧵 asks the finder for a hand, off the main thread
// -----------------------------------------------------------------------------
// The only caller is `useCrowdCoach` in `ui/CrowdBubble.jsx`. One Worker for the
// whole match (`engine/policies/playFinder.worker.js`), requests matched by id.
//
// 📌 WHY THIS IS A .js FILE AND NOT PART OF THE COMPONENT: `new Worker(new URL(…,
// import.meta.url))` is how Vite finds and bundles a worker, and `test:client`
// (clientRefCheck) parses every .jsx with a scope-blind reader that reads
// `import.meta` as two undeclared names. Keeping the one line that needs it in
// plain JS keeps that suite honest rather than teaching it an exception.
//
// ⚠️ NO WORKER (jsdom, an old browser) FALLS BACK TO THE SAME FUNCTION INLINE,
// deferred with a timeout so it is at least off the render. The answer is
// identical either way; only where the second of work lands differs.
// =============================================================================
let worker = null, failed = false, nextId = 0;
const pending = new Map();

function getWorker() {
  if (worker || failed) return worker;
  try {
    if (typeof Worker === 'undefined') throw new Error('no Worker');
    worker = new Worker(new URL('../engine/policies/playFinder.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const job = pending.get(e.data?.id); pending.delete(e.data?.id); job?.resolve(e.data?.plays ?? null); };
    // ⚠️ A worker that fails to LOAD fails asynchronously, after requests were
    // already posted to it. Those requests are re-run inline rather than answered
    // with null — a null would silence the crowd until the hand next changed.
    worker.onerror = () => {
      failed = true; worker = null;
      for (const job of pending.values()) inline(job.args).promise.then(job.resolve);
      pending.clear();
    };
  } catch { failed = true; worker = null; }
  return worker;
}

/**
 * @returns {{ promise: Promise<object|null>, cancel: () => void }}
 *   `cancel` only stops the inline fallback; a Worker answer that arrives late is
 *   simply ignored by the caller's own staleness check.
 */
/** Only the fields `findBestPlays` reads. ⚠️ The client's note sheet carries
 *  plenty more, and one non-cloneable value in it would make `postMessage` THROW
 *  inside a React effect — so the sheet is slimmed before it crosses, not after. */
const FINDER_FIELDS = ['rootNote', 'paletteMode', 'noteStock', 'usedStockIdx', 'melodyLine', 'driveStack', 'sustainStack',
  'stackCommitsThisTurn', 'hasConfirmed', 'tempDrive', 'tempSustain', 'mojoDrain', 'driveSlots', 'sustainSlots'];
const slim = ns => Object.fromEntries(FINDER_FIELDS.filter(k => ns?.[k] !== undefined).map(k => [k, ns[k]]));

export function askFinder(spiritId, ns, goals, unavailable = []) {
  const args = { spiritId, ns: slim(ns), goals, unavailable: [...(unavailable ?? [])] };
  const w = getWorker();
  if (w) {
    const id = ++nextId;
    const promise = new Promise(resolve => pending.set(id, { resolve, args }));
    try {
      w.postMessage({ id, ...args });
      return { promise, cancel: () => pending.delete(id) };
    } catch {
      pending.delete(id);           // could not cross — answer inline instead
    }
  }
  return inline(args);
}

function inline({ spiritId, ns, goals, unavailable }) {
  let timer = 0;
  const promise = new Promise(resolve => {
    timer = setTimeout(() => {
      import('../engine/policies/playFinder.js')
        .then(({ findBestPlays }) => resolve(findBestPlays(spiritId, ns, { goals, unavailable })))
        .catch(() => resolve(null));
    }, 0);
  });
  return { promise, cancel: () => clearTimeout(timer) };
}
