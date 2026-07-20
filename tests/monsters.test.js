import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONSTER_LIMIT,
  MONSTER_STATUSES,
  createAccountState,
  addMonster,
  setActiveMonster,
  setMonsterStatus,
  toPublicMonster
} from '../js/monsters.js';

function accountWithOneMonster() {
  return createAccountState({
    accountId: 'A1',
    ownerId: 'P1',
    worldTick: 7,
    monster: { id: 'M1', name: '嘎吱', race: 'GOBLIN', seed: 101 }
  });
}

test('account starts with one active monster without resetting world tick', () => {
  const account = accountWithOneMonster();
  assert.equal(account.worldTick, 7);
  assert.equal(account.monsters.length, 1);
  assert.equal(account.activeMonsterId, 'M1');
  assert.equal(account.monsters[0].status, 'ACTIVE');
  assert.equal(account.monsters[0].ownerId, 'P1');
  assert.deepEqual(account.monsters[0].ownershipHistory, [{ ownerId: 'P1', tick: 7 }]);
});

test('adding monsters preserves tick and enforces a maximum of five', () => {
  let account = accountWithOneMonster();
  for (let index = 2; index <= MONSTER_LIMIT; index += 1) {
    account = addMonster(account, {
      id: `M${index}`,
      name: `怪物${index}`,
      race: 'SLIME',
      seed: 100 + index
    });
  }
  assert.equal(account.worldTick, 7);
  assert.equal(account.monsters.length, MONSTER_LIMIT);
  assert.throws(() => addMonster(account, {
    id: 'M6', name: '超额怪物', race: 'SKELETON', seed: 106
  }), /最多 5 只怪物/);
});

test('monster identity validates id, name and supported race and has no profession fields', () => {
  const account = accountWithOneMonster();
  const monster = account.monsters[0];
  assert.equal(monster.id, 'M1');
  assert.equal(monster.name, '嘎吱');
  assert.equal(monster.race, 'GOBLIN');
  assert.equal('profession' in monster, false);
  assert.equal('class' in monster, false);
  assert.throws(() => addMonster(account, { id: '', name: '无ID', race: 'GOBLIN', seed: 1 }), /ID/);
  assert.throws(() => addMonster(account, { id: 'M2', name: '   ', race: 'GOBLIN', seed: 1 }), /名字/);
  assert.throws(() => addMonster(account, { id: 'M2', name: '未知', race: 'DRAGON', seed: 1 }), /种族/);
});

test('creation generates fixed private growth aptitude and appearance genes from seed', () => {
  const first = addMonster(accountWithOneMonster(), {
    id: 'M2', name: '泥团', race: 'SLIME', seed: 4242
  }).monsters[1];
  const second = addMonster(accountWithOneMonster(), {
    id: 'M2', name: '泥团', race: 'SLIME', seed: 4242
  }).monsters[1];
  assert.deepEqual(first.privateGrowthAptitudes, second.privateGrowthAptitudes);
  assert.deepEqual(first.appearanceGenes, second.appearanceGenes);
  assert.deepEqual(Object.keys(first.privateGrowthAptitudes).sort(), ['agility', 'instinct', 'strength', 'vitality']);
});

test('public monster projection never exposes exact growth aptitudes', () => {
  const monster = accountWithOneMonster().monsters[0];
  const publicMonster = toPublicMonster(monster);
  assert.equal('privateGrowthAptitudes' in publicMonster, false);
  assert.equal(publicMonster.id, monster.id);
  assert.equal(publicMonster.name, monster.name);
  assert.equal(publicMonster.race, monster.race);
});

test('switching active monster is allowed only for ACTIVE monsters and keeps exactly one active id', () => {
  let account = addMonster(accountWithOneMonster(), {
    id: 'M2', name: '泥团', race: 'SLIME', seed: 2
  });
  account = setActiveMonster(account, 'M2');
  assert.equal(account.activeMonsterId, 'M2');
  assert.equal(account.monsters.find((monster) => monster.id === 'M2').status, 'ACTIVE');

  account = setMonsterStatus(account, 'M1', 'RESTING');
  assert.throws(() => setActiveMonster(account, 'M1'), /RESTING/);
  assert.equal(account.activeMonsterId, 'M2');
});

test('monster status accepts only the mutually exclusive status set', () => {
  assert.deepEqual(MONSTER_STATUSES, ['ACTIVE', 'GARRISONED', 'RESTING', 'MISSION', 'CAPTURED']);
  let account = accountWithOneMonster();
  for (const status of MONSTER_STATUSES.slice(1)) {
    account = setMonsterStatus(account, 'M1', status);
    assert.equal(account.monsters[0].status, status);
    assert.equal(account.activeMonsterId, null);
    account = setMonsterStatus(account, 'M1', 'ACTIVE');
    account = setActiveMonster(account, 'M1');
  }
  assert.throws(() => setMonsterStatus(account, 'M1', 'TRADING'), /非法状态/);
});

test('all account operations are immutable and reject duplicate monster ids', () => {
  const account = accountWithOneMonster();
  const snapshot = structuredClone(account);
  const next = addMonster(account, { id: 'M2', name: '泥团', race: 'SLIME', seed: 2 });
  assert.deepEqual(account, snapshot);
  assert.notEqual(next, account);
  assert.throws(() => addMonster(account, { id: 'M1', name: '重复', race: 'SLIME', seed: 2 }), /重复/);
});
