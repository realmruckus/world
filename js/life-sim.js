import { advanceYear, calculateLifeScore, createPerson, deriveAchievements, mulberry32, resolveChoice } from "./life-sim-engine.js";

const STORAGE_KEY = "realmruckus.world.life-sim.v1";
const achievementCatalog = {
  "long-life": ["长寿人生", "活到 80 岁"],
  millionaire: ["百万积蓄", "拥有 1,000,000 以上资产"],
  "big-family": ["大家庭", "拥有至少 3 个孩子"],
  brilliant: ["聪慧过人", "智慧达到 90"],
  beloved: ["朋友遍天下", "朋友关系达到 90"],
  "full-archive": ["完整档案", "记录至少 70 年人生"],
};

const state = { events: [], person: null, archive: [], achievements: [] };
const $ = (selector) => document.querySelector(selector);

function loadLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved) Object.assign(state, { person: saved.person || null, archive: saved.archive || [], achievements: saved.achievements || [] });
  } catch (error) {
    console.warn("Unable to read local save", error);
  }
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ person: state.person, archive: state.archive, achievements: state.achievements }));
}

function avatarSvg(person) {
  const hue = Math.abs(person.seed % 360);
  const hair = person.age < 12 ? "M34 40 Q50 18 66 40" : person.age < 55 ? "M30 42 Q50 16 70 42" : "M30 42 Q50 22 70 42";
  const glasses = person.stats.smarts > 75 ? '<circle cx="42" cy="49" r="7" fill="none" stroke="currentColor"/><circle cx="58" cy="49" r="7" fill="none" stroke="currentColor"/><path d="M49 49h2" stroke="currentColor"/>' : "";
  return `<svg viewBox="0 0 100 100" role="img" aria-label="${person.name} 的程序生成头像" style="--avatar-hue:${hue}"><rect width="100" height="100" rx="24" fill="hsl(var(--avatar-hue) 45% 86%)"/><circle cx="50" cy="50" r="25" fill="hsl(calc(var(--avatar-hue) + 25) 35% 72%)"/><path d="${hair}" fill="none" stroke="hsl(var(--avatar-hue) 30% 26%)" stroke-width="9" stroke-linecap="round"/><circle cx="42" cy="49" r="2"/><circle cx="58" cy="49" r="2"/>${glasses}<path d="M42 62 Q50 ${person.age > 60 ? 64 : 68} 58 62" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M25 96 Q50 72 75 96" fill="hsl(calc(var(--avatar-hue) + 160) 40% 45%)"/></svg>`;
}

function meter(label, value) {
  return `<div class="life-meter"><span>${label}</span><div><i style="width:${value}%"></i></div><strong>${value}</strong></div>`;
}

function renderStats() {
  const person = state.person;
  $("#profile").innerHTML = `${avatarSvg(person)}<div><p class="eyebrow">${person.alive ? `${person.year + person.age} 年 · ${person.age} 岁` : "人生档案已封存"}</p><h1>${person.name}</h1><p>${person.location} · ${person.education} · ${person.career}</p></div>`;
  $("#metrics").innerHTML = [["健康", person.stats.health], ["快乐", person.stats.happiness], ["智慧", person.stats.smarts], ["自律", person.stats.discipline], ["社交", person.stats.social]].map(([label, value]) => meter(label, value)).join("");
  $("#facts").innerHTML = `<li><span>资产</span><strong>¥${person.money.toLocaleString("zh-CN")}</strong></li><li><span>年收入</span><strong>¥${person.salary.toLocaleString("zh-CN")}</strong></li><li><span>家庭</span><strong>${person.partner ? `${person.partner} · ${person.children} 个孩子` : "单身"}</strong></li><li><span>关系</span><strong>家人 ${person.relationships.family} · 朋友 ${person.relationships.friends}</strong></li><li><span>特质</span><strong>${person.traits.join("、") || "尚未形成"}</strong></li>`;
}

function renderEvent() {
  const person = state.person;
  const panel = $("#event-panel");
  if (!person.alive) {
    panel.innerHTML = `<p class="eyebrow">Ending</p><h2>${person.ending?.title || "人生结束"}</h2><p>${person.ending?.description || "这一生已经结束。"}</p><p class="life-score">人生评分 <strong>${calculateLifeScore(person)}</strong></p><button class="primary" id="archive-life" type="button">封存档案并重新投胎</button>`;
    $("#archive-life").addEventListener("click", archiveAndRestart);
    return;
  }
  if (!person.pendingEvent) {
    panel.innerHTML = `<p class="eyebrow">Next year</p><h2>继续这一生</h2><p>点击“长大一岁”，系统会根据年龄、状态、事件权重与冷却生成下一段现实人生。</p><button class="primary" id="age-up" type="button">长大一岁</button>`;
    $("#age-up").addEventListener("click", ageUp);
    return;
  }
  const event = person.pendingEvent;
  panel.innerHTML = `<span class="event-type">${event.type}</span><h2>${event.title}</h2><p>${event.text}</p><div class="choice-list">${event.choices.map((choice) => `<button type="button" data-choice="${choice.id}"><strong>${choice.label}</strong><span>${choice.result}</span></button>`).join("")}</div>`;
  panel.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => choose(button.dataset.choice)));
}

function renderTimeline() {
  const entries = [...state.person.timeline].reverse().slice(0, 24);
  $("#timeline").innerHTML = entries.length ? entries.map((entry) => `<li><time>${entry.age} 岁</time><div><strong>${entry.title}</strong><p>${entry.choice}：${entry.result}</p></div></li>`).join("") : '<li class="empty">人生刚刚开始，档案会记录重要选择。</li>';
}

function renderMeta() {
  $("#archives").innerHTML = state.archive.length ? state.archive.slice(0, 6).map((life) => `<li><strong>${life.name}</strong><span>${life.age} 岁 · ${life.ending} · ${life.score} 分</span></li>`).join("") : "<li>还没有封存的人生。</li>";
  $("#achievements").innerHTML = Object.entries(achievementCatalog).map(([id, [title, desc]]) => `<li class="${state.achievements.includes(id) ? "unlocked" : ""}"><strong>${title}</strong><span>${desc}</span></li>`).join("");
}

function render() {
  renderStats();
  renderEvent();
  renderTimeline();
  renderMeta();
  saveLocal();
}

function ageUp() {
  const random = mulberry32((state.person.seed + state.person.age * 7919 + state.person.timeline.length * 104729) >>> 0);
  state.person = advanceYear(state.person, state.events, random);
  render();
}

function choose(choiceId) {
  state.person = resolveChoice(state.person, state.person.pendingEvent, choiceId);
  state.achievements = deriveAchievements(state.person, state.achievements);
  render();
}

function archiveAndRestart() {
  const person = state.person;
  state.achievements = deriveAchievements(person, state.achievements);
  state.archive.unshift({ id: person.id, name: person.name, age: person.age, ending: person.ending?.title || "人生结束", score: calculateLifeScore(person), money: person.money, traits: person.traits, completedAt: new Date().toISOString() });
  state.archive = state.archive.slice(0, 30);
  state.person = createPerson();
  render();
}

function newLife() {
  if (state.person?.timeline.length && !confirm("当前人生尚未结束，确定重新投胎吗？")) return;
  state.person = createPerson();
  render();
}

function exportSave() {
  const blob = new Blob([JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `world-life-${state.person.name}-${state.person.age}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function clearData() {
  if (!confirm("这会清除当前人生、历史档案和全部成就。确定继续吗？")) return;
  localStorage.removeItem(STORAGE_KEY);
  state.archive = [];
  state.achievements = [];
  state.person = createPerson();
  render();
}

async function init() {
  const response = await fetch("./data/life-events.json");
  if (!response.ok) throw new Error("事件 JSON 加载失败");
  state.events = await response.json();
  loadLocal();
  if (!state.person) state.person = createPerson();
  $("#new-life").addEventListener("click", newLife);
  $("#export-save").addEventListener("click", exportSave);
  $("#clear-data").addEventListener("click", clearData);
  render();
}

init().catch((error) => {
  $("#event-panel").innerHTML = `<h2>无法启动人生模拟</h2><p>${error.message}</p>`;
});
