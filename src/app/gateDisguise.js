// ═══ THE GATE'S DISGUISE — what `index.html` looks like in a build ════════
// Pure string transform, run by the `rlsw-gate-disguise` plugin in
// vite.config.js at BUILD time only (dev keeps the honest index.html).
//
// 🎯 WHY IN THE HTML AND NOT JUST IN JAVASCRIPT: "view source" shows the file the
//    server sent, not the page JS draws. A 502 painted by a script reads, in
//    view-source, as an empty `<div id="root">` under a title that gives the game
//    away. Baked in here, the source says 502 too — and if the script never
//    loads at all, the page is still a convincing dead server.
//
// The giveaways it removes, each one a thing a curious glance would catch:
//   • the tab title            → "502 Bad Gateway"
//   • the favicon              → none (a dead server has no icon)
//   • the Google Fonts links   → gone (the Network tab would show a game font
//                                 being fetched for an error page)
//   • search engines           → `noindex`, so the game's name is never in results
//
// ⚠️ EVERY REPLACEMENT MUST LAND, or the build throws. A later edit to index.html
//    that renames the title or moves the icon would otherwise quietly ship the
//    game's name on the "broken" page, and nothing would notice.

/** The body of the fake page — nginx's stock 502, the most ordinary error on the web. */
export const FAKE_ERROR_HTML =
  '<div id="gw"><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></div>';

export function disguiseIndexHtml(html, gate) {
  if (!gate.on) return html;
  let out = html;
  const swap = (re, to, what) => {
    if (out.search(re) === -1) throw new Error(`[gate] index.html has no ${what} to disguise — update gateDisguise.js`);
    out = out.replace(re, to);
  };
  swap(/<title>[^<]*<\/title>/,
    `<title>${gate.disguiseTitle}</title>\n    <meta name="robots" content="noindex, nofollow" />`, '<title>');
  swap(/\s*<link rel="icon"[^>]*>/, '', 'favicon <link>');
  swap(/\s*<link [^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '', 'Google Fonts <link>');
  swap(/<div id="root"><\/div>/, `${FAKE_ERROR_HTML}\n    <div id="root"></div>`, '<div id="root">');
  return out;
}
