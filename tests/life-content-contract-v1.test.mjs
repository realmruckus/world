import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const moduleUrl = new URL('../js/life-content-contract-v1.js', import.meta.url);
const fixtureUrl = new URL('../data/fixtures/life-content-contract-v1.json', import.meta.url);
const schemaUrl = new URL('../schemas/life-content-contract-v1.schema.json', import.meta.url);

async function contract() {
  return import(moduleUrl.href);
}

async function fixture() {
  const { loadLifeContentPackage } = await contract();
  return loadLifeContentPackage(fixtureUrl);
}

test('Origin and Family schemas are versioned and fixtures cover five family types', async () => {
  const schema = JSON.parse(fs.readFileSync(schemaUrl, 'utf8'));
  assert.equal(schema.properties.schemaVersion.const, 1);
  assert.ok(schema.$defs.origin.required.includes('finance'));
  assert.ok(schema.$defs.family.required.includes('parentNpcIds'));

  const content = await fixture();
  assert.equal(content.schemaVersion, 1);
  assert.equal(new Set(content.families.map((family) => family.type)).size, 5);
});

test('Parent Job references fail when a parent points to an unknown job', async () => {
  const { validateLifeContentPackage } = await contract();
  const content = await fixture();
  content.npcs[0].parentJobId = 'missing-job';
  assert.throws(() => validateLifeContentPackage(content), /Unknown Parent Job reference/);
});

test('every declared age band has at least one event fixture', async () => {
  const { validateLifeContentPackage } = await contract();
  const content = await fixture();
  content.events = content.events.filter((event) => event.ageBandId !== 'older_adult');
  assert.throws(() => validateLifeContentPackage(content), /Missing event coverage for age band: older_adult/);
});

test('the romance fixture has a reachable path from potential to married', async () => {
  const { validateLifeContentPackage } = await contract();
  const content = await fixture();
  content.relationshipTransitions = content.relationshipTransitions.filter((edge) => edge.to !== 'married');
  assert.throws(() => validateLifeContentPackage(content), /Unreachable relationship state: married/);
});

test('origin finance contracts require income, cash, assets, debt and fixed expenses', async () => {
  const { validateLifeContentPackage } = await contract();
  const content = await fixture();
  delete content.origins[0].finance.fixedExpenses;
  assert.throws(() => validateLifeContentPackage(content), /Missing finance field: fixedExpenses/);
});

test('Family NPC references fail when a parent NPC is missing', async () => {
  const { validateLifeContentPackage } = await contract();
  const content = await fixture();
  content.families[0].parentNpcIds[0] = 'missing-parent';
  assert.throws(() => validateLifeContentPackage(content), /Unknown NPC reference/);
});

test('Ending Metric references fail when an ending uses an unknown metric', async () => {
  const { validateLifeContentPackage } = await contract();
  const content = await fixture();
  content.endings[0].metricIds.push('unknown_metric');
  assert.throws(() => validateLifeContentPackage(content), /Unknown Ending Metric reference/);
});

test('invalid imports fail closed without returning partial content', async () => {
  const { parseLifeContentPackage } = await contract();
  assert.throws(() => parseLifeContentPackage('{bad json'), /Invalid life content JSON/);
  assert.throws(
    () => parseLifeContentPackage(JSON.stringify({ schemaVersion: 1, status: 'approved' })),
    /Fixture status is required/,
  );
});
