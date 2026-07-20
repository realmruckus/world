import { WORLD_ENGINE_VERSION } from './engine.js';
import {
  DEFAULT_TEST_SEED,
  compareStates,
  createDefaultTestState,
  exportSave,
  importSave,
  runDeterministicAction,
  validateSeed,
  validateWorldState
} from './dev-tools.js';

const $ = (selector) => document.querySelector(selector);
const elements = {
  engineVersion: $('#engine-version'), tick: $('#world-tick'), seed: $('#seed'),
  run: $('#run-action'), replay: $('#replay-action'), reset: $('#reset-state'),
  exportButton: $('#export-save'), importButton: $('#import-save'),
  saveText: $('#save-text'), state: $('#state-json'), monsters: $('#monster-json'),
  locations: $('#location-json'), eventLog: $('#event-log'), before: $('#before-json'),
  after: $('#after-json'), diff: $('#state-diff'), errors: $('#errors'), warnings: $('#warnings')
};

let state = createDefaultTestState();
let lastRun = null;

function pretty(value) { return JSON.stringify(value, null, 2); }
function setMessages(target, messages, emptyText) {
  target.replaceChildren();
  if (!messages.length) {
    target.textContent = emptyText;
    target.classList.add('muted');
    return;
  }
  target.classList.remove('muted');
  const list = document.createElement('ul');
  for (const message of messages) {
    const item = document.createElement('li');
    item.textContent = message;
    list.append(item);
  }
  target.append(list);
}
function report(error = null, warnings = []) {
  setMessages(elements.errors, error ? String(error.message || error).split('\n') : [], '无错误。');
  setMessages(elements.warnings, warnings, '无警告。');
}
function renderComparison(before = null, after = null) {
  elements.before.textContent = before ? pretty(before) : '尚未执行操作。';
  elements.after.textContent = after ? pretty(after) : '尚未执行操作。';
  const changes = before && after ? compareStates(before, after) : [];
  elements.diff.textContent = changes.length
    ? changes.map((change) => `${change.path}\n- ${pretty(change.before)}\n+ ${pretty(change.after)}`).join('\n\n')
    : '无状态差异。';
}
function render() {
  const validation = validateWorldState(state);
  elements.engineVersion.textContent = WORLD_ENGINE_VERSION;
  elements.tick.textContent = String(state.tick);
  elements.state.textContent = pretty(state);
  elements.monsters.textContent = pretty(state.monsters);
  elements.locations.textContent = pretty(state.locations);
  elements.eventLog.textContent = state.eventLog.length ? pretty(state.eventLog) : '暂无事件日志。';
  if (!validation.valid) report(new Error(validation.errors.join('\n')), validation.warnings);
  else if (!elements.errors.textContent || !elements.warnings.textContent) report(null, validation.warnings);
}
function executeAndRender(seed) {
  const result = runDeterministicAction(state, { seed, action: 'HUNT', choiceIndex: 0 });
  state = result.after;
  lastRun = { inputState: result.before, seed: result.seed, result };
  renderComparison(result.before, result.after);
  report(null, validateWorldState(state).warnings);
  render();
  return result;
}

elements.seed.value = String(DEFAULT_TEST_SEED);
elements.run.addEventListener('click', () => {
  try { executeAndRender(validateSeed(elements.seed.value)); }
  catch (error) { report(error); }
});
elements.replay.addEventListener('click', () => {
  try {
    if (!lastRun) throw new Error('尚无可重放的操作。');
    const replay = runDeterministicAction(lastRun.inputState, { seed: lastRun.seed, action: 'HUNT', choiceIndex: 0 });
    const original = pretty(lastRun.result.after);
    const reproduced = pretty(replay.after);
    if (original !== reproduced) throw new Error('确定性重放失败：结果不一致。');
    state = replay.after;
    renderComparison(replay.before, replay.after);
    report(null, ['确定性重放通过：相同状态、输入与种子产生相同结果。']);
    render();
  } catch (error) { report(error); }
});
elements.reset.addEventListener('click', () => {
  const before = structuredClone(state);
  state = createDefaultTestState();
  lastRun = null;
  renderComparison(before, state);
  report(null, ['测试状态已重置。']);
  render();
});
elements.exportButton.addEventListener('click', () => {
  try {
    elements.saveText.value = exportSave(state);
    report(null, ['存档已导出到文本区。']);
  } catch (error) { report(error); }
});
elements.importButton.addEventListener('click', () => {
  try {
    const before = structuredClone(state);
    const imported = importSave(elements.saveText.value);
    state = imported.state;
    lastRun = null;
    renderComparison(before, state);
    report(null, imported.warnings.length ? imported.warnings : ['存档结构与版本检查通过，已安全导入。']);
    render();
  } catch (error) {
    report(error, ['导入失败，当前状态保持不变。']);
    render();
  }
});

renderComparison();
report();
render();
