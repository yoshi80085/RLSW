// ─── 🔎 CLIENT REFERENCE CHECK ───────────────────────────────────────────────
//
// Does every name the CLIENT uses actually exist?
//
// ⚠️ THIS SUITE EXISTS BECAUSE OF A REAL SHIPPED BUG, and the bug is worth
// stating in full because nothing else in the repo could see it.
//
// The 2026-08-26 Cursed Shamisen rework deleted the board-token mechanic. One of
// the blocks it deleted — "FEED THE CURSED SHAMISEN" — sat in the MIDDLE of the
// melody commit, and the cut ran past the end of it. It took with it:
//
//   · `setNoteField('cosmic_ronin', { lastMoveBudget: … })`
//   · `setMovedThisTurn(false)` and `setAction('move')` — the last two lines of
//     the commit, which are what put the player into the move/act phase
//   · the ENTIRE `startNewTurnNotes` function — the draw, the refill, the
//     turn-start dispatch — while TWO call sites kept calling it
//
// The result: a match that dealt no new notes and never got past turn one. Every
// one of the seventeen suites stayed green, because every one of them tests the
// ENGINE and none of them drives the client. `check:bundle` stayed green too:
// esbuild reads a call to a function nobody defined as a reference to a GLOBAL,
// which is legal JavaScript right up until it runs.
//
// 🎯 SO THIS IS THE ONE CHECK THAT LOOKS AT THE CLIENT AT ALL. It is deliberately
// narrow — it answers one question, "is every name that this file reads declared
// somewhere in it, imported into it, or a real browser global?" — because that
// one question is exactly the shape of the failure above, and a narrow check that
// runs in 400ms is worth more than a broad one nobody wires up.
//
// ⚠️ IT IS SCOPE-BLIND ON PURPOSE. Every declaration anywhere in a file counts as
// declaring that name for the whole file, so it will NOT catch a name used out of
// its block, used before its `let`, or shadowed. Those are eslint's job
// (`npm run lint`, which is thorough and slow). This is the fast tripwire for the
// only failure that has actually cost the game a playable build: a name that
// exists NOWHERE.
//
// 📌 `npm run test:client`, and it is in `test:all`.

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import * as espree from "espree";
import globalsPkg from "globals";

let count = 0;
const ok = (c, m) => { count++; assert.ok(c, m); };

// ── What counts as "already there" without being declared in the file ────────
// Browser + standard-library globals, plus the handful of build-time names Vite
// injects. Anything NOT in here and not declared in the file is a real finding.
const KNOWN = new Set([
  ...Object.keys(globalsPkg.browser),
  ...Object.keys(globalsPkg.es2021),
  "globalThis", "console", "process", "require", "module", "exports",
  "arguments", "undefined", "NaN", "Infinity",
]);

// ── The files under watch ────────────────────────────────────────────────────
// Every .jsx in the tree. The .js modules under engine/, data/ and music/ are
// left out ON PURPOSE: the other sixteen suites IMPORT them, so a missing name
// there throws the moment a test runs. The .jsx files are the ones nothing runs.
function jsxFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsxFiles(p, out);
    else if (e.name.endsWith(".jsx")) out.push(p);
  }
  return out;
}

// ── A plain recursive walk. No scope tracking; see the header. ───────────────
function walk(node, visit, parent = null, key = null) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { for (const n of node) walk(n, visit, parent, key); return; }
  if (typeof node.type !== "string") return;
  visit(node, parent, key);
  for (const k of Object.keys(node)) {
    if (k === "type" || k === "loc" || k === "range" || k === "start" || k === "end") continue;
    walk(node[k], visit, node, k);
  }
}

/** Every name bound by a binding pattern (`const {a, b: [c]} = …`). */
function patternNames(pat, out = []) {
  if (!pat) return out;
  switch (pat.type) {
    case "Identifier":       out.push(pat.name); break;
    case "ObjectPattern":    pat.properties.forEach(p =>
                               patternNames(p.type === "RestElement" ? p.argument : p.value, out)); break;
    case "ArrayPattern":     pat.elements.forEach(e => patternNames(e, out)); break;
    case "AssignmentPattern":patternNames(pat.left, out); break;
    case "RestElement":      patternNames(pat.argument, out); break;
    default: break;
  }
  return out;
}

/** Is this Identifier a *reference*, or is it a label / property / declaration? */
function isReference(node, parent, key) {
  if (!parent) return true;
  switch (parent.type) {
    // `foo.bar` — `bar` is a property name unless the access is computed.
    case "MemberExpression":     return !(key === "property" && !parent.computed);
    case "OptionalMemberExpression": return !(key === "property" && !parent.computed);
    // `{ bar: 1 }` — `bar` is a key unless computed. Shorthand values DO count.
    case "Property":             return !(key === "key" && !parent.computed);
    case "PropertyDefinition":   return !(key === "key" && !parent.computed);
    case "MethodDefinition":     return !(key === "key" && !parent.computed);
    // Declarations bind rather than read.
    case "VariableDeclarator":   return key !== "id";
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
    case "ClassDeclaration":
    case "ClassExpression":      return key !== "id" && key !== "params";
    case "ImportSpecifier":
    case "ImportDefaultSpecifier":
    case "ImportNamespaceSpecifier": return false;
    case "ExportSpecifier":      return false;
    case "LabeledStatement":
    case "BreakStatement":
    case "ContinueStatement":    return false;
    case "CatchClause":          return key !== "param";
    // JSX attribute names and namespaces are not identifiers we resolve.
    case "JSXAttribute":         return key !== "name";
    case "JSXNamespacedName":    return false;
    case "JSXMemberExpression":  return key === "object";
    // Binding patterns are handled by patternNames, never as references.
    case "ObjectPattern":
    case "ArrayPattern":
    case "RestElement":          return false;
    case "AssignmentPattern":    return key !== "left";
    default: return true;
  }
}

const files = jsxFiles("src").sort();
ok(files.length > 0, "🔎 there are .jsx files to check");
ok(files.includes(path.join("src", "rlsw-simulator-v3_8_1.jsx")),
   "🎸 THE MONOLITH IS IN THE SWEEP — it is the whole reason this suite exists");

const findings = [];

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = espree.parse(src, {
      ecmaVersion: "latest", sourceType: "module",
      ecmaFeatures: { jsx: true }, loc: true,
    });
  } catch (err) {
    findings.push(`${file}: DID NOT PARSE — ${err.message}`);
    continue;
  }

  const declared = new Set();
  const refs = [];   // { name, line }

  walk(ast, (node, parent, key) => {
    switch (node.type) {
      case "VariableDeclarator":  patternNames(node.id).forEach(n => declared.add(n)); break;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
        if (node.id) declared.add(node.id.name);
        node.params.forEach(p => patternNames(p).forEach(n => declared.add(n)));
        break;
      case "ClassDeclaration":
      case "ClassExpression":     if (node.id) declared.add(node.id.name); break;
      case "CatchClause":         patternNames(node.param).forEach(n => declared.add(n)); break;
      case "ImportSpecifier":
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier": declared.add(node.local.name); break;
      case "Identifier":
        if (isReference(node, parent, key)) refs.push({ name: node.name, line: node.loc.start.line });
        break;
      // A lowercase JSX tag is an HTML element; an Uppercase one is a component
      // that must be in scope, and THAT is worth resolving.
      case "JSXIdentifier":
        if (parent?.type === "JSXOpeningElement" || parent?.type === "JSXClosingElement") {
          if (/^[A-Z]/.test(node.name)) refs.push({ name: node.name, line: node.loc.start.line });
        } else if (parent?.type === "JSXMemberExpression" && key === "object") {
          if (/^[A-Z]/.test(node.name)) refs.push({ name: node.name, line: node.loc.start.line });
        }
        break;
      default: break;
    }
  });

  const seen = new Set();
  for (const { name, line } of refs) {
    if (declared.has(name) || KNOWN.has(name)) continue;
    if (seen.has(name)) continue;   // one line per missing name, not per use
    seen.add(name);
    findings.push(`${file}:${line}  ${name} — used but never declared, imported or a browser global`);
  }
}

if (findings.length) {
  console.error("\n❌ names used but never declared:\n");
  for (const f of findings) console.error("   " + f);
  console.error("");
}
ok(findings.length === 0,
   `🔎 every name the .jsx files use resolves (${findings.length} did not)`);

// ── The specific regression, pinned by name ─────────────────────────────────
// 📌 A named assertion on top of the general sweep, because "the sweep is green"
// and "the commit still hands the turn over" are different sentences and the
// second one is the one that cost a build.
{
  const src = fs.readFileSync("src/rlsw-simulator-v3_8_1.jsx", "utf8");
  ok(/function\s+startNewTurnNotes\s*\(/.test(src),
     "🎲 `startNewTurnNotes` is DEFINED — the turn-start draw exists (deleted by accident 2026-08-26)");
  ok(src.includes("setAction('move')"),
     "🎸 the melody commit still ends by handing the player the move phase");
  ok(/setMovedThisTurn\(false\)/.test(src),
     "🎸 …and still clears the moved-this-turn flag as it does so");
}

console.log(`✅ clientRefCheck: ${count} checks passed across ${files.length} .jsx files — every name the client reads exists`);
