export const STAT_KEYS = ["health", "happiness", "smarts", "discipline", "social"];

export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function createPerson(options = {}) {
  const seed = Number.isInteger(options.seed) ? options.seed : Math.floor(Math.random() * 2 ** 31);
  const rng = mulberry32(seed);
  const names = options.names || ["林知夏", "陈默", "周遥", "苏晴", "许川", "顾言"];
  return {
    id: options.id || `life-${Date.now()}-${seed}`,
    seed,
    name: options.name || names[Math.floor(rng() * names.length)],
    age: 0,
    alive: true,
    year: options.startYear || 2000 + Math.floor(rng() * 16),
    location: options.location || "一座普通城市",
    education: "未入学",
    career: "无",
    salary: 0,
    money: 0,
    partner: null,
    children: 0,
    stats: {
      health: 55 + Math.floor(rng() * 31),
      happiness: 50 + Math.floor(rng() * 31),
      smarts: 45 + Math.floor(rng() * 41),
      discipline: 40 + Math.floor(rng() * 41),
      social: 40 + Math.floor(rng() * 41),
    },
    traits: [],
    flags: {},
    cooldowns: {},
    relationships: { family: 60, friends: 20, partner: 0 },
    timeline: [],
    pendingEvent: null,
    ending: null,
    summaryTags: [],
  };
}

function conditionMatches(person, condition = {}) {
  if (condition.minAge != null && person.age < condition.minAge) return false;
  if (condition.maxAge != null && person.age > condition.maxAge) return false;
  if (condition.alive != null && person.alive !== condition.alive) return false;
  if (condition.career && person.career !== condition.career) return false;
  if (condition.education && person.education !== condition.education) return false;
  if (condition.flag && !person.flags[condition.flag]) return false;
  if (condition.notFlag && person.flags[condition.notFlag]) return false;
  if (condition.minMoney != null && person.money < condition.minMoney) return false;
  if (condition.stat) {
    const value = person.stats[condition.stat.key] ?? 0;
    if (condition.stat.min != null && value < condition.stat.min) return false;
    if (condition.stat.max != null && value > condition.stat.max) return false;
  }
  return true;
}

export function eligibleEvents(person, events) {
  return events.filter((event) => {
    if (!conditionMatches(person, event.condition)) return false;
    const remaining = person.cooldowns[event.id] || 0;
    return remaining <= 0;
  });
}

export function chooseWeightedEvent(person, events, random = Math.random) {
  const eligible = eligibleEvents(person, events);
  if (!eligible.length) return null;
  const total = eligible.reduce((sum, event) => sum + (event.weight || 1), 0);
  let roll = random() * total;
  for (const event of eligible) {
    roll -= event.weight || 1;
    if (roll <= 0) return structuredClone(event);
  }
  return structuredClone(eligible.at(-1));
}

function applyEffect(person, effect = {}) {
  if (effect.stats) {
    for (const [key, delta] of Object.entries(effect.stats)) {
      person.stats[key] = clamp((person.stats[key] || 0) + delta);
    }
  }
  if (effect.relationships) {
    for (const [key, delta] of Object.entries(effect.relationships)) {
      person.relationships[key] = clamp((person.relationships[key] || 0) + delta);
    }
  }
  if (effect.money) person.money = Math.max(0, person.money + effect.money);
  if (effect.salary) person.salary = Math.max(0, person.salary + effect.salary);
  if (effect.education) person.education = effect.education;
  if (effect.career) person.career = effect.career;
  if (effect.partner !== undefined) person.partner = effect.partner;
  if (effect.children) person.children = Math.max(0, person.children + effect.children);
  if (effect.addTrait && !person.traits.includes(effect.addTrait)) person.traits.push(effect.addTrait);
  if (effect.flag) person.flags[effect.flag] = true;
  if (effect.clearFlag) delete person.flags[effect.clearFlag];
}

export function resolveChoice(person, event, choiceId) {
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error(`Unknown choice: ${choiceId}`);
  const next = structuredClone(person);
  applyEffect(next, choice.effect);
  next.timeline.push({
    age: next.age,
    year: next.year + next.age,
    type: event.type,
    eventId: event.id,
    title: event.title,
    choice: choice.label,
    result: choice.result,
  });
  next.pendingEvent = null;
  if (event.cooldown) next.cooldowns[event.id] = event.cooldown;
  if (choice.ending) {
    next.alive = false;
    next.ending = choice.ending;
  }
  return next;
}

function naturalYearEffects(person, random) {
  const next = structuredClone(person);
  next.age += 1;
  for (const key of Object.keys(next.cooldowns)) next.cooldowns[key] -= 1;
  if (next.age >= 18 && next.salary > 0) next.money += Math.round(next.salary * (0.55 + random() * 0.25));
  if (next.age > 45) next.stats.health = clamp(next.stats.health - (random() < 0.45 ? 1 : 0));
  if (next.age > 70) next.stats.health = clamp(next.stats.health - 1);
  next.stats.happiness = clamp(next.stats.happiness + (next.money > 100000 ? 1 : 0) - (next.money === 0 && next.age > 24 ? 1 : 0));
  return next;
}

export function checkNaturalEnding(person, random = Math.random) {
  if (!person.alive) return person;
  const next = structuredClone(person);
  const ageRisk = Math.max(0, (next.age - 68) / 170);
  const healthRisk = Math.max(0, (35 - next.stats.health) / 160);
  if (next.stats.health <= 0 || random() < ageRisk + healthRisk) {
    next.alive = false;
    next.ending = {
      id: next.age >= 80 ? "long-life" : "ordinary-life",
      title: next.age >= 80 ? "漫长的一生" : "人生落幕",
      description: `你在 ${next.age} 岁结束了这一生。留下的，不只是数字，还有一次次选择。`,
    };
  }
  return next;
}

export function advanceYear(person, events, random = Math.random) {
  if (!person.alive) return structuredClone(person);
  let next = naturalYearEffects(person, random);
  next = checkNaturalEnding(next, random);
  if (!next.alive) return next;
  const event = chooseWeightedEvent(next, events, random);
  next.pendingEvent = event;
  if (!event) {
    next.timeline.push({ age: next.age, year: next.year + next.age, type: "quiet", title: "平静的一年", choice: "继续生活", result: "这一年没有发生特别重大的事。" });
  }
  return next;
}

export function calculateLifeScore(person) {
  const statAverage = STAT_KEYS.reduce((sum, key) => sum + person.stats[key], 0) / STAT_KEYS.length;
  const longevity = Math.min(100, person.age * 1.15);
  const wealth = Math.min(100, Math.log10(person.money + 1) * 18);
  const connection = (person.relationships.family + person.relationships.friends + person.relationships.partner) / 3;
  return Math.round(statAverage * 0.35 + longevity * 0.25 + wealth * 0.15 + connection * 0.25);
}

export function deriveAchievements(person, existing = []) {
  const unlocked = new Set(existing);
  if (person.age >= 80) unlocked.add("long-life");
  if (person.money >= 1000000) unlocked.add("millionaire");
  if (person.children >= 3) unlocked.add("big-family");
  if (person.stats.smarts >= 90) unlocked.add("brilliant");
  if (person.relationships.friends >= 90) unlocked.add("beloved");
  if (person.timeline.length >= 70) unlocked.add("full-archive");
  return [...unlocked];
}
