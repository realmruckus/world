import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { composeLifeIdentity, validateJsonSchema } from '../js/life-content-contract-v1.js';
import { runContractSimulation } from '../js/life-content-simulation-adapter-v1.js';
import { runLife } from '../js/life-simulation-v3.js';

const fixture = JSON.parse(fs.readFileSync(new URL('../data/fixtures/life-content-contract-v1.json', import.meta.url), 'utf8'));
const reportSchema = JSON.parse(fs.readFileSync(new URL('../schemas/life-content-simulation-report-v1.schema.json', import.meta.url), 'utf8'));

test('RR-120 reports successful execution counts exactly', () => {
  const report = runContractSimulation({ requestedLifeCount: 4, seedStart: 120000 });
  assert.equal(report.executedLifeCount, 4);
  assert.equal(report.failedLifeCount, 0);
  assert.equal(report.status, 'completed');
  assert.equal(validateJsonSchema(report, reportSchema), true);
});

test('RR-120 reports partial failures from a controlled execution seam', () => {
  const report = runContractSimulation({
    requestedLifeCount: 4,
    seedStart: 120000,
    executeLife(seed, policy, content) {
      if (seed % 2 === 0) throw new Error('controlled partial failure');
      return runLife(seed, policy, content);
    },
  });
  assert.equal(report.executedLifeCount, 2);
  assert.equal(report.failedLifeCount, 2);
  assert.equal(report.executedLifeCount + report.failedLifeCount, report.requestedLifeCount);
  assert.equal(report.status, 'completed_with_errors');
  assert.deepEqual(report.errorSummary, { 'controlled partial failure': 2 });
  assert.equal(validateJsonSchema(report, reportSchema), true);
});

test('RR-120 reports complete failure without inventing executed lives', () => {
  const report = runContractSimulation({
    requestedLifeCount: 3,
    seedStart: 120000,
    executeLife() { throw new Error('controlled total failure'); },
  });
  assert.equal(report.executedLifeCount, 0);
  assert.equal(report.failedLifeCount, 3);
  assert.equal(report.executedLifeCount + report.failedLifeCount, report.requestedLifeCount);
  assert.equal(report.status, 'failed');
  assert.deepEqual(report.errorSummary, { 'controlled total failure': 3 });
  assert.equal(validateJsonSchema(report, reportSchema), true);
});

test('RR-120 derives identity Parent Jobs only from Family parent NPCs', () => {
  const family = fixture.families.find((item) => item.id === 'family_working');
  const selection = { familyId: family.id, genderId: 'gender_a', zodiacSignId: 'aries' };
  const identity = composeLifeIdentity(fixture, selection);
  const expected = family.parentNpcIds.map((npcId) => fixture.npcs.find((npc) => npc.id === npcId).parentJobId);
  assert.deepEqual(identity.parentNpcIds, family.parentNpcIds);
  assert.deepEqual(identity.parentJobIds, expected);
  assert.deepEqual(composeLifeIdentity(fixture, selection), identity);
});

test('RR-120 rejects selection overrides and malformed authoritative Parent Jobs', () => {
  const selection = { familyId: 'family_working', genderId: 'gender_a', zodiacSignId: 'aries' };
  assert.throws(
    () => composeLifeIdentity(fixture, { ...selection, parentJobIds: ['job_service', 'job_technical'] }),
    /must not override Parent Job/i,
  );

  const dangling = structuredClone(fixture);
  dangling.npcs.find((npc) => npc.id === 'parent_working_a').parentJobId = 'missing_job';
  assert.throws(() => composeLifeIdentity(dangling, selection), /Unknown Parent Job reference/i);

  const wrongSlots = structuredClone(fixture);
  wrongSlots.families.find((family) => family.id === 'family_working').parentNpcIds = [];
  assert.throws(() => composeLifeIdentity(wrongSlots, selection), /minItems|parent slots/i);
});
