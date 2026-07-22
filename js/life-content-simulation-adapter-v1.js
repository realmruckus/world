import { readFileSync } from 'node:fs';
import { composeLifeIdentity, validateJsonSchema, validateLifeContentPackage } from './life-content-contract-v1.js';
import { runLife, summarizeBatch } from './life-simulation-v3.js';

export const LIFE_CONTENT_SIMULATION_POLICY_VERSION = 'rr-120-adapter-v1';
export const LIFE_CONTENT_SIMULATION_CONTENT_VERSION = 'life-engine-content-v3';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const contractContent = readJson('../data/fixtures/life-content-contract-v1.json');
const reportSchema = readJson('../schemas/life-content-simulation-report-v1.schema.json');
const formalContent = {
  annualEvents: readJson('../data/life-events-annual-v3.json'),
  romanceEvents: [
    ...readJson('../data/life-events-romance-v3.json'),
    ...readJson('../data/life-events-romance-resolution-v3.json'),
  ],
  interruptEvents: readJson('../data/life-events-interrupt-v3.json'),
  relationshipRules: readJson('../data/life-relationship-rules.json'),
  metricRegistry: readJson('../data/life-derived-metrics.json'),
  metricDsl: readJson('../data/life-metric-dsl.json'),
  endingRules: readJson('../data/life-ending-rules.json'),
};

validateLifeContentPackage(contractContent);

const identityCombinations = contractContent.families.flatMap((family, familyIndex) =>
  contractContent.genders.flatMap((gender, genderIndex) =>
    contractContent.zodiacSigns.map((zodiac, zodiacIndex) => composeLifeIdentity(contractContent, {
      familyId: family.id,
      genderId: gender.id,
      zodiacSignId: zodiac.id,
    })),
  ),
);
const originById = new Map(contractContent.origins.map((origin) => [origin.id, origin]));

function initializeFromContract(life, seed, seedStart) {
  const index = Math.abs(seed - seedStart) % identityCombinations.length;
  const identity = identityCombinations[index];
  const origin = originById.get(identity.originId);
  life.identity = {
    ...life.identity,
    familyId: identity.familyId,
    originId: identity.originId,
    genderId: identity.genderId,
    zodiacSignId: identity.zodiacSignId,
    parentNpcIds: [...identity.parentNpcIds],
    parentJobIds: [...identity.parentJobIds],
    originResources: structuredClone(origin.resources),
  };
  life.finance = {
    ...life.finance,
    ...structuredClone(origin.finance),
  };
  life.relationships = identity.parentNpcIds.map((npcId) => ({
    id: npcId,
    name: npcId,
    role: 'family',
    status: 'active',
    dimensions: {
      attraction: 0,
      love: origin.resources.familySupport,
      trust: origin.resources.familySupport,
      conflict: 100 - origin.resources.familySupport,
      dependence: 0,
      respect: origin.resources.familySupport,
      passion: 0,
      commitment: origin.resources.familySupport,
    },
    relationshipStartedAtWeeks: 0,
    statusChangedAtWeeks: 0,
    sharedExperiences: [],
  }));
  return life;
}

function eventOverlapsBand(event, band) {
  const min = Number.isInteger(event.conditions?.age?.min) ? event.conditions.age.min : 0;
  const max = Number.isInteger(event.conditions?.age?.max) ? event.conditions.age.max : 120;
  return min <= band.maxAge && max >= band.minAge;
}

function ageBandCoverage(simulationSummary) {
  const allEvents = [...formalContent.annualEvents, ...formalContent.romanceEvents, ...formalContent.interruptEvents];
  return Object.fromEntries(contractContent.ageBands.map((band) => {
    const matching = allEvents.filter((event) => eventOverlapsBand(event, band));
    const observed = matching.filter((event) => Number(simulationSummary.eventFrequency[event.id] || 0) > 0);
    return [band.id, {
      declaredEventCount: matching.length,
      observedUniqueEventCount: observed.length,
      observedOccurrenceCount: observed.reduce((sum, event) => sum + simulationSummary.eventFrequency[event.id], 0),
    }];
  }));
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function addMap(target, source) {
  for (const [key, value] of Object.entries(source || {})) target[key] = (target[key] || 0) + value;
}

export function mergeSimulationReports(reports, requestedLifeCount, seedStart) {
  if (!Array.isArray(reports) || reports.length === 0) throw new Error('Simulation reports are required');
  for (const report of reports) validateSimulationReport(report);
  const executedLifeCount = reports.reduce((sum, report) => sum + report.executedLifeCount, 0);
  const failedLifeCount = reports.reduce((sum, report) => sum + report.failedLifeCount, 0);
  const lifeCount = reports.reduce((sum, report) => sum + report.simulationSummary.lifeCount, 0);
  const mapFields = [
    'endingDistribution', 'deathCauseDistribution', 'eventFrequency', 'careerDistribution',
    'relationshipStatusDistribution', 'relationshipPathDistribution', 'achievementFrequency',
  ];
  const simulationSummary = {};
  for (const field of mapFields) {
    simulationSummary[field] = {};
    for (const report of reports) addMap(simulationSummary[field], report.simulationSummary[field]);
  }
  const weightedFields = [
    'averageTurns', 'averageLifeScore', 'eventCoverageRate', 'repeatRate', 'romanceStallRate',
    'invalidChoiceRate', 'achievementUnlockRate',
  ];
  for (const field of weightedFields) {
    simulationSummary[field] = reports.reduce(
      (sum, report) => sum + Number(report.simulationSummary[field] || 0) * report.simulationSummary.lifeCount,
      0,
    ) / Math.max(1, lifeCount);
  }
  const metricIds = new Set(reports.flatMap((report) => Object.keys(report.simulationSummary.metricAverages || {})));
  simulationSummary.metricAverages = Object.fromEntries([...metricIds].sort().map((id) => [id, Math.round(
    reports.reduce((sum, report) => sum + Number(report.simulationSummary.metricAverages[id] || 0) * report.simulationSummary.lifeCount, 0)
      / Math.max(1, lifeCount),
  )]));
  simulationSummary.lifeCount = lifeCount;
  simulationSummary.uniqueEventCount = Object.keys(simulationSummary.eventFrequency).length;

  const ageBandEventCoverage = {};
  for (const report of reports) {
    for (const [id, coverage] of Object.entries(report.ageBandEventCoverage)) {
      const target = ageBandEventCoverage[id] ||= { declaredEventCount: 0, observedUniqueEventCount: 0, observedOccurrenceCount: 0 };
      target.declaredEventCount = Math.max(target.declaredEventCount, coverage.declaredEventCount);
      target.observedUniqueEventCount = Math.max(target.observedUniqueEventCount, coverage.observedUniqueEventCount);
      target.observedOccurrenceCount += coverage.observedOccurrenceCount;
    }
  }
  const errorSummary = {};
  for (const report of reports) addMap(errorSummary, report.errorSummary);
  const report = {
    schemaVersion: 1,
    status: failedLifeCount === 0 ? 'completed' : executedLifeCount === 0 ? 'failed' : 'completed_with_errors',
    requestedLifeCount,
    executedLifeCount,
    failedLifeCount,
    seed: { strategy: 'consecutive_integer', start: seedStart, end: seedStart + requestedLifeCount - 1 },
    policyVersion: reports[0].policyVersion,
    contentVersion: reports[0].contentVersion,
    contractVersion: reports[0].contractVersion,
    ageBandEventCoverage,
    relationshipPathDistribution: simulationSummary.relationshipPathDistribution,
    endingDistribution: simulationSummary.endingDistribution,
    errorSummary,
    simulationSummary,
  };
  validateSimulationReport(report);
  return report;
}

function deterministicChoice(event, life) {
  const mode = Math.abs(life.seed) % 4;
  if (mode === 0) return event.choices[0].id;
  if (mode === 1) return event.choices.at(-1).id;
  let hash = (life.seed ^ life.clock.totalWeeks) >>> 0;
  for (const character of event.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return event.choices[hash % event.choices.length].id;
}

export function runContractSimulation(options = {}) {
  const requestedLifeCount = options.requestedLifeCount ?? 10000;
  const seedStart = options.seedStart ?? 119000;
  if (!Number.isInteger(requestedLifeCount) || requestedLifeCount < 1) throw new Error('requestedLifeCount must be a positive integer');
  if (!Number.isInteger(seedStart)) throw new Error('seedStart must be an integer');
  const executeLife = options.executeLife ?? runLife;
  if (typeof executeLife !== 'function') throw new Error('executeLife must be a function');

  const results = [];
  const errorSummary = {};
  const policy = {
    maxAgeYears: 82,
    choose: deterministicChoice,
    initialize(life, seed) { return initializeFromContract(life, seed, seedStart); },
  };

  for (let index = 0; index < requestedLifeCount; index += 1) {
    try {
      results.push(executeLife(seedStart + index, policy, formalContent));
    } catch (error) {
      increment(errorSummary, error instanceof Error ? error.message : String(error));
    }
  }

  const failedLifeCount = requestedLifeCount - results.length;
  const simulationSummary = results.length ? summarizeBatch(results, formalContent) : {
    lifeCount: 0,
    endingDistribution: {},
    deathCauseDistribution: {},
    eventFrequency: {},
    careerDistribution: {},
    relationshipStatusDistribution: {},
    relationshipPathDistribution: {},
    achievementFrequency: {},
    metricAverages: {},
    averageTurns: 0,
    averageLifeScore: 0,
    uniqueEventCount: 0,
    eventCoverageRate: 0,
    repeatRate: 0,
    romanceStallRate: 0,
    invalidChoiceRate: 0,
    achievementUnlockRate: 0,
  };
  const report = {
    schemaVersion: 1,
    status: failedLifeCount === 0 ? 'completed' : results.length === 0 ? 'failed' : 'completed_with_errors',
    requestedLifeCount,
    executedLifeCount: results.length,
    failedLifeCount,
    seed: {
      strategy: 'consecutive_integer',
      start: seedStart,
      end: seedStart + requestedLifeCount - 1,
    },
    policyVersion: LIFE_CONTENT_SIMULATION_POLICY_VERSION,
    contentVersion: LIFE_CONTENT_SIMULATION_CONTENT_VERSION,
    contractVersion: contractContent.schemaVersion,
    ageBandEventCoverage: ageBandCoverage(simulationSummary),
    relationshipPathDistribution: simulationSummary.relationshipPathDistribution,
    endingDistribution: simulationSummary.endingDistribution,
    errorSummary,
    simulationSummary,
  };
  validateSimulationReport(report);
  return report;
}

export function validateSimulationReport(report) {
  validateJsonSchema(report, reportSchema);
  if (report.executedLifeCount + report.failedLifeCount !== report.requestedLifeCount) {
    throw new Error('Simulation report counts must sum to requestedLifeCount');
  }
  const expectedStatus = report.failedLifeCount === 0
    ? 'completed'
    : report.executedLifeCount === 0 ? 'failed' : 'completed_with_errors';
  if (report.status !== expectedStatus) throw new Error(`Simulation report status must be ${expectedStatus}`);
  if (report.simulationSummary.lifeCount !== report.executedLifeCount) {
    throw new Error('Simulation summary lifeCount must equal executedLifeCount');
  }
  const errorCount = Object.values(report.errorSummary).reduce((sum, count) => sum + count, 0);
  if (errorCount !== report.failedLifeCount) throw new Error('Simulation errorSummary must equal failedLifeCount');
  return true;
}
