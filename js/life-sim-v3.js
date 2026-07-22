import { applyCommandsAtomic, createLifeStateV3 } from './life-engine-v3.js';
import { resolvePendingChoice, selectEventAtomic } from './life-event-engine-v3.js';
import { resolveRomanceChoice, selectRomanceTurn } from './life-romance-engine-v3.js';
import { calculateDerivedMetrics } from './life-metric-engine-v3.js';
import { finalizeLife } from './life-ending-engine-v3.js';
import { archiveFinishedLife, createEmptySave, exportSaveJson, importSaveJson, loadLocalSave, persistLocalSave, setCurrentLife, unlockAchievements } from './life-save-engine-v3.js';
import { evaluateAchievements } from './life-achievement-engine-v3.js';
import { activeRelationship, eventView, generatedChineseIdentity, metricRows, profileView, timelineRows } from './life-ui-model-v3.js';
import {
  advanceIdentityBuilder, closeCardDetail, confirmIdentityBuilder, createIdentityBuilder,
  createLifeChoiceCardViewModel, createLifeInteractionState, createLifeOffer, createProfileCardViewModel, identityBuilderView,
  openCardDetail, openExpandedCard, playLifeChoice, requestMulligan, retreatIdentityBuilder, selectIdentityCard,
} from './life-ui-foundation.js';

const $ = (selector) => document.querySelector(selector);
const state = { save: createEmptySave(), content: null, identityBuilder: null, interaction: null };
const endingNames = { ordinary_complete:'平凡而完整', career_peak:'事业巅峰', financial_freedom:'财富自由', family_anchor:'家庭支柱', lifelong_love:'挚爱相伴', creative_legacy:'创造者遗产', public_contribution:'公共贡献', free_spirit:'自由灵魂', second_chance:'重新出发', rise_and_fall:'大起大落', debt_life:'债务人生', lonely_later_life:'孤独晚年', unfinished_path:'未竟之路', hidden_rare:'隐藏结局' };
const relationshipNames = { potential:'互有好感', dating:'约会中', exclusive:'稳定交往', cohabiting:'共同生活', engaged:'已订婚', married:'已婚', paused:'暂停', broken_up:'已分手', no_contact:'不再联系' };
const identityStepNames = {
  gender:'性别', zodiac:'星座', family:'家庭', parentJobPrimary:'父母职业（一）', parentJobSecondary:'父母职业（二）', review:'确认身份',
};
const identityOptions = {
  gender:[
    { id:'gender_a', title:'性别选项 A', summary:'占位身份选项', assetId:'placeholder:identity:gender-a' },
    { id:'gender_b', title:'性别选项 B', summary:'占位身份选项', assetId:'placeholder:identity:gender-b' },
    { id:'gender_c', title:'性别选项 C', summary:'占位身份选项', assetId:'placeholder:identity:gender-c' },
  ],
  zodiac:['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'].map((id) => ({ id, title:id, summary:'占位星座选项', assetId:'placeholder:identity:zodiac' })),
  family:['family_a','family_b','family_c','family_d','family_e'].map((id) => ({ id, title:id, summary:'技术占位家庭选项', assetId:'placeholder:identity:family' })),
  parentJobPrimary:['job_a','job_b','job_c'].map((id) => ({ id, title:id, summary:'技术占位职业选项', assetId:'placeholder:identity:parent-job' })),
  parentJobSecondary:['job_d','job_e','job_f'].map((id) => ({ id, title:id, summary:'技术占位职业选项', assetId:'placeholder:identity:parent-job' })),
};

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

function applyGeneratedIdentity(life) {
  const generated = generatedChineseIdentity(life.seed);
  if (!life.identity.name || life.identity.name === '无名者' || /^界行者(?:\s|$)/.test(life.identity.name)) life.identity.name = generated.name;
  if (!life.identity.gender) life.identity.gender = generated.gender;
  if (!life.identity.birthMonth) life.identity.birthMonth = generated.birthMonth;
  if (!life.identity.birthDay) life.identity.birthDay = generated.birthDay;
  return life;
}

function createNewLife(selections = {}) {
  const seed = randomSeed();
  const identity = generatedChineseIdentity(seed);
  const life = createLifeStateV3({ id:`life-${seed}`, seed, name:identity.name, birthYear:2000, region:'现实城市', createdAt:new Date().toISOString() });
  Object.assign(life.identity, identity);
  life.identity.uiPrototype = {
    status: 'draft',
    genderId: selections.gender || null,
    zodiacSignId: selections.zodiac || null,
    familyId: selections.family || null,
    parentJobIds: [selections.parentJobPrimary, selections.parentJobSecondary].filter(Boolean),
  };
  return life;
}

function openIdentityBuilder() {
  state.identityBuilder = createIdentityBuilder({ options: identityOptions });
  renderIdentityBuilder();
}

function renderIdentityBuilder() {
  const element = $('#identity-builder');
  if (!state.identityBuilder) { element.hidden = true; return; }
  const view = identityBuilderView(state.identityBuilder);
  element.hidden = false;
  const selectionRows = Object.entries(view.selections).map(([key, value]) => `<li><span>${identityStepNames[key]}</span><strong>${value}</strong></li>`).join('');
  element.innerHTML = `<section class="identity-builder__surface"><header><p class="eyebrow">IdentityBuilder · 技术原型</p><h1>${identityStepNames[view.step]}</h1></header>${view.step === 'review' ? `<ul class="fact-list">${selectionRows}</ul>` : `<div class="identity-builder__cards">${view.cards.map((card) => `<button class="identity-builder__card" type="button" data-identity-option="${card.id}" aria-pressed="${card.selected}"><span class="life-choice-card__asset" aria-hidden="true">${card.assetId}</span><strong>${card.title}</strong><span>${card.summary}</span></button>`).join('')}</div>`}<footer class="identity-builder__actions"><button type="button" data-identity-back ${view.canRetreat ? '' : 'disabled'}>返回</button><button class="primary" type="button" data-identity-next ${view.step === 'review' ? (view.canConfirm ? '' : 'disabled') : (view.canAdvance ? '' : 'disabled')}>${view.step === 'review' ? '确认身份' : '下一步'}</button></footer></section>`;
  element.querySelectorAll('[data-identity-option]').forEach((button) => button.addEventListener('click', () => {
    state.identityBuilder = selectIdentityCard(state.identityBuilder, view.step, button.dataset.identityOption);
    renderIdentityBuilder();
  }));
  element.querySelector('[data-identity-back]')?.addEventListener('click', () => {
    state.identityBuilder = retreatIdentityBuilder(state.identityBuilder);
    renderIdentityBuilder();
  });
  element.querySelector('[data-identity-next]')?.addEventListener('click', () => {
    if (view.step === 'review') {
      const confirmed = confirmIdentityBuilder(state.identityBuilder);
      state.identityBuilder = null;
      renderIdentityBuilder();
      state.save.currentLife = createNewLife(confirmed.selections);
      render();
      return;
    }
    state.identityBuilder = advanceIdentityBuilder(state.identityBuilder);
    renderIdentityBuilder();
  });
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
  const profileCard = createProfileCardViewModel(life);
  const genderLabel = profileCard.identity.genderId || view.gender;
  const zodiacLabel = profileCard.identity.zodiacSignId || view.zodiac;
  $('#profile').innerHTML = `${view.avatar}<div><p class="eyebrow">${view.stageLabel} · ${view.ageLabel}</p><h1>${view.name}</h1><p class="profile-meta"><span>${genderLabel}</span><span>${zodiacLabel}</span><span>${view.birthdayLabel}</span></p><p class="profile-meta"><span>${view.location}</span><span>${view.education}</span><span>${view.career}</span></p></div>`;
  $('#metrics').innerHTML = metricRows(life).map(({label,status}) => `<div class="life-condition"><span>${label}</span><strong>${status}</strong></div>`).join('');
  const relationship = activeRelationship(life);
  $('#facts').innerHTML = `<li><span>家庭 / 父母职业</span><strong>${profileCard.identity.familyId || '—'} · ${profileCard.identity.parentJobIds.join(' / ') || '—'}</strong></li><li><span>现金</span><strong>¥${Math.round(life.finance.cash).toLocaleString('zh-CN')}</strong></li><li><span>资产 / 债务</span><strong>¥${Math.round(life.finance.assets).toLocaleString('zh-CN')} / ¥${Math.round(life.finance.debt).toLocaleString('zh-CN')}</strong></li><li><span>年收入</span><strong>¥${Math.round(life.finance.income).toLocaleString('zh-CN')}</strong></li><li><span>关系</span><strong>${relationship ? `${relationship.name} · ${relationshipNames[relationship.status] || relationship.status}` : '暂无重要伴侣关系'}</strong></li><li><span>人生标签</span><strong>${life.history.tags.join('、') || '尚未形成'}</strong></li>`;
}

function renderTimeline(life) {
  const rows = timelineRows(life);
  $('#timeline').innerHTML = rows.length ? rows.map((row) => `<li><time>${row.time}</time><div><strong>${row.title}</strong><p>${row.summary}</p></div></li>`).join('') : '<li class="empty">人生刚刚开始，重要选择会记录在这里。</li>';
}

function renderEvent(life) {
  const panel = $('#event-panel');
  state.interaction = null;
  if (life.alive === false) {
    const ending = life.ending;
    const evaluation = ending.lifeScore >= 80 ? '非常精彩' : ending.lifeScore >= 60 ? '充实完整' : ending.lifeScore >= 40 ? '平凡真实' : '留下遗憾';
    panel.innerHTML = `<p class="eyebrow">人生结局</p><h2>${endingNames[ending.primaryEnding] || ending.primaryEnding}</h2><p>这段人生已经结束。你可以封存档案，查看人生总结和跨人生成就。</p><p class="life-score">人生评价 <strong>${evaluation}</strong></p><p>${(ending.secondaryTags || []).join(' · ') || '没有额外标签'}</p><button class="primary" id="archive-life" type="button">封存档案并重新投胎</button>`;
    $('#archive-life').addEventListener('click', archiveAndRestart);
    return;
  }
  const view = eventView(life);
  if (!view) {
    panel.innerHTML = '<p class="eyebrow">正在准备</p><h2>正在生成下一段人生</h2>';
    return;
  }
  const cards = view.choices.map((choice) => createLifeChoiceCardViewModel({
    cardId:`${view.id}:${choice.id}`, choiceId:choice.id, title:choice.label, summary:choice.result,
    details:choice.result, assetId:`placeholder:event:${view.id}`, state:'available', requirements:[],
    effectsPreview:choice.result ? [choice.result] : [], risk:null, source:`event:${view.id}`,
    rarityOrImportance:'standard', accessibilityLabel:`${choice.label}。${choice.result || ''}`,
  }));
  const offer = createLifeOffer({ offerId:`${life.id}:${view.id}`, revision:life.history.timeline.length, cards, mulligansRemaining:0 });
  state.interaction = createLifeInteractionState({ offer });
  panel.innerHTML = `<span class="event-type">${view.type}</span><p class="event-caption">${view.caption}</p><h2>${view.title}</h2><p>${view.description}</p><life-card-hand></life-card-hand><life-card-stack hidden></life-card-stack><life-card-mulligan data-offer-id="${offer.offerId}" data-revision="${offer.revision}"><span>本次 Offer 无可用换牌次数</span><button type="button" disabled>全部换牌</button></life-card-mulligan>`;
  renderInteraction();
}

function renderInteraction() {
  if (!state.interaction) return;
  const hand = $('#event-panel life-card-hand');
  if (hand) hand.model = {
    cards: state.interaction.offer.cards.map((card) => ({
      ...card, state: card.cardId === state.interaction.expandedCardId && card.state === 'available' ? 'expanded' : card.state,
    })),
  };
  const busy = state.interaction.submissionStatus !== 'idle' || state.interaction.mulliganStatus !== 'idle';
  $('#event-panel')?.setAttribute('aria-busy', String(busy));
}

function showFeedback(message) {
  const feedback = $('[data-life-region="feedback"]');
  if (feedback) feedback.textContent = message;
}

function inspectChoice(choiceId) {
  try { state.interaction = openExpandedCard(state.interaction, choiceId); renderInteraction(); }
  catch (error) { showFeedback(error.message); }
}

function detailChoice(choiceId, restoreFocus) {
  try {
    state.interaction = openCardDetail(state.interaction, choiceId);
    const card = state.interaction.offer.cards.find((item) => item.choiceId === choiceId);
    $('#card-detail').open(card, restoreFocus);
  } catch (error) { showFeedback(error.message); }
}

function detailControlFor(choiceId) {
  return [...document.querySelectorAll('#event-panel [data-choice-id]')]
    .find((card) => card.dataset.choiceId === choiceId)
    ?.querySelector('[data-card-detail]') || null;
}

function submitChoice(choiceId) {
  try {
    const played = playLifeChoice(state.interaction, choiceId);
    state.interaction = played.state;
    renderInteraction();
    choose(played.submission.choiceId);
  } catch (error) { showFeedback(error.message); }
}

function requestOfferMulligan() {
  try {
    const requested = requestMulligan(state.interaction);
    state.interaction = requested.state;
    renderInteraction();
    showFeedback('换牌请求已交给 Deck/Offer Model。');
  } catch (error) { showFeedback(error.message); }
}

function renderMeta() {
  $('#archives').innerHTML = state.save.archives.length ? state.save.archives.slice(0,8).map((life) => `<li><strong>${life.name}</strong><span>${life.ageYears} 岁 · ${endingNames[life.endingId] || life.endingId}</span></li>`).join('') : '<li>还没有封存的人生。</li>';
  $('#achievements').innerHTML = state.content.achievements.map((item) => `<li class="${state.save.achievements.includes(item.id) ? 'unlocked' : ''}"><strong>${item.title}</strong><span>${item.description}</span></li>`).join('');
}

function render() {
  let life = state.save.currentLife;
  if (!life) {
    persist();
    renderMeta();
    openIdentityBuilder();
    return;
  }
  life = applyGeneratedIdentity(life);
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
  next.currentLife = null;
  state.save = next;
  render();
}

function newLife() {
  const life = state.save.currentLife;
  if (life?.history.timeline.length && life.alive !== false && !confirm('当前人生尚未结束，确定重新投胎吗？')) return;
  state.save.currentLife = null;
  persist();
  openIdentityBuilder();
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
  state.save.currentLife = null;
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
  $('#event-panel').addEventListener('card-inspect', (event) => inspectChoice(event.detail.choiceId));
  $('#event-panel').addEventListener('card-detail-open', (event) => {
    detailChoice(event.detail.choiceId, detailControlFor(event.detail.choiceId));
  });
  $('#event-panel').addEventListener('life-choice', (event) => submitChoice(event.detail.choiceId));
  $('#event-panel').addEventListener('mulligan-request', requestOfferMulligan);
  $('#card-detail').addEventListener('card-detail-close', () => {
    if (state.interaction) state.interaction = closeCardDetail(state.interaction);
  });
  $('#card-detail').addEventListener('life-choice', (event) => submitChoice(event.detail.choiceId));
  render();
}

function showError(error) {
  console.error(error);
  $('#event-panel').innerHTML = `<p class="eyebrow">错误</p><h2>无法继续人生模拟</h2><p>${error.message}</p>`;
}

init().catch(showError);
