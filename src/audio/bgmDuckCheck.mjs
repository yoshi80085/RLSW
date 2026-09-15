// ─── BGM BED + DUCKING CHECK ─────────────────────────────────────────────────
// The atmospheric bed (`music/atmospheric-sound.mp3`) plays under the whole game
// and steps aside for battle and riff-off music instead of stopping. This suite
// covers the two things that silently rot:
//
//   §1  `bgm.js` still registers a bed. The file spent five months exporting an
//       empty `BGM_TRACKS` while every call site looked perfectly healthy — the
//       music was simply gone and nothing said so. An empty list is now a
//       FAILURE, not a quiet no-op.
//   §2–§6  the duck actually ducks, and the three ways it historically wouldn't.
//
// ⚠️ §2–§6 READ THE SHIPPED CODE OUT OF THE MONOLITH rather than re-implementing
//    it here. A transcribed copy of the logic is a test of the transcription:
//    `sonicRingCheck` exists because that exact trap cost a whole rebuild. If the
//    duck block is renamed or moved, this suite fails loudly instead of quietly
//    testing nothing.
//
// Run: npm run test:bgm
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BGM_TRACKS, nextBgmTrack } from "./bgm.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MONOLITH = path.join(HERE, "..", "rlsw-simulator-v3_8_1.jsx");

let pass = 0;
const failures = [];
function ok(cond, msg) {
  if (cond) { pass++; console.log("  ✓", msg); }
  else { failures.push(msg); console.log("  ✗", msg); }
}
const near = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;

// ═══ 1. THERE IS A BED AT ALL ═══════════════════════════════════════════════
console.log("\n§1 bgm.js registers the default bed");
{
  ok(BGM_TRACKS.length > 0,
    `BGM_TRACKS has ${BGM_TRACKS.length} track(s) — an empty list means the game ships silent`);
  ok(String(BGM_TRACKS[0] ?? "").includes("atmospheric-sound"),
    `the bed is atmospheric-sound.mp3 (got ${JSON.stringify(BGM_TRACKS[0])})`);
  ok(nextBgmTrack() === 0, "nextBgmTrack() picks the single bed");
  ok(nextBgmTrack(0) === 0, "nextBgmTrack(lastIdx) is stable with one bed — never returns -1");
}

// ═══ 2. THE SHIPPED DUCK BLOCK, LIFTED VERBATIM ═════════════════════════════
const src = fs.readFileSync(MONOLITH, "utf8");
const START = "const BGM_DUCK    = 0.15;";
const END   = "function unduckBgm()";
const i0 = src.indexOf(START);
const i1 = src.indexOf(END);
if (i0 < 0 || i1 < 0) {
  console.error(
    "\n✗ could not find the BGM duck block in rlsw-simulator-v3_8_1.jsx.\n" +
    "  📌 It is anchored on the literal `" + START + "` and the `unduckBgm` declaration.\n" +
    "     If you renamed or moved them, re-anchor this suite — do not delete it."
  );
  process.exit(1);
}
// Refs, state and effects are React; give them plain equivalents so the SAME
// source runs headless. Nothing about the fade maths is touched.
//
// ⚠️ THE MIXER LIVES IN THIS BLOCK TOO as of 2026-09-14, and it is deliberately
//    neutralised here rather than modelled: `mix.music` becomes 1 so the duck
//    maths is tested on its own. What the music fader does to the bed is
//    `test:mix`'s job — two suites asserting the same multiply is how you get
//    one of them quietly asserting nothing.
const rawBlock = src.slice(i0, src.indexOf("\n", i1));
const shims = [
  [/const (bgmVolumeRef|bgmDuckedRef|bgmFadeRef)\s*= useRef\(([^)]*)\);/g,
   "const $1 = { current: $2 };"],
  [/const \[mix, setMix\] = useState\(\(\) => getMix\(\)\);/, "const mix = { music: 1 };"],
  [/useEffect\(\(\) => onMixChange\(setMix\), \[\]\);/, ""],
  [/useEffect\(\(\) => \{[\s\S]*?\}, \[bgmVolume, mix\.music\]\);[^\n]*/, ""],
];
let block = rawBlock;
for (const [re, to] of shims) {
  if (!re.test(block)) {
    console.error(
      "\n\u2717 a shim in bgmDuckCheck no longer matches the monolith: " + re +
      "\n  \uD83D\uDCCC The duck block was edited. Re-anchor the shim \u2014 do not delete it, and do" +
      "\n     not let this suite quietly test a block it failed to neutralise."
    );
    process.exit(1);
  }
  block = block.replace(re, to);
}
if (/use(State|Effect|Ref)\(/.test(block)) {
  console.error("\n\u2717 React hooks survived the shims:\n" +
    block.split("\n").filter(l => /use(State|Effect|Ref)\(/.test(l)).join("\n"));
  process.exit(1);
}

// A clock and an <audio> element we can step deterministically.
let now = 0;
const timers = new Set();
const shim = {
  setInterval: (fn, ms) => { const t = { fn, ms, next: now + ms }; timers.add(t); return t; },
  clearInterval: (t) => timers.delete(t),
  performance: { now: () => now },
};
function advance(ms) {
  const target = now + ms;
  for (;;) {
    let soonest = null;
    for (const t of timers) if (t.next <= target && (!soonest || t.next < soonest.next)) soonest = t;
    if (!soonest) break;
    now = soonest.next; soonest.next += soonest.ms; soonest.fn();
  }
  now = target;
}

const audio = { volume: 0.4 };
const api = new Function(
  "audioRef", "bgmVolume", "setInterval", "clearInterval", "performance",
  block + "\n return { fadeBgmTo, duckBgm, unduckBgm, bgmTargetVolume, bgmVolumeRef, bgmDuckedRef };"
)({ current: audio }, 0.4, shim.setInterval, shim.clearInterval, shim.performance);

console.log("\n§2 the bed drops when battle music starts");
{
  ok(near(api.bgmTargetVolume(), 0.4), "unducked target is the player's full volume (0.40)");
  api.duckBgm();
  ok(near(audio.volume, 0.4),
    "volume does NOT jump on the same tick — a hard cut on a pad is an audible click");
  advance(225);
  ok(audio.volume < 0.4 && audio.volume > 0.06,
    `mid-fade, partway down (${audio.volume.toFixed(3)})`);
  advance(250);
  ok(near(audio.volume, 0.06), `settles at 15% of 0.40 = 0.060 (${audio.volume.toFixed(3)})`);
}

console.log("\n§3 the volume slider does not cancel the duck");
{
  api.bgmVolumeRef.current = 0.8;
  ok(near(api.bgmTargetVolume(), 0.12), "target follows the new slider but stays ducked (0.12)");
  api.fadeBgmTo(api.bgmTargetVolume(), 120);
  advance(150);
  ok(near(audio.volume, 0.12),
    `faded to 0.120 — did not leap to 0.80 over the battle song (${audio.volume.toFixed(3)})`);
}

console.log("\n§4 the bed comes back when the battle closes");
{
  api.unduckBgm();
  advance(500);
  ok(near(audio.volume, 0.8), `restored to the full slider volume (${audio.volume.toFixed(3)})`);
}

console.log("\n§5 a battle → battle handoff never swells");
{
  api.duckBgm();
  advance(500);
  const before = audio.volume;
  // This is the real call order: playBattleMusic() calls stopBattleMusic()
  // (which un-ducks) and then re-ducks, both inside one tick.
  api.unduckBgm();
  api.duckBgm();
  ok(near(audio.volume, before),
    `volume unchanged across the same-tick unduck→duck (${audio.volume.toFixed(3)})`);
  advance(500);
  ok(near(audio.volume, 0.12), `still ducked after the handoff (${audio.volume.toFixed(3)})`);
}

console.log("\n§6 no fade is left running");
{
  ok(timers.size === 0, `every fade interval was cleared (${timers.size} live)`);
}

console.log(
  failures.length
    ? `\n✗ BGM CHECK FAILED — ${pass} passed, ${failures.length} failed:\n    ` +
      failures.join("\n    ")
    : `\n✓ BGM check passed — ${pass} assertions`
);
process.exit(failures.length ? 1 : 0);
