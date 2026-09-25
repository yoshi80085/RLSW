// ─── ⌨️ NOTE KEYS CHECK ──────────────────────────────────────────────────────
// Alex, 2026-09-25: commit hand notes by keystroke — a letter is its natural,
// Shift + letter is its sharp OR flat, Tab switches Drive ⇄ Sustain.
//
// ⚠️ WHAT THIS SUITE IS REALLY GUARDING:
//   §3 — ONE MODIFIER IS ENOUGH. Every key's spelled pool (the thing hands are
//        drawn from) holds at most one altered form per letter, so Shift+letter
//        can never be ambiguous inside one key. If a respelling ever breaks that,
//        this is where it shows.
//   §2 — CAPS LOCK IS NOT SHIFT. `altered` must come from shiftKey, not case.
//   §5 — THE MONOLITH IS WIRED: same entry point as a click, human turns only.
//
// Run: npm run test:notekeys
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let pass = 0;
const failures = [];
function ok(cond, msg) { if (cond) pass++; else { failures.push(msg); console.log('  ✗', msg); } }

const { parseStockNote, noteKeyFromEvent, stockIndexForKey, nextStackDest, keyLabel } = await import('./noteKeys.js');
const { getSpelledPool, NOTE_POOL } = await import('./notes.js');

console.log('⌨️  noteKeysCheck — letters commit naturals, Shift commits the sharp or flat\n');

// §1 — parsing stock notes
console.log('§1 parseStockNote');
ok(JSON.stringify(parseStockNote('A'))   === '{"letter":"A","altered":false}', 'A is a natural A');
ok(JSON.stringify(parseStockNote('Bb'))  === '{"letter":"B","altered":true}',  'Bb is an altered B');
ok(JSON.stringify(parseStockNote('F#'))  === '{"letter":"F","altered":true}',  'F# is an altered F');
ok(JSON.stringify(parseStockNote('B'))   === '{"letter":"B","altered":false}', 'B alone is not "b = flat"');
ok(JSON.stringify(parseStockNote('Eb4')) === '{"letter":"E","altered":true}',  'octave digits are ignored');
ok(parseStockNote('') === null && parseStockNote(null) === null && parseStockNote('H') === null, 'non-notes are null');

// §2 — reading key events
console.log('§2 noteKeyFromEvent');
const ev = (key, mods = {}) => ({ key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods });
ok(JSON.stringify(noteKeyFromEvent(ev('a'))) === '{"letter":"A","altered":false}', 'a → natural A');
ok(JSON.stringify(noteKeyFromEvent(ev('B', { shiftKey: true }))) === '{"letter":"B","altered":true}', 'Shift+B → altered B');
ok(noteKeyFromEvent(ev('A')).altered === false, 'CAPS LOCK "A" without Shift stays natural');
ok(noteKeyFromEvent(ev('h')) === null && noteKeyFromEvent(ev('1')) === null, 'non-note keys ignored');
ok(noteKeyFromEvent(ev('Tab')) === null && noteKeyFromEvent(ev('Backspace')) === null, 'named keys are not letters');
for (const m of ['ctrlKey', 'altKey', 'metaKey'])
  ok(noteKeyFromEvent(ev('a', { [m]: true })) === null, `${m} chords are left to the browser`);

// §3 — one altered form per letter in every spelled pool
console.log('§3 every key spells each letter with at most one accidental');
let pools = 0;
for (const root of [...NOTE_POOL, 'Db', 'Eb', 'Gb', 'Ab', 'Bb']) for (const mode of ['major', 'minor', 'ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian', 'hirajoshi']) {
  const pool = getSpelledPool(root, mode);
  const altered = pool.map(parseStockNote).filter(n => n?.altered).map(n => n.letter);
  ok(new Set(altered).size === altered.length, `${root} ${mode}: one altered form per letter (${pool.join(' ')})`);
  pools++;
}

// §4 — picking from a hand
console.log('§4 stockIndexForKey');
const hand = ['C', 'Bb', 'A', 'F#', 'A', 'B', 'Db', 'D#'];
const K = (letter, altered = false) => ({ letter, altered });
ok(stockIndexForKey(hand, K('A')) === 2, 'first A, left to right');
ok(stockIndexForKey(hand, K('A'), i => i !== 2) === 4, 'used A skipped → the second A');
ok(stockIndexForKey(hand, K('B', true)) === 1, 'Shift+B takes Bb');
ok(stockIndexForKey(hand, K('B')) === 5, 'B takes the natural B, not Bb');
ok(stockIndexForKey(hand, K('F', true)) === 3, 'Shift+F takes F#');
ok(stockIndexForKey(hand, K('F')) === -1, 'no natural F → -1');
ok(stockIndexForKey(hand, K('D', true)) === 6, 'Db and D# together: leftmost first');
ok(stockIndexForKey(hand, K('D', true), i => i !== 6) === 7, '…then the other one');
ok(stockIndexForKey(hand, K('C', true)) === -1, 'no altered C → -1');
ok(stockIndexForKey([], K('A')) === -1 && stockIndexForKey(null, K('A')) === -1 && stockIndexForKey(hand, null) === -1, 'empty inputs → -1');

// §4b — Tab cycle and labels
console.log('§4b nextStackDest / keyLabel');
ok(nextStackDest(null) === 'drive', 'nothing picked → Drive');
ok(nextStackDest('drive') === 'sustain' && nextStackDest('sustain') === 'drive', 'Drive ⇄ Sustain');
ok(nextStackDest(null, { driveOpen: false }) === 'sustain', 'full Drive → straight to Sustain');
ok(nextStackDest('sustain', { driveOpen: false }) === 'sustain', 'only Sustain open → stays');
ok(nextStackDest('drive', { driveOpen: false, sustainOpen: false }) === null, 'neither open → null');
ok(keyLabel(K('B', true)) === 'Shift+B' && keyLabel(K('A')) === 'A', 'labels read Shift+B / A');

// §5 — the monolith is wired the way the header promises
console.log('§5 monolith wiring');
const mono = fs.readFileSync(path.join(HERE, '../rlsw-simulator-v3_8_1.jsx'), 'utf8');
const fnAt = mono.indexOf('function keyboardNoteCommit(');
const body = fnAt >= 0 ? mono.slice(fnAt, mono.indexOf('\n  }\n', fnAt)) : '';
ok(fnAt >= 0, 'keyboardNoteCommit exists');
ok(/isBot\(acting\)/.test(body) && /isMyTurn/.test(body), 'human turns only (bots and rivals never)');
ok(/clickNoteStock\(idx, chipFor\(idx\), dest\)/.test(body), 'stack commits go through clickNoteStock');
ok(/clickNoteStock\(idx, chipFor\(idx\)\)/.test(body), 'melody commits go through clickNoteStock');
ok(/removeMelodyNote\(melodyLine\.length - 1\)/.test(body), 'Backspace uses removeMelodyNote');
ok(/INPUT\|TEXTAREA\|SELECT/.test(body), 'typing in a text field is left alone');
ok((mono.match(/data-stock-idx=\{idx\}/g) ?? []).length === 2, 'both hand grids carry data-stock-idx (flight source)');
ok(!/bttp|back_to_past/i.test(mono), 'Back to the Past is gone');

console.log(`\n${failures.length ? '❌' : '✅'} ${pass} passed, ${failures.length} failed (${pools} spelled pools checked)`);
if (failures.length) process.exit(1);
