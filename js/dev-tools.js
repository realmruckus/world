import {
  WORLD_ENGINE_VERSION,
  composeEvent,
  createMonster,
  createWorldState,
  resolveChoice
} from './engine.js';

export const WORLD_SAVE_FORMAT = 'REALM_RUCKUS_WORLD_SAVE';
export const WORLD_SAVE_VERSION = 1;
export const DEFAULT_TEST_SEED = 1;

export function cloneValue(value) {
  return structuredClone(value);
}

export function createDefaultTestState() {
  return createWorldState(createMonster({
    id: 'M01-TEST-MONSTER',
    name: '调试哥布林',
    race: 'GOBLIN'
  }));
}

export function validateSeed(value) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    throw new Error('随机种子必须是 0 到 4294967295 之间的整数。');
  }
  const seed = Number(text);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('随机种子必须是 0 到 4294967295 之间的整数。');
  }
  return seed;
}

export function validateWorldState(state) {
  const errors = [];
  const warnings = [];

  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return { valid: false, errors: ['存档 state 必须是对象。'], warnings };
  }
  if (state.engineVersion !== WORLD_ENGINE_VERSION) {
    errors.push(`Engine 版本不匹配：需要 ${WORLD_ENGINE_VERSION}，收到 ${String(state.engineVersion)}。`);
  }
  if (!Number.isInteger(state.tick) || state.tick < 0) errors.push('tick 必须是非负整数。');
  if (!Array.isArray(state.monsters) || state.monsters.length === 0) errors.push('monsters 必须是非空数组。');
  if (!state.locations || typeof state.locations !== 'object' || Array.isArray(state.locations)) errors.push('locations 必须是对象。');
  if (!Array.isArray(state.eventLog)) errors.push('eventLog 必须是数组。');
  if (!state.materials || typeof state.materials !== 'object' || Array.isArray(state.materials)) errors.push('materials 必须是对象。');
  if (typeof state.activeMonsterId !== 'string' || !state.activeMonsterId) errors.push('activeMonsterId 必须是非空字符串。');

  if (Array.isArray(state.monsters)) {
    const ids = new Set();
    for (const [index, monster] of state.monsters.entries()) {
      if (!monster || typeof monster !== 'object') {
        errors.push(`monsters[${index}] 必须是对象。`);
        continue;
      }
      if (typeof monster.id !== 'string' || !monster.id) errors.push(`monsters[${index}].id 必须是非空字符串。`);
      else if (ids.has(monster.id)) errors.push(`怪物 ID 重复：${monster.id}。`);
      else ids.add(monster.id);
      if (typeof monster.name !== 'string' || !monster.name.trim()) errors.push(`monsters[${index}].name 必须是非空字符串。`);
      if (typeof monster.race !== 'string' || !monster.race) errors.push(`monsters[${index}].race 必须是非空字符串。`);
      if (!monster.attributes || typeof monster.attributes !== 'object') errors.push(`monsters[${index}].attributes 必须是对象。`);
    }
    if (state.activeMonsterId && !ids.has(state.activeMonsterId)) errors.push('activeMonsterId 未指向 monsters 中的怪物。');
  }

  if (state.locations && typeof state.locations === 'object' && !Array.isArray(state.locations)) {
    for (const [key, location] of Object.entries(state.locations)) {
      if (!location || typeof location !== 'object') errors.push(`locations.${key} 必须是对象。`);
      else if (location.id !== key) warnings.push(`地点键 ${key} 与地点 id ${String(location.id)} 不一致。`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function createSaveEnvelope(state) {
  const validation = validateWorldState(state);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  return {
    format: WORLD_SAVE_FORMAT,
    saveVersion: WORLD_SAVE_VERSION,
    engineVersion: WORLD_ENGINE_VERSION,
    state: cloneValue(state)
  };
}

export function exportSave(state, spacing = 2) {
  return JSON.stringify(createSaveEnvelope(state), null, spacing);
}

export function importSave(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('存档不是有效 JSON。');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('存档根节点必须是对象。');
  if (parsed.format !== WORLD_SAVE_FORMAT) throw new Error(`存档格式无效：需要 ${WORLD_SAVE_FORMAT}。`);
  if (parsed.saveVersion !== WORLD_SAVE_VERSION) throw new Error(`存档版本不支持：需要 ${WORLD_SAVE_VERSION}，收到 ${String(parsed.saveVersion)}。`);
  if (parsed.engineVersion !== WORLD_ENGINE_VERSION) throw new Error(`存档 Engine 版本不兼容：需要 ${WORLD_ENGINE_VERSION}，收到 ${String(parsed.engineVersion)}。`);

  const candidate = cloneValue(parsed.state);
  const validation = validateWorldState(candidate);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  return { state: candidate, warnings: validation.warnings };
}

export function runDeterministicAction(state, { action = 'HUNT', seed, choiceIndex = 0 } = {}) {
  const normalizedSeed = validateSeed(seed);
  const nextState = cloneValue(state);
  const event = composeEvent(nextState, action, normalizedSeed);
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error(`事件 ${event.id} 不存在 choiceIndex ${choiceIndex}。`);
  const before = cloneValue(nextState);
  resolveChoice(nextState, event, choice.id);
  return {
    before,
    after: nextState,
    event,
    choice,
    seed: normalizedSeed
  };
}

export function compareStates(before, after) {
  const changes = [];
  walk(before, after, '$', changes);
  return changes;
}

function walk(before, after, path, changes) {
  if (Object.is(before, after)) return;
  const beforeObject = before !== null && typeof before === 'object';
  const afterObject = after !== null && typeof after === 'object';
  if (!beforeObject || !afterObject || Array.isArray(before) !== Array.isArray(after)) {
    changes.push({ path, before, after });
    return;
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of [...keys].sort()) {
    const childPath = Array.isArray(after) || Array.isArray(before) ? `${path}[${key}]` : `${path}.${key}`;
    if (!(key in before)) changes.push({ path: childPath, before: undefined, after: after[key] });
    else if (!(key in after)) changes.push({ path: childPath, before: before[key], after: undefined });
    else walk(before[key], after[key], childPath, changes);
  }
}
