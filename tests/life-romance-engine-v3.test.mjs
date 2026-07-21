import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  applyCommandsAtomic,
  createLifeStateV3,
} from '../js/life-engine-v3.js';
import {
  enterRomanceStage,
  exitRomanceStage,
  resolveRomanceChoice,
  selectRomanceTurn,
} from '../js/life-romance-engine-v3.js';

const relationshipRules = JSON.parse(fs.readFileSync(new URL('../data/life-relationship-rules.json', import.meta.url), 'utf8'));
const romanceEvents = [
  ...JSON.parse(fs.readFileSync(new URL('../data/life-events-romance-v3.json', import.meta.url), 'utf8')),
  ...JSON.parse(fs.readFileSync(new URL('../data/life-events-romance-resolution-v3.json', import.meta.url), 'utf8')),
];
const interruptEvents = JSON.parse(fs.readFileSync(new URL('../data/life-events-interrupt-v3.json', import.meta.url), 'utf8'));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function createRomanceLife(status = 'potential', dimensions = {}) {
  const base = createLifeStateV3({ id: 'romance-life', seed: 31, name: '测试者' });
  const withRelationship = applyCommandsAtomic(base, [{
    op: 'CreateRelationship', relationshipId: 'partner-1', role: 'partner_candidate', name: '林遥', targetStatus: status,
    dimensions: {
      attraction: 60, love: 50, trust: 50, conflict: 10,
      dependence: 20, respect: 50, passion: 50, commitment: 35,
      ...dimensions,
    },
  }], { advanceTime: false });
  return enterRomanceStage(withRelationship, 'partner-1');
}

test('entering romance stage preserves time and records active relationship', () => {
  const life = createRomanceLife();
  assert.equal(life.clock.stage, 'romance');
  assert.equal(life.clock.totalWeeks, 0);
  assert.equal(life.history.flags.activeRomanceRelationshipId, 'partner-1');
});

test('normal romance choice advances exactly one week', () => {
  const life = createRomanceLife();
  const selected = selectRomanceTurn(life, romanceEvents, [], relationshipRules);
  assert.equal(selected.pendingEvent.id, 'romance_first_date');
  const resolved = resolveRomanceChoice(selected, 'open', relationshipRules);
  assert.equal(resolved.clock.totalWeeks, 1);
  assert.equal(resolved.clock.stage, 'romance');
  assert.equal(resolved.relationships[0].status, 'dating');
});

test('interrupt event preserves romance stage and stage start', () => {
  const life = createRomanceLife('dating');
  life.mind.stress = 80;
  life.clock.totalWeeks = 10;
  life.clock.stageStartedAtWeeks = 3;
  const selected = selectRomanceTurn(life, romanceEvents, interruptEvents, relationshipRules);
  assert.equal(selected.pendingEvent.canInterruptStage, true);
  const resolved = resolveRomanceChoice(selected, 'rest', relationshipRules);
  assert.equal(resolved.clock.stage, 'romance');
  assert.equal(resolved.clock.stageStartedAtWeeks, 3);
  assert.equal(resolved.clock.totalWeeks, 11);
});

test('empty romance pool fast forwards one quiet week', () => {
  const life = createRomanceLife('dating');
  const next = selectRomanceTurn(life, [], [], relationshipRules);
  assert.equal(next.clock.totalWeeks, 1);
  assert.equal(next.clock.stage, 'romance');
  assert.equal(next.history.timeline.at(-1).kind, 'quiet_week');
});

test('hard limit forces a resolution event before normal events', () => {
  const life = createRomanceLife('dating');
  life.clock.totalWeeks = 52;
  life.clock.stageStartedAtWeeks = 0;
  const selected = selectRomanceTurn(life, romanceEvents, interruptEvents, relationshipRules);
  assert.equal(selected.pendingEvent.relationshipResolution, true);
  assert.equal(selected.pendingEvent.id, 'romance_hard_limit_unresolved');
});

test('hard limit has a resolution event for every nonterminal romance status', () => {
  const expected = {
    potential: 'romance_hard_limit_potential',
    dating: 'romance_hard_limit_unresolved',
    exclusive: 'romance_hard_limit_committed',
    cohabiting: 'romance_hard_limit_cohabiting',
    engaged: 'romance_hard_limit_engaged',
    paused: 'romance_hard_limit_paused',
  };
  for (const [status, eventId] of Object.entries(expected)) {
    const life = createRomanceLife(status);
    life.clock.totalWeeks = 52;
    life.clock.stageStartedAtWeeks = 0;
    const selected = selectRomanceTurn(life, romanceEvents, [], relationshipRules);
    assert.equal(selected.pendingEvent.id, eventId);
  }
});

test('terminal relationship resolution exits romance stage', () => {
  const life = createRomanceLife('dating');
  life.clock.totalWeeks = 52;
  const selected = selectRomanceTurn(life, romanceEvents, [], relationshipRules);
  const resolved = resolveRomanceChoice(selected, 'break_up', relationshipRules);
  assert.equal(resolved.relationships[0].status, 'broken_up');
  assert.equal(resolved.clock.stage, 'life');
  assert.equal(resolved.history.flags.activeRomanceRelationshipId, undefined);
});

test('paused relationship exits the active weekly romance stage', () => {
  const life = createRomanceLife('dating');
  life.clock.totalWeeks = 52;
  const selected = selectRomanceTurn(life, romanceEvents, [], relationshipRules);
  const resolved = resolveRomanceChoice(selected, 'pause', relationshipRules);
  assert.equal(resolved.relationships[0].status, 'paused');
  assert.equal(resolved.clock.stage, 'life');
});

test('manual exit keeps canonical time unchanged', () => {
  const life = createRomanceLife('dating');
  life.clock.totalWeeks = 12;
  const exited = exitRomanceStage(life);
  assert.equal(exited.clock.totalWeeks, 12);
  assert.equal(exited.clock.stage, 'life');
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
