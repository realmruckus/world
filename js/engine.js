export const WORLD_ENGINE_VERSION = "0.1.0";

export function createSeededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createMonster({ id, name, race }) {
  return {
    id,
    name,
    race,
    level: 1,
    experience: 0,
    attributes: { strength: 1, agility: 1, endurance: 1, instinct: 1 },
    skills: { hunting: 0, scouting: 0, gathering: 0, combat: 0, crafting: 0, diplomacy: 0 },
    traitProgress: {},
    traits: [],
    experiences: [],
    relationships: {},
    equipment: [],
    injuries: [],
    status: "ACTIVE",
    locationId: "FOREST_EDGE"
  };
}

export function createWorldState(monster) {
  return {
    engineVersion: WORLD_ENGINE_VERSION,
    tick: 0,
    gold: 20,
    materials: { food: 2, wood: 0, ore: 0 },
    monsters: [monster],
    activeMonsterId: monster.id,
    locations: {
      FOREST_EDGE: { id: "FOREST_EDGE", name: "森林边缘", capacity: 1, ownerId: null, garrison: [] },
      OLD_CAVE: { id: "OLD_CAVE", name: "旧山洞", capacity: 5, ownerId: null, garrison: [] }
    },
    eventLog: []
  };
}

export function applyEffects(state, monster, effects) {
  for (const effect of effects) {
    switch (effect.type) {
      case "RESOURCE":
        state.materials[effect.resource] = (state.materials[effect.resource] || 0) + effect.value;
        break;
      case "GOLD":
        state.gold += effect.value;
        break;
      case "SKILL_PROGRESS":
        monster.skills[effect.skill] = (monster.skills[effect.skill] || 0) + effect.value;
        break;
      case "ATTRIBUTE":
        monster.attributes[effect.attribute] = (monster.attributes[effect.attribute] || 0) + effect.value;
        break;
      case "TRAIT_PROGRESS": {
        const next = (monster.traitProgress[effect.trait] || 0) + effect.value;
        monster.traitProgress[effect.trait] = next;
        if (next >= (effect.threshold || 5) && !monster.traits.includes(effect.trait)) monster.traits.push(effect.trait);
        break;
      }
      case "ADD_EXPERIENCE":
        if (!monster.experiences.includes(effect.experience)) monster.experiences.push(effect.experience);
        break;
      case "EQUIPMENT":
        monster.equipment.push(effect.item);
        break;
      default:
        throw new Error(`Unsupported effect: ${effect.type}`);
    }
  }
}

const EVENT_TEMPLATES = {
  HUNT: [
    {
      id: "HUNT_TRACKS",
      title: "潮湿泥地上的足迹",
      text: "你发现一串刚留下的足迹。它们通向灌木深处。",
      choices: [
        { id: "FOLLOW", label: "跟踪", effects: [{ type: "SKILL_PROGRESS", skill: "hunting", value: 1 }, { type: "TRAIT_PROGRESS", trait: "CAUTIOUS", value: 1 }] },
        { id: "RUSH", label: "直接冲进去", effects: [{ type: "SKILL_PROGRESS", skill: "combat", value: 1 }, { type: "TRAIT_PROGRESS", trait: "RECKLESS", value: 1 }] }
      ]
    },
    {
      id: "HUNT_CACHE",
      title: "猎物旁的旧背包",
      text: "猎物倒下后，你发现草丛里还有一个被遗忘的旧背包。",
      choices: [
        { id: "SEARCH", label: "仔细翻找", effects: [{ type: "RESOURCE", resource: "food", value: 2 }, { type: "SKILL_PROGRESS", skill: "scouting", value: 1 }] },
        { id: "TAKE_BLADE", label: "只拿走露出的短刀", effects: [{ type: "EQUIPMENT", item: { id: "RUSTY_BLADE", name: "生锈短刀", rarity: "COMMON", power: 1 } }, { type: "ADD_EXPERIENCE", experience: "FOUND_FIRST_WEAPON" }] }
      ]
    },
    {
      id: "HUNT_RARE_DROP",
      title: "铁背兽的遗物",
      text: "你遇到了一头异常强壮的铁背兽。它身上卡着一件不属于荒野的装备。",
      rare: true,
      choices: [
        { id: "CHALLENGE", label: "冒险挑战", effects: [{ type: "SKILL_PROGRESS", skill: "combat", value: 2 }, { type: "EQUIPMENT", item: { id: "IRON_HIDE_VEST", name: "铁皮背心", rarity: "RARE", power: 5 } }, { type: "ADD_EXPERIENCE", experience: "DEFEATED_IRONBACK" }] },
        { id: "OBSERVE", label: "先观察弱点", effects: [{ type: "SKILL_PROGRESS", skill: "scouting", value: 2 }, { type: "TRAIT_PROGRESS", trait: "CAUTIOUS", value: 2 }] }
      ]
    }
  ]
};

export function composeEvent(state, action, seed = Date.now()) {
  const random = createSeededRandom(seed + state.tick);
  const pool = EVENT_TEMPLATES[action];
  if (!pool?.length) throw new Error(`No event templates for action: ${action}`);
  const rareRoll = random();
  const candidates = rareRoll < 0.12 ? pool : pool.filter((event) => !event.rare);
  return structuredClone(candidates[Math.floor(random() * candidates.length)] || pool[0]);
}

export function resolveChoice(state, event, choiceId) {
  const monster = state.monsters.find((item) => item.id === state.activeMonsterId);
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!monster || !choice) throw new Error("Invalid monster or choice");
  applyEffects(state, monster, choice.effects);
  state.tick += 1;
  state.eventLog.unshift({ tick: state.tick, eventId: event.id, title: event.title, choiceId, effects: choice.effects });
  return { state, monster, choice };
}

export function calculateTerritoryOutcome({ attackers, defenders, locationBonus = 1, scoutingBonus = 1, seed = 1 }) {
  const random = createSeededRandom(seed);
  const attackPower = attackers.reduce((sum, unit) => sum + unit.power, 0) * scoutingBonus;
  const defensePower = defenders.reduce((sum, unit) => sum + unit.power, 0) * locationBonus;
  const ratio = attackPower / Math.max(1, attackPower + defensePower);
  const roll = random();
  const margin = ratio - roll;
  if (margin > 0.3) return "DECISIVE_VICTORY";
  if (margin > 0.05) return "NARROW_VICTORY";
  if (margin > -0.05) return "STALEMATE";
  if (margin > -0.3) return "NARROW_DEFEAT";
  return "DECISIVE_DEFEAT";
}

export function calculateLocationNetIncome({ production, garrisonMaintenance, facilityMaintenance, expectedRaidLoss }) {
  return production - garrisonMaintenance - facilityMaintenance - expectedRaidLoss;
}
