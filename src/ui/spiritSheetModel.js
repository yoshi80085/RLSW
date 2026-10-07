// ─── 🪪 THE SPIRIT SHEET — what the SPIRIT card's window says, as data ───────
//
// Alex, 2026-10-07: "Lets build out a new version of the Spirit window when
// clicking the Spirit's image in the player's HUD in gameplay. Right now, the
// old 2D version we built out before comes up, lets rebuild that to have the
// necessary information while keeping the current 'look'." His picks: body
// (Vibe, lives, speed, hex), abilities + cooldowns, status effects, sound + key
// detail, and FP; same spot beside the pocket; the seat-portrait head.
//
// ⭐ TWO HALVES, ON PURPOSE. This file is PURE — the levers (`SPIRIT_SHEET`) and
// `sheetModel`, which turns the game's raw numbers into the rows the window
// draws. `SpiritSheet.jsx` only draws them. So `spiritSheetCheck` can read every
// rule (what a status says, when Fame turns red, which next note a stack wants)
// with no DOM, and the preview page reads its defaults FROM here, so the page
// and the game cannot drift.
//
// ⚠️ THE MODEL NEVER INVENTS A NUMBER. Every value is the same one some other
// surface already shows — Fame from the sheet, Drive / Sustain from
// `readStack` (what the SOUND dials read), the cooldown from `cooldownLeft`
// (what the wallet reads). If this window ever disagrees with the board, the
// board is right and this is the bug.
import { SKILL_BY_ID } from '../data/skillTree.js';
import { cooldownLeft } from '../engine/systems/cooldowns.js';
import { readStack, nextStep, PC_NAMES } from '../music/vocabularies.js';
import { getIntervalNotes } from '../music/notes.js';
import { stackCapFor, FAME_RACE_CONTESTED_LEAD } from '../data/gameConstants.js';
import { MODE_NAME, pretty } from './scaleWheelModel.js';
import { characterId } from '../data/spiritIdentity.js';

/** 🎛️ THE LEVERS — every taste call on the preview page is one of these.
 *  ⭐ ALEX'S DIAL-IN, 2026-10-07 ("Lets wire it in!"): 6 of 25 moved — width
 *  480 → 426, sections rules → brackets, scrim .5 → .54, heroHeight 118 → 105,
 *  statusDetail always → hover, abilityDetail line → hover. Every other field is
 *  the opening value he left alone. `spiritSheetCheck` §0 pins them. */
export const SPIRIT_SHEET = Object.freeze({
  // the window
  width: 426,           // px (the old window was 480)
  scrim: 0.54,          // the bracket's wash; the arena reads through it
  accent: 'player',     // 'player' = the seat's colour on the frame · 'hud' = the arena's cyan
  sections: 'brackets', // 'rules' = one frame, hairline-split · 'brackets' = a frame per section
  layout: 'two',        // 'two' = two columns under the hero · 'one' = one long column
  labelPx: 9,           // stencil labels
  textPx: 10,           // body copy
  valuePx: 16,          // the big numbers
  enter: 'slide',       // 'slide' | 'fade' | 'none'
  enterMs: 220,
  // the hero (SeatPortrait under the hood)
  heroHeight: 105,      // px
  headWidth: 0.62,      // share of the hero the head takes
  headBreak: 16,        // px the head breaks out of the top
  headPanel: 'stripes', // 'stripes' | 'glow' | 'plain'
  // ⭐ FAME
  fameStyle: 'bar',     // 'bar' | 'segments'
  capPips: 'on',        // this turn's ★ pips
  // 💗 BODY
  vibeStyle: 'segments',// 'segments' | 'bar'
  // ⚠️ STATUS
  statusDetail: 'hover',  // 'always' = the one-line rule under each · 'hover' = title only
  statusEmpty: 'clear',   // 'clear' = an "All clear" line · 'hide' = the section goes
  // 🎛️ SOUND
  chipPx: 28,           // the stack's NoteHex size
  nextNote: 'on',       // "add an E for a Power Chord"
  diceWhy: 'on',        // the +N dice and where they come from
  // 🔑 KEY
  intervals: 'on',
  // 🗡️ ABILITIES
  abilityDetail: 'hover', // 'line' = first sentence · 'full' = the whole rule · 'hover'
  cdStyle: 'pips',        // 'pips' | 'text'
});

/** ✂️ The first sentence of a skill's rule, for the 'line' detail. */
export function firstSentence(s = '') {
  const t = String(s).replace(/\s+/g, ' ').trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : t;
}

/** 🔑 THE KEY PLATE'S OWN COLOURS — 4th violet, 5th pink, one muted violet for
 *  the three unlock-gated discords. ⚠️ Copied from the monolith's
 *  `UNLOCKED_DISCORD.text` and the plate's literals (~line 12900): a legend in
 *  different colours from the chips it explains is worse than none. */
export const KEY_COLOURS = Object.freeze({ fourth: '#cc55ff', fifth: '#ff55aa', discord: '#b8a8d8' });

/**
 * ⚠️ THE STATUS TABLE — every flag the old card badged, plus the ones it never
 * did (the Iwato curse, a blown amp, Sunbeam's blindness, the Mosh). One row
 * each: the icon, the name, turns left (null = this turn only / standing), the
 * rule in one line, and whether it hurts. ⭐ The `what` lines are the rules as
 * the engine runs them (economy.js `applyDebuffsTicked`, `BURN_TICKED`,
 * melodyCommit's `isMojoDrained`, eleven.js, iwatoCurse.js) — not flavour.
 */
export function statusRows(ns = {}, { respawn = false } = {}) {
  const rows = [];
  const add = (id, icon, label, turns, what, tone = 'bad') => rows.push({ id, icon, label, turns, what, tone });
  if (ns.iwatoCurse && (ns.iwatoCurse.turnsLeft ?? 0) > 0)
    add('iwato', '呪', 'IWATO CURSE', ns.iwatoCurse.turnsLeft,
      `Your palette is Iwato on ${pretty(ns.iwatoCurse.roninRoot ?? '?')} — every other note is discord. Play 3 different Iwato notes next turn to exorcise it.`);
  if ((ns.burn?.turnsLeft ?? 0) > 0)
    add('burn', '🔥', 'BURNING', ns.burn.turnsLeft, 'A coin flip at the end of each turn: heads, −1 Vibe.');
  if (ns.stagger)
    add('stagger', '⚡', 'STAGGER', ns.stagger.turnsLeft ?? 1, 'Two notes in your hand are locked this turn.');
  if ((ns.mojoDrain ?? 0) > 0)
    add('mojo', '💧', 'MOJO DRAIN', ns.mojoDrain, 'Your melody pays no red / blue stack-root carrot.');
  if ((ns.blindTurns ?? 0) > 0)
    add('blind', '☀️', 'BLINDED', ns.blindTurns, 'Sunbeam: you cannot see where to move.');
  if (ns.tripped)  add('tripped', '🌀', 'TRIPPED', null, 'Half movement this turn.');
  if (ns.dazed)    add('dazed', '😵', 'DAZED', null, 'Your next move goes the wrong way.');
  if (ns.instrumentDropped) add('dropped', '🎸', 'DROPPED', null, 'Instrument on the floor: −1 Drive this turn.');
  if ((ns.ampBlownTurns ?? 0) > 0)
    add('blown', '🔇', 'AMP BLOWN', ns.ampBlownTurns, 'No Sonic, and you brace on a bare d4.');
  if (ns.atEleven)
    add('eleven', '🔊', 'AT ELEVEN', null, 'Your attack is SET to 11 this turn.', 'good');
  if ((ns.elevenTurns ?? 0) > 0)
    add('goes11', '🎚️', 'GOES TO 11', ns.elevenTurns, 'The dial is turned up.', 'good');
  if ((ns.tempSustain ?? 0) > 0)
    add('guard', '🛡️', `+${ns.tempSustain} SUSTAIN`, null, 'Extra Sustain until your next turn.', 'good');
  if ((ns.moshDrive ?? 0) > 0)
    add('mosh', '🤘', `MOSH +${ns.moshDrive} DRIVE`, null, 'Stands until you call the next pit.', 'good');
  if (respawn) add('respawn', '✨', 'RESPAWNED', null, 'Back on your home hex.', 'good');
  return rows;
}

/** 🎛️ One stack, as the SOUND section draws it. */
function stackRow(spiritId, ns, which, boost, boostWhy) {
  const notes = (which === 'drive' ? ns.driveStack : ns.sustainStack) ?? [];
  const read = readStack(spiritId, notes);
  const cap = stackCapFor(ns, which);
  const step = nextStep(spiritId, notes, which);
  return {
    which, notes: notes.map(String), cap,
    value: which === 'drive' ? read.drive : read.sustain,
    chord: read.label, chordName: read.name,
    boost, boostWhy,
    next: step ? { label: step.rung.label, notes: step.missing.map(pc => PC_NAMES[pc]) } : null,
    full: notes.length >= cap,
  };
}

/**
 * Everything the window draws, from plain game numbers.
 * @param {object} a
 * @param {object} a.spirit  the acting Spirit (id, name, color, vibe, maxVibe, lives, speed, num, style)
 * @param {object} a.ns      its note sheet
 * @param {number} a.startingLives · a.fameToWin · a.turnFameCap (Infinity = no cap)
 * @param {number} a.fameBanked   Fame banked this turn
 * @param {number} a.rivalBestFame the best rival's Fame
 * @param {boolean} a.edgeHex · a.headliner · a.respawn
 * @param {boolean} a.keyIsNext   the KEY PLATE's own test: move_act && hasConfirmed
 * @param {number}  a.driveBonus · a.driveWhy  the SOUND dial's own dice chip
 */
export function sheetModel(a) {
  const { spirit = {}, ns = {} } = a;
  const fp = ns.fame ?? 0;
  const toWin = a.fameToWin ?? 24;
  const lead = fp - (a.rivalBestFame ?? 0);
  const cap = Number.isFinite(a.turnFameCap) ? a.turnFameCap : null;
  const banked = a.fameBanked ?? 0;
  const lives = spirit.lives ?? 0;
  const mode = ns.scaleMode ?? 'major';
  const ivs = getIntervalNotes(ns.rootNote, mode);
  return {
    // ⚠️ TWO IDS: `id` is the SEAT (what `data-spirit-id` and every sheet key use);
    // `charId` is the CHARACTER the seat-portrait art and head focus are keyed by.
    id: spirit.id, charId: characterId(spirit.id), name: spirit.name, color: spirit.color, style: spirit.style,
    headliner: !!a.headliner,
    fame: {
      fp, toWin, pct: Math.min(100, (fp / toWin) * 100), lead,
      // ⚠️ THE OLD CARD'S OWN TEST, kept exactly: within 4 of the crown with a
      // rival inside the contested lead. Change it there and here together.
      danger: fp >= toWin - 4 && lead < FAME_RACE_CONTESTED_LEAD,
      hot: fp / toWin >= 0.75,
      cap, banked, capped: cap != null && banked >= cap,
    },
    body: {
      vibe: spirit.vibe ?? 0, maxVibe: spirit.maxVibe ?? 0,
      lives, startingLives: Math.max(a.startingLives ?? 3, lives),
      lastLife: lives === 1,
      speed: Math.min(5, spirit.speed ?? 5),
      hex: spirit.num ?? null, edge: !!a.edgeHex, ko: !!spirit.knockedOut,
      fans: (ns.casuals ?? 0) + (ns.diehards ?? 0),
    },
    statuses: statusRows(ns, { respawn: a.respawn }),
    sound: {
      drive:   stackRow(spirit.id, ns, 'drive',   a.driveBonus ?? 0, a.driveWhy ?? null),
      sustain: stackRow(spirit.id, ns, 'sustain', ns.tempSustain ?? 0, (ns.tempSustain ?? 0) > 0 ? `+${ns.tempSustain} from a guard` : null),
    },
    key: {
      root: ns.rootNote ?? null, mode, modeName: MODE_NAME[mode] ?? mode,
      next: !!a.keyIsNext,
      // 呪 A CURSED Spirit's palette is not its own key — the pocket's Scale Wheel
      // already shows the infected wheel, so the key section must not print a
      // clean palette beside it as if nothing had happened.
      curse: (ns.iwatoCurse?.turnsLeft ?? 0) > 0 ? { root: ns.iwatoCurse.roninRoot ?? null, turns: ns.iwatoCurse.turnsLeft } : null,
      intervals: [
        ['4th', ivs.fourth, KEY_COLOURS.fourth], ['5th', ivs.fifth, KEY_COLOURS.fifth],
        ['tri', ivs.tritone, KEY_COLOURS.discord], ['M3', ivs.majorThird, KEY_COLOURS.discord],
        ['m7', ivs.minorSeventh, KEY_COLOURS.discord],
      ],
    },
    abilities: (ns.unlockedSkills ?? []).map(id => {
      const sk = SKILL_BY_ID[id];
      if (!sk) return null;
      const cd = cooldownLeft(ns, id);
      return { id, icon: sk.icon, label: sk.label, cd, ready: cd === 0, desc: sk.desc ?? '', line: firstSentence(sk.desc) };
    }).filter(Boolean),
  };
}
