import { ESLint } from 'eslint';
import { readFileSync } from 'node:fs';

// Compare diagnostics by rule/severity across src + server so moving unchanged
// code between modules cannot reset the budget. This is a noise ceiling, not a
// claim that old violations are harmless or that equal counts prove equivalence.
const baseline = JSON.parse(readFileSync(new URL('../docs/lint-baseline.json', import.meta.url), 'utf8'));
const results = await new ESLint().lintFiles(['src', 'server']);
const counts = {};
for (const result of results) for (const message of result.messages) {
  const key = `${message.severity}:${message.ruleId ?? 'parse'}`;
  counts[key] = (counts[key] ?? 0) + 1;
}
const increases = Object.entries(counts).filter(([key, count]) => count > (baseline.counts[key] ?? 0));
for (const [key, count] of increases) console.error(`${key}: ${count} > baseline ${baseline.counts[key] ?? 0}`);
console.log(`Lint baseline: ${results.reduce((n, r) => n + r.errorCount, 0)} errors, ${results.reduce((n, r) => n + r.warningCount, 0)} warnings; ${increases.length} increased categories.`);
process.exitCode = increases.length ? 1 : 0;
