import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLifeStateV3 } from '../js/life-engine-v3.js';
import { calculateDerivedMetrics } from '../js/life-metric-engine-v3.js';
import { finalizeLife, resolveEnding } from '../js/life-ending-engine-v3.js';

const registry = JSON.parse(fs.readFileSync(new URL('../data/life-derived-metrics.json', import.meta.url), 'utf8'));
const endings = JSON.parse(fs.readFileSync(new URL('../data/life-ending-rules.json', import.meta.url), 'utf8'));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function sampleLife() {
  const life = createLifeStateV3({ id: 'metric-life', seed: 44, name: '指标测试' });
  life.clock.totalWeeks = 85 * 52;
  life.health.health = 82;
  life.body.fitness = 75;
  life.mind.smarts = 88;
  life.mind.empathy = 80;
  life.mind.stress = 20;
  life.career.level = 7;
  life.career.freeTime = 65;
  life.finance.assets = 2000000;
  life.finance.cash = 300000;
  life.finance.income = 100000;
  life.finance.reputation = 80;
  life.identity.childrenCount = 2;
  life.relationships.push({ id:'family-1', name:'家人', role:'family', status:'active', dimensions:{ attraction:0,love:90,trust:88,conflict:5,dependence:30,respect:85,passion:0,commitment:90 }, relationshipStartedAtWeeks:0,statusChangedAtWeeks:0,sharedExperiences:[] });
  life.relationships.push({ id:'partner-1', name:'伴侣', role:'partner_candidate', status:'married', dimensions:{ attraction:80,love:92,trust:90,conflict:8,dependence:45,respect:90,passion:75,commitment:95 }, relationshipStartedAtWeeks:1000,statusChangedAtWeeks:2000,sharedExperiences:[] });
  life.history.tags.push('long_term_partner');
  life.history.experiences.push(
    { id:'edu', type:'education', title:'进修', tags:['education_growth'] },
    { id:'career', type:'career', title:'晋升', tags:['career_change','completed_goal'] },
    { id:'help', type:'public', title:'帮助他人', tags:['helped_person','public_contribution'], contributionMagnitude:20 },
    { id:'trip', type:'opportunity', title:'远行', tags:['major_activity','risk_choice'] },
  );
  life.history.timeline.push({ timeScale:'year', netIncome:50000, careerId:'career-a', regionId:'region-a' });
  return life;
}

test('metric registry evaluates all metrics deterministically', () => {
  const life = sampleLife();
  const a = calculateDerivedMetrics(life, registry);
  const b = calculateDerivedMetrics(life, registry);
  assert.deepEqual(a, b);
  for (const value of Object.values(a)) assert.equal(Number.isInteger(value) && value >= 0 && value <= 100, true);
  assert.ok(a.health > 70);
  assert.ok(a.relationship > 70);
});

test('unknown function and dependency cycle fail closed', () => {
  const life = sampleLife();
  assert.throws(() => calculateDerivedMetrics(life, { metrics: { bad: { formula:'unknownFn(1)' } } }), /Unknown metric function/);
  assert.throws(() => calculateDerivedMetrics(life, { metrics: { a:{formula:'b'}, b:{formula:'a'} } }), /dependency cycle/);
});

test('ending selection uses priority then score then id', () => {
  const life = sampleLife();
  const metrics = calculateDerivedMetrics(life, registry);
  const ending = resolveEnding(life, metrics, endings);
  assert.equal(ending.deathCause, 'old_age');
  assert.ok(typeof ending.primaryEnding === 'string');
  assert.ok(ending.lifeScore >= 0 && ending.lifeScore <= 100);
});

test('hidden ending wins by priority and finalize stores immutable result', () => {
  const life = sampleLife();
  life.history.flags.hidden_ending_unlocked = true;
  const metrics = calculateDerivedMetrics(life, registry);
  const finalized = finalizeLife(life, metrics, endings);
  assert.equal(finalized.alive, false);
  assert.equal(finalized.ending.primaryEnding, 'hidden_rare');
  assert.deepEqual(finalized.derivedMetrics, metrics);
  assert.equal(life.alive, true);
});

test('unknown ending metric fails instead of defaulting to zero', () => {
  const life = sampleLife();
  const bad = structuredClone(endings);
  bad.primaryEndings[0].conditions.metricMin.unknownMetric = 1;
  const metrics = calculateDerivedMetrics(life, registry);
  assert.throws(() => resolveEnding(life, metrics, bad), /Unknown ending metric/);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
