import { createMonster, createWorldState, composeEvent, resolveChoice } from './engine.js';

const elements = {
  race: document.querySelector('#race'),
  name: document.querySelector('#name'),
  start: document.querySelector('#start'),
  hunt: document.querySelector('#hunt'),
  character: document.querySelector('#character'),
  event: document.querySelector('#event'),
  choices: document.querySelector('#choices'),
  history: document.querySelector('#history')
};

let state = null;
let currentEvent = null;

function render() {
  if (!state) return;
  const monster = state.monsters[0];
  elements.character.innerHTML = `
    <p><span class="badge">Tick ${state.tick}</span></p>
    <h2>${monster.name}</h2>
    <p>${monster.race} · 等级 ${monster.level}</p>
    <p>金币 ${state.gold} · 食物 ${state.materials.food}</p>
    <p>技能：狩猎 ${monster.skills.hunting} / 侦查 ${monster.skills.scouting} / 战斗 ${monster.skills.combat}</p>
    <p>特性：${monster.traits.join('、') || '尚未形成'}</p>
    <p>经历：${monster.experiences.join('、') || '尚无'}</p>
    <p>装备：${monster.equipment.map((item) => `${item.name}（${item.rarity}）`).join('、') || '无'}</p>
  `;
  elements.history.textContent = state.eventLog.length
    ? state.eventLog.map((entry) => `Tick ${entry.tick} · ${entry.title} · ${entry.choiceId}`).join('\n')
    : '暂无记录。';
}

function showEvent(event) {
  currentEvent = event;
  elements.event.innerHTML = `<h2>${event.title}</h2><p>${event.text}</p>${event.rare ? '<p class="badge">稀有事件</p>' : ''}`;
  elements.choices.replaceChildren();
  for (const choice of event.choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = choice.label;
    button.addEventListener('click', () => {
      resolveChoice(state, currentEvent, choice.id);
      elements.event.innerHTML = `<h2>结果已写入怪物卡</h2><p>选择：${choice.label}</p>`;
      elements.choices.replaceChildren();
      currentEvent = null;
      render();
    });
    elements.choices.append(button);
  }
}

elements.start.addEventListener('click', () => {
  const name = elements.name.value.trim() || '无名怪物';
  state = createWorldState(createMonster({ id: crypto.randomUUID(), name, race: elements.race.value }));
  elements.hunt.disabled = false;
  elements.event.textContent = '你的怪物醒来了。选择一次行动。';
  render();
});

elements.hunt.addEventListener('click', () => {
  if (!state || currentEvent) return;
  showEvent(composeEvent(state, 'HUNT', Date.now()));
});
