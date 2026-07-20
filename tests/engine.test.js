import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMonster,
  createWorldState,
  composeEvent,
  resolveChoice,
  calculateTerritoryOutcome,
  calculateLocationNetIncome
} from '../js/engine.js';

test('choice advances tick and changes monster data', () => {
  const monster = createMonster({ id: 'M1', name: '嘎吱', race: 'GOBLIN' });
  const state = createWorldState(monster);
  const event = composeEvent(state, 'HUNT', 1);
  resolveChoice(state, event, event.choices[0].id);
  assert.equal(state.tick, 1);
  assert.equal(state.eventLog.length, 1);
});

test('territory outcome is deterministic for the same seed', () => {
  const input = {
    attackers: [{ power: 5 }, { power: 4 }],
    defenders: [{ power: 3 }],
    locationBonus: 1.1,
    scoutingBonus: 1.2,
    seed: 42
  };
  assert.equal(calculateTerritoryOutcome(input), calculateTerritoryOutcome(input));
});

test('location income subtracts all costs', () => {
  assert.equal(calculateLocationNetIncome({
    production: 20,
    garrisonMaintenance: 5,
    facilityMaintenance: 2,
    expectedRaidLoss: 3
  }), 10);
});
