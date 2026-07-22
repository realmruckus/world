import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const fixtureUrl = new URL('../data/fixtures/life-content-contract-v1.json', import.meta.url);
const schemaUrl = new URL('../schemas/life-content-contract-v1.schema.json', import.meta.url);
const contract = await import('../js/life-content-contract-v1.js');

const loadFixture = () => JSON.parse(fs.readFileSync(fixtureUrl, 'utf8'));
const parse = (value) => contract.parseLifeContentPackage(JSON.stringify(value));

test('Family and Origin templates do not bind gender or zodiac identity', () => {
  const content = loadFixture();
  for (const template of [...content.origins, ...content.families]) {
    assert.equal('genderId' in template, false);
    assert.equal('zodiacSignId' in template, false);
  }

  for (const family of content.families) {
    for (const gender of content.genders) {
      for (const zodiac of content.zodiacSigns) {
        const parentJobIds = family.parentNpcIds.map((npcId) =>
          content.npcs.find((npc) => npc.id === npcId).parentJobId);
        const selection = contract.composeLifeIdentity(content, {
          familyId: family.id,
          genderId: gender.id,
          zodiacSignId: zodiac.id,
        });
        assert.deepEqual(
          { familyId: selection.familyId, genderId: selection.genderId, zodiacSignId: selection.zodiacSignId },
          { familyId: family.id, genderId: gender.id, zodiacSignId: zodiac.id },
        );
      }
    }
  }
});

test('identity composition is deterministic and fails closed on unknown references', () => {
  const content = loadFixture();
  const input = {
    familyId: 'family_working',
    genderId: 'gender_c',
    zodiacSignId: 'pisces',
  };
  assert.deepEqual(contract.composeLifeIdentity(content, input), contract.composeLifeIdentity(content, input));
  assert.throws(() => contract.composeLifeIdentity(content, { ...input, genderId: 'missing_gender' }), /Unknown Gender/);
  assert.throws(() => contract.composeLifeIdentity(content, { ...input, zodiacSignId: 'missing_zodiac' }), /Unknown Zodiac/);
  assert.deepEqual(contract.composeLifeIdentity(content, input).parentJobIds, ['job_service', 'job_technical']);
  assert.throws(
    () => contract.composeLifeIdentity(content, { ...input, parentJobIds: ['job_service', 'job_technical'] }),
    /must not override Parent Job/i,
  );
});

test('every Parent Job fixture is represented through its authoritative parent NPC', () => {
  const content = loadFixture();
  const observedJobIds = new Set();
  for (const family of content.families) {
    const identity = contract.composeLifeIdentity(content, {
      familyId: family.id,
      genderId: content.genders[0].id,
      zodiacSignId: content.zodiacSigns[0].id,
    });
    const npcJobIds = family.parentNpcIds.map((npcId) => content.npcs.find((npc) => npc.id === npcId).parentJobId);
    assert.deepEqual(identity.parentJobIds, npcJobIds);
    npcJobIds.forEach((id) => observedJobIds.add(id));
  }
  assert.deepEqual(observedJobIds, new Set(content.parentJobs.map((job) => job.id)));
});

test('the actual parser enforces Schema extra fields, IDs, required fields, enums, and array limits', () => {
  const mutations = [
    [(value) => { value.extra = true; }, /additional propert/i],
    [(value) => { value.families[0].id = 'Invalid ID'; }, /pattern/i],
    [(value) => { delete value.parentJobs[0].sector; }, /required/i],
    [(value) => { value.parentJobs[0].incomeBand = 'extreme'; }, /enum/i],
    [(value) => { value.families[0].parentNpcIds = []; }, /minItems/i],
    [(value) => { value.families[0].parentNpcIds = ['parent_working_a', 'parent_working_b', 'parent_single_a']; }, /maxItems/i],
    [(value) => { value.schemaVersion = 2; }, /const|schemaVersion/i],
    [(value) => { value.status = 'approved'; }, /enum|status/i],
  ];

  for (const [mutate, expected] of mutations) {
    const content = loadFixture();
    mutate(content);
    assert.throws(() => parse(content), expected);
  }
});

test('Schema and runtime share resource, finance, and finite-number boundaries', () => {
  for (const [path, value] of [
    [['origins', 0, 'resources', 'wealth'], -1],
    [['origins', 0, 'resources', 'education'], 101],
    [['origins', 0, 'finance', 'income'], -1],
  ]) {
    const content = loadFixture();
    path.slice(0, -1).reduce((node, key) => node[key], content)[path.at(-1)] = value;
    assert.throws(() => contract.validateLifeContentPackage(content), /minimum|maximum|finite|Invalid/i);
  }
  const content = loadFixture();
  content.origins[0].finance.cash = Number.POSITIVE_INFINITY;
  assert.throws(() => contract.validateLifeContentPackage(content), /finite|Invalid/i);
});

test('Origin owns the only Family reference and mappings are one-to-one', () => {
  const content = loadFixture();
  assert.ok(content.origins.every((origin) => origin.familyId));
  assert.ok(content.families.every((family) => !('originId' in family)));
  content.origins[1].familyId = content.origins[0].familyId;
  assert.throws(() => contract.validateLifeContentPackage(content), /Family.*multiple Origins|one-to-one/i);
});

test('Parent Jobs expose stable display identity without encoding family resources', () => {
  const content = loadFixture();
  for (const job of content.parentJobs) {
    assert.match(job.id, /^[a-z][a-z0-9_]*$/);
    assert.match(job.displayNameKey, /^[a-z][a-z0-9_.]*$/);
    assert.equal('education' in job, false);
    assert.equal('familySupport' in job, false);
    assert.equal('healthEnvironment' in job, false);
  }
});

test('relationship fixtures include pause, crisis, recovery, breakup, and no-contact paths', () => {
  const content = loadFixture();
  const states = new Set(content.relationshipStates.map(({ id }) => id));
  for (const state of ['paused', 'broken_up', 'no_contact']) assert.ok(states.has(state));
  const kinds = new Set(content.relationshipTransitions.map(({ kind }) => kind));
  for (const kind of ['pause', 'crisis', 'recovery', 'breakup', 'no_contact']) assert.ok(kinds.has(kind));

  content.relationshipTransitions = content.relationshipTransitions.filter((edge) => edge.kind !== 'recovery');
  assert.throws(() => contract.validateLifeContentPackage(content), /relationship.*recovery|Unreachable/i);
});

test('age bands are ordered, contiguous, non-overlapping, and cover their event fixtures', () => {
  const overlap = loadFixture();
  overlap.ageBands[1].minAge = overlap.ageBands[0].maxAge;
  assert.throws(() => contract.validateLifeContentPackage(overlap), /overlap/i);

  const gap = loadFixture();
  gap.ageBands[1].minAge += 1;
  assert.throws(() => contract.validateLifeContentPackage(gap), /gap/i);

  const inverted = loadFixture();
  inverted.ageBands[0].minAge = inverted.ageBands[0].maxAge + 1;
  assert.throws(() => contract.validateLifeContentPackage(inverted), /minAge.*maxAge/i);
});

test('parent NPC ownership is unique and dangling or non-parent references fail closed', () => {
  const shared = loadFixture();
  shared.families[1].parentNpcIds[0] = shared.families[0].parentNpcIds[0];
  assert.throws(() => contract.validateLifeContentPackage(shared), /multiple Families|shared/i);

  const dangling = loadFixture();
  dangling.npcs.push({ id: 'parent_unowned', role: 'parent', parentJobId: dangling.parentJobs[0].id });
  assert.throws(() => contract.validateLifeContentPackage(dangling), /not owned|unowned/i);

  const wrongRole = loadFixture();
  wrongRole.npcs[0].role = 'friend';
  assert.throws(() => contract.validateLifeContentPackage(wrongRole), /not a parent|const/i);
});

test('Family type remains an extensible ID rather than a five-value enum', () => {
  const schema = JSON.parse(fs.readFileSync(schemaUrl, 'utf8'));
  assert.equal('enum' in schema.$defs.family.properties.type, false);
  const content = loadFixture();
  content.families[0].type = 'multigenerational';
  assert.doesNotThrow(() => contract.validateLifeContentPackage(content));
});

test('missing fields, duplicate IDs, illegal references, and partial parses fail closed', () => {
  const missing = loadFixture();
  delete missing.origins[0].resources;
  assert.throws(() => parse(missing));

  const duplicate = loadFixture();
  duplicate.genders[1].id = duplicate.genders[0].id;
  assert.throws(() => parse(duplicate), /duplicate/i);

  const badReference = loadFixture();
  badReference.endings[0].metricIds = ['missing_metric'];
  assert.throws(() => parse(badReference), /Unknown Ending Metric/);

  assert.throws(() => contract.parseLifeContentPackage('{"schemaVersion":1'), /Invalid life content JSON/);
});
