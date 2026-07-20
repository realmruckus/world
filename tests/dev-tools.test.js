import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_SAVE_FORMAT,
  WORLD_SAVE_VERSION,
  createDefaultTestState,
  exportSave,
  importSave,
  runDeterministicAction,
  validateSeed,
  validateWorldState
} from '../js/dev-tools.js';
import { WORLD_ENGINE_VERSION } from '../js/engine.js';

test('save export and import preserve world state', () => {
  const state = createDefaultTestState();
  const text = exportSave(state);
  const parsed = JSON.parse(text);
  assert.equal(parsed.format, WORLD_SAVE_FORMAT);
  assert.equal(parsed.saveVersion, WORLD_SAVE_VERSION);
  assert.equal(parsed.engineVersion, WORLD_ENGINE_VERSION);
  assert.deepEqual(importSave(text).state, state);
});

test('same state, input and seed reproduce the same result', () => {
  const state = createDefaultTestState();
  const first = runDeterministicAction(state, { action: 'HUNT', seed: 42, choiceIndex: 0 });
  const second = runDeterministicAction(state, { action: 'HUNT', seed: 42, choiceIndex: 0 });
  assert.deepEqual(first.event, second.event);
  assert.deepEqual(first.after, second.after);
  assert.equal(state.tick, 0, 'source state must not be mutated');
});

test('reset factory returns a clean independent state', () => {
  const changed = runDeterministicAction(createDefaultTestState(), { seed: 7 }).after;
  const reset = createDefaultTestState();
  assert.equal(changed.tick, 1);
  assert.equal(reset.tick, 0);
  assert.equal(reset.eventLog.length, 0);
  assert.notDeepEqual(changed, reset);
});

test('invalid JSON and damaged saves are rejected', () => {
  assert.throws(() => importSave('{broken'), /有效 JSON/);
  const envelope = JSON.parse(exportSave(createDefaultTestState()));
  envelope.state.monsters = [];
  assert.throws(() => importSave(JSON.stringify(envelope)), /monsters 必须是非空数组/);
});

test('failed import cannot mutate the current state', () => {
  const current = createDefaultTestState();
  const snapshot = structuredClone(current);
  assert.throws(() => importSave('{"format":"WRONG"}'));
  assert.deepEqual(current, snapshot);
});

test('save and engine version mismatches are rejected', () => {
  const saveMismatch = JSON.parse(exportSave(createDefaultTestState()));
  saveMismatch.saveVersion += 1;
  assert.throws(() => importSave(JSON.stringify(saveMismatch)), /存档版本不支持/);

  const engineMismatch = JSON.parse(exportSave(createDefaultTestState()));
  engineMismatch.engineVersion = '999.0.0';
  assert.throws(() => importSave(JSON.stringify(engineMismatch)), /Engine 版本不兼容/);
});

test('state validation reports structural errors and warnings', () => {
  const state = createDefaultTestState();
  state.locations.FOREST_EDGE.id = 'OTHER';
  const warning = validateWorldState(state);
  assert.equal(warning.valid, true);
  assert.equal(warning.warnings.length, 1);

  state.activeMonsterId = 'MISSING';
  const invalid = validateWorldState(state);
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join('\n'), /activeMonsterId/);
});

test('seed validation accepts uint32 integers only', () => {
  assert.equal(validateSeed('0'), 0);
  assert.equal(validateSeed('4294967295'), 4294967295);
  assert.throws(() => validateSeed('-1'));
  assert.throws(() => validateSeed('1.5'));
  assert.throws(() => validateSeed('abc'));
  assert.throws(() => validateSeed('4294967296'));
});
