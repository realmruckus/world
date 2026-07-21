import { applyCommandsAtomic, createLifeStateV3 } from './life-engine-v3.js';
import { resolvePendingChoice, selectEventAtomic } from './life-event-engine-v3.js';
import { resolveRomanceChoice, selectRomanceTurn } from './life-romance-engine-v3.js';
import { calculateDerivedMetrics } from './life-metric-engine-v3.js';
import { finalizeLife } from './life-ending-engine-v3.js';
import { archiveFinishedLife, createEmptySave, exportSaveJson, importSaveJson, loadLocalSave, persistLocalSave, setCurrentLife, unlockAchievements } from './life-save-engine-v3.js';
import { evaluateAchievements } from './life-achievement-engine-v3.js';
import { activeRelationship, eventView, generatedChineseIdentity, metricRows, profileView, timelineRows } from './life-ui-model-v3.js';

const $ = (selector) => document.querySelector(selector);
const state = { save: createEmptySave(), content: null };
const endingNames = { ordinary_complete:'平凡而完整', career_peak:'事业巅峰', financial_freedom:'财富自由', family_anchor:'家庭支柱', lifelong_love:'挚爱相伴', creative_legacy:'创造者遗产', public_contribution:'公共贡献', free_spirit:'自由灵魂', second_chance:'重新出发', rise_and_fall:'大起大落', debt_life:'债务人生', lonely_later_life:'孤独晚年', unfinished_path:'未竟之路', hidden_rare:'隐藏结局' };
const relationshipNames = { potential:'互有好感', dating:'约会中', exclusive:'稳定交往', cohabiting:'共同生活', engaged:'已订婚', married:'已婚', paused:'暂停', broken_up:'已分手', no_contact:'不再联系' };

async function json(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`无法加载 ${path}`);
  return response.json();
}

async function loadContent() {
  const [annual, social, romance, resolutions, interrupts, relationshipRules, metricRegistry, metricDsl, endingRules, achievements] = await Promise.all([
    json('./data/life-events-annual-v3.json'), json('./data/life-events-social-v3.json'), json('./data/life-events-romance-v3.json'),
    json('./data/life-events-romance-resolution-v3.json'), json('./data/life-events-interrupt-v3.json'), json('./data/life-relationship-rules.json'),
    json('./data/life-derived-metrics.json'), json('./data/life-metric-dsl.json'), json('./data/life-ending-rules.json'), json('./data/life-achievements-v3.json'),
  ]);
  return { annualEvents:[...annual, ...social], romanceEvents:[...romance, ...resolutions], interruptEvents:interrupts, relationshipRules, metricRegistry, metricDsl, endingRules, achievements };
}

function randomSeed() {
  return Math.floor((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
}

function createNewLife() {
  const seed = randomSeed();
  const identity = generatedChineseIdentity(seed);
  const life = createLifeStateV3({ id:`life-${seed}`, seed, name:identity.name, birthYear:2000, region:'现实城市', createdAt:new Date().toISOString() });
  Object.assign(life.identity, identity);
  return life;
}

function persist() {
  state.save = setCurrentLife(state.save, state.save.currentLife, new Date().toISOString());
  persistLocalSave(localStorage, state.save);
}

function finalizeIfNeeded(life) {
  if (life.alive === false || life.health.health <= 0 || Math.floor(life.clock.totalWeeks / 52) >= 90) {
    if (life.alive === false && life.ending) return life;
    const metrics = calculateDerivedMetrics(life, state.content.metricRegistry, state.content.metricDsl);
    return finalizeLife(life, metrics, state.content.endingRules);
  }
  return life;
}

function ensurePending(life) {
  if (!life || life.alive === false || life.pendingEvent) return life;
  if (life.clock.stage === 'romance') return selectRomanceTurn(life, state.content.romanceEvents, state.content.interruptEvents, state.content.relationshipRules);
  return selectEventAtomic(life, state.content.annualEvents);
}

function renderProfile(life) {
  const view = profileView(life);
  $('#profile').innerHTML = `${view.avatar}<div><p class="eyebrow">${view.stageLabel} · ${view.ageLabel}</p><h1>${view.name}</h1><p>${view.gender} · ${view.zodiac} · ${view.birthdayLabel}</p><p>${view.location} · ${view.education} · ${view.career}</p></div>`;
  $('#metrics').innerHTML = metricRows(life).map(({label,status}) => `<div class="life-status"><span>${label}</span><strong>${status}</strong></div>`).join('');
  const relationship = activeRelationship(life);
  $('#facts').innerHTML = `<li><span>现金</span><strong>¥${Math.round(life.finance.cash).toLocaleString('zh-CN')}</strong></li><li><span>资产 / 债务</span><strong>¥${Math.round(life.finance.assets).toLocaleString('zh-CN')} / ¥${Math.round(life.finance.debt).toLocaleString('zh-CN')}</strong></li><li><span>年收入</span><strong>¥${Math.round(life.finance.income).toLocaleString('zh-CN')}</strong></li><li><span>关系</span><strong>${relationship ? `${relationship.name} · ${relationshipNames[relationship.status] || relationship.status}` : '暂无重要伴侣关系'}</strong></li><li><span>人生标签</span><strong>${life.history.tags.join('、') || '尚未形成'}</strong></li>`;
}

function renderTimeline(life) {
  const rows = timelineRows(life);
  $('#timeline').innerHTML = rows.length ? rows.map((row) => `<li><time>${row.time}</time><div><strong>${row.title}</strong><p>${row.summary}</p></div></li>`).join('') : '<li class="empty">人生刚刚开始，重要选择会记录在这里。</li>';
}

function renderEvent(life) {
  const panel = $('#event-panel');
  if (life.alive === false) {
    const ending = life.ending;
    panel.innerHTML = `<p class="eyebrow">结局</p><h2>${endingNames[ending.primaryEnding] || ending.primaryEnding}</h2><p>这段人生已经结束。你可以封存档案，查看总分、结局标签和跨人生成就。</p><p class="life-score">人生评分 <strong>${ending.lifeScore}</strong></p><p>${(ending.secondaryTags || []).join(' · ') || '没有额外标签'}</p><button class="primary" id="archive-life" type="button">封存档案并重新投胎</button>`;
    $('#archive-life').addEventListener('click', archiveAndRestart);
    return;
  }
  const view = eventView(life);
  if (!view) {
    panel.innerHTML = '<p class="eyebrow">载入中</p><h2>正在生成下一段人生</h2>';
    return;
  }
  panel.innerHTML = `<span class="event-type">${view.type}</span><p class="event-caption">${view.caption}</p><h2>${view.title}</h2><p>${view.description}</p><div class="choice-list">${view.choices.map((choice) => `<button type="button" data-choice="${choice.id}"><strong>${choice.label}</strong><span>${choice.result}</span></button>`).join('')}</div>`;
  panel.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => choose(button.dataset.choice)));
}

function renderMeta() {
  $('#archives').innerHTML = state.save.archives.length ? state.save.archives.slice(0,8).map((life) => `<li><strong>${life.name}</strong><span>${life.ageYears} 岁 · ${endingNames[life.endingId] || life.endingId} · ${life.score} 分</span></li>`).join('') : '<li>还没有封存的人生。</li>';
  $('#achievements').innerHTML = state.content.achievements.map((item) => `<li class="${state.save.achievements.includes(item.id) ? 'unlocked' : ''}"><strong>${item.title}</strong><span>${item.description}</span></li>`).join('');
}

function render() {
  let life = state.save.currentLife;
  if (!life) life = createNewLife();
  life = finalizeIfNeeded(life);
  life = ensurePending(life);
  state.save.currentLife = life;
  renderProfile(life);
  renderTimeline(life);
  renderEvent(life);
  renderMeta();
  persist();
}

function choose(choiceId) {
  const life = state.save.currentLife;
  const resolved = life.clock.stage === 'romance'
    ? resolveRomanceChoice(life, choiceId, state.content.relationshipRules)
    : resolvePendingChoice(life, choiceId, applyCommandsAtomic, { relationshipRules:state.content.relationshipRules });
  state.save.currentLife = finalizeIfNeeded(resolved);
  render();
}

function archiveAndRestart() {
  const life = state.save.currentLife;
  let next = archiveFinishedLife(state.save, life, { endedAt:new Date().toISOString(), includeSnapshot:true });
  const unlocked = evaluateAchievements(next, state.content.achievements, life);
  next = unlockAchievements(next, unlocked, new Date().toISOString());
  next.currentLife = createNewLife();
  state.save = next;
  render();
}

function newLife() {
  const life = state.save.currentLife;
  if (life?.history.timeline.length && life.alive !== false && !confirm('当前人生尚未结束，确定重新投胎吗？')) return;
  state.save.currentLife = createNewLife();
  render();
}

function exportSave() {
  const blob = new Blob([exportSaveJson(state.save)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `world-life-save-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importSave(file) {
  const text = await file.text();
  state.save = importSaveJson(text);
  persistLocalSave(localStorage, state.save);
  render();
}

function clearData() {
  if (!confirm('这会清除当前人生、历史档案和全部成就。确定继续吗？')) return;
  localStorage.removeItem('realmruckus.world.life.v3');
  state.save = createEmptySave({ savedAt:new Date().toISOString() });
  state.save.currentLife = createNewLife();
  render();
}

async function init() {
  state.content = await loadContent();
  try { state.save = loadLocalSave(localStorage); } catch (error) { console.warn(error); state.save = createEmptySave({ savedAt:new Date().toISOString() }); }
  $('#new-life').addEventListener('click', newLife);
  $('#export-save').addEventListener('click', exportSave);
  $('#import-save').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) importSave(file).catch(showError); event.target.value = ''; });
  $('#clear-data').addEventListener('click', clearData);
  render();
}

function showError(error) {
  console.error(error);
  $('#event-panel').innerHTML = `<p class="eyebrow">错误</p><h2>无法继续人生模拟</h2><p>${error.message}</p>`;
}

init().catch(showError);