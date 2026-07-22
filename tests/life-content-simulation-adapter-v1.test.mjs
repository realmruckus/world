import assert from 'node:assert/strict';
import test from 'node:test';

test('RR-119 adapter executes real deterministic lives and emits the required report contract', async () => {
  const adapter = await import('../js/life-content-simulation-adapter-v1.js');
  const options = { requestedLifeCount: 8, seedStart: 119000 };
  const first = adapter.runContractSimulation(options);
  const second = adapter.runContractSimulation(options);
  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, 1);
  assert.equal(first.status, 'completed');
  assert.equal(first.requestedLifeCount, 8);
  assert.equal(first.executedLifeCount, 8);
  assert.equal(first.failedLifeCount, 0);
  assert.deepEqual(first.seed, { strategy: 'consecutive_integer', start: 119000, end: 119007 });
  assert.equal(typeof first.policyVersion, 'string');
  assert.equal(typeof first.contentVersion, 'string');
  assert.equal(first.contractVersion, 1);
  assert.equal(typeof first.ageBandEventCoverage, 'object');
  assert.equal(typeof first.relationshipPathDistribution, 'object');
  assert.equal(typeof first.endingDistribution, 'object');
  assert.deepEqual(first.errorSummary, {});
});

test('RR-119 adapter does not collapse every life into the lonely/no-relationship path', async () => {
  const { runContractSimulation } = await import('../js/life-content-simulation-adapter-v1.js');
  const report = runContractSimulation({ requestedLifeCount: 40, seedStart: 119000 });
  assert.ok((report.endingDistribution.lonely_later_life || 0) < report.requestedLifeCount);
  assert.ok((report.relationshipPathDistribution.none || 0) < report.requestedLifeCount);
});
