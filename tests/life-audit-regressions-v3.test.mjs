import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createLifeStateV3 } from '../js/life-engine-v3.js';
import { calculateDerivedMetrics } from '../js/life-metric-engine-v3.js';

const registry = JSON.parse(fs.readFileSync(new URL('../data/life-derived-metrics.json', import.meta.url), 'utf8'));
const dsl = JSON.parse(fs.readFileSync(new URL('../data/life-metric-dsl.json', import.meta.url), 'utf8'));
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function relationship(status) {
  return {
    id:'partner-1', name:'林遥', role:'partner_candidate', status,
    dimensions:{ attraction:62, love:22, trust:35, conflict:5, dependence:8, respect:45, passion:38, commitment:12 },
    relationshipStartedAtWeeks:988, statusChangedAtWeeks:1040, sharedExperiences:[],
  };
}

test('ended partner relationships do not provide current partner support', () => {
  const life = createLifeStateV3({ seed:1 });
  life.relationships.push(relationship('no_contact'));
  const metrics = calculateDerivedMetrics(life, registry, dsl);
  assert.equal(metrics.partnerSupport, 0);
});

test('current recurring income provides stability when old timeline rows lack accounting snapshots', () => {
  const life = createLifeStateV3({ seed:2 });
  life.finance.income = 76000;
  life.history.timeline.push({ timeScale:'year', eventId:'annual_work_growth' });
  const metrics = calculateDerivedMetrics(life, registry, dsl);
  assert.ok(metrics.incomeStability > 0);
});

test('strong family and partner support are not capped by a missing friendship domain', () => {
  const life = createLifeStateV3({ seed:3 });
  life.relationships.push({
    id:'family-1', name:'家人', role:'family', status:'active',
    dimensions:{ attraction:0,love:90,trust:88,conflict:5,dependence:30,respect:85,passion:0,commitment:90 },
    relationshipStartedAtWeeks:0,statusChangedAtWeeks:0,sharedExperiences:[],
  });
  life.relationships.push({
    id:'partner-1', name:'伴侣', role:'partner_candidate', status:'married',
    dimensions:{ attraction:80,love:92,trust:90,conflict:8,dependence:45,respect:90,passion:75,commitment:95 },
    relationshipStartedAtWeeks:1000,statusChangedAtWeeks:2000,sharedExperiences:[],
  });
  const metrics = calculateDerivedMetrics(life, registry, dsl);
  assert.ok(metrics.relationship > 70);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
