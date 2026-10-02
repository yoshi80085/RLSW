// ─── 🎸 THE IWATO CURSE — the Cursed Shamisen's rules (engine half) ──────────
// `RONIN_ABILITY_DESIGN.md` §2.3.00 is the spec. The pure scale helpers and every
// number of the LOOK live in `board/cursedShamisen.js` (one copy); this file is
// the rules the client and the kernel both read, as plain functions over note
// sheets. Nothing here touches React, three.js or the audio graph.
//
// The life of one curse, in five sheet changes:
//   1. 🪕 TAKE UP  — the Ronin takes the shamisen up (a free act on his own turn,
//                    off cooldown). `ns.shamisen = { strings:[], ready:false,
//                    root }` — the instrument keeps THAT root (`shamisenRoot`).
//   2. 🎼 TUNE     — from his NEXT turn (`startTurnNotes` sets `ready`), the
//                    chord step has a third destination: up to three strings, one
//                    Iwato note each, out of the SAME 3-a-turn commit budget as
//                    Drive and Sustain. ⭐ Alex, 2026-10-02: *"the sacrifice … is
//                    not that it comes directly from his stack but rather
//                    potentially a note that could have been used for his Drive
//                    or Sustain. But yes, up to 3 a turn - after the ability was
//                    selected, so … from the next turn."*
//   3. ⚡ CAST     — three strings tuned: the Action Token, Db and the cooldown
//                    (`firePatch`), on a rival within `CAST_RANGE` hexes. The
//                    strings are spent and the instrument is put away.
//   4. 🌑 CURSED   — `rivalNs.iwatoCurse`: their palette IS Iwato on the Ronin's
//                    root for their next `CURSE_TURNS` turns. Everything that asks
//                    "which notes are clean for this Spirit?" goes through
//                    `livePalette` below, so the existing "discord notes are inert"
//                    rule does the punishing — no Db, no fans.
//   5. 🔥 EXORCISM — on the FIRST cursed turn only, a committed melody holding
//                    `EXORCISE_NOTES` different Iwato notes lifts it. Otherwise it
//                    runs out at the end of their second cursed turn.
//
// ⚠️ THE CURSE IS COUNTED IN THE RIVAL'S OWN TURNS, ended by `endCursedTurn` at
// the end of each of their turns — never by the round clock. A round-end tick
// would give a rival who acts right after the Ronin two cursed turns and a rival
// who acts right before him one, and turn order would decide the curse.
import { getSpelledPool, pitchIndex, playableScale } from '../../music/notes.js';
import { melodyModeFor } from '../../music/melodyIdentity.js';
import { IWATO, STRINGS, CURSE_TURNS, EXORCISE_NOTES, isIwato, iwatoDegree, canTune, exorcises, stringIv, stringOctaves } from '../../board/cursedShamisen.js';
import { SONIC_BEAM_REACH } from '../../data/gameConstants.js';
import { canFire, firePatch, cooldownLeft } from './cooldowns.js';
import { axialDist } from '../../board/hexGeometry.js';

export const SHAMISEN_SKILL = 'cursed_shamisen';
/** Cast range, in hexes, any direction. ⁉️ Alex has not ruled; the Sonic beam's
 *  reach is the default so the number already means something at the table. */
export const CAST_RANGE = SONIC_BEAM_REACH;
export { STRINGS, CURSE_TURNS, EXORCISE_NOTES };

// ── 🪕 the Ronin's side ───────────────────────────────────────────────────────
/** Does this sheet own the Shamisen at all? */
export const hasShamisen = ns => (ns?.unlockedSkills ?? []).includes(SHAMISEN_SKILL);
/** The tuned strings (pitch names, in the order they were tuned). */
export const stringsOf = ns => ns?.shamisen?.strings ?? [];

/**
 * ⚠️ THE SHAMISEN KEEPS THE KEY IT WAS TAKEN UP IN. His root follows his melody's
 * last note (`melodyCommit.js`), so "Iwato on his root" would move every turn
 * and a string tuned on Monday could stop being Iwato by Wednesday. The take-up
 * fixes the instrument's root — the key his strings then open in — and every
 * string, the cast and the rival's curse read THAT root.
 */
export const shamisenRoot = ns => ns?.shamisen?.root ?? ns?.rootNote ?? 'C';

/** Can he take the instrument up right now? Off cooldown and not already up. */
export function canTakeUp(ns) {
  return hasShamisen(ns) && !ns?.shamisen && cooldownLeft(ns, SHAMISEN_SKILL) <= 0;
}
/** The take-up patch. Free; the strings open on his next turn. */
export function takeUpPatch(ns = {}) {
  return { shamisen: { strings: [], ready: false, root: ns.rootNote ?? 'C' } };
}

/** Is the third destination open in this chord step? */
export const tuningOpen = ns => !!ns?.shamisen?.ready && stringsOf(ns).length < STRINGS;

/**
 * May this note go on the next string? Iwato on HIS root, a string free, the
 * strings open this turn. Repeats are allowed — they ring in octaves.
 * @returns {{ ok:boolean, reason?:string }}
 */
export function tuneCheck(ns, note) {
  if (!ns?.shamisen) return { ok: false, reason: 'the shamisen is not taken up' };
  if (!ns.shamisen.ready) return { ok: false, reason: 'the strings open on your next turn' };
  if (stringsOf(ns).length >= STRINGS) return { ok: false, reason: 'all three strings are tuned' };
  if (!canTune(stringsOf(ns), note, shamisenRoot(ns))) return { ok: false, reason: `${note} is not an Iwato note on ${shamisenRoot(ns)}` };
  return { ok: true };
}
/** The tuning patch: the note joins the strings. The CALLER spends the stock slot
 *  and the commit budget (the same two fields a Drive/Sustain commit spends). */
export function tunePatch(ns, note) {
  return { shamisen: { ...ns.shamisen, strings: [...stringsOf(ns), note] } };
}
/** The Ronin's notes in the hand that could go on a string (for the chord step's glow). */
export const tunableIdx = (ns, used = new Set()) => (ns?.noteStock ?? [])
  .map((n, i) => (!used.has(i) && isIwato(n, shamisenRoot(ns)) ? i : -1)).filter(i => i >= 0);

/** His strings as intervals above his root, and the octave each one rings in. */
export function stringVoicing(ns) {
  const root = shamisenRoot(ns);
  const ivs = stringsOf(ns).map(n => stringIv(n, root));
  const octaves = stringOctaves(ivs), degrees = stringsOf(ns).map(n => iwatoDegree(n, root));
  // The label a string wears on the board: its degree, primed once per octave up (♭2 · ♭2′).
  return { ivs, octaves, degrees, labels: degrees.map((d, i) => `${d}${['', '′', '″'][octaves[i]] ?? ''}`) };
}

// ── ⚡ the cast ──────────────────────────────────────────────────────────────

/**
 * Every refusal the cast can produce, in the order a player meets them.
 * @param ctx `{ ns, rivalNs, from, to, tokenUsed }` — `from`/`to` are axial hexes
 * @returns {{ ok:boolean, reason?:string }}
 */
export function castCheck({ ns, rivalNs = null, from = null, to = null, tokenUsed = false } = {}) {
  if (!ns?.shamisen) return { ok: false, reason: 'Take the shamisen up first.' };
  if (stringsOf(ns).length < STRINGS) return { ok: false, reason: `Tune all three strings first (${stringsOf(ns).length}/${STRINGS}).` };
  if (tokenUsed) return { ok: false, reason: 'Already used your Action Token this turn.' };
  if (!canFire(ns, SHAMISEN_SKILL)) return { ok: false, reason: cooldownLeft(ns, SHAMISEN_SKILL) > 0 ? 'The Shamisen is recharging.' : 'Not enough Db for the curse.' };
  if (rivalNs?.iwatoCurse) return { ok: false, reason: 'That rival is already cursed.' };
  if (from && to && axialDist(from.q, from.r, to.q, to.r) > CAST_RANGE) return { ok: false, reason: `Too far — the curse reaches ${CAST_RANGE} hexes.` };
  return { ok: true };
}

/**
 * The cast, as two patches. The Ronin pays Db + cooldown and his strings; the
 * rival takes the curse. `roninRoot` is HIS root — the scale is his, not theirs.
 */
export function castPatches(ns, roninId, key = `${roninId}`) {
  const strings = stringsOf(ns);
  return {
    ronin: { ...firePatch(ns, SHAMISEN_SKILL), shamisen: null },
    // `key` names THIS curse for the picture (`curseScene`): it must differ from
    // the last one on the same rival, so the client passes the turn count in it.
    rival: { iwatoCurse: { key, by: roninId, roninRoot: shamisenRoot(ns), strings: [...strings], turnsLeft: CURSE_TURNS } },
  };
}

// ── 🌑 the rival's side ───────────────────────────────────────────────────────
export const isCursed = ns => (ns?.iwatoCurse?.turnsLeft ?? 0) > 0;
/** May THIS turn's melody exorcise? Only their first cursed turn. */
export const exorciseWindow = ns => isCursed(ns) && ns.iwatoCurse.turnsLeft === CURSE_TURNS;

/**
 * The cursed palette: the five Iwato pitch classes on the RONIN's root, spelled
 * through the RIVAL's own pool — their hand is spelled through that pool
 * (`startTurnNotes`), and the palette is compared to it by name.
 */
export function cursedPalette(spiritId, ns) {
  const pool = getSpelledPool(ns?.rootNote ?? 'C', ns?.paletteMode ?? melodyModeFor(spiritId));
  const r = pitchIndex(ns.iwatoCurse.roninRoot);
  return IWATO.map(iv => pool[(r + iv) % 12]);
}
/**
 * ⭐ THE ONE READING OF "WHICH NOTES ARE CLEAN FOR THIS SPIRIT NOW", curse
 * included. `notes.js` `paletteScaleFor` is the uncursed half; every reader that
 * scores a melody (the commit, the finder, the coach, the bot's style gain, the
 * client's live check) asks this instead, so a cursed hand reads dead
 * everywhere at once and never in only some places.
 */
export function livePalette(spiritId, ns = {}) {
  if (isCursed(ns)) return cursedPalette(spiritId, ns);
  return playableScale(ns?.rootNote ?? 'C', ns?.paletteMode ?? melodyModeFor(spiritId));
}

/** Does this committed melody lift the curse? (window + 3 different Iwato notes) */
export function exorcisedBy(ns, line = []) {
  return exorciseWindow(ns) && exorcises(line, ns.iwatoCurse.roninRoot);
}

/**
 * The end of one of the cursed Spirit's own turns.
 * @returns {{ patch:object|null, ended:'expired'|null, turnsLeft:number }}
 */
export function endCursedTurn(ns) {
  if (!isCursed(ns)) return { patch: null, ended: null, turnsLeft: 0 };
  const turnsLeft = ns.iwatoCurse.turnsLeft - 1;
  return turnsLeft <= 0
    ? { patch: { iwatoCurse: null, curseEnded: { key: ns.iwatoCurse.key ?? null, how: 'expired' } }, ended: 'expired', turnsLeft: 0 }
    : { patch: { iwatoCurse: { ...ns.iwatoCurse, turnsLeft } }, ended: null, turnsLeft };
}

/** The patch a lifting melody writes (`melodyCommit.js`). */
export const exorcisePatch = ns => ({ iwatoCurse: null, curseEnded: { key: ns?.iwatoCurse?.key ?? null, how: 'exorcised' } });

// ── 🎬 the picture's reading of the rules ─────────────────────────────────────
/**
 * Everything the arena draws for the curse, read off the note sheets alone — so
 * every client, a replay and a spectator draw the same thing from the same state
 * (`board/cursedShamisenArena.js` plays it). Public by design: rivals can count
 * the strings, and a curse is cast in front of everyone.
 * @returns {{ instruments:object[], curses:object[] }}
 */
export function curseScene(spirits = [], noteStates = {}) {
  const color = id => spirits.find(s => s.id === id)?.color ?? '#4488ff';
  const instruments = spirits.filter(s => !s.knockedOut && noteStates[s.id]?.shamisen)
    .map(s => ({ roninId: s.id, color: s.color, strings: stringVoicing(noteStates[s.id]).labels }));
  const curses = [];
  for (const s of spirits) {
    const ns = noteStates[s.id] ?? {};
    const c = ns.iwatoCurse;
    if (isCursed(ns)) curses.push({ key: c.key ?? `${c.by}>${s.id}`, roninId: c.by, color: color(c.by), targetId: s.id,
      ivs: (c.strings ?? []).map(n => stringIv(n, c.roninRoot)), turnsLeft: c.turnsLeft, ended: null });
    else if (ns.curseEnded?.key) curses.push({ key: ns.curseEnded.key, roninId: null, color: null, targetId: s.id,
      ivs: [], turnsLeft: 0, ended: ns.curseEnded.how });
  }
  return { instruments, curses };
}
