// ── BGM ───────────────────────────────────────────────────────────────────────
// The background bed the game plays under everything else. One track today:
// `atmospheric-sound.mp3`, the default music (Alex, 2026-09-14).
//
// 📌 The old eight-track shuffle is preserved commented at the bottom. It is the
//    shape this file goes back to the moment there is a second bed — the
//    consumer contract (`BGM_TRACKS` + `nextBgmTrack`) is deliberately unchanged
//    from the shuffle era so that re-expanding costs nothing at the call site.
import atmospheric from "../music/atmospheric-sound.mp3";

export const BGM_TRACKS = [atmospheric];

// ⚠️ WITH ONE TRACK THERE IS NOTHING TO SHUFFLE, and that is not a bug to fix
//    with a random pick — a single-entry queue that "chooses" still returns 0,
//    it just burns a call doing it. Returns -1 on an empty list so the caller's
//    `if (idx < 0) return` guard keeps working if the array is ever emptied
//    again (that is how this file spent the last five months).
export function nextBgmTrack(/* lastIdx */) {
  return BGM_TRACKS.length ? 0 : -1;
}

// ── The shuffle, for when there is more than one bed ──────────────────────────
// function shuffleBgm(arr) {
//   const a = [...arr];
//   for (let i = a.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [a[i], a[j]] = [a[j], a[i]];
//   }
//   return a;
// }
// function makeBgmQueue(excludeFirst = -1) {
//   let q = shuffleBgm(BGM_TRACKS.map((_, i) => i));
//   if (excludeFirst !== -1 && q[0] === excludeFirst && q.length > 1) {
//     const swap = Math.floor(Math.random() * (q.length - 1)) + 1;
//     [q[0], q[swap]] = [q[swap], q[0]];
//   }
//   return q;
// }
// let bgmQueue = [];
// export function nextBgmTrack(lastIdx = -1) {
//   if (bgmQueue.length === 0) bgmQueue = makeBgmQueue(lastIdx);
//   return bgmQueue.shift();
// }
