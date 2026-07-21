export const LIFE_SAVE_KEY_V3 = 'realmruckus.world.life.v3';
export const RELATIONSHIP_DIMENSIONS = ['attraction','love','trust','conflict','dependence','respect','passion','commitment'];

const SCORE_PATHS = new Set([
  'body.fitness','mind.smarts','mind.empathy','mind.stress','mind.happiness','mind.discipline',
  'career.freeTime','finance.reputation','health.health',
]);
const RESOURCE_PATHS = new Set([
  'career.level','finance.assets','finance.debt','finance.businessAssets','finance.income','finance.cash',
]);
const STAGES = new Set(['life','romance']);
const RELATIONSHIP_STATUSES = new Set([
  'active','estranged','deceased','potential','dating','exclusive','cohabiting','engaged','married','paused','broken_up','no_contact',
]);

export function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) throw new Error('Numeric value must be finite');
  return Math.max(min, Math.min(max, value));
}

export function deriveClock(totalWeeks) {
  if (!Number.isInteger(totalWeeks) || totalWeeks < 0) throw new Error('totalWeeks must be a non-negative integer');
  return { ageYears: Math.floor(totalWeeks / 52), weekOfYear: totalWeeks % 52 };
}

export function durationToWeeks(duration) {
  if (!duration || !Number.isInteger(duration.amount) || duration.amount < 0) throw new Error('Invalid duration amount');
  if (duration.unit === 'year') return duration.amount * 52;
  if (duration.unit === 'week') return duration.amount;
  throw new Error(`Unknown duration unit: ${duration.unit}`);
}

export function advanceClock(totalWeeks, timeScale) {
  if (timeScale === 'year') return totalWeeks + 52;
  if (timeScale === 'week') return totalWeeks + 1;
  throw new Error(`Unknown timeScale: ${timeScale}`);
}

export function createLifeStateV3(options = {}) {
  const now = options.createdAt || new Date(0).toISOString();
  return {
    id: options.id || `life-${options.seed ?? 0}`,
    seed: Number.isInteger(options.seed) ? options.seed : 0,
    rngCursor: 0,
    createdAt: now,
    alive: true,
    clock: { totalWeeks: 0, stage: 'life', stageStartedAtWeeks: 0 },
    identity: { name: options.name || '无名者', birthYear: options.birthYear || 2000, region: options.region || '普通城市', childrenCount: 0 },
    body: { fitness: 50 },
    mind: { smarts: 50, empathy: 50, stress: 20, happiness: 50, discipline: 50 },
    career: { id: 'none', level: 0, freeTime: 60, educationId: 'none' },
    finance: { assets: 0, debt: 0, businessAssets: 0, reputation: 0, income: 0, cash: 0 },
    health: { health: 70 },
    inventory: [],
    location: { id: 'default', name: options.region || '普通城市' },
    relationships: [],
    history: { tags: [], flags: {}, experiences: [], timeline: [], cooldowns: {}, scheduled: [] },
    derivedMetrics: {},
    pendingEvent: null,
    ending: null,
  };
}

const deepClone = (value) => structuredClone(value);
const getPath = (object, path) => path.split('.').reduce((current, key) => current?.[key], object);

function setPath(object, path, value) {
  const keys = path.split('.');
  let current = object;
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (!current[keys[i]] || typeof current[keys[i]] !== 'object') throw new Error(`Unknown numeric path: ${path}`);
    current = current[keys[i]];
  }
  if (!(keys.at(-1) in current)) throw new Error(`Unknown numeric path: ${path}`);
  current[keys.at(-1)] = value;
}

function normalizeDimensions(input = {}) {
  const output = {};
  for (const key of RELATIONSHIP_DIMENSIONS) output[key] = clamp(Number(input[key] ?? 0));
  return output;
}

function findRelationship(life, id) {
  const relationship = life.relationships.find((item) => item.id === id);
  if (!relationship) throw new Error(`Unknown relationship: ${id}`);
  return relationship;
}

function stableRelationshipId(lifeId, index) {
  return `relationship-${String(lifeId || 'life').replace(/[^a-zA-Z0-9_-]/g, '_')}-${index}`;
}

function stableExperienceInstanceId(life, definitionId) {
  const safeDefinitionId = String(definitionId).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeDefinitionId}-${life.clock.totalWeeks}-${life.history.experiences.length}`;
}

export function evaluateRelationshipTransition(relationship, intent, targetStatus, rules) {
  if (!rules || !Array.isArray(rules.transitions)) throw new Error('Relationship rules are required');
  const rule = rules.transitions.find((item) =>
    item.from === relationship.status && item.to === targetStatus && item.intent === intent);
  if (!rule) return { allowed: false, reason: 'transition_not_registered' };
  for (const [key, minimum] of Object.entries(rule.min || {})) {
    if (!RELATIONSHIP_DIMENSIONS.includes(key)) throw new Error(`Unknown relationship dimension in rule: ${key}`);
    if (relationship.dimensions[key] < minimum) return { allowed: false, reason: `minimum_not_met:${key}` };
  }
  for (const [key, maximum] of Object.entries(rule.max || {})) {
    if (!RELATIONSHIP_DIMENSIONS.includes(key)) throw new Error(`Unknown relationship dimension in rule: ${key}`);
    if (relationship.dimensions[key] > maximum) return { allowed: false, reason: `maximum_exceeded:${key}` };
  }
  return { allowed: true, rule };
}

export function relationshipStageWeeks(life) {
  if (life.clock.stage !== 'romance') return 0;
  return life.clock.totalWeeks - life.clock.stageStartedAtWeeks;
}

export function relationshipHardLimitReached(life, rules) {
  const limit = rules?.hardLimitResolution?.atWeeks;
  if (!Number.isInteger(limit) || limit < 0) throw new Error('Invalid relationship hard limit');
  return life.clock.stage === 'romance' && relationshipStageWeeks(life) >= limit;
}

function applyCommand(life, command, options) {
  if (!command || typeof command.op !== 'string') throw new Error('Command op is required');
  switch (command.op) {
    case 'AddStat':
    case 'SetStat': {
      if (!SCORE_PATHS.has(command.key)) throw new Error(`Unknown numeric path: ${command.key}`);
      const current = Number(getPath(life, command.key));
      const operand = command.op === 'AddStat' ? Number(command.amount) : Number(command.value);
      if (!Number.isFinite(operand)) throw new Error(`${command.op} requires a finite numeric value`);
      setPath(life, command.key, clamp(command.op === 'AddStat' ? current + operand : operand));
      return;
    }
    case 'AddResource':
    case 'SetResource': {
      if (!RESOURCE_PATHS.has(command.key)) throw new Error(`Unknown numeric path: ${command.key}`);
      const current = Number(getPath(life, command.key));
      const operand = command.op === 'AddResource' ? Number(command.amount) : Number(command.value);
      if (!Number.isFinite(operand)) throw new Error(`${command.op} requires a finite numeric value`);
      setPath(life, command.key, Math.max(0, command.op === 'AddResource' ? current + operand : operand));
      return;
    }
    case 'AddTag':
    case 'UnlockAchievement':
      if (!command.tag) throw new Error(`${command.op} requires tag`);
      if (!life.history.tags.includes(command.tag)) life.history.tags.push(command.tag);
      return;
    case 'RemoveTag':
      if (!command.tag) throw new Error('RemoveTag requires tag');
      life.history.tags = life.history.tags.filter((tag) => tag !== command.tag);
      return;
    case 'SetFlag':
      if (!command.flag) throw new Error('SetFlag requires flag');
      life.history.flags[command.flag] = command.value ?? true;
      return;
    case 'ClearFlag':
      if (!command.flag) throw new Error('ClearFlag requires flag');
      delete life.history.flags[command.flag];
      return;
    case 'CreateRelationship': {
      if (!command.relationshipId || !command.role || !command.name) throw new Error('CreateRelationship missing fields');
      if (!RELATIONSHIP_STATUSES.has(command.targetStatus || 'active')) throw new Error('Unknown relationship status');
      if (life.relationships.some((item) => item.id === command.relationshipId)) throw new Error(`Duplicate relationship: ${command.relationshipId}`);
      life.relationships.push({
        id: command.relationshipId,
        name: command.name,
        role: command.role,
        status: command.targetStatus || 'active',
        dimensions: normalizeDimensions(command.dimensions),
        relationshipStartedAtWeeks: life.clock.totalWeeks,
        statusChangedAtWeeks: life.clock.totalWeeks,
        sharedExperiences: [],
      });
      return;
    }
    case 'ModifyRelationship': {
      const relationship = findRelationship(life, command.relationshipId);
      const entries = Object.entries(command.dimensions || {});
      if (!entries.length) throw new Error('ModifyRelationship requires dimensions');
      for (const [key, deltaRaw] of entries) {
        if (!RELATIONSHIP_DIMENSIONS.includes(key)) throw new Error(`Unknown relationship dimension: ${key}`);
        const delta = Number(deltaRaw);
        if (!Number.isFinite(delta)) throw new Error(`Relationship delta must be finite: ${key}`);
        relationship.dimensions[key] = clamp(relationship.dimensions[key] + delta);
      }
      return;
    }
    case 'RequestRelationshipTransition': {
      const relationship = findRelationship(life, command.relationshipId);
      if (!command.targetStatus || !command.intent) throw new Error('Relationship transition requires intent and targetStatus');
      const result = evaluateRelationshipTransition(relationship, command.intent, command.targetStatus, options.relationshipRules);
      if (!result.allowed) throw new Error(`Relationship transition rejected: ${result.reason}`);
      relationship.status = command.targetStatus;
      relationship.statusChangedAtWeeks = life.clock.totalWeeks;
      return;
    }
    case 'EndRelationship': {
      const relationship = findRelationship(life, command.relationshipId);
      const targetStatus = command.targetStatus || 'broken_up';
      if (!RELATIONSHIP_STATUSES.has(targetStatus)) throw new Error('Unknown relationship status');
      relationship.status = targetStatus;
      relationship.statusChangedAtWeeks = life.clock.totalWeeks;
      return;
    }
    case 'AppendExperience': {
      if (!command.experience?.id || !command.experience?.type || !command.experience?.title) throw new Error('AppendExperience requires id, type and title');
      const experience = deepClone(command.experience);
      const definitionId = experience.definitionId || experience.id;
      life.history.experiences.push({
        ...experience,
        id: stableExperienceInstanceId(life, definitionId),
        definitionId,
        atTotalWeeks: life.clock.totalWeeks,
      });
      return;
    }
    case 'ScheduleEvent':
      if (!command.eventId || !command.after) throw new Error('ScheduleEvent requires eventId and after');
      life.history.scheduled.push({
        id: command.id || `${command.eventId}-${life.clock.totalWeeks}-${life.history.scheduled.length}`,
        dueAtTotalWeeks: life.clock.totalWeeks + durationToWeeks(command.after),
        kind: 'event',
        payload: { eventId: command.eventId, ...(command.payload || {}) },
      });
      return;
    case 'SetCareer':
      if (command.value == null && command.key == null) throw new Error('SetCareer requires value');
      life.career.id = String(command.value ?? command.key);
      return;
    case 'SetEducation':
      if (command.value == null && command.key == null) throw new Error('SetEducation requires value');
      life.career.educationId = String(command.value ?? command.key);
      return;
    case 'EnterStage':
      if (!STAGES.has(command.stage)) throw new Error(`Unknown stage: ${command.stage}`);
      life.clock.stage = command.stage;
      life.clock.stageStartedAtWeeks = life.clock.totalWeeks;
      return;
    case 'ExitStage':
      life.clock.stage = 'life';
      life.clock.stageStartedAtWeeks = life.clock.totalWeeks;
      return;
    default:
      throw new Error(`Unknown command op: ${command.op}`);
  }
}

export function validateLifeState(life) {
  if (!life || typeof life !== 'object') throw new Error('LifeState is required');
  const { totalWeeks, stage, stageStartedAtWeeks } = life.clock || {};
  if (!Number.isInteger(totalWeeks) || totalWeeks < 0) throw new Error('Invalid totalWeeks');
  if (!STAGES.has(stage)) throw new Error('Invalid stage');
  if (!Number.isInteger(stageStartedAtWeeks) || stageStartedAtWeeks < 0 || stageStartedAtWeeks > totalWeeks) throw new Error('stageStartedAtWeeks must be <= totalWeeks');
  for (const relationship of life.relationships || []) {
    if (!RELATIONSHIP_STATUSES.has(relationship.status)) throw new Error(`Invalid relationship status: ${relationship.status}`);
    if (relationship.relationshipStartedAtWeeks > totalWeeks) throw new Error('relationshipStartedAtWeeks must be <= totalWeeks');
    if (relationship.statusChangedAtWeeks > totalWeeks) throw new Error('statusChangedAtWeeks must be <= totalWeeks');
    for (const key of RELATIONSHIP_DIMENSIONS) {
      const value = relationship.dimensions?.[key];
      if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Invalid relationship dimension: ${key}`);
    }
  }
  for (const path of SCORE_PATHS) {
    const value = getPath(life, path);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error(`Invalid score path: ${path}`);
  }
  for (const path of RESOURCE_PATHS) {
    const value = getPath(life, path);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid resource path: ${path}`);
  }
  return true;
}

export function applyCommandsAtomic(life, commands, options = {}) {
  const next = deepClone(life);
  const eventTimeScale = options.timeScale || (life.clock.stage === 'romance' ? 'week' : 'year');
  for (const command of commands || []) applyCommand(next, command, options);
  if (options.advanceTime !== false) next.clock.totalWeeks = advanceClock(next.clock.totalWeeks, eventTimeScale);
  validateLifeState(next);
  return next;
}

function migrateRelationshipV2(item, totalWeeks, lifeId, index) {
  const closeness = Number(item.closeness ?? 0);
  const trust = Number(item.trust ?? closeness);
  const conflict = Number(item.conflict ?? 0);
  return {
    id: item.id || stableRelationshipId(lifeId, index),
    name: item.name || '未知人物',
    role: item.role || 'other',
    status: RELATIONSHIP_STATUSES.has(item.status) ? item.status : 'active',
    dimensions: normalizeDimensions({ attraction: closeness, love: closeness, trust, conflict, dependence: item.dependency ?? 0, respect: trust, passion: 0, commitment: closeness }),
    relationshipStartedAtWeeks: Math.min(item.relationshipStartedAtWeeks ?? 0, totalWeeks),
    statusChangedAtWeeks: Math.min(item.statusChangedAtWeeks ?? 0, totalWeeks),
    sharedExperiences: [...(item.sharedExperiences || [])],
  };
}

export function migrateLifeV2ToV3(oldLife) {
  if (!oldLife) return null;
  const totalWeeks = oldLife.clock?.totalWeeks ?? ((oldLife.age ?? 0) * 52);
  const stats = oldLife.stats || {};
  const resources = oldLife.resources || {};
  const life = createLifeStateV3({
    id: oldLife.id, seed: oldLife.seed,
    name: oldLife.identity?.name || oldLife.name,
    birthYear: oldLife.identity?.birthYear || oldLife.year || 2000,
    region: oldLife.identity?.region || oldLife.location || '普通城市',
    createdAt: oldLife.createdAt || new Date(0).toISOString(),
  });
  life.rngCursor = oldLife.rngCursor || 0;
  life.alive = oldLife.alive !== false;
  life.clock = {
    totalWeeks,
    stage: oldLife.clock?.stage || 'life',
    stageStartedAtWeeks: Math.min(oldLife.clock?.stageStartedAtWeeks ?? totalWeeks, totalWeeks),
  };
  life.identity.childrenCount = oldLife.identity?.childrenCount ?? oldLife.children ?? 0;
  life.body.fitness = clamp(stats.fitness ?? 50);
  life.mind.smarts = clamp(stats.smarts ?? 50);
  life.mind.empathy = clamp(stats.empathy ?? 50);
  life.mind.stress = clamp(stats.stress ?? 20);
  life.mind.happiness = clamp(stats.happiness ?? 50);
  life.mind.discipline = clamp(stats.discipline ?? 50);
  life.career.id = oldLife.identity?.careerId || oldLife.career || 'none';
  life.career.educationId = oldLife.identity?.educationId || oldLife.education || 'none';
  life.career.level = Math.max(0, Number(resources.careerLevel ?? 0));
  life.career.freeTime = clamp(stats.freeTime ?? resources.freeTime ?? 60);
  life.finance.assets = Math.max(0, Number(resources.assets ?? oldLife.money ?? 0));
  life.finance.debt = Math.max(0, Number(resources.debt ?? 0));
  life.finance.businessAssets = Math.max(0, Number(resources.businessAssets ?? 0));
  life.finance.reputation = clamp(resources.reputation ?? 0);
  life.finance.income = Math.max(0, Number(resources.income ?? oldLife.salary ?? 0));
  life.finance.cash = Math.max(0, Number(resources.cash ?? oldLife.money ?? 0));
  life.health.health = clamp(stats.health ?? 70);
  life.relationships = (oldLife.relationships || []).map((item, index) => migrateRelationshipV2(item, totalWeeks, life.id, index));
  life.history = {
    tags: [...(oldLife.tags || oldLife.traits || [])],
    flags: deepClone(oldLife.flags || {}),
    experiences: deepClone(oldLife.experiences || []),
    timeline: deepClone(oldLife.timeline || []),
    cooldowns: deepClone(oldLife.cooldowns || {}),
    scheduled: deepClone(oldLife.scheduled || []),
  };
  life.pendingEvent = deepClone(oldLife.pendingEvent || null);
  life.ending = deepClone(oldLife.ending || null);
  validateLifeState(life);
  return life;
}

export function migrateSaveV2ToV3(save) {
  if (!save || save.schemaVersion !== 2) throw new Error('Expected schemaVersion 2 save');
  return {
    schemaVersion: 3,
    appVersion: '0.3.0',
    savedAt: save.savedAt || new Date(0).toISOString(),
    currentLife: migrateLifeV2ToV3(save.currentLife),
    archives: deepClone(save.archives || []),
    achievements: [...(save.achievements || [])],
    settings: deepClone(save.settings || { reducedMotion: false, showEffectHints: true, confirmReset: true }),
  };
}
