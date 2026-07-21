import { readFile } from 'node:fs/promises';

export const LIFE_CONTENT_SCHEMA_VERSION = 1;
export const LIFE_FINANCE_FIELDS = ['income', 'cash', 'assets', 'debt', 'fixedExpenses'];
export const LIFE_RELATIONSHIP_PATH = ['potential', 'dating', 'exclusive', 'cohabiting', 'engaged', 'married'];

const COLLECTIONS = [
  'origins', 'families', 'parentJobs', 'genders', 'zodiacSigns', 'ageBands', 'events',
  'npcs', 'relationshipStates', 'relationshipTransitions', 'metrics', 'endings',
];

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} object is required`);
}

function assertCollection(content, key) {
  if (!Array.isArray(content[key]) || content[key].length === 0) throw new Error(`${key} fixtures are required`);
  const ids = content[key].map((item) => item?.id);
  if (ids.some((id) => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
    throw new Error(`Invalid or duplicate ID in ${key}`);
  }
}

function ids(content, key) {
  return new Set(content[key].map((item) => item.id));
}

function assertFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid ${label}`);
}

function validateOrigins(content) {
  const familyIds = ids(content, 'families');
  const genderIds = ids(content, 'genders');
  const zodiacIds = ids(content, 'zodiacSigns');
  for (const origin of content.origins) {
    if (!familyIds.has(origin.familyId)) throw new Error(`Unknown Family reference: ${origin.familyId}`);
    if (!genderIds.has(origin.genderId)) throw new Error(`Unknown Gender reference: ${origin.genderId}`);
    if (!zodiacIds.has(origin.zodiacSignId)) throw new Error(`Unknown Zodiac reference: ${origin.zodiacSignId}`);
    assertObject(origin.resources, 'Origin resources');
    for (const key of ['wealth', 'education', 'familySupport', 'socialConnections', 'healthEnvironment']) {
      assertFiniteNonNegative(origin.resources[key], `origin resource: ${key}`);
    }
    assertObject(origin.finance, 'Origin finance');
    for (const key of LIFE_FINANCE_FIELDS) {
      if (!(key in origin.finance)) throw new Error(`Missing finance field: ${key}`);
      assertFiniteNonNegative(origin.finance[key], `finance field: ${key}`);
    }
  }
}

function validateFamiliesAndParents(content) {
  const originIds = ids(content, 'origins');
  const npcById = new Map(content.npcs.map((npc) => [npc.id, npc]));
  const parentJobIds = ids(content, 'parentJobs');
  for (const family of content.families) {
    if (!originIds.has(family.originId)) throw new Error(`Unknown Origin reference: ${family.originId}`);
    if (!Array.isArray(family.parentNpcIds) || family.parentNpcIds.length < 1) throw new Error('Family parentNpcIds are required');
    for (const npcId of family.parentNpcIds) {
      const npc = npcById.get(npcId);
      if (!npc) throw new Error(`Unknown NPC reference: ${npcId}`);
      if (npc.role !== 'parent') throw new Error(`Family NPC is not a parent: ${npcId}`);
      if (!parentJobIds.has(npc.parentJobId)) throw new Error(`Unknown Parent Job reference: ${npc.parentJobId}`);
    }
  }
  for (const npc of content.npcs) {
    if (npc.role === 'parent' && !parentJobIds.has(npc.parentJobId)) {
      throw new Error(`Unknown Parent Job reference: ${npc.parentJobId}`);
    }
  }
}

function validateAgeBandCoverage(content) {
  const covered = new Set();
  const ageBandIds = ids(content, 'ageBands');
  for (const event of content.events) {
    if (!ageBandIds.has(event.ageBandId)) throw new Error(`Unknown age band reference: ${event.ageBandId}`);
    covered.add(event.ageBandId);
  }
  for (const ageBand of content.ageBands) {
    if (!covered.has(ageBand.id)) throw new Error(`Missing event coverage for age band: ${ageBand.id}`);
  }
}

function validateRelationshipReachability(content) {
  const states = ids(content, 'relationshipStates');
  const reachable = new Set(['potential']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const transition of content.relationshipTransitions) {
      if (!states.has(transition.from) || !states.has(transition.to)) throw new Error('Unknown relationship state reference');
      if (reachable.has(transition.from) && !reachable.has(transition.to)) {
        reachable.add(transition.to);
        changed = true;
      }
    }
  }
  for (const state of LIFE_RELATIONSHIP_PATH) {
    if (!reachable.has(state)) throw new Error(`Unreachable relationship state: ${state}`);
  }
}

function validateEndingMetrics(content) {
  const metricIds = ids(content, 'metrics');
  for (const ending of content.endings) {
    if (!Array.isArray(ending.metricIds) || ending.metricIds.length === 0) throw new Error('Ending metricIds are required');
    for (const metricId of ending.metricIds) {
      if (!metricIds.has(metricId)) throw new Error(`Unknown Ending Metric reference: ${metricId}`);
    }
  }
}

function validateSimulationReport(report) {
  assertObject(report, 'Simulation report');
  if (report.schemaVersion !== 1 || report.status !== 'not_run') throw new Error('Invalid Simulation report skeleton');
  if (report.requestedLifeCount !== 10000 || report.executedLifeCount !== 0) throw new Error('Invalid Simulation report counts');
  for (const key of ['ageBandEventCoverage', 'relationshipPathDistribution', 'endingDistribution']) {
    assertObject(report[key], `Simulation report ${key}`);
  }
}

export function validateLifeContentPackage(content) {
  assertObject(content, 'Life content');
  if (content.schemaVersion !== LIFE_CONTENT_SCHEMA_VERSION) throw new Error('Unsupported life content schemaVersion');
  if (!['fixture', 'draft'].includes(content.status)) throw new Error('Fixture status is required');
  for (const key of COLLECTIONS) assertCollection(content, key);
  validateOrigins(content);
  validateFamiliesAndParents(content);
  validateAgeBandCoverage(content);
  validateRelationshipReachability(content);
  validateEndingMetrics(content);
  validateSimulationReport(content.simulationReport);
  return true;
}

export function parseLifeContentPackage(text) {
  let content;
  try {
    content = JSON.parse(text);
  } catch (error) {
    throw new Error('Invalid life content JSON', { cause: error });
  }
  validateLifeContentPackage(content);
  return structuredClone(content);
}

export async function loadLifeContentPackage(source) {
  return parseLifeContentPackage(await readFile(source, 'utf8'));
}
