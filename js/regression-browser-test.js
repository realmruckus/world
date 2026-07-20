import {
  createMonster,
  createWorldState,
  composeEvent,
  resolveChoice,
  calculateTerritoryOutcome,
  calculateLocationNetIncome
} from './engine.js';
import {
  WORLD_SAVE_FORMAT,
  WORLD_SAVE_VERSION,
  createDefaultTestState,
  exportSave,
  importSave,
  runDeterministicAction,
  validateSeed,
  validateWorldState
} from './dev-tools.js';
import {
  MONSTER_LIMIT,
  MONSTER_STATUSES,
  createAccountState,
  addMonster,
  setActiveMonster,
  setMonsterStatus,
  toPublicMonster
} from './monsters.js';

const results = [];
const output = document.querySelector('#test-results');
const summary = document.querySelector('#test-summary');
const runButton = document.querySelector('#run-tests');
runButton.dataset.bound = 'true';

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn, pattern) {
  let error;
  try { fn(); } catch (caught) { error = caught; }
  assert(error, '预期抛出错误，但操作成功。');
  if (pattern) assert(pattern.test(String(error.message)), `错误信息不匹配：${error.message}`);
}

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const passedCount = results.filter((item) => item.passed).length;
  summary.textContent = `已执行 ${results.length} 项：${passedCount} 通过，${results.length - passedCount} 失败。`;
  output.replaceChildren(...results.map((result) => {
    const item = document.createElement('li');
    item.className = result.passed ? 'pass' : 'fail';
    item.innerHTML = `<strong>${result.passed ? 'PASS' : 'FAIL'} · ${result.name}</strong>`;
    if (result.detail) {
      const pre = document.createElement('pre');
      pre.textContent = result.detail;
      item.append(pre);
    }
    return item;
  }));
}

async function runCase(name, test) {
  try {
    await test();
    record(name, true);
  } catch (error) {
    record(name, false, error instanceof Error ? error.stack || error.message : String(error));
  }
}

function accountWithOneMonster() {
  return createAccountState({
    accountId: 'A1', ownerId: 'P1', worldTick: 7,
    monster: { id: 'M1', name: '嘎吱', race: 'GOBLIN', seed: 101 }
  });
}

const cases = [
  ['M01 · 选择推进 Tick 并写入日志', () => {
    const state = createWorldState(createMonster({ id: 'M1', name: '嘎吱', race: 'GOBLIN' }));
    const event = composeEvent(state, 'HUNT', 1);
    resolveChoice(state, event, event.choices[0].id);
    assert(state.tick === 1, 'Tick 未增加。');
    assert(state.eventLog.length === 1, '事件日志未写入。');
  }],
  ['M01 · 领地结果固定种子可重放', () => {
    const input = { attackers: [{ power: 5 }, { power: 4 }], defenders: [{ power: 3 }], locationBonus: 1.1, scoutingBonus: 1.2, seed: 42 };
    assert(calculateTerritoryOutcome(input) === calculateTerritoryOutcome(input), '相同输入结果不一致。');
  }],
  ['M01 · 地点净收益扣除全部成本', () => {
    assert(calculateLocationNetIncome({ production: 20, garrisonMaintenance: 5, facilityMaintenance: 2, expectedRaidLoss: 3 }) === 10, '净收益错误。');
  }],
  ['M01 · 存档导出导入保持状态', () => {
    const state = createDefaultTestState();
    const parsed = JSON.parse(exportSave(state));
    assert(parsed.format === WORLD_SAVE_FORMAT, 'format 错误。');
    assert(parsed.saveVersion === WORLD_SAVE_VERSION, 'saveVersion 错误。');
    assert(equal(importSave(JSON.stringify(parsed)).state, state), '导入状态不一致。');
  }],
  ['M01 · 相同状态输入种子结果一致', () => {
    const state = createDefaultTestState();
    const first = runDeterministicAction(state, { action: 'HUNT', seed: 42, choiceIndex: 0 });
    const second = runDeterministicAction(state, { action: 'HUNT', seed: 42, choiceIndex: 0 });
    assert(equal(first.event, second.event) && equal(first.after, second.after), '确定性结果不一致。');
    assert(state.tick === 0, '源状态被修改。');
  }],
  ['M01 · Reset 工厂返回独立初始状态', () => {
    const changed = runDeterministicAction(createDefaultTestState(), { seed: 7 }).after;
    const reset = createDefaultTestState();
    assert(changed.tick === 1 && reset.tick === 0 && reset.eventLog.length === 0, 'Reset 状态错误。');
  }],
  ['M01 · 非法 JSON 与损坏存档被拒绝', () => {
    assertThrows(() => importSave('{broken'), /有效 JSON/);
    const envelope = JSON.parse(exportSave(createDefaultTestState()));
    envelope.state.monsters = [];
    assertThrows(() => importSave(JSON.stringify(envelope)), /monsters 必须是非空数组/);
  }],
  ['M01 · 失败导入不修改当前状态', () => {
    const current = createDefaultTestState();
    const snapshot = structuredClone(current);
    assertThrows(() => importSave('{"format":"WRONG"}'));
    assert(equal(current, snapshot), '当前状态被修改。');
  }],
  ['M01 · 存档与 Engine 版本不匹配被拒绝', () => {
    const saveMismatch = JSON.parse(exportSave(createDefaultTestState()));
    saveMismatch.saveVersion += 1;
    assertThrows(() => importSave(JSON.stringify(saveMismatch)), /存档版本不支持/);
    const engineMismatch = JSON.parse(exportSave(createDefaultTestState()));
    engineMismatch.engineVersion = '999.0.0';
    assertThrows(() => importSave(JSON.stringify(engineMismatch)), /Engine 版本不兼容/);
  }],
  ['M01 · 状态校验报告错误和警告', () => {
    const state = createDefaultTestState();
    state.locations.FOREST_EDGE.id = 'OTHER';
    assert(validateWorldState(state).warnings.length === 1, '地点警告缺失。');
    state.activeMonsterId = 'MISSING';
    assert(validateWorldState(state).valid === false, '非法 activeMonsterId 未被拒绝。');
  }],
  ['M01 · Seed 只接受 uint32 整数', () => {
    assert(validateSeed('0') === 0 && validateSeed('4294967295') === 4294967295, '合法 Seed 被拒绝。');
    for (const value of ['-1', '1.5', 'abc', '4294967296']) assertThrows(() => validateSeed(value));
  }],
  ['M02 · 账号初始怪物保留 World Tick', () => {
    const account = accountWithOneMonster();
    assert(account.worldTick === 7 && account.monsters.length === 1 && account.activeMonsterId === 'M1', '账号初始状态错误。');
    assert(account.monsters[0].ownerId === 'P1', '所有权缺失。');
  }],
  ['M02 · 最多五只怪物且新增不重置 Tick', () => {
    let account = accountWithOneMonster();
    for (let index = 2; index <= MONSTER_LIMIT; index += 1) account = addMonster(account, { id: `M${index}`, name: `怪物${index}`, race: 'SLIME', seed: 100 + index });
    assert(account.worldTick === 7 && account.monsters.length === 5, '数量或 Tick 错误。');
    assertThrows(() => addMonster(account, { id: 'M6', name: '超额怪物', race: 'SKELETON', seed: 106 }), /最多 5 只怪物/);
  }],
  ['M02 · 身份字段校验且无职业字段', () => {
    const monster = accountWithOneMonster().monsters[0];
    assert(!('profession' in monster) && !('class' in monster), '出现职业字段。');
    assertThrows(() => addMonster(accountWithOneMonster(), { id: '', name: '无ID', race: 'GOBLIN', seed: 1 }), /ID/);
    assertThrows(() => addMonster(accountWithOneMonster(), { id: 'M2', name: ' ', race: 'GOBLIN', seed: 1 }), /名字/);
    assertThrows(() => addMonster(accountWithOneMonster(), { id: 'M2', name: '未知', race: 'DRAGON', seed: 1 }), /种族/);
  }],
  ['M02 · 固定种子生成固定资质与外观基因', () => {
    const first = addMonster(accountWithOneMonster(), { id: 'M2', name: '泥团', race: 'SLIME', seed: 4242 }).monsters[1];
    const second = addMonster(accountWithOneMonster(), { id: 'M2', name: '泥团', race: 'SLIME', seed: 4242 }).monsters[1];
    assert(equal(first.privateGrowthAptitudes, second.privateGrowthAptitudes), '成长资质不稳定。');
    assert(equal(first.appearanceGenes, second.appearanceGenes), '外观基因不稳定。');
  }],
  ['M02 · 公共投影不暴露精确成长资质', () => {
    const monster = accountWithOneMonster().monsters[0];
    const publicMonster = toPublicMonster(monster);
    assert(!('privateGrowthAptitudes' in publicMonster), '精确资质已泄露。');
    assert(publicMonster.id === monster.id && publicMonster.name === monster.name && publicMonster.race === monster.race, '公开身份字段不完整。');
  }],
  ['M02 · 仅 ACTIVE 怪物可切换为主控', () => {
    let account = addMonster(accountWithOneMonster(), { id: 'M2', name: '泥团', race: 'SLIME', seed: 2 });
    account = setActiveMonster(account, 'M2');
    assert(account.activeMonsterId === 'M2', '主控切换失败。');
    account = setMonsterStatus(account, 'M1', 'RESTING');
    assertThrows(() => setActiveMonster(account, 'M1'), /RESTING/);
  }],
  ['M02 · 怪物状态集合互斥且非法状态被拒绝', () => {
    assert(equal(MONSTER_STATUSES, ['ACTIVE', 'GARRISONED', 'RESTING', 'MISSION', 'CAPTURED']), '状态集合错误。');
    let account = accountWithOneMonster();
    for (const status of MONSTER_STATUSES.slice(1)) {
      account = setMonsterStatus(account, 'M1', status);
      assert(account.monsters[0].status === status && account.activeMonsterId === null, `${status} 状态处理错误。`);
      account = setMonsterStatus(account, 'M1', 'ACTIVE');
      account = setActiveMonster(account, 'M1');
    }
    assertThrows(() => setMonsterStatus(account, 'M1', 'TRADING'), /非法状态/);
  }],
  ['M02 · 操作不可变且拒绝重复 ID', () => {
    const account = accountWithOneMonster();
    const snapshot = structuredClone(account);
    const next = addMonster(account, { id: 'M2', name: '泥团', race: 'SLIME', seed: 2 });
    assert(equal(account, snapshot) && next !== account, '操作修改了源状态。');
    assertThrows(() => addMonster(account, { id: 'M1', name: '重复', race: 'SLIME', seed: 2 }), /重复/);
  }]
];

async function runAllTests() {
  runButton.disabled = true;
  results.length = 0;
  output.replaceChildren();
  summary.textContent = '正在执行浏览器回归测试…';
  for (const [name, test] of cases) await runCase(name, test);
  runButton.disabled = false;
}

runButton.addEventListener('click', runAllTests);
runAllTests();
