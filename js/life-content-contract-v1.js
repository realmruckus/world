import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export const LIFE_CONTENT_SCHEMA_VERSION = 1;
export const LIFE_FINANCE_FIELDS = ['income', 'cash', 'assets', 'debt', 'fixedExpenses'];
export const LIFE_RELATIONSHIP_STATES = [
  'potential', 'dating', 'exclusive', 'cohabiting', 'engaged', 'married',
  'paused', 'broken_up', 'no_contact',
];

const COLLECTIONS = [
  'origins', 'families', 'parentJobs', 'genders', 'zodiacSigns', 'ageBands', 'events',
  'npcs', 'relationshipStates', 'relationshipTransitions', 'metrics', 'endings',
];
const schema = JSON.parse(readFileSync(new URL('../schemas/life-content-contract-v1.schema.json', import.meta.url), 'utf8'));

function schemaError(path, keyword, detail = '') {
  throw new Error(`Schema validation failed at ${path}: ${keyword}${detail ? ` ${detail}` : ''}`);
}

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported Schema ref: ${ref}`);
  return ref.slice(2).split('/').reduce((node, key) => node?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], root);
}

function valueType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

function validateSchemaNode(value, definition, path, root) {
  if (definition.$ref) return validateSchemaNode(value, resolveRef(root, definition.$ref), path, root);
  if ('const' in definition && value !== definition.const) schemaError(path, 'const', JSON.stringify(definition.const));
  if (definition.enum && !definition.enum.includes(value)) schemaError(path, 'enum', definition.enum.join('|'));

  if (definition.type) {
    const matches = definition.type === 'integer'
      ? Number.isInteger(value)
      : definition.type === 'number'
        ? typeof value === 'number' && Number.isFinite(value)
        : definition.type === 'object'
          ? value !== null && typeof value === 'object' && !Array.isArray(value)
          : valueType(value) === definition.type;
    if (!matches) schemaError(path, definition.type === 'number' ? 'finite number' : `type ${definition.type}`);
  }

  if (typeof value === 'string' && definition.pattern && !new RegExp(definition.pattern).test(value)) {
    schemaError(path, 'pattern', definition.pattern);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) schemaError(path, 'finite number');
    if (definition.minimum != null && value < definition.minimum) schemaError(path, 'minimum', definition.minimum);
    if (definition.maximum != null && value > definition.maximum) schemaError(path, 'maximum', definition.maximum);
  }
  if (Array.isArray(value)) {
    if (definition.minItems != null && value.length < definition.minItems) schemaError(path, 'minItems', definition.minItems);
    if (definition.maxItems != null && value.length > definition.maxItems) schemaError(path, 'maxItems', definition.maxItems);
    if (definition.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) schemaError(path, 'uniqueItems');
    if (definition.items) value.forEach((item, index) => validateSchemaNode(item, definition.items, `${path}[${index}]`, root));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of definition.required || []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) schemaError(path, 'required', key);
    }
    const properties = definition.properties || {};
    if (definition.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(properties, key)) schemaError(`${path}.${key}`, 'additional property');
    }
    for (const [key, child] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) validateSchemaNode(value[key], child, `${path}.${key}`, root);
    }
  }
  return true;
}

export function validateLifeContentSchema(content) {
  return validateSchemaNode(content, schema, '$', schema);
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} object is required`);
}

function assertCollection(content, key) {
  const ids = content[key].map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Invalid or duplicate ID in ${key}`);
}

function ids(content, key) {
  return new Set(content[key].map((item) => item.id));
}

function validateOrigins(content) {
  const familyIds = ids(content, 'families');
  const originsByFamily = new Map();
  for (const origin of content.origins) {
    if (!familyIds.has(origin.familyId)) throw new Error(`Unknown Family reference: ${origin.familyId}`);
    if (originsByFamily.has(origin.familyId)) throw new Error(`Family has multiple Origins; one-to-one mapping required: ${origin.familyId}`);
    originsByFamily.set(origin.familyId, origin.id);
  }
  for (const familyId of familyIds) {
    if (!originsByFamily.has(familyId)) throw new Error(`Family has no Origin in one-to-one mapping: ${familyId}`);
  }
}

function validateFamiliesAndParents(content) {
  const npcById = new Map(content.npcs.map((npc) => [npc.id, npc]));
  const parentJobIds = ids(content, 'parentJobs');
  const ownerByNpc = new Map();
  for (const family of content.families) {
    for (const npcId of family.parentNpcIds) {
      const npc = npcById.get(npcId);
      if (!npc) throw new Error(`Unknown NPC reference: ${npcId}`);
      if (npc.role !== 'parent') throw new Error(`Family NPC is not a parent: ${npcId}`);
      if (!parentJobIds.has(npc.parentJobId)) throw new Error(`Unknown Parent Job reference: ${npc.parentJobId}`);
      if (ownerByNpc.has(npcId)) throw new Error(`Parent NPC shared by multiple Families: ${npcId}`);
      ownerByNpc.set(npcId, family.id);
    }
  }
  for (const npc of content.npcs) {
    if (npc.role === 'parent' && !parentJobIds.has(npc.parentJobId)) throw new Error(`Unknown Parent Job reference: ${npc.parentJobId}`);
    if (npc.role === 'parent' && !ownerByNpc.has(npc.id)) throw new Error(`Parent NPC is not owned by a Family: ${npc.id}`);
  }
}

function validateAgeBands(content) {
  const ordered = [...content.ageBands].sort((a, b) => a.minAge - b.minAge || a.id.localeCompare(b.id));
  for (let index = 0; index < ordered.length; index += 1) {
    const band = ordered[index];
    if (band.minAge > band.maxAge) throw new Error(`Age band minAge must be <= maxAge: ${band.id}`);
    if (index === 0 && band.minAge !== 0) throw new Error(`Age band gap before: ${band.id}`);
    if (index > 0) {
      const previous = ordered[index - 1];
      if (band.minAge <= previous.maxAge) throw new Error(`Age band overlap: ${previous.id}/${band.id}`);
      if (band.minAge !== previous.maxAge + 1) throw new Error(`Age band gap: ${previous.id}/${band.id}`);
    }
  }

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
  for (const required of LIFE_RELATIONSHIP_STATES) if (!states.has(required)) throw new Error(`Missing relationship state: ${required}`);
  const kinds = new Set();
  const reachable = new Set(['potential']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const transition of content.relationshipTransitions) {
      if (!states.has(transition.from) || !states.has(transition.to)) throw new Error('Unknown relationship state reference');
      kinds.add(transition.kind);
      if (reachable.has(transition.from) && !reachable.has(transition.to)) {
        reachable.add(transition.to);
        changed = true;
      }
    }
  }
  for (const required of ['pause', 'crisis', 'recovery', 'breakup', 'no_contact']) {
    if (!kinds.has(required)) throw new Error(`Missing relationship ${required} path`);
  }
  for (const state of LIFE_RELATIONSHIP_STATES) if (!reachable.has(state)) throw new Error(`Unreachable relationship state: ${state}`);
}

function validateEndingMetrics(content) {
  const metricIds = ids(content, 'metrics');
  for (const ending of content.endings) {
    for (const metricId of ending.metricIds) {
      if (!metricIds.has(metricId)) throw new Error(`Unknown Ending Metric reference: ${metricId}`);
    }
  }
}

function validateLegacyFailureMessages(content) {
  if (Array.isArray(content.origins)) {
    for (const origin of content.origins) {
      for (const key of LIFE_FINANCE_FIELDS) {
        if (origin?.finance && !Object.prototype.hasOwnProperty.call(origin.finance, key)) throw new Error(`Missing finance field: ${key}`);
      }
    }
  }
  const parentJobIds = new Set((content.parentJobs || []).map((job) => job?.id));
  for (const npc of content.npcs || []) {
    if (npc?.role === 'parent' && !parentJobIds.has(npc.parentJobId)) throw new Error(`Unknown Parent Job reference: ${npc.parentJobId}`);
  }
  const npcIds = new Set((content.npcs || []).map((npc) => npc?.id));
  for (const family of content.families || []) {
    for (const npcId of family?.parentNpcIds || []) if (!npcIds.has(npcId)) throw new Error(`Unknown NPC reference: ${npcId}`);
  }
}

export function validateLifeContentPackage(content) {
  assertObject(content, 'Life content');
  if (content.schemaVersion !== LIFE_CONTENT_SCHEMA_VERSION) throw new Error('Unsupported life content schemaVersion');
  if (!['fixture', 'draft'].includes(content.status)) throw new Error('Fixture status is required');
  validateLegacyFailureMessages(content);
  validateLifeContentSchema(content);
  for (const key of COLLECTIONS) assertCollection(content, key);
  validateOrigins(content);
  validateFamiliesAndParents(content);
  validateAgeBands(content);
  validateRelationshipReachability(content);
  validateEndingMetrics(content);
  return true;
}

export function composeLifeIdentity(content, selection) {
  validateLifeContentPackage(content);
  assertObject(selection, 'Identity selection');
  const family = content.families.find((item) => item.id === selection.familyId);
  if (!family) throw new Error(`Unknown Family: ${selection.familyId}`);
  if (!ids(content, 'genders').has(selection.genderId)) throw new Error(`Unknown Gender: ${selection.genderId}`);
  if (!ids(content, 'zodiacSigns').has(selection.zodiacSignId)) throw new Error(`Unknown Zodiac: ${selection.zodiacSignId}`);
  const origin = content.origins.find((item) => item.familyId === family.id);
  const npcById = new Map(content.npcs.map((npc) => [npc.id, npc]));
  return {
    familyId: family.id,
    originId: origin.id,
    genderId: selection.genderId,
    zodiacSignId: selection.zodiacSignId,
    parentNpcIds: [...family.parentNpcIds],
    parentJobIds: family.parentNpcIds.map((npcId) => npcById.get(npcId).parentJobId),
  };
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
