import { applyCommandsAtomic, relationshipHardLimitReached } from './life-engine-v3.js';
import { eligibleEvents, resolvePendingChoice, selectEventAtomic } from './life-event-engine-v3.js';

const deepClone = (value) => structuredClone(value);

function activeRomanceRelationship(life) {
  const preferredId = life.history.flags.activeRomanceRelationshipId;
  if (preferredId) {
    const preferred = life.relationships.find((item) => item.id === preferredId);
    if (preferred) return preferred;
  }
  return life.relationships.find((item) =>
    ['potential','dating','exclusive','cohabiting','engaged','paused'].includes(item.status));
}

export function enterRomanceStage(life, relationshipId) {
  const relationship = life.relationships.find((item) => item.id === relationshipId);
  if (!relationship) throw new Error(`Unknown relationship: ${relationshipId}`);
  if (!['potential','dating','exclusive','cohabiting','engaged','paused'].includes(relationship.status)) {
    throw new Error(`Relationship cannot enter romance stage from status: ${relationship.status}`);
  }
  const next = deepClone(life);
  next.clock.stage = 'romance';
  next.clock.stageStartedAtWeeks = next.clock.totalWeeks;
  next.history.flags.activeRomanceRelationshipId = relationshipId;
  return next;
}

export function exitRomanceStage(life) {
  const next = deepClone(life);
  next.clock.stage = 'life';
  next.clock.stageStartedAtWeeks = next.clock.totalWeeks;
  delete next.history.flags.activeRomanceRelationshipId;
  return next;
}

function hardLimitResolutionPool(life, romanceEvents, relationshipRules) {
  if (!relationshipHardLimitReached(life, relationshipRules)) return [];
  const minimumPriority = relationshipRules.hardLimitResolution.priorityMinimum;
  return eligibleEvents(life, romanceEvents).filter((event) =>
    event.relationshipResolution === true && Number(event.priority ?? 0) >= minimumPriority);
}

function interruptPool(life, interruptEvents) {
  return eligibleEvents(life, interruptEvents).filter((event) => event.canInterruptStage === true);
}

export function selectRomanceTurn(life, romanceEvents, interruptEvents, relationshipRules) {
  if (life.clock.stage !== 'romance') throw new Error('Romance turn requires romance stage');
  if (!activeRomanceRelationship(life)) throw new Error('Romance stage requires an active relationship');

  const forcedResolution = hardLimitResolutionPool(life, romanceEvents, relationshipRules);
  if (relationshipHardLimitReached(life, relationshipRules)) {
    if (!forcedResolution.length) throw new Error('Romance hard limit reached without eligible resolution event');
    return selectEventAtomic(life, forcedResolution);
  }

  const interrupts = interruptPool(life, interruptEvents);
  if (interrupts.length) return selectEventAtomic(life, interrupts);

  const romancePool = eligibleEvents(life, romanceEvents);
  if (romancePool.length) return selectEventAtomic(life, romancePool);

  const quiet = deepClone(life);
  quiet.clock.totalWeeks += 1;
  quiet.history.timeline.push({
    id: `timeline-${quiet.history.timeline.length}-quiet-romance-week`,
    atTotalWeeks: quiet.clock.totalWeeks,
    stage: 'romance',
    timeScale: 'week',
    kind: 'quiet_week',
    title: '平静的一周',
    summary: '这一周没有需要作出重大决定的关系事件。',
  });
  quiet.pendingEvent = null;
  return quiet;
}

export function resolveRomanceChoice(life, choiceId, relationshipRules) {
  const event = life.pendingEvent;
  if (!event) throw new Error('No pending romance event');
  const originalStage = life.clock.stage;
  const originalStageStartedAtWeeks = life.clock.stageStartedAtWeeks;
  const resolved = resolvePendingChoice(
    life,
    choiceId,
    applyCommandsAtomic,
    { relationshipRules },
  );

  if (event.canInterruptStage === true) {
    resolved.clock.stage = originalStage;
    resolved.clock.stageStartedAtWeeks = originalStageStartedAtWeeks;
  }

  const relationship = activeRomanceRelationship(resolved);
  const terminal = !relationship || ['married','paused','broken_up','no_contact'].includes(relationship.status);
  if (terminal && resolved.clock.stage === 'romance') return exitRomanceStage(resolved);
  return resolved;
}

export function runRomanceTurn(life, romanceEvents, interruptEvents, choose, relationshipRules) {
  const selected = selectRomanceTurn(life, romanceEvents, interruptEvents, relationshipRules);
  if (!selected.pendingEvent) return selected;
  const choiceId = choose(selected.pendingEvent, selected);
  return resolveRomanceChoice(selected, choiceId, relationshipRules);
}
