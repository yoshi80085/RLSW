// ═══ GATE CHECK ═════════════════════════════════════════════════════════════
// `npm run test:gate` — the fake-502 front door (app/gate*.js, main.jsx, boot.jsx).
// 📌 Headless: the code listener, the pad reader and the HTML disguise are pure,
//    and §5–§7 read the SOURCE for the two mistakes that would quietly undo the
//    disguise (the game in main.jsx's static imports; index.html drifting).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashCode, createCodeListener, GATE_TOKENS } from './gateCode.js';
import { disguiseIndexHtml, FAKE_ERROR_HTML } from './gateDisguise.js';
import { GATE } from './gateConfig.js';
import { padDirections, gateActive, KEY_TOKENS } from './gate.js';

let checks = 0, failures = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.error(`  ✗ ${msg}`); } };
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

console.log('🚪 gateCheck — does the front door stay shut, and open on the code?\n');

// §1 the hash
console.log('§1 hashCode');
{
  const a = ['up', 'left', 'down', 'right', 'up', 'right', 'down', 'left'];
  ok(hashCode(a) === hashCode([...a]), 'same code, same hash');
  ok(typeof hashCode(a) === 'string' && /^[0-9a-z]+$/.test(hashCode(a)), 'hash is base-36');
  ok(hashCode(a) !== hashCode(a.slice().reverse()), 'reversed code hashes differently');
  ok(hashCode(a) !== hashCode(a.slice(0, 7)), 'a prefix hashes differently');
  // every one-press change to the code is a different hash
  let distinct = 0;
  for (let i = 0; i < a.length; i++) for (const t of GATE_TOKENS) {
    if (t === a[i]) continue;
    const b = a.slice(); b[i] = t;
    if (hashCode(b) !== hashCode(a)) distinct++;
  }
  ok(distinct === a.length * 3, `all ${a.length * 3} one-press variants hash differently (${distinct})`);
}

// §2 the listener
console.log('§2 createCodeListener');
{
  const code = ['up', 'up', 'left', 'right', 'down', 'down'];
  let t = 0;
  const mk = () => createCodeListener({ hash: hashCode(code), length: code.length, gapMs: 1000, now: () => t });
  const type = (l, seq, step = 100) => seq.map(tok => { t += step; return l.push(tok); });

  let l = mk();
  let r = type(l, code);
  ok(r.slice(0, -1).every(x => !x) && r.at(-1) === true, 'opens on the last press, not before');

  l = mk(); r = type(l, ['left', 'down', 'right', ...code]);
  ok(r.at(-1) === true, 'stray presses before the code do no harm');

  l = mk(); r = type(l, ['up', 'up', 'left', 'left', ...code]);
  ok(r.at(-1) === true, 'a fumble needs no reset — start again at once');

  l = mk(); type(l, code.slice(0, 3)); t += 5000; r = type(l, code.slice(3));
  ok(!r.some(Boolean), 'a long pause forgets the half-typed code');

  l = mk(); type(l, code.slice(0, 3)); r = type(l, code.slice(3), 900);
  ok(r.at(-1) === true, 'pauses inside the gap are fine');

  l = mk(); r = type(l, code.slice(0, -1));
  ok(!r.some(Boolean), 'one press short stays shut');

  l = mk(); r = type(l, [...code.slice(0, -1), 'left']);
  ok(!r.some(Boolean), 'a wrong last press stays shut');
}

// §3 the pad reader
console.log('§3 padDirections');
{
  const pad = (axes = [0, 0], pressed = []) => ({
    axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  });
  const dirs = (p, was) => [...padDirections(p, was)].sort().join(',');
  ok(dirs(pad()) === '', 'a resting pad holds nothing');
  ok(dirs(pad([0, 0], [12])) === 'up', 'D-pad up (button 12)');
  ok(dirs(pad([0, 0], [13])) === 'down', 'D-pad down (13)');
  ok(dirs(pad([0, 0], [14])) === 'left', 'D-pad left (14)');
  ok(dirs(pad([0, 0], [15])) === 'right', 'D-pad right (15)');
  ok(dirs(pad([0, -0.9])) === 'up', 'stick up (axis 1 negative)');
  ok(dirs(pad([0.9, 0])) === 'right', 'stick right');
  ok(dirs(pad([0.7, -0.8])) === 'up', 'a diagonal flick is ONE direction (dominant axis)');
  ok(dirs(pad([0, -0.5])) === '', 'below 0.6 does not start a press');
  ok(dirs(pad([0, -0.5]), new Set(['up'])) === 'up', 'a held flick stays held down to 0.3 (no chatter)');
  ok(dirs(pad([0, -0.2]), new Set(['up'])) === '', 'and lets go inside 0.3');
  ok(dirs({ axes: [], buttons: [] }) === '', 'a pad with no axes or buttons is harmless');
}

// §4 the disguise
console.log('§4 disguiseIndexHtml on the real index.html');
{
  const html = read('../../index.html');
  const out = disguiseIndexHtml(html, GATE);
  ok(GATE.on ? true : out === html, 'gate off → index.html untouched');
  const on = disguiseIndexHtml(html, { ...GATE, on: true });
  ok(on.includes(`<title>${GATE.disguiseTitle}</title>`), 'title is the 502');
  ok(!/rlsw/i.test(on.replace(/<script[^>]*><\/script>/g, '')), 'no "rlsw" anywhere outside the script tag');
  ok(!/<link[^>]*rel="icon"/.test(on), 'no favicon');
  ok(!/fonts\.(googleapis|gstatic)/.test(on), 'no Google Fonts');
  ok(/<meta name="robots" content="noindex, nofollow"/.test(on), 'noindex for search engines');
  ok(on.includes(FAKE_ERROR_HTML) && on.includes('<div id="root"></div>'), 'the 502 body is in, #root kept');
  ok(on.indexOf(FAKE_ERROR_HTML) < on.indexOf('<div id="root">'), 'the 502 sits before #root');
  ok(/<script type="module" src="\/src\/main\.jsx"><\/script>/.test(on), 'the entry script survives');
  ok(disguiseIndexHtml(html, { ...GATE, on: false }) === html, 'on:false is a no-op');
  let threw = false;
  try { disguiseIndexHtml(html.replace(/<title>[^<]*<\/title>/, ''), { ...GATE, on: true }); } catch { threw = true; }
  ok(threw, 'an index.html with no <title> FAILS the build instead of shipping undisguised');
  threw = false;
  try { disguiseIndexHtml(html.replace(/<link rel="icon"[^>]*>/, ''), { ...GATE, on: true }); } catch { threw = true; }
  ok(threw, 'a moved favicon fails the build too');
}

// §5 config sanity
console.log('§5 gateConfig');
{
  const html = read('../../index.html');
  ok(html.includes(`href="${GATE.fontsHref}"`), 'GATE.fontsHref matches the fonts <link> in index.html');
  ok(typeof GATE.codeHash === 'string' && /^[0-9a-z]+$/.test(GATE.codeHash) && GATE.codeHash !== 'PLACEHOLDER',
    'a real code hash is set (npm run gate:code)');
  ok(Number.isInteger(GATE.codeLength) && GATE.codeLength >= 6 && GATE.codeLength <= 24, 'code is 6–24 presses');
  ok(GATE.gapMs >= 1000, 'the pause allowance is at least 1 s (a human has to type it)');
  ok(!read('./gateConfig.js').match(/'(up|down|left|right)'/), 'the code is not written in plain words in gateConfig.js');
}

// §6 main.jsx keeps the game behind the dynamic import
console.log('§6 main.jsx / boot.jsx');
{
  const main = read('../main.jsx');
  const statics = [...main.matchAll(/^\s*import\s[^(]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm)].map(m => m[1] ?? m[2]);
  ok(statics.length === 1 && statics[0] === './app/gate.js', `main.jsx statically imports only the gate (got: ${statics.join(', ')})`);
  ok(/import\(\s*['"]\.\/boot\.jsx['"]\s*\)/.test(main), 'boot.jsx is reached by a dynamic import');
  const boot = read('../boot.jsx');
  ok(/import App from '\.\/App\.jsx'/.test(boot) && /import '\.\/index\.css'/.test(boot), 'boot.jsx mounts App and index.css');
  const gate = read('./gate.js');
  const gateImports = [...gate.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  ok(gateImports.every(p => p === './gateConfig.js' || p === './gateCode.js'), 'gate.js pulls in nothing heavy');
}

// §7 who sees the gate
console.log('§7 gateActive');
{
  const store = (v) => ({ getItem: () => v });
  ok(gateActive({ dev: true, config: { ...GATE, on: true } }) === false, 'never in dev');
  ok(gateActive({ dev: false, config: { ...GATE, on: false } }) === false, 'never when switched off');
  ok(gateActive({ dev: false, config: { ...GATE, on: true }, storage: store(null) }) === true, 'up on a fresh tab of a build');
  ok(gateActive({ dev: false, config: { ...GATE, on: true, rememberInTab: true }, storage: store('1') }) === false, 'down once opened in this tab');
  ok(gateActive({ dev: false, config: { ...GATE, on: true, rememberInTab: false }, storage: store('1') }) === true, 'rememberInTab:false asks every load');
  ok(gateActive({ dev: false, config: { ...GATE, on: true }, storage: { getItem() { throw new Error('blocked'); } } }) === true,
    'blocked storage → just ask for the code (no crash)');
  ok(Object.values(KEY_TOKENS).every(t => GATE_TOKENS.includes(t)), 'every key maps to a code word');
  ok(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].every(k => KEY_TOKENS[k]), 'arrows and WASD both type');
}

console.log('');
if (failures) { console.error(`❌ gateCheck: ${failures} failure(s) across ${checks} checks`); process.exit(1); }
console.log(`✅ gateCheck: ${checks} checks passed`);
