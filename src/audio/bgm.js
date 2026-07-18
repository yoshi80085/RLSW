// ── BGM DISABLED ──────────────────────────────────────────────────────────────
// BGM tracks removed from the build — using custom music only.
// Original imports and shuffle logic preserved below (commented) for re-enabling.
//
// import bgm1 from "../bgm/bgm_1.mp3";
// import bgm2 from "../bgm/bgm_2.mp3";
// import bgm3 from "../bgm/bgm_3.mp3";
// import bgm4 from "../bgm/bgm_4.mp3";
// import bgm5 from "../bgm/bgm_5.mp3";
// import bgm6 from "../bgm/bgm_6.mp3";
// import bgm7 from "../bgm/bgm_7.mp3";
// import bgm8 from "../bgm/bgm_8.mp3";
//
// export const BGM_TRACKS = [bgm1, bgm2, bgm3, bgm4, bgm5, bgm6, bgm7, bgm8];

export const BGM_TRACKS = [];

// No-op — nothing to queue when tracks are empty.
export function nextBgmTrack(/* lastIdx */) { return -1; }

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
