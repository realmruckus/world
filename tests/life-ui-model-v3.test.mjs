import assert from 'node:assert/strict';
import { createLifeStateV3 } from '../js/life-engine-v3.js';
import { activeRelationship, avatarSvg, derivedClock, eventView, generatedChineseIdentity, metricRows, profileView, timelineRows, zodiacName } from '../js/life-ui-model-v3.js';

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

test('profile and core conditions use player-readable language instead of internal ids or raw scores', () => {
  const life = createLifeStateV3({ name:'界行者', seed:12 });
  life.career.educationId = 'college';
  life.career.id = 'starter_job';
  life.health.health = 70;
  life.mind.happiness = 82;
  life.mind.smarts = 85;
  life.mind.discipline = 50;
  life.mind.stress = 23;

  const profile = profileView(life);
  assert.equal(profile.education, '大学阶段');
  assert.equal(profile.career, '职场起步');

  const rows = metricRows(life);
  assert.deepEqual(rows.map((row) => row.status), ['状态良好', '心情愉快', '思维敏锐', '自律一般', '压力较低']);
  assert.equal(rows.some((row) => Object.hasOwn(row, 'value')), false);
});

test('generated identity uses a formal Chinese name and exposes gender and zodiac', () => {
  const identity = generatedChineseIdentity(1571);
  assert.match(identity.name, /^[\u4e00-\u9fff]{2,4}$/);
  assert.ok(['男','女'].includes(identity.gender));
  assert.ok(Number.isInteger(identity.birthMonth) && identity.birthMonth >= 1 && identity.birthMonth <= 12);
  assert.ok(Number.isInteger(identity.birthDay) && identity.birthDay >= 1 && identity.birthDay <= 28);
  assert.equal(generatedChineseIdentity(1571), generatedChineseIdentity(1571));

  const life = createLifeStateV3({ name:identity.name, seed:1571 });
  life.identity.gender = identity.gender;
  life.identity.birthMonth = identity.birthMonth;
  life.identity.birthDay = identity.birthDay;
  const profile = profileView(life);
  assert.equal(profile.gender, identity.gender);
  assert.equal(profile.zodiac, zodiacName(identity.birthMonth, identity.birthDay));
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
