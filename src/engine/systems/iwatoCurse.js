// ─── 🎸 THE IWATO CURSE — the Cursed Shamisen's rules (engine half) ──────────
// ⭐ v3, "THE TRAP" (Alex, 2026-10-09). `src/IWATO_CURSE_V3_SPEC.md` is the spec;
// the v1 take-up/strings/cast flow (`RONIN_ABILITY_DESIGN.md` §2.3.00) and the
// unbuilt v2 are kept as the record. The pure scale helpers, the haunted-note
// draw and every number of the LOOK live in `board/cursedShamisen.js`; this file
// is the rules the client and the headless path both read, as plain functions
// over note sheets. Nothing here touches React, three.js or the audio graph.
//
// The life of one curse:
//   1. 🪤 LAY      — on his turn the Ronin spends his ACTION TOKEN (and starts
//                    the cooldown) to curse ONE Lost Chord anywhere on the board:
//                    `ns.shamisenTrap = { hexNum, note, key }` on HIS sheet. Only
//                    he sees it (the client draws it for his screen alone). One
//                    Shamisen curse at a time: no trap while one is armed or
//                    while a curse of his still stands on a Rival.
//   2. 📌 ARMED    — the cursed Lost Chord HOLDS ITS HEX (`board.js`
//                    `applyTokensDrifted` pins it) until the start of his next
//                    turn (`startTurnNotes` clears it: WASTED). 🪦 A trap that
//                    catches no one — wasted, his own pickup, a fizzle, his
//                    elimination — leaves a PUBLIC `shamisenAsh` (`ashPatch`,
//                    rule 18): every seat sees its noroi card burn to ash.
//   3. 🌑 SPRUNG   — a Rival picks it up (`springOutcome`): they bank the note as
//                    usual AND `rivalNs.iwatoCurse` is written — Iwato on the
//                    TRAPPED NOTE, three haunted notes (creepy degrees only),
//                    `CURSE_TURNS` of their own turns, the springing turn the
//                    first. The Ronin stepping on his own trap just collects the
//                    note: the trap is gone, no curse.
//   4. 👻 LIFTS    — each haunted note the Rival commits in a MELODY lifts one
//                    ghost (`liftOutcome`, from `melodyCommit.js`); progress
//                    accumulates. All three lift the paper (`how:'exorcised'`).
//                    The haunted notes are fixed from the spring (no refresh);
//                    instead their DRAW SEEPS toward the cursed wheel — ⅓ of the
//                    guaranteed slice on their 2nd cursed turn, ⅔ on their 3rd
//                    (`cursedDrawShare`, read by `turnFlow.js`).
//   5. ⌛ EXPIRY   — after their third cursed turn it ends either way
//                    (`endCursedTurn`, `how:'expired'`). The springing turn's
//                    melody is already played, so that is TWO cursed melodies
//                    (Alex, 2026-10-09: "2 rounds … in the melody is good").
//
// ⚠️ THE CURSE IS COUNTED IN THE RIVAL'S OWN TURNS, ended by `endCursedTurn` at
// the end of each of their turns — never by the round clock (turn order would
// otherwise decide how long it bites).
import { getSpelledPool, pitchIndex, playableScale } from '../../music/notes.js';
import { melodyModeFor } from '../../music/melodyIdentity.js';
import { IWATO, IWATO_DEGREES, CURSE_TURNS, HAUNTED_NOTES, hauntRand, pickHaunted, iwatoNames, cursedDrawShare } from '../../board/cursedShamisen.js';
import { canFire, firePatch, cooldownLeft } from './cooldowns.js';

export const SHAMISEN_SKILL = 'cursed_shamisen';
export { CURSE_TURNS, HAUNTED_NOTES, cursedDrawShare };

const pcOf = n => (((typeof n === 'number' ? n : pitchIndex(n)) % 12) + 12) % 12;
const ivAbove = (note, root) => (pcOf(note) - pcOf(root) + 12) % 12;

// ── 🪤 the Ronin's side ───────────────────────────────────────────────────────
/** Does this sheet own the Shamisen at all? */
export const hasShamisen = ns => (ns?.unlockedSkills ?? []).includes(SHAMISEN_SKILL);
/** His armed trap, or null. */
export const trapOf = ns => ns?.shamisenTrap ?? null;

/** Every Rival a curse of THIS Ronin still stands on (one Shamisen curse at a time). */
export function cursesStandingBy(noteStates = {}, roninId) {
  return Object.entries(noteStates).filter(([, ns]) => isCursed(ns) && ns.iwatoCurse.by === roninId).map(([id]) => id);
}

/**
 * Every refusal laying the trap can produce, in the order a player meets them.
 * @param ctx `{ ns, roninId, noteStates, token, tokenUsed }` — `token` is the
 *   Lost Chord clicked (`{ num, note }`), or null when only asking "can I arm it?"
 * @returns {{ ok:boolean, reason?:string }}
 */
export function layCheck({ ns, roninId, noteStates = {}, token = undefined, tokenUsed = false } = {}) {
  if (!hasShamisen(ns)) return { ok: false, reason: 'The Cursed Shamisen is not in your kit.' };
  if (trapOf(ns)) return { ok: false, reason: 'A trap is already set — it lasts until your next turn.' };
  if (cursesStandingBy(noteStates, roninId).length) return { ok: false, reason: 'Your curse still haunts a rival — one at a time.' };
  if (tokenUsed) return { ok: false, reason: 'Already used your Action Token this turn.' };
  if (!canFire(ns, SHAMISEN_SKILL)) return { ok: false, reason: cooldownLeft(ns, SHAMISEN_SKILL) > 0 ? 'The Shamisen is recharging.' : 'The curse is not in your kit.' };
  if (token === null) return { ok: false, reason: 'Click a Lost Chord on the board to curse it.' };
  return { ok: true };
}

/** The lay patch on HIS sheet: the cooldown starts now, the trap is armed.
 *  The CALLER spends the Action Token (`beatsSpent(0, true)` in the client). */
export function layPatch(ns, token, key) {
  return { ...firePatch(ns, SHAMISEN_SKILL), shamisenTrap: { hexNum: token.num, note: token.note, key: String(key) } };
}

/**
 * 🪦 THE ASH (Alex, 2026-10-09, rule 18: *"lets have the paper crumbling to ash
 * be public. Since no one was affected, they at least get to see the result
 * publicly."*). Every way a trap ends WITHOUT cursing anyone clears it AND leaves
 * a public record on his sheet, so every client burns the same noroi card from
 * state (`curseScene().ashes`), as `curseEnded` does for a curse:
 *   'wasted' (his next turn start) · 'disarmed' (his own pickup) ·
 *   'fizzled' (the picker was already cursed) · 'orphaned' (he was eliminated).
 * `shamisenAsh` is the LAST one, kept until the next overwrites it (the arena
 * keys on `key`, so a repeat frame never burns it twice).
 */
export function ashPatch(trap, how) {
  if (!trap) return { shamisenTrap: null };
  return { shamisenTrap: null, shamisenAsh: { key: `${trap.key}~${how}`, trapKey: String(trap.key), hexNum: trap.hexNum, note: trap.note, how } };
}

/** Which Ronin's trap sits on this hex, if any. */
export function trapAt(noteStates = {}, hexNum) {
  for (const [id, ns] of Object.entries(noteStates)) {
    const t = trapOf(ns);
    if (t && t.hexNum === hexNum) return { roninId: id, trap: t };
  }
  return null;
}
/** Every armed trap's hex — `board.js` pins these Lost Chords in place. */
export const armedTrapHexes = (noteStates = {}) =>
  new Set(Object.values(noteStates).map(trapOf).filter(Boolean).map(t => t.hexNum));

/**
 * 🌑 THE SPRING — what picking up the Lost Chord on `hexNum` does to the curse.
 * Call it with the sheets as they were BEFORE the pickup (it reads the trap).
 * @returns null (no trap there) or `{ kind, roninId, targetId?, patches }`:
 *   · 'disarmed' — the Ronin took his own note: his trap is gone, nothing else.
 *   · 'sprung'   — the picker is cursed (`patches[targetId].iwatoCurse`).
 *   · 'fizzled'  — the picker already carries a curse: the trap is spent, no second one.
 */
export function springOutcome({ noteStates = {}, pickerId, hexNum, turnKey = '' } = {}) {
  const found = trapAt(noteStates, hexNum);
  if (!found) return null;
  const { roninId, trap } = found;
  const clearTrap = { shamisenTrap: null };
  // 🪦 no one cursed → the card burns in public (rule 18)
  if (pickerId === roninId) return { kind: 'disarmed', roninId, patches: { [roninId]: ashPatch(trap, 'disarmed') } };
  if (isCursed(noteStates[pickerId])) return { kind: 'fizzled', roninId, targetId: pickerId, patches: { [roninId]: ashPatch(trap, 'fizzled') } };
  const key = `${trap.key}>${pickerId}${turnKey ? `@${turnKey}` : ''}`;
  const targets = pickHaunted(hauntRand(key), HAUNTED_NOTES);
  return {
    kind: 'sprung', roninId, targetId: pickerId,
    patches: {
      [roninId]: clearTrap,
      [pickerId]: { iwatoCurse: { key, by: roninId, root: trap.note, fromHex: hexNum, targets, lifted: [], turnsLeft: CURSE_TURNS } },
    },
  };
}

/** An eliminated Ronin's trap can never reach "his next turn": the client
 *  clears it (a curse already sprung runs on). @returns the Ronin ids. */
export const orphanedTraps = (spirits = [], noteStates = {}) =>
  spirits.filter(s => s.knockedOut && trapOf(noteStates[s.id])).map(s => s.id);

// ── 🌑 the Rival's side ───────────────────────────────────────────────────────
export const isCursed = ns => (ns?.iwatoCurse?.turnsLeft ?? 0) > 0;
/** The curse's key note (the trapped Lost Chord). Old v1 sheets carried `roninRoot`. */
export const curseRoot = c => c?.root ?? c?.roninRoot ?? 'C';
/** The haunted notes as intervals, and which are still to lift. */
export const hauntedOf = ns => ns?.iwatoCurse?.targets ?? [];
export const liftedOf = ns => ns?.iwatoCurse?.lifted ?? [];
export const unliftedOf = ns => hauntedOf(ns).filter(iv => !liftedOf(ns).includes(iv));

/**
 * The cursed palette: the five Iwato pitch classes on the CURSE'S root, spelled
 * through the RIVAL's own pool — their hand is spelled through that pool
 * (`startTurnNotes`), and the palette is compared to it by name.
 */
export function cursedPalette(spiritId, ns) {
  const pool = getSpelledPool(ns?.rootNote ?? 'C', ns?.paletteMode ?? melodyModeFor(spiritId));
  const r = pcOf(curseRoot(ns.iwatoCurse));
  return IWATO.map(iv => pool[(r + iv) % 12]);
}
/**
 * ⭐ THE ONE READING OF "WHICH NOTES ARE CLEAN FOR THIS SPIRIT NOW", curse
 * included. Every reader that scores a melody (the commit, the finder, the
 * coach, the bot's style gain, the client's live check) asks this, so a cursed
 * hand reads dead everywhere at once and never in only some places.
 */
export function livePalette(spiritId, ns = {}) {
  if (isCursed(ns)) return cursedPalette(spiritId, ns);
  return playableScale(ns?.rootNote ?? 'C', ns?.paletteMode ?? melodyModeFor(spiritId));
}

/** The haunted notes spelled through the Rival's pool, each with its degree and whether it is lifted. */
export function hauntedNotes(spiritId, ns) {
  const c = ns?.iwatoCurse; if (!c) return [];
  const pool = getSpelledPool(ns?.rootNote ?? 'C', ns?.paletteMode ?? melodyModeFor(spiritId));
  const r = pcOf(curseRoot(c));
  return (c.targets ?? []).map(iv => ({ iv, pc: (r + iv) % 12, note: pool[(r + iv) % 12],
    degree: IWATO_DEGREES[IWATO.indexOf(iv)] ?? null, lifted: (c.lifted ?? []).includes(iv) }));
}

/**
 * 👻 THE LIFTS — a committed MELODY lifts every unlifted haunted note it holds
 * (several in one melody lift together). Progress accumulates on the sheet; the
 * third lift ends the curse. ⚠️ `line` must be the notes PLAYED FROM THE HAND
 * (`noteTechniques.js` `playedNotes`) — a hammered note does not lift a curse.
 * @returns {{ patch:object|null, newly:number[], done:boolean }}
 */
export function liftOutcome(ns, line = []) {
  if (!isCursed(ns)) return { patch: null, newly: [], done: false };
  const c = ns.iwatoCurse;
  const played = new Set(line.map(n => ivAbove(n, curseRoot(c))));
  const newly = unliftedOf(ns).filter(iv => played.has(iv));
  if (!newly.length) return { patch: null, newly, done: false };
  const lifted = [...liftedOf(ns), ...newly];
  const done = (c.targets ?? []).every(iv => lifted.includes(iv));
  return done
    ? { patch: { iwatoCurse: null, curseEnded: { key: c.key ?? null, how: 'exorcised', lifted: lifted.length } }, newly, done }
    : { patch: { iwatoCurse: { ...c, lifted } }, newly, done };
}

/**
 * The end of one of the cursed Spirit's own turns.
 * @returns {{ patch:object|null, ended:'expired'|null, turnsLeft:number }}
 */
export function endCursedTurn(ns) {
  if (!isCursed(ns)) return { patch: null, ended: null, turnsLeft: 0 };
  const turnsLeft = ns.iwatoCurse.turnsLeft - 1;
  return turnsLeft <= 0
    ? { patch: { iwatoCurse: null, curseEnded: { key: ns.iwatoCurse.key ?? null, how: 'expired', lifted: liftedOf(ns).length } }, ended: 'expired', turnsLeft: 0 }
    : { patch: { iwatoCurse: { ...ns.iwatoCurse, turnsLeft } }, ended: null, turnsLeft };
}

/** Human words for a curse's key and haunted count, for logs and tooltips. */
export const curseWords = c => `Iwato on ${curseRoot(c)} (${iwatoNames(curseRoot(c)).join(' ')})`;

// ── 🎬 the picture's reading of the rules ─────────────────────────────────────
/**
 * Everything the arena draws for the curse, read off the note sheets alone — so
 * every client, a replay and a spectator draw the same thing from the same
 * state (`board/cursedShamisenArena.js` plays it). ⚠️ PUBLIC ONLY: an armed trap
 * is NOT here — it is hidden, and the client adds it for the Ronin's own screen
 * (`trap`, and the Lost Chord's `claim: 'cursed'`). A sprung curse is cast in
 * front of everyone, and so is a trap's ASH (`ashes`, rule 18).
 * @returns {{ instruments:object[], curses:object[], ashes:object[] }}
 */
export function curseScene(spirits = [], noteStates = {}) {
  const color = id => spirits.find(s => s.id === id)?.color ?? '#4488ff';
  const curses = [];
  for (const s of spirits) {
    const ns = noteStates[s.id] ?? {};
    const c = ns.iwatoCurse;
    if (isCursed(ns)) curses.push({ key: c.key ?? `${c.by}>${s.id}`, roninId: c.by, color: color(c.by), targetId: s.id,
      fromHex: c.fromHex ?? null, ivs: [...(c.targets ?? [])], lifted: (c.lifted ?? []).length, rootPc: pcOf(curseRoot(c)),
      turnsLeft: c.turnsLeft, ended: null });
    else if (ns.curseEnded?.key) curses.push({ key: ns.curseEnded.key, roninId: null, color: null, targetId: s.id, fromHex: null,
      ivs: [], lifted: ns.curseEnded.lifted ?? 0, rootPc: null, turnsLeft: 0, ended: ns.curseEnded.how });
  }
  // 🪦 the last trap of each Ronin's that caught no one (public)
  const ashes = spirits.map(s => [s, noteStates[s.id]?.shamisenAsh]).filter(([, a]) => a?.key)
    .map(([s, a]) => ({ key: a.key, trapKey: a.trapKey ?? null, hexNum: a.hexNum, note: a.note, roninId: s.id, color: color(s.id), how: a.how }));
  return { instruments: [], curses, ashes };
}
