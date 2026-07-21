const deepClone = (value) => structuredClone(value);

function getPath(object, path) {
  return path.split('.').reduce((current, key) => current?.[key], object);
}

function deriveAgeYears(life) {
  return Math.floor(life.clock.totalWeeks / 52);
}

function deterministicUnit(seed, cursor) {
  let value = (Number(seed) ^ Math.imul(cursor + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function arrayContainsAll(haystack = [], needles = []) {
  const set = new Set(haystack);
  return needles.every((item) => set.has(item));
}

function relationshipMatches(life, condition) {
  if (!condition) return true;
  return life.relationships.some((relationship) => {
    if (condition.role && relationship.role !== condition.role) return false;
    if (condition.status && relationship.status !== condition.status) return false;
    for (const [key, minimum] of Object.entries(condition.dimensionMin || {})) {
      if ((relationship.dimensions?.[key] ?? 0) < minimum) return false;
    }
    for (const [key, maximum] of Object.entries(condition.dimensionMax || {})) {
      if ((relationship.dimensions?.[key] ?? 0) > maximum) return false;
    }
    return true;
  });
}

export function eventConditionsMatch(life, conditions = {}) {
  const ageYears = deriveAgeYears(life);
  if (conditions.age?.min != null && ageYears < conditions.age.min) return false;
  if (conditions.age?.max != null && ageYears > conditions.age.max) return false;
  const stageWeeks = life.clock.totalWeeks - life.clock.stageStartedAtWeeks;
  if (conditions.weekInStage?.min != null && stageWeeks < conditions.weekInStage.min) return false;
  if (conditions.weekInStage?.max != null && stageWeeks > conditions.weekInStage.max) return false;
  if (!arrayContainsAll(life.history.tags, conditions.requiredTags)) return false;
  if ((conditions.forbiddenTags || []).some((tag) => life.history.tags.includes(tag))) return false;
  if (!(conditions.flagsAll || []).every((flag) => Boolean(life.history.flags[flag]))) return false;
  if ((conditions.flagsNone || []).some((flag) => Boolean(life.history.flags[flag]))) return false;
  for (const [path, minimum] of Object.entries(conditions.statMin || {})) {
    if ((getPath(life, path) ?? 0) < minimum) return false;
  }
  for (const [path, maximum] of Object.entries(conditions.statMax || {})) {
    if ((getPath(life, path) ?? 0) > maximum) return false;
  }
  for (const [path, minimum] of Object.entries(conditions.resourceMin || {})) {
    if ((getPath(life, path) ?? 0) < minimum) return false;
  }
  for (const [path, maximum] of Object.entries(conditions.resourceMax || {})) {
    if ((getPath(life, path) ?? 0) > maximum) return false;
  }
  return relationshipMatches(life, conditions.relationship);
}

export function effectiveEventWeight(life, event) {
  let weight = Number(event.weight);
  if (!Number.isFinite(weight) || weight <= 0) throw new Error(`Invalid event weight: ${event.id}`);
  for (const modifier of event.probabilityModifiers || []) {
    if (eventConditionsMatch(life, modifier.conditions)) weight *= modifier.multiplier;
  }
  return weight;
}

function eventSeen(life, eventId) {
  return life.history.timeline.some((entry) => entry.eventId === eventId);
}

export function eligibleEvents(life, events) {
  return events.filter((event) => {
    const interrupt = event.canInterruptStage === true;
    if (!interrupt && event.stage !== life.clock.stage) return false;
    if (!interrupt) {
      const expectedScale = life.clock.stage === 'romance' ? 'week' : 'year';
      if (event.timeScale !== expectedScale) return false;
    }
    if (interrupt && !['year', 'week'].includes(event.timeScale)) return false;
    if (!eventConditionsMatch(life, event.conditions)) return false;
    if (event.oncePerLife && eventSeen(life, event.id)) return false;
    const cooldownUntil = life.history.cooldowns[event.id];
    if (Number.isInteger(cooldownUntil) && life.clock.totalWeeks < cooldownUntil) return false;
    return effectiveEventWeight(life, event) > 0;
  });
}

export function selectEventAtomic(life, events) {
  const next = deepClone(life);
  const pool = eligibleEvents(next, events);
  if (!pool.length) {
    next.pendingEvent = null;
    return next;
  }
  const maxPriority = Math.max(...pool.map((event) => Number(event.priority ?? 100)));
  const layer = pool.filter((event) => Number(event.priority ?? 100) === maxPriority)
    .sort((a, b) => a.id.localeCompare(b.id));
  const weights = layer.map((event) => effectiveEventWeight(next, event));
  const total = weights.reduce((sum, value) => sum + value, 0);
  const roll = deterministicUnit(next.seed, next.rngCursor) * total;
  next.rngCursor += 1;
  let cursor = roll;
  let selected = layer.at(-1);
  for (let index = 0; index < layer.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) {
      selected = layer[index];
      break;
    }
  }
  next.pendingEvent = deepClone(selected);
  return next;
}

function durationToWeeks(duration) {
  if (!duration) return 0;
  if (!Number.isInteger(duration.amount) || duration.amount < 0) throw new Error('Invalid cooldown duration');
  if (duration.unit === 'year') return duration.amount * 52;
  if (duration.unit === 'week') return duration.amount;
  throw new Error(`Unknown cooldown unit: ${duration.unit}`);
}

export function resolvePendingChoice(life, choiceId, executeCommands, options = {}) {
  if (typeof executeCommands !== 'function') throw new Error('executeCommands callback is required');
  const event = life.pendingEvent;
  if (!event) throw new Error('No pending event');
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error(`Unknown choice: ${choiceId}`);
  const before = deepClone(life);
  const next = executeCommands(before, choice.commands || [], {
    ...options,
    timeScale: event.timeScale,
  });
  const resolvedAt = next.clock.totalWeeks;
  if (event.cooldown) {
    next.history.cooldowns[event.id] = resolvedAt + durationToWeeks(event.cooldown);
  }
  next.history.timeline.push({
    id: `timeline-${next.history.timeline.length}-${event.id}`,
    atTotalWeeks: resolvedAt,
    stage: event.stage,
    timeScale: event.timeScale,
    kind: 'event_choice',
    eventId: event.id,
    choiceId: choice.id,
    title: event.narration.title,
    summary: choice.result,
  });
  next.pendingEvent = null;
  if (choice.nextEventId) {
    next.history.scheduled.unshift({
      id: `next-${choice.nextEventId}-${resolvedAt}`,
      dueAtTotalWeeks: resolvedAt,
      kind: 'event',
      payload: { eventId: choice.nextEventId, forced: true },
    });
  }
  return next;
}

export function runAnnualTurn(life, events, choose, executeCommands, options = {}) {
  if (life.clock.stage !== 'life') throw new Error('Annual turn requires life stage');
  const selected = selectEventAtomic(life, events);
  if (!selected.pendingEvent) return selected;
  const choiceId = choose(selected.pendingEvent, selected);
  return resolvePendingChoice(selected, choiceId, executeCommands, options);
}
