import assert from 'node:assert/strict';
import {
  advanceClock,
  applyCommandsAtomic,
  createLifeStateV3,
  deriveClock,
  migrateSaveV2ToV3,
  validateLifeState,
} from '../js/life-engine-v3.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('canonical clock derives age and week', () => {
  assert.deepEqual(deriveClock(53), { ageYears: 1, weekOfYear: 1 });
});

test('year and week advancement use totalWeeks only', () => {
  assert.equal(advanceClock(17, 'year'), 69);
  assert.equal(advanceClock(51, 'week'), 52);
});

test('commands and time advance atomically', () => {
  const life = createLifeStateV3({ seed: 7, name: '测试者' });
  const next = applyCommandsAtomic(life, [
    { op: 'AddStat', key: 'mind.smarts', amount: 10 },
    { op: 'AddResource', key: 'finance.assets', amount: 500 },
  ], { timeScale: 'year' });
  assert.equal(next.mind.smarts, 60);
  assert.equal(next.finance.assets, 500);
  assert.equal(next.clock.totalWeeks, 52);
  assert.equal(life.clock.totalWeeks, 0);
});

test('illegal command rolls back the whole transaction', () => {
  const life = createLifeStateV3({ seed: 8 });
  assert.throws(() => applyCommandsAtomic(life, [
    { op: 'AddStat', key: 'mind.smarts', amount: 10 },
    { op: 'AddStat', key: 'unknown.path', amount: 1 },
  ], { timeScale: 'week' }), /Unknown numeric path/);
  assert.equal(life.mind.smarts, 50);
  assert.equal(life.clock.totalWeeks, 0);
});

test('scores and relationship dimensions are clamped', () => {
  const life = createLifeStateV3({ seed: 9 });
  const next = applyCommandsAtomic(life, [
    { op: 'SetStat', key: 'health.health', value: 120 },
    {
      op: 'CreateRelationship', relationshipId: 'r1', role: 'friend', name: '朋友',
      dimensions: { attraction: 0, love: 150, trust: 50, conflict: -5, dependence: 0, respect: 50, passion: 0, commitment: 20 },
    },
  ], { advanceTime: false });
  assert.equal(next.health.health, 100);
  assert.equal(next.relationships[0].dimensions.love, 100);
  assert.equal(next.relationships[0].dimensions.conflict, 0);
});

test('stage commands do not advance time by themselves', () => {
  const life = createLifeStateV3({ seed: 10 });
  const next = applyCommandsAtomic(life, [{ op: 'EnterStage', stage: 'romance' }], { advanceTime: false });
  assert.equal(next.clock.stage, 'romance');
  assert.equal(next.clock.stageStartedAtWeeks, 0);
  assert.equal(next.clock.totalWeeks, 0);
});

test('schedule event stores absolute due week', () => {
  const life = createLifeStateV3({ seed: 11 });
  life.clock.totalWeeks = 100;
  const next = applyCommandsAtomic(life, [{ op: 'ScheduleEvent', eventId: 'future', after: { amount: 2, unit: 'year' } }], { advanceTime: false });
  assert.equal(next.history.scheduled[0].dueAtTotalWeeks, 204);
});

test('runtime invariants reject future timestamps', () => {
  const life = createLifeStateV3({ seed: 12 });
  life.clock.stageStartedAtWeeks = 1;
  assert.throws(() => validateLifeState(life), /stageStartedAtWeeks/);
});

test('v2 save migrates to modular v3 without losing history', () => {
  const v2 = {
    schemaVersion: 2,
    appVersion: '0.2',
    savedAt: '2026-07-21T00:00:00.000Z',
    currentLife: {
      id: 'old', seed: 3, rngCursor: 4, createdAt: '2026-01-01T00:00:00.000Z', alive: true,
      identity: { name: '旧档', birthYear: 2000, region: '城市', childrenCount: 1, careerId: 'teacher', educationId: 'college' },
      clock: { totalWeeks: 520, stage: 'life', stageStartedAtWeeks: 0 },
      stats: { health: 70, happiness: 60, smarts: 80, fitness: 55, empathy: 65, stress: 30 },
      resources: { assets: 1000, debt: 100, careerLevel: 2, freeTime: 40, reputation: 20 },
      relationships: [], tags: ['legacy'], flags: {}, experiences: [{ id: 'e1', type: 'education', atTotalWeeks: 100, title: '毕业' }], timeline: [], cooldowns: { e: 600 }, scheduled: [],
    },
    archives: [], achievements: ['first'], settings: { reducedMotion: false, showEffectHints: true, confirmReset: true },
  };
  const migrated = migrateSaveV2ToV3(v2);
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.currentLife.mind.smarts, 80);
  assert.equal(migrated.currentLife.health.health, 70);
  assert.equal(migrated.currentLife.history.tags[0], 'legacy');
  assert.equal(migrated.currentLife.history.experiences[0].title, '毕业');
  assert.equal(migrated.currentLife.finance.assets, 1000);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}
console.log(`\n${passed}/${tests.length} tests passed`);
