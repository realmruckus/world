import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLifeStateV3, migrateSaveV2ToV3 } from '../js/life-engine-v3.js';
import {
  archiveFinishedLife, createEmptySave, exportSaveJson, importSaveJson,
  loadLocalSave, persistLocalSave, setCurrentLife, unlockAchievements, validateSaveV3,
} from '../js/life-save-engine-v3.js';
import { evaluateAchievements } from '../js/life-achievement-engine-v3.js';

const achievements = JSON.parse(fs.readFileSync(new URL('../data/life-achievements-v3.json', import.meta.url), 'utf8'));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function finalizedLife(id = 'life-1', score = 82) {
  const life = createLifeStateV3({ id, name: '归档测试', seed: 5 });
  life.clock.totalWeeks = 86 * 52;
  life.identity.childrenCount = 1;
  life.alive = false;
  life.derivedMetrics = { health: 80 };
  life.ending = {
    deathCause: 'old_age', primaryEnding: 'ordinary_complete',
    secondaryTags: ['family_harmony','lifelong_learner'], lifeScore: score,
    metrics: { health: 80 },
  };
  return life;
}

test('empty save and current life round trip through JSON', () => {
  const save = setCurrentLife(createEmptySave(), createLifeStateV3({ id:'current' }), '2026-07-21T00:00:00.000Z');
  const imported = importSaveJson(exportSaveJson(save));
  assert.deepEqual(imported, save);
  assert.equal(validateSaveV3(imported), true);
});

test('local storage adapter persists without database', () => {
  const memory = new Map();
  const storage = { getItem:key => memory.has(key) ? memory.get(key) : null, setItem:(key,value) => memory.set(key,value) };
  const save = setCurrentLife(createEmptySave(), createLifeStateV3({ id:'local' }));
  persistLocalSave(storage, save);
  assert.deepEqual(loadLocalSave(storage), save);
});

test('finalized life archives newest first and removes current life', () => {
  let save = setCurrentLife(createEmptySave(), createLifeStateV3({ id:'active' }));
  save = archiveFinishedLife(save, finalizedLife(), { endedAt:'2026-07-21T01:00:00.000Z' });
  assert.equal(save.currentLife, null);
  assert.equal(save.archives[0].lifeId, 'life-1');
  assert.equal(save.archives[0].score, 82);
  assert.equal(save.archives[0].snapshot.alive, false);
});

test('archive list is deduplicated and capped at 100', () => {
  let save = createEmptySave();
  for (let index = 0; index < 105; index += 1) {
    save = archiveFinishedLife(save, finalizedLife(`life-${index}`, index % 101), { endedAt:`2026-07-21T${String(index % 24).padStart(2,'0')}:00:00.000Z`, includeSnapshot:false });
  }
  assert.equal(save.archives.length, 100);
  const updated = archiveFinishedLife(save, finalizedLife('life-104', 99), { endedAt:'2026-07-22T00:00:00.000Z', includeSnapshot:false });
  assert.equal(updated.archives.filter((item) => item.lifeId === 'life-104').length, 1);
  assert.equal(updated.archives[0].score, 99);
});

test('achievements evaluate across current life and archive history', () => {
  let save = archiveFinishedLife(createEmptySave(), finalizedLife(), { endedAt:'2026-07-21T01:00:00.000Z' });
  const unlocked = evaluateAchievements(save, achievements, finalizedLife());
  assert.ok(unlocked.includes('first_life'));
  assert.ok(unlocked.includes('high_score'));
  assert.ok(unlocked.includes('long_life'));
  assert.ok(unlocked.includes('parenthood'));
  save = unlockAchievements(save, unlocked);
  assert.deepEqual(evaluateAchievements(save, achievements, finalizedLife()), []);
});

test('invalid JSON and invalid save fail closed', () => {
  assert.throws(() => importSaveJson('{bad'), /Invalid save JSON/);
  assert.throws(() => importSaveJson(JSON.stringify({ schemaVersion:3 })), /Invalid appVersion/);
});

test('strict archive and achievement invariants reject malformed imports', () => {
  const valid = archiveFinishedLife(createEmptySave(), finalizedLife(), { endedAt:'2026-07-21T01:00:00.000Z', includeSnapshot:false });
  const missingTags = structuredClone(valid);
  delete missingTags.archives[0].summaryTags;
  assert.throws(() => validateSaveV3(missingTags), /archive summaryTags/);
  const duplicate = structuredClone(valid);
  duplicate.archives.push(structuredClone(duplicate.archives[0]));
  assert.throws(() => validateSaveV3(duplicate), /Duplicate archive lifeId/);
  const badAchievement = structuredClone(valid);
  badAchievement.achievements = [123];
  assert.throws(() => validateSaveV3(badAchievement), /Invalid achievements/);
});

test('schema v2 import migrates to v3', () => {
  const v2 = {
    schemaVersion:2, appVersion:'0.2', savedAt:'2026-07-21T00:00:00.000Z', currentLife:null,
    archives:[], achievements:[], settings:{ reducedMotion:false, showEffectHints:true, confirmReset:true },
  };
  assert.equal(importSaveJson(JSON.stringify(v2)).schemaVersion, 3);
  assert.equal(migrateSaveV2ToV3(v2).schemaVersion, 3);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
