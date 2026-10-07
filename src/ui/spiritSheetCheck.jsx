// ─── 🪪 SPIRIT SHEET CHECK — the Spirit window's rules and markup ────────────
// Run: npm run test:spiritsheet  (esbuild-bundled, like test:seatportrait)
//   §1 a fresh sheet · §2 every status says what it does · §3 Fame's danger and
//   cap (the OLD card's own test) · §4 cooldowns · §5 the key, next round and the
//   curse · §6 the real component through react-dom/server at every layout lever ·
//   §7 the preview page reads its levers FROM `SPIRIT_SHEET` (one copy).
//   §0 Alex's 2026-10-07 dial-in, pinned · §8 the game really mounts it, with
//   the old card's tutorial anchors and suite hooks carried over.
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import process from 'node:process';
import { SPIRIT_SHEET, sheetModel, statusRows, firstSentence } from './spiritSheetModel.js';
import { SpiritSheet } from './SpiritSheet.jsx';
import { SPIRIT_DEFS } from '../data/spirits.js';
import { melodyModeFor } from '../music/melodyIdentity.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const ns0 = (id, root, x = {}) => ({ rootNote: root, scaleMode: melodyModeFor(id), driveStack: [root], sustainStack: [root],
  diehards: 2, casuals: 0, abilityCd: {}, unlockedSkills: [], ...x });
const base = (x = {}) => ({ spirit: { ...SPIRIT_DEFS.cosmic_ronin, color: '#4488ff', lives: 3, num: 7 },
  ns: ns0('cosmic_ronin', 'E', { unlockedSkills: ['shukuchi', 'psycho_bushido'] }),
  startingLives: 3, fameToWin: 24, turnFameCap: 4, fameBanked: 0, rivalBestFame: 0, ...x });

// §0 Alex's dial-in (2026-10-07, "Lets wire it in!") — 6 of 25 moved
{
  const moved = { width: 426, sections: 'brackets', scrim: 0.54, heroHeight: 105, statusDetail: 'hover', abilityDetail: 'hover' };
  for (const [k, v] of Object.entries(moved)) ok(SPIRIT_SHEET[k] === v, `§0 ${k} = ${v} (his dial-in)`);
  const kept = { layout: 'two', accent: 'player', enter: 'slide', enterMs: 220, labelPx: 9, textPx: 10, valuePx: 16,
    headWidth: 0.62, headBreak: 16, headPanel: 'stripes', fameStyle: 'bar', capPips: 'on', vibeStyle: 'segments',
    statusEmpty: 'clear', chipPx: 28, nextNote: 'on', diceWhy: 'on', intervals: 'on', cdStyle: 'pips' };
  for (const [k, v] of Object.entries(kept)) ok(SPIRIT_SHEET[k] === v, `§0 ${k} = ${v} (left at the opening value)`);
  ok(Object.keys(SPIRIT_SHEET).length === 25, '§0 twenty-five levers, no more, no fewer');
}

// §1 a fresh sheet
{
  const m = sheetModel(base());
  ok(m.name === 'Shredding Ronin' && m.color === '#4488ff', '§1 name and the seat colour ride through');
  ok(m.fame.fp === 0 && m.fame.lead === 0 && !m.fame.danger && !m.fame.capped, '§1 no Fame, level, not contested');
  ok(m.statuses.length === 0, '§1 nothing on a fresh Spirit');
  ok(m.abilities.length === 2 && m.abilities.every(a => a.ready && a.cd === 0), '§1 both drafted abilities READY');
  ok(m.body.vibe === 15 && m.body.maxVibe === 15 && m.body.lives === 3 && m.body.speed === 5 && m.body.hex === 7, '§1 body numbers');
  ok(m.sound.drive.value === 1 && m.sound.drive.cap === 3 && m.sound.drive.chord === 'Single note', '§1 Drive = one note, three seats');
  ok(m.sound.drive.next?.label === 'Power chord' && m.sound.drive.next.notes.join() === 'B', '§1 next Drive step: add B → Power chord (E root)');
  ok(m.body.fans === 2, '§1 two Diehards');
}

// §2 every status, and what it says
{
  const rows = statusRows({
    iwatoCurse: { turnsLeft: 2, roninRoot: 'E' }, burn: { turnsLeft: 2 }, stagger: { turnsLeft: 1 }, mojoDrain: 1,
    blindTurns: 1, tripped: true, dazed: true, instrumentDropped: true, ampBlownTurns: 2, atEleven: true,
    elevenTurns: 2, tempSustain: 2, moshDrive: 2,
  }, { respawn: true });
  const ids = rows.map(r => r.id);
  ok(['iwato', 'burn', 'stagger', 'mojo', 'blind', 'tripped', 'dazed', 'dropped', 'blown', 'eleven', 'goes11', 'guard', 'mosh', 'respawn']
    .every(id => ids.includes(id)), `§2 all fourteen statuses badge (${ids.join(',')})`);
  ok(rows.every(r => r.what && r.what.length > 8 && r.icon && r.label), '§2 every row says what it does');
  ok(rows.find(r => r.id === 'iwato').what.includes('E'), "§2 the curse names the Ronin's root");
  ok(rows.find(r => r.id === 'burn').turns === 2 && rows.find(r => r.id === 'tripped').turns === null, '§2 turns left, or null for this turn');
  ok(rows.filter(r => r.tone === 'good').map(r => r.id).sort().join() === 'eleven,goes11,guard,mosh,respawn', '§2 the buffs read good, the rest bad');
  ok(statusRows({ burn: { turnsLeft: 0 }, iwatoCurse: { turnsLeft: 0 }, mojoDrain: 0 }).length === 0, '§2 spent statuses do not badge');
}

// §3 Fame — the old card's own danger test, and the cap
{
  const f = x => sheetModel(base({ ns: { ...base().ns, fame: x.fp }, rivalBestFame: x.rival, fameBanked: x.banked ?? 0, turnFameCap: x.cap ?? 4 })).fame;
  ok(f({ fp: 21, rival: 20 }).danger, '§3 21/24 with a 1-point lead is NECK AND NECK');
  ok(!f({ fp: 21, rival: 18 }).danger, '§3 a 3-point lead is not contested (FAME_RACE_CONTESTED_LEAD)');
  ok(!f({ fp: 19, rival: 19 }).danger, '§3 not within 4 of the crown → not danger');
  ok(f({ fp: 15, rival: 17 }).lead === -2, '§3 behind by two');
  ok(f({ fp: 5, rival: 0, banked: 4 }).capped && !f({ fp: 5, rival: 0, banked: 3 }).capped, '§3 CAPPED at the per-turn cap');
  ok(f({ fp: 5, rival: 0, cap: Infinity }).cap === null, '§3 no cap in Battle of the Bands');
  ok(f({ fp: 30, rival: 0 }).pct === 100, '§3 the bar never overfills');
}

// §4 cooldowns
{
  const m = sheetModel(base({ ns: { ...base().ns, abilityCd: { shukuchi: 2, psycho_bushido: 1 } } }));
  ok(m.abilities[0].cd === 2 && !m.abilities[0].ready && m.abilities[1].cd === 1 && !m.abilities[1].ready, '§4 cooldowns from cooldownLeft — one round left is still not ready');
  ok(firstSentence('One. Two.') === 'One.' && firstSentence('No stop') === 'No stop', '§4 the line detail is the first sentence');
}

// §5 the key
{
  const m = sheetModel(base());
  ok(m.key.root === 'E' && m.key.modeName === 'Hirajoshi' && !m.key.next && !m.key.curse, '§5 E Hirajoshi, this round');
  ok(m.key.intervals.map(([l, n]) => `${l}=${n}`).join(' ') === '4th=A 5th=B tri=A# M3=G# m7=D',
    `§5 the intervals (${m.key.intervals.map(([l, n]) => `${l}=${n}`).join(' ')})`);
  ok(sheetModel(base({ keyIsNext: true })).key.next, '§5 NEXT ROUND after a commit');
  const c = sheetModel(base({ ns: { ...base().ns, iwatoCurse: { turnsLeft: 1, roninRoot: 'D' } } })).key.curse;
  ok(c && c.root === 'D' && c.turns === 1, '§5 a cursed key says so');
}

// §6 the real component, every layout lever
{
  const m = sheetModel(base({ ns: { ...base().ns, burn: { turnsLeft: 1 } } }));
  // ⚠️ Match CLASS ATTRIBUTES, not bare class names — the sheet ships its CSS
  // in a <style> inside the same markup, so every class name is in the string.
  const has = (h, cls) => new RegExp(`class="[^"]*\\b${cls}\\b`).test(h);
  const html = P => renderToStaticMarkup(<SpiritSheet model={m} P={{ ...SPIRIT_SHEET, ...P }} imageSrc="x.png" turnLabel="YOUR TURN · 01" onClose={() => {}} />);
  const d = html({});
  ok(d.includes('Shredding Ronin') && d.includes('FAME') && d.includes('BURNING') && d.includes('ABILITIES') && d.includes('SOUND') && d.includes('KEY'), '§6 every section draws');
  ok(has(d, 'seat-portrait') && has(d, 'ss-close'), '§6 the head and the close button');
  ok(has(d, 'ss-cols') && !has(html({ layout: 'one' }), 'ss-cols'), '§6 the columns lever');
  ok((html({ sections: 'brackets' }).match(/rlsw-brk /g) ?? []).length > (html({ sections: 'rules' }).match(/rlsw-brk /g) ?? []).length, '§6 the bracket-per-section lever');
  const clean = renderToStaticMarkup(<SpiritSheet model={sheetModel(base())} P={{ ...SPIRIT_SHEET, statusEmpty: 'hide' }} imageSrc="x.png" />);
  ok(!clean.includes('>STATUS<') && !has(clean, 'ss-close'), '§6 an empty STATUS hides; no ✕ without onClose');
  ok(html({ statusDetail: 'hover' }).includes('title="A coin flip'), '§6 the hover detail moves the rule to the title');
  ok(has(html({ fameStyle: 'segments' }), 'ss-fame-seg') && !has(d, 'ss-fame-seg'), '§6 the Fame segments lever');
}

// §7 the preview reads its levers from SPIRIT_SHEET
{
  const src = readFileSync('.scratch/spirit-sheet-preview.jsx', 'utf8');
  ok(src.includes('def: SPIRIT_SHEET[l.k]'), '§7 the page takes its defaults from the module');
  const levers = [...src.matchAll(/k:'(\w+)'/g)].map(x => x[1]);
  const missing = Object.keys(SPIRIT_SHEET).filter(k => !levers.includes(k));
  ok(missing.length === 0, `§7 every SPIRIT_SHEET field has a lever on the page (missing: ${missing.join(',') || 'none'})`);
}

// §8 the game mounts it — and keeps what the old card carried for other code
{
  const html = renderToStaticMarkup(<SpiritSheet model={sheetModel(base())} imageSrc="x.png"
    stock={{ grid: <span>hand</span>, open: true, onToggle: () => {}, left: 4 }} />);
  for (const a of ['fame-bar', 'vibe-bar', 'stat-knobs', 'ability-wallet', 'root-note', 'interval-legend', 'note-stock'])
    ok(html.includes(`data-tip-anchor="${a}"`), `§8 the tutorial anchor ${a} moved with the card`);
  ok(html.includes('data-spirit-id="cosmic_ronin"') && html.includes('data-vibe="15"'), '§8 data-spirit-id / data-vibe (read by the battle and replay journeys)');
  ok((html.match(/class="draft-info-button/g) ?? []).length === 2, "§8 an 'i' Field Guide per ability (loadoutUiCheck counts them)");
  ok(!renderToStaticMarkup(<SpiritSheet model={sheetModel(base())} imageSrc="x.png" />).includes('data-tip-anchor="note-stock"'),
    '§8 no stock drawer → no note-stock anchor (one copy in the DOM, ever)');
  const game = readFileSync('src/rlsw-simulator-v3_8_1.jsx', 'utf8');
  const region = game.slice(game.indexOf('<HudRegion name="spirit">'), game.indexOf('<HudRegion name="turn">'));
  ok(region.includes('<SpiritSheet') && region.includes('sheetModel('), '§8 the spirit region mounts SpiritSheet through sheetModel');
  ok(!region.includes('<ChannelStrip') && !region.includes('<StatKnob'), '§8 …and the old 2D card is gone from it');
  ok(region.includes('...actingDriveDice') && game.includes('...actingDriveDice,\n'), '§8 the sheet and the SOUND plate share one dice computation');
}

console.log(`PASS: ${checks} checks — fresh sheet, statuses, Fame danger/cap, cooldowns, key/curse, markup levers, preview parity`);
process.exit(0);
