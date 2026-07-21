import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runBatch, runLife, summarizeBatch } from '../js/life-simulation-v3.js';

const content = {
  annualEvents: JSON.parse(fs.readFileSync(new URL('../data/life-events-annual-v3.json', import.meta.url), 'utf8')),
  romanceEvents: [
    ...JSON.parse(fs.readFileSync(new URL('../data/life-events-romance-v3.json', import.meta.url), 'utf8')),
    ...JSON.parse(fs.readFileSync(new URL('../data/life-events-romance-resolution-v3.json', import.meta.url), 'utf8')),
  ],
  interruptEvents: JSON.parse(fs.readFileSync(new URL('../data/life-events-interrupt-v3.json', import.meta.url), 'utf8')),
  relationshipRules: JSON.parse(fs.readFileSync(new URL('../data/life-relationship-rules.json', import.meta.url), 'utf8')),
  metricRegistry: JSON.parse(fs.readFileSync(new URL('../data/life-derived-metrics.json', import.meta.url), 'utf8')),
  metricDsl: JSON.parse(fs.readFileSync(new URL('../data/life-metric-dsl.json', import.meta.url), 'utf8')),
  endingRules: JSON.parse(fs.readFileSync(new URL('../data/life-ending-rules.json', import.meta.url), 'utf8')),
};

const policy = {
  maxAgeYears: 82,
  choose(event) { return event.choices[0].id; },
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('runLife is deterministic for identical seed, policy and content', () => {
  const a = runLife(100, policy, content);
  const b = runLife(100, policy, content);
  assert.deepEqual(a, b);
  assert.equal(a.life.alive, false);
  assert.equal(a.summary.seed, 100);
  assert.ok(a.summary.turns > 0);
  assert.ok(a.summary.primaryEnding);
});

test('runLife enforces a finite turn budget', () => {
  assert.throws(() => runLife(1, { ...policy, maxTurns: 1 }, content), /turn budget/);
});

test('runBatch uses consecutive seeds and is deterministic', () => {
  const a = runBatch(5, 200, policy, content);
  const b = runBatch(5, 200, policy, content);
  assert.deepEqual(a, b);
  assert.deepEqual(a.results.map((item) => item.summary.seed), [200,201,202,203,204]);
  assert.equal(a.report.lifeCount, 5);
});

test('batch report includes endings, event coverage and operation statistics', () => {
  const batch = runBatch(8, 300, policy, content);
  const report = batch.report;
  assert.equal(Object.values(report.endingDistribution).reduce((a,b) => a + b, 0), 8);
  assert.ok(report.uniqueEventCount > 0);
  assert.ok(report.averageTurns > 0);
  assert.ok(report.eventCoverageRate > 0 && report.eventCoverageRate <= 1);
  assert.ok(report.repeatRate >= 0 && report.repeatRate <= 1);
});

test('summarizeBatch rejects invalid results', () => {
  assert.throws(() => summarizeBatch([]), /non-empty/);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
