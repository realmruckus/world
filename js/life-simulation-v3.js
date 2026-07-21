import { applyCommandsAtomic, createLifeStateV3 } from './life-engine-v3.js';
import { runAnnualTurn } from './life-event-engine-v3.js';
import { runRomanceTurn } from './life-romance-engine-v3.js';
import { calculateDerivedMetrics } from './life-metric-engine-v3.js';
import { finalizeLife } from './life-ending-engine-v3.js';

const deepClone = (value) => structuredClone(value);
const ageYears = (life) => Math.floor(life.clock.totalWeeks / 52);

function assertContent(content) {
  const requiredArrays = ['annualEvents','romanceEvents','interruptEvents'];
  for (const key of requiredArrays) if (!Array.isArray(content?.[key])) throw new Error(`Simulation content requires ${key}`);
  for (const key of ['relationshipRules','metricRegistry','metricDsl','endingRules']) {
    if (!content?.[key] || typeof content[key] !== 'object') throw new Error(`Simulation content requires ${key}`);
  }
}

function chooseForPolicy(policy, event, life) {
  if (!event?.choices?.length) throw new Error(`Event has no choices: ${event?.id || 'unknown'}`);
  const choiceId = typeof policy?.choose === 'function'
    ? policy.choose(deepClone(event), deepClone(life))
    : [...event.choices].sort((a, b) => a.id.localeCompare(b.id))[0].id;
  if (!event.choices.some((choice) => choice.id === choiceId)) throw new Error(`Policy returned unknown choice: ${choiceId}`);
  return choiceId;
}

function createInitialLife(seed, policy) {
  const base = createLifeStateV3({
    id: `simulation-life-${seed}`,
    seed,
    name: policy?.name || `模拟者 ${seed}`,
    birthYear: policy?.birthYear || 2000,
    region: policy?.region || '普通城市',
    createdAt: '1970-01-01T00:00:00.000Z',
  });
  if (typeof policy?.initialize === 'function') {
    const initialized = policy.initialize(deepClone(base), seed);
    if (!initialized || typeof initialized !== 'object') throw new Error('Policy initialize must return a LifeState');
    return initialized;
  }
  return base;
}

function shouldFinish(life, policy) {
  const maxAgeYears = Number.isInteger(policy?.maxAgeYears) ? policy.maxAgeYears : 90;
  return life.alive === false || life.health.health <= 0 || ageYears(life) >= maxAgeYears;
}

function eventIdsFromTimeline(life) {
  return life.history.timeline.map((entry) => entry.eventId).filter(Boolean);
}

function summarizeLife(life, seed, turns) {
  const eventIds = eventIdsFromTimeline(life);
  return {
    seed,
    turns,
    ageYears: ageYears(life),
    primaryEnding: life.ending?.primaryEnding || null,
    deathCause: life.ending?.deathCause || null,
    lifeScore: life.ending?.lifeScore || 0,
    eventIds,
    uniqueEventCount: new Set(eventIds).size,
    careerId: life.career.id,
    relationshipStatuses: life.relationships.map((item) => item.status).sort(),
    metrics: deepClone(life.derivedMetrics || {}),
  };
}

export function runLife(seed, policy = {}, content) {
  if (!Number.isInteger(seed)) throw new Error('Simulation seed must be an integer');
  assertContent(content);
  let life = createInitialLife(seed, policy);
  const maxTurns = Number.isInteger(policy.maxTurns) ? policy.maxTurns : 10000;
  if (maxTurns < 1) throw new Error('Simulation maxTurns must be positive');
  let turns = 0;

  while (!shouldFinish(life, policy)) {
    if (turns >= maxTurns) throw new Error(`Simulation turn budget exceeded at seed ${seed}`);
    if (typeof policy.beforeTurn === 'function') {
      const prepared = policy.beforeTurn(deepClone(life), turns, content);
      if (prepared) life = prepared;
    }
    const choose = (event, state) => chooseForPolicy(policy, event, state);
    if (life.clock.stage === 'romance') {
      life = runRomanceTurn(
        life,
        content.romanceEvents,
        content.interruptEvents,
        choose,
        content.relationshipRules,
      );
    } else {
      life = runAnnualTurn(
        life,
        content.annualEvents,
        choose,
        applyCommandsAtomic,
        { relationshipRules: content.relationshipRules },
      );
    }
    turns += 1;
  }

  if (life.alive !== false) {
    const metrics = calculateDerivedMetrics(life, content.metricRegistry, content.metricDsl);
    life = finalizeLife(life, metrics, content.endingRules);
  }
  return { life, summary: summarizeLife(life, seed, turns) };
}

function increment(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount;
}

export function summarizeBatch(results, content = null) {
  if (!Array.isArray(results) || !results.length) throw new Error('Batch results must be a non-empty array');
  const endingDistribution = {};
  const deathCauseDistribution = {};
  const eventFrequency = {};
  const careerDistribution = {};
  const relationshipStatusDistribution = {};
  const metricTotals = {};
  let totalTurns = 0;
  let totalEvents = 0;
  let totalUniqueEventsPerLife = 0;
  let totalScore = 0;

  for (const result of results) {
    const summary = result?.summary;
    if (!summary?.primaryEnding) throw new Error('Invalid life result in batch');
    increment(endingDistribution, summary.primaryEnding);
    increment(deathCauseDistribution, summary.deathCause || 'unknown');
    increment(careerDistribution, summary.careerId || 'none');
    for (const status of summary.relationshipStatuses || []) increment(relationshipStatusDistribution, status);
    for (const eventId of summary.eventIds || []) increment(eventFrequency, eventId);
    for (const [id, value] of Object.entries(summary.metrics || {})) metricTotals[id] = (metricTotals[id] || 0) + Number(value);
    totalTurns += summary.turns;
    totalEvents += (summary.eventIds || []).length;
    totalUniqueEventsPerLife += summary.uniqueEventCount || 0;
    totalScore += summary.lifeScore || 0;
  }

  const lifeCount = results.length;
  const uniqueEventCount = Object.keys(eventFrequency).length;
  const declaredEventCount = content
    ? new Set([...(content.annualEvents || []), ...(content.romanceEvents || []), ...(content.interruptEvents || [])].map((event) => event.id)).size
    : uniqueEventCount;
  const metricAverages = Object.fromEntries(Object.entries(metricTotals).map(([id, total]) => [id, Math.round(total / lifeCount)]));

  return {
    lifeCount,
    endingDistribution,
    deathCauseDistribution,
    eventFrequency,
    careerDistribution,
    relationshipStatusDistribution,
    metricAverages,
    averageTurns: totalTurns / lifeCount,
    averageLifeScore: totalScore / lifeCount,
    uniqueEventCount,
    eventCoverageRate: declaredEventCount ? uniqueEventCount / declaredEventCount : 0,
    repeatRate: totalEvents ? 1 - (totalUniqueEventsPerLife / totalEvents) : 0,
  };
}

export function runBatch(count, seedStart, policy = {}, content) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Batch count must be a positive integer');
  if (!Number.isInteger(seedStart)) throw new Error('Batch seedStart must be an integer');
  assertContent(content);
  const results = [];
  for (let index = 0; index < count; index += 1) results.push(runLife(seedStart + index, policy, content));
  return { results, report: summarizeBatch(results, content) };
}
