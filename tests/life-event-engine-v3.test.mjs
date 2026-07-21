import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyCommandsAtomic, createLifeStateV3 } from '../js/life-engine-v3.js';
import {
  effectiveEventWeight, eligibleEvents, eventConditionsMatch,
  resolvePendingChoice, runAnnualTurn, selectEventAtomic,
} from '../js/life-event-engine-v3.js';

const annualEvents = JSON.parse(fs.readFileSync(new URL('../data/life-events-annual-v3.json', import.meta.url), 'utf8'));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function createAdult() {
  const life = createLifeStateV3({ id: 'life-annual', seed: 42, name: '测试者' });
  life.clock.totalWeeks = 18 * 52;
  life.history.tags.push('student');
  life.mind.smarts = 60;
  life.finance.assets = 1000;
  return life;
}

function event(id, overrides = {}) {
  return {
    id, version: 3, type: 'values', stage: 'life', timeScale: 'year', priority: 100, weight: 1,
    conditions: {}, scene: { id: 'test' }, narration: { title: id, description: id }, aiTags: ['test'],
    choices: [{ id: 'a', label: 'A', result: 'done', commands: [] }], ...overrides,
  };
}

test('conditions support age, tags and modular paths', () => {
  const life = createAdult();
  assert.equal(eventConditionsMatch(life, {
    age: { min: 18 }, requiredTags: ['student'], statMin: { 'mind.smarts': 50 }, resourceMin: { 'finance.assets': 1000 },
  }), true);
  assert.equal(eventConditionsMatch(life, { age: { min: 19 } }), false);
});

test('probability modifiers change effective weight', () => {
  const life = createAdult();
  const weighted = event('weighted', {
    probabilityModifiers: [{ conditions: { requiredTags: ['student'] }, multiplier: 2 }],
  });
  assert.equal(effectiveEventWeight(life, weighted), 2);
});

test('eligibility enforces cooldown and once-per-life', () => {
  const life = createAdult();
  life.history.cooldowns.cool = life.clock.totalWeeks + 10;
  life.history.timeline.push({ eventId: 'once' });
  const pool = eligibleEvents(life, [event('cool'), event('once', { oncePerLife: true }), event('ok')]);
  assert.deepEqual(pool.map((item) => item.id), ['ok']);
});

test('selection uses highest priority before weight', () => {
  const life = createAdult();
  const selected = selectEventAtomic(life, [
    event('low', { priority: 10, weight: 100 }), event('high', { priority: 20 }),
  ]);
  assert.equal(selected.pendingEvent.id, 'high');
  assert.equal(selected.rngCursor, 1);
  assert.equal(life.rngCursor, 0);
});

test('same seed and cursor select the same event', () => {
  const events = [event('a'), event('b')];
  assert.equal(selectEventAtomic(createAdult(), events).pendingEvent.id, selectEventAtomic(createAdult(), events).pendingEvent.id);
});

test('choice resolution integrates Command Executor, timeline and cooldown', () => {
  const life = selectEventAtomic(createAdult(), [event('school', {
    cooldown: { amount: 2, unit: 'year' },
    choices: [{ id: 'study', label: 'Study', result: 'graduated', commands: [{ op: 'AddResource', key: 'finance.assets', amount: 500 }] }],
  })]);
  const next = resolvePendingChoice(life, 'study', applyCommandsAtomic);
  assert.equal(next.clock.totalWeeks, 19 * 52);
  assert.equal(next.finance.assets, 1500);
  assert.equal(next.history.timeline[0].eventId, 'school');
  assert.equal(next.history.cooldowns.school, 21 * 52);
  assert.equal(next.pendingEvent, null);
});

test('annual vertical slice completes a deterministic year', () => {
  const life = createAdult();
  const next = runAnnualTurn(life, annualEvents, (pending) => pending.choices[0].id, applyCommandsAtomic);
  assert.equal(next.clock.totalWeeks, 19 * 52);
  assert.equal(next.history.timeline.length, 1);
  assert.equal(next.pendingEvent, null);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
