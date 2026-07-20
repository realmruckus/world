export const MONSTER_LIMIT = 5;
export const MONSTER_STATUSES = ['ACTIVE', 'GARRISONED', 'RESTING', 'MISSION', 'CAPTURED'];

const SUPPORTED_RACES = ['GOBLIN', 'SLIME', 'SKELETON'];

function clone(value) {
  return structuredClone(value);
}

function randomValues(seed, count) {
  let state = seed >>> 0;
  return Array.from({ length: count }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  });
}

function validateIdentity({ id, name, race }) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('怪物 ID 不能为空');
  if (typeof name !== 'string' || !name.trim()) throw new Error('怪物名字不能为空');
  if (!SUPPORTED_RACES.includes(race)) throw new Error('不支持的怪物种族');
}

function createMonsterRecord({ id, name, race, seed }, ownerId, worldTick, status) {
  validateIdentity({ id, name, race });
  const values = randomValues(seed, 8);
  return {
    id: id.trim(),
    name: name.trim(),
    race,
    ownerId,
    status,
    privateGrowthAptitudes: {
      strength: values[0],
      vitality: values[1],
      agility: values[2],
      instinct: values[3]
    },
    appearanceGenes: values.slice(4),
    ownershipHistory: [{ ownerId, tick: worldTick }]
  };
}

export function createAccountState({ accountId, ownerId, worldTick = 0, monster }) {
  const firstMonster = createMonsterRecord(monster, ownerId, worldTick, 'ACTIVE');
  return {
    accountId,
    ownerId,
    worldTick,
    monsters: [firstMonster],
    activeMonsterId: firstMonster.id
  };
}

export function addMonster(account, monster) {
  if (account.monsters.length >= MONSTER_LIMIT) throw new Error('账号最多 5 只怪物');
  validateIdentity(monster);
  if (account.monsters.some((item) => item.id === monster.id.trim())) throw new Error('怪物 ID 重复');
  const next = clone(account);
  next.monsters.push(createMonsterRecord(monster, account.ownerId, account.worldTick, 'ACTIVE'));
  return next;
}

export function setActiveMonster(account, monsterId) {
  const monster = account.monsters.find((item) => item.id === monsterId);
  if (!monster) throw new Error('怪物不存在');
  if (monster.status !== 'ACTIVE') throw new Error(`怪物状态为 ${monster.status}，不能设为主控`);
  const next = clone(account);
  next.activeMonsterId = monsterId;
  return next;
}

export function setMonsterStatus(account, monsterId, status) {
  if (!MONSTER_STATUSES.includes(status)) throw new Error('非法状态');
  const index = account.monsters.findIndex((item) => item.id === monsterId);
  if (index < 0) throw new Error('怪物不存在');
  const next = clone(account);
  next.monsters[index].status = status;
  if (status !== 'ACTIVE' && next.activeMonsterId === monsterId) next.activeMonsterId = null;
  return next;
}

export function toPublicMonster(monster) {
  const result = clone(monster);
  delete result.privateGrowthAptitudes;
  return result;
}
