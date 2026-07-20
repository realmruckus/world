const TEST_SEED = '12345';
const INVALID_SEEDS = ['abc', '-1', '1.5', '4294967296'];
const RESOURCE_URLS = ['./dev.html', './js/dev.js', './js/dev-tools.js', './js/engine.js'];

const results = [];
const frame = document.querySelector('#test-frame');
const summary = document.querySelector('#test-summary');
const output = document.querySelector('#test-results');
const runButton = document.querySelector('#run-tests');

function clone(value) {
  return structuredClone(value);
}

function equal(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  renderResults();
}

function renderResults() {
  const passed = results.filter((item) => item.passed).length;
  const failed = results.length - passed;
  summary.textContent = `已执行 ${results.length} 项：${passed} 通过，${failed} 失败。`;
  output.replaceChildren();
  for (const result of results) {
    const item = document.createElement('li');
    item.className = result.passed ? 'pass' : 'fail';
    const title = document.createElement('strong');
    title.textContent = `${result.passed ? 'PASS' : 'FAIL'} · ${result.name}`;
    item.append(title);
    if (result.detail) {
      const detail = document.createElement('pre');
      detail.textContent = result.detail;
      item.append(detail);
    }
    output.append(item);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitForFrameLoad() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('dev.html 加载超时。')), 10000);
    frame.addEventListener('load', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
    frame.src = `./dev.html?browser-test=${Date.now()}`;
  });
}

function context() {
  const doc = frame.contentDocument;
  assert(doc, '无法读取 dev.html 文档。');
  const get = (selector) => {
    const element = doc.querySelector(selector);
    assert(element, `缺少页面元素：${selector}`);
    return element;
  };
  return { doc, get };
}

function readState(get) {
  return JSON.parse(get('#state-json').textContent);
}

function click(get, selector) {
  get(selector).click();
}

function setValue(get, selector, value) {
  const element = get(selector);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

async function settle() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function runCase(name, test) {
  try {
    await test();
    record(name, true);
  } catch (error) {
    record(name, false, error instanceof Error ? error.stack || error.message : String(error));
  }
}

async function verifyResources() {
  for (const url of RESOURCE_URLS) {
    const response = await fetch(url, { cache: 'no-store' });
    assert(response.ok, `${url} 返回 HTTP ${response.status}`);
  }
}

async function reset(get) {
  click(get, '#reset-state');
  await settle();
}

async function execute(get, seed = TEST_SEED) {
  setValue(get, '#seed', seed);
  click(get, '#run-action');
  await settle();
  return readState(get);
}

async function runAllTests() {
  runButton.disabled = true;
  results.length = 0;
  renderResults();

  try {
    await waitForFrameLoad();
    await settle();
    const { get } = context();

    await runCase('HTML 与 ES Module 资源可访问', verifyResources);

    await runCase('初始状态与核心面板正常', async () => {
      const state = readState(get);
      assert(get('#engine-version').textContent.trim() !== '—', 'Engine 版本未显示。');
      assert(get('#world-tick').textContent.trim() === '0', '初始 World Tick 不是 0。');
      assert(Array.isArray(state.monsters) && state.monsters.length > 0, '怪物数据缺失。');
      assert(state.locations && typeof state.locations === 'object', '地点数据缺失。');
      assert(Array.isArray(state.eventLog), '事件日志结构无效。');
    });

    await runCase('相同状态、输入与种子产生相同结果', async () => {
      await reset(get);
      const first = await execute(get);
      await reset(get);
      const second = await execute(get);
      assert(equal(first, second), '两次确定性执行结果不同。');
    });

    await runCase('重放上次操作结果一致', async () => {
      await reset(get);
      const original = await execute(get);
      click(get, '#replay-action');
      await settle();
      const replayed = readState(get);
      assert(equal(original, replayed), '重放结果与原结果不同。');
      assert(get('#warnings').textContent.includes('确定性重放通过'), '未显示重放通过提示。');
    });

    await runCase('非法随机种子被拒绝且状态不变', async () => {
      await reset(get);
      for (const seed of INVALID_SEEDS) {
        const before = clone(readState(get));
        setValue(get, '#seed', seed);
        click(get, '#run-action');
        await settle();
        const after = readState(get);
        assert(equal(before, after), `非法种子 ${seed} 改变了状态。`);
        assert(get('#errors').textContent.includes('随机种子必须'), `非法种子 ${seed} 未显示错误。`);
      }
    });

    await runCase('重置恢复初始测试状态', async () => {
      await reset(get);
      await execute(get);
      assert(readState(get).tick === 1, '执行后 Tick 未增加。');
      await reset(get);
      const resetState = readState(get);
      assert(resetState.tick === 0, '重置后 Tick 不是 0。');
      assert(resetState.eventLog.length === 0, '重置后事件日志未清空。');
    });

    await runCase('存档导出与正常导入', async () => {
      await reset(get);
      const expected = await execute(get);
      click(get, '#export-save');
      await settle();
      const text = get('#save-text').value;
      const envelope = JSON.parse(text);
      assert(envelope.format, '导出存档缺少 format。');
      assert(Number.isInteger(envelope.saveVersion), '导出存档缺少 saveVersion。');
      assert(envelope.engineVersion, '导出存档缺少 engineVersion。');
      assert(envelope.state, '导出存档缺少 state。');
      await reset(get);
      setValue(get, '#save-text', text);
      click(get, '#import-save');
      await settle();
      assert(equal(expected, readState(get)), '导入后状态与导出状态不同。');
    });

    await runCase('非法 JSON 导入失败且不破坏状态', async () => {
      const before = clone(readState(get));
      setValue(get, '#save-text', '{broken');
      click(get, '#import-save');
      await settle();
      assert(equal(before, readState(get)), '非法 JSON 导入改变了当前状态。');
      assert(get('#errors').textContent.includes('有效 JSON'), '非法 JSON 未显示正确错误。');
    });

    await runCase('错误存档版本被拒绝且不破坏状态', async () => {
      click(get, '#export-save');
      const envelope = JSON.parse(get('#save-text').value);
      const before = clone(readState(get));
      envelope.saveVersion = 999;
      setValue(get, '#save-text', JSON.stringify(envelope));
      click(get, '#import-save');
      await settle();
      assert(equal(before, readState(get)), '错误存档版本改变了当前状态。');
      assert(get('#errors').textContent.includes('存档版本不支持'), '未显示存档版本错误。');
    });

    await runCase('错误 Engine 版本被拒绝且不破坏状态', async () => {
      click(get, '#export-save');
      const envelope = JSON.parse(get('#save-text').value);
      const before = clone(readState(get));
      envelope.engineVersion = '999.0.0';
      setValue(get, '#save-text', JSON.stringify(envelope));
      click(get, '#import-save');
      await settle();
      assert(equal(before, readState(get)), '错误 Engine 版本改变了当前状态。');
      assert(get('#errors').textContent.includes('Engine 版本不兼容'), '未显示 Engine 版本错误。');
    });

    await runCase('损坏状态结构被拒绝且不破坏状态', async () => {
      click(get, '#export-save');
      const envelope = JSON.parse(get('#save-text').value);
      const before = clone(readState(get));
      envelope.state.monsters = [];
      setValue(get, '#save-text', JSON.stringify(envelope));
      click(get, '#import-save');
      await settle();
      assert(equal(before, readState(get)), '损坏存档改变了当前状态。');
      assert(get('#errors').textContent.includes('monsters 必须是非空数组'), '未显示结构校验错误。');
    });

    await runCase('操作前后状态和差异面板更新', async () => {
      await reset(get);
      await execute(get);
      assert(get('#before-json').textContent.includes('"tick": 0'), '操作前状态未显示 Tick 0。');
      assert(get('#after-json').textContent.includes('"tick": 1'), '操作后状态未显示 Tick 1。');
      const diff = get('#state-diff').textContent;
      assert(diff.includes('$.tick'), '状态差异未包含 tick。');
      assert(diff.includes('eventLog'), '状态差异未包含 eventLog。');
    });

    await runCase('怪物、地点、日志和完整状态同步显示', async () => {
      const state = readState(get);
      assert(equal(JSON.parse(get('#monster-json').textContent), state.monsters), '怪物面板与世界状态不一致。');
      assert(equal(JSON.parse(get('#location-json').textContent), state.locations), '地点面板与世界状态不一致。');
      assert(equal(JSON.parse(get('#event-log').textContent), state.eventLog), '事件日志面板与世界状态不一致。');
      assert(get('#world-tick').textContent.trim() === String(state.tick), 'Tick 摘要与世界状态不一致。');
    });
  } catch (error) {
    record('测试框架初始化', false, error instanceof Error ? error.stack || error.message : String(error));
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener('click', runAllTests);
runAllTests();
