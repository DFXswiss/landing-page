#!/usr/bin/env node
/**
 * Visual coverage gate. Fails closed (exit 1) unless:
 *   - a committed baseline exists for every page × project,
 *   - there are no stray/orphan baseline files,
 *   - the Playwright report shows every visual screenshot test ran and passed
 *     (no missing report, no unexpected/flaky/skipped results).
 *
 * Run after `playwright test`, which writes playwright-report/results.json.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { PAGES, PROJECTS, screenshotName } from '../tests/pages.mjs';

const root = process.cwd();
const errors = [];
const fail = (msg) => errors.push(msg);

const SHOTS_DIR = join(root, 'tests', '__screenshots__');

// --- 1. every expected baseline exists, and nothing else is committed --------
const expected = new Set();
for (const project of PROJECTS) {
  for (const path of PAGES) {
    const rel = join('tests', '__screenshots__', project, screenshotName(path));
    expected.add(rel);
    if (!existsSync(join(root, rel))) fail(`missing baseline: ${rel}`);
  }
}

function listPngs(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listPngs(full));
    else if (entry.endsWith('.png')) out.push(full);
  }
  return out;
}
for (const png of listPngs(SHOTS_DIR)) {
  const rel = relative(root, png);
  if (!expected.has(rel)) fail(`orphan baseline (no matching page × project): ${rel}`);
}

// --- 2. the Playwright report confirms every visual test passed --------------
const reportPath = join(root, 'playwright-report', 'results.json');
if (!existsSync(reportPath)) {
  fail('playwright-report/results.json not found — run `playwright test` first');
} else {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));

  if (!report.stats) {
    fail('Playwright report has no stats block');
  } else {
    if (report.stats.unexpected > 0)
      fail(`Playwright reported ${report.stats.unexpected} failing test(s)`);
    if (report.stats.flaky > 0) fail(`Playwright reported ${report.stats.flaky} flaky test(s)`);
  }

  const specs = [];
  const collect = (suite) => {
    for (const spec of suite.specs || []) specs.push(spec);
    for (const child of suite.suites || []) collect(child);
  };
  for (const suite of report.suites || []) collect(suite);

  const visualTests = specs
    .filter((spec) => spec.file && spec.file.endsWith('visual.spec.mjs'))
    .flatMap((spec) => spec.tests || []);

  const expectedRuns = PAGES.length * PROJECTS.length;
  if (visualTests.length !== expectedRuns) {
    fail(
      `expected ${expectedRuns} visual test runs (pages × projects) but the report has ${visualTests.length}`,
    );
  }
  for (const test of visualTests) {
    if (test.status !== 'expected') {
      fail(`visual test did not pass (status="${test.status}")`);
    }
  }
}

// --- report ------------------------------------------------------------------
if (errors.length > 0) {
  for (const message of errors) console.error(`error    ${message}`);
  console.error(`\ncheck-visual: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(
  `check-visual: OK — ${PAGES.length} pages × ${PROJECTS.length} projects baselines present and all visual tests passed.`,
);
