// Runs every headless test suite. Usage: node games/head-cup/_tests/run.mjs [core|skills|ai]
import { summary } from './helpers.mjs';
import { coreTests } from './core.test.mjs';

const only = process.argv[2];
const suites = { core: coreTests };
for (const name of ['skills', 'ai']) {
  try { const m = await import(`./${name}.test.mjs`); suites[name] = m[name + 'Tests']; } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
}
for (const [name, fn] of Object.entries(suites)) if (!only || only === name) await fn();
process.exit(summary() ? 1 : 0);
