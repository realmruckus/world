import assert from 'node:assert/strict';
import { createLifeStateV3 } from '../js/life-engine-v3.js';
import { activeRelationship, avatarSvg, derivedClock, eventView, metricRows, profileView, timelineRows } from '../js/life-ui-model-v3.js';

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('clock and profile use canonical total weeks', () => {
  const life = createLifeStateV3({ name:'界行者', seed:12 });
  life.clock.totalWeeks = 53;
  assert.deepEqual(derivedClock(life), { ageYears:1, weekOfYear:1 });
  assert.equal(profileView(life).ageLabel, '1 岁 · 第 2 周');
});

test('avatar is deterministic SVG without external image files', () => {
  const life = createLifeStateV3({ name:'界行者', seed:12 });
  assert.equal(avatarSvg(life), avatarSvg(life));
  assert.match(avatarSvg(life), /^<svg/);
  assert.match(avatarSvg(life), /程序生成头像/);
});

test('metric, timeline and event models are display ready', () => {
  const life = createLifeStateV3({ name:'界行者', seed:12 });
  life.history.timeline.push({ atTotalWeeks:52, timeScale:'year', title:'开学', summary:'认识了新同学', kind:'event_choice' });
  life.pendingEvent = { id:'e1', type:'education', narration:{ title:'事件', description:'说明' }, scene:{ caption:'场景' }, choices:[{ id:'a', label:'选择', result:'结果' }] };
  assert.equal(metricRows(life).length, 5);
  assert.equal(timelineRows(life)[0].time, '1岁');
  assert.equal(eventView(life).choices[0].label, '选择');
});

test('active relationship follows romance context', () => {
  const life = createLifeStateV3({ seed:1 });
  life.relationships.push({ id:'r1', name:'林遥', role:'partner_candidate', status:'dating', dimensions:{}, relationshipStartedAtWeeks:0, statusChangedAtWeeks:0, sharedExperiences:[] });
  life.history.flags.activeRomanceRelationshipId = 'r1';
  assert.equal(activeRelationship(life).id, 'r1');
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} tests passed`);