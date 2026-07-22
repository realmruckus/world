export const IDENTITY_STEPS = Object.freeze([
  'gender', 'zodiac', 'family', 'parentJobPrimary', 'parentJobSecondary', 'review',
]);

const SELECTABLE_IDENTITY_STEPS = IDENTITY_STEPS.slice(0, -1);
const CARD_STATES = new Set(['available', 'expanded', 'disabled', 'locked']);
const CARD_FIELDS = new Set([
  'cardId', 'choiceId', 'title', 'summary', 'details', 'assetId', 'state', 'disabledReason',
  'requirements', 'effectsPreview', 'risk', 'source', 'rarityOrImportance', 'accessibilityLabel',
]);

function clone(value) {
  return structuredClone(value);
}

function freeze(value) {
  if (Array.isArray(value)) value.forEach(freeze);
  else if (value && typeof value === 'object') Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function nonEmptyId(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value;
}

function validateIdentityOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('Identity options are required');
  for (const key of Object.keys(options)) {
    if (!SELECTABLE_IDENTITY_STEPS.includes(key)) throw new Error(`Unknown identity step: ${key}`);
  }
  for (const step of SELECTABLE_IDENTITY_STEPS) {
    if (!Array.isArray(options[step]) || options[step].length === 0) throw new Error(`${step} requires at least one option`);
    const ids = options[step].map((item) => typeof item === 'string' ? item : item?.id);
    ids.forEach((id) => nonEmptyId(id, `${step} option`));
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ${step} option`);
  }
}

function identityOptionId(option) {
  return typeof option === 'string' ? option : option.id;
}

function assertBuilder(builder) {
  if (!builder || builder.kind !== 'identity-builder' || !IDENTITY_STEPS.includes(builder.step)) {
    throw new Error('Invalid IdentityBuilder state');
  }
}

export function createIdentityBuilder({ options, selections = {} } = {}) {
  validateIdentityOptions(options);
  for (const key of Object.keys(selections)) {
    if (!SELECTABLE_IDENTITY_STEPS.includes(key)) throw new Error(`Unknown identity selection: ${key}`);
    if (!options[key].some((item) => identityOptionId(item) === selections[key])) throw new Error(`Unknown option for ${key}: ${selections[key]}`);
  }
  return freeze({
    kind: 'identity-builder',
    version: 1,
    step: IDENTITY_STEPS[0],
    status: 'editing',
    options: clone(options),
    selections: clone(selections),
    confirmationId: null,
  });
}

export function selectIdentityCard(builder, step, optionId) {
  assertBuilder(builder);
  if (builder.status !== 'editing') throw new Error('IdentityBuilder is already confirmed');
  if (builder.step !== step || !SELECTABLE_IDENTITY_STEPS.includes(step)) throw new Error('Identity card must match the current step');
  if (!builder.options[step].some((item) => identityOptionId(item) === optionId)) throw new Error(`Unknown option for ${step}: ${optionId}`);
  return freeze({ ...clone(builder), selections: { ...clone(builder.selections), [step]: optionId } });
}

export function advanceIdentityBuilder(builder) {
  assertBuilder(builder);
  if (builder.status !== 'editing') throw new Error('IdentityBuilder is already confirmed');
  const index = IDENTITY_STEPS.indexOf(builder.step);
  if (builder.step === 'review') throw new Error('Review must be confirmed');
  if (!builder.selections[builder.step]) throw new Error(`${builder.step} selection is required`);
  return freeze({ ...clone(builder), step: IDENTITY_STEPS[index + 1] });
}

export function retreatIdentityBuilder(builder) {
  assertBuilder(builder);
  if (builder.status !== 'editing') throw new Error('Confirmed IdentityBuilder cannot move backward');
  const index = IDENTITY_STEPS.indexOf(builder.step);
  if (index === 0) throw new Error('IdentityBuilder is already at the first step');
  return freeze({ ...clone(builder), step: IDENTITY_STEPS[index - 1] });
}

export function confirmIdentityBuilder(builder) {
  assertBuilder(builder);
  if (builder.status === 'confirmed') throw new Error('IdentityBuilder is already confirmed');
  if (builder.step !== 'review') throw new Error('IdentityBuilder must reach review before confirmation');
  for (const step of SELECTABLE_IDENTITY_STEPS) {
    if (!builder.selections[step]) throw new Error(`${step} selection is required`);
  }
  const confirmationId = SELECTABLE_IDENTITY_STEPS.map((step) => builder.selections[step]).join('|');
  return freeze({ ...clone(builder), status: 'confirmed', confirmationId });
}

export function identityBuilderView(builder) {
  assertBuilder(builder);
  const options = builder.step === 'review' ? [] : builder.options[builder.step];
  return freeze({
    kind: 'identity-builder',
    step: builder.step,
    status: builder.status,
    selections: clone(builder.selections),
    canRetreat: IDENTITY_STEPS.indexOf(builder.step) > 0 && builder.status === 'editing',
    canAdvance: builder.step !== 'review' && Boolean(builder.selections[builder.step]),
    canConfirm: builder.step === 'review' && SELECTABLE_IDENTITY_STEPS.every((step) => builder.selections[step]),
    cards: options.map((option) => {
      const id = identityOptionId(option);
      return {
        id,
        title: typeof option === 'string' ? id : option.title || id,
        summary: typeof option === 'string' ? '' : option.summary || '',
        assetId: typeof option === 'string' ? `placeholder:identity:${builder.step}` : option.assetId || `placeholder:identity:${builder.step}`,
        selected: builder.selections[builder.step] === id,
      };
    }),
  });
}

export function createProfileCardViewModel(life) {
  if (!life || typeof life !== 'object') throw new Error('Life state is required');
  const identity = life.identity || {};
  const parentJobIds = Array.isArray(identity.parentJobIds) ? [...identity.parentJobIds] : [];
  const totalWeeks = Number(life.clock?.totalWeeks || 0);
  if (!Number.isInteger(totalWeeks) || totalWeeks < 0) throw new Error('Profile totalWeeks must be a non-negative integer');
  return freeze({
    kind: 'profile-card',
    assetId: identity.assetId || 'placeholder:profile:portrait',
    name: identity.name || '',
    ageYears: Math.floor(totalWeeks / 52),
    weekOfYear: totalWeeks % 52,
    stage: life.clock?.stage || 'life',
    identity: {
      genderId: identity.genderId || identity.gender || null,
      zodiacSignId: identity.zodiacSignId || null,
      familyId: identity.familyId || null,
      parentJobIds,
      birthday: identity.birthMonth && identity.birthDay ? { month: identity.birthMonth, day: identity.birthDay } : null,
    },
    educationId: life.career?.educationId || 'none',
    careerId: life.career?.id || 'none',
    cash: Number(life.finance?.cash || 0),
    health: Number(life.health?.health || 0),
    relationshipCount: Array.isArray(life.relationships) ? life.relationships.length : 0,
  });
}

export function createLifeChoiceCardViewModel(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Choice card input is required');
  for (const key of Object.keys(input)) if (!CARD_FIELDS.has(key)) throw new Error(`Unknown card field: ${key}`);
  const state = input.state || 'available';
  if (!CARD_STATES.has(state)) throw new Error(`Unknown card state: ${state}`);
  if (!String(input.assetId || '').startsWith('placeholder:')) throw new Error('RR-113 cards require a placeholder Asset ID');
  if ((state === 'disabled' || state === 'locked') && !String(input.disabledReason || '').trim()) throw new Error('A disabled reason is required');
  const output = {
    cardId: nonEmptyId(input.cardId, 'cardId'),
    choiceId: nonEmptyId(input.choiceId, 'choiceId'),
    title: nonEmptyId(input.title, 'title'),
    summary: String(input.summary || ''),
    details: String(input.details || ''),
    assetId: input.assetId,
    state,
    disabledReason: input.disabledReason || null,
    requirements: clone(input.requirements || []),
    effectsPreview: clone(input.effectsPreview || []),
    risk: input.risk ?? null,
    source: String(input.source || ''),
    rarityOrImportance: String(input.rarityOrImportance || 'standard'),
    accessibilityLabel: nonEmptyId(input.accessibilityLabel, 'accessibilityLabel'),
  };
  if (!Array.isArray(output.requirements) || !Array.isArray(output.effectsPreview)) throw new Error('Card requirements and effectsPreview must be arrays');
  return freeze(output);
}

function validateOffer(offer) {
  if (!offer || offer.kind !== 'life-offer') throw new Error('A Life Offer is required');
  if (!Array.isArray(offer.cards) || offer.cards.length === 0) throw new Error('Life Offer requires at least one card');
  if (!Number.isInteger(offer.revision) || offer.revision < 0) throw new Error('Offer revision must be a non-negative integer');
}

export function createLifeOffer({ offerId, revision, cards, mulligansRemaining = 0 } = {}) {
  nonEmptyId(offerId, 'offerId');
  if (!Number.isInteger(revision) || revision < 0) throw new Error('Offer revision must be a non-negative integer');
  if (!Array.isArray(cards) || cards.length === 0) throw new Error('Life Offer requires at least one card');
  if (!Number.isInteger(mulligansRemaining) || mulligansRemaining < 0) throw new Error('mulligansRemaining must be a non-negative integer');
  const choiceIds = cards.map((item) => item?.choiceId);
  if (choiceIds.some((id) => !id) || new Set(choiceIds).size !== choiceIds.length) throw new Error('Offer choiceIds must be present and unique');
  return freeze({ kind: 'life-offer', offerId, revision, mulligansRemaining, cards: clone(cards) });
}

export function createLifeInteractionState({ offer } = {}) {
  validateOffer(offer);
  return freeze({
    kind: 'life-interaction', offer: clone(offer), expandedCardId: null, detailChoiceId: null,
    submissionStatus: 'idle', submittedChoiceId: null, mulliganStatus: 'idle', focusChoiceId: null,
  });
}

function assertInteraction(state) {
  if (!state || state.kind !== 'life-interaction') throw new Error('Invalid life interaction state');
  validateOffer(state.offer);
}

function cardForChoice(state, choiceId) {
  const found = state.offer.cards.find((item) => item.choiceId === choiceId);
  if (!found) throw new Error(`Unknown choice: ${choiceId}`);
  return found;
}

export function openExpandedCard(state, choiceId) {
  assertInteraction(state);
  const selected = cardForChoice(state, choiceId);
  return freeze({ ...clone(state), expandedCardId: selected.cardId, focusChoiceId: choiceId });
}

export function closeExpandedCard(state) {
  assertInteraction(state);
  return freeze({ ...clone(state), expandedCardId: null });
}

export function openCardDetail(state, choiceId) {
  assertInteraction(state);
  cardForChoice(state, choiceId);
  return freeze({ ...clone(state), detailChoiceId: choiceId, focusChoiceId: choiceId });
}

export function closeCardDetail(state) {
  assertInteraction(state);
  return freeze({ ...clone(state), detailChoiceId: null });
}

export function playLifeChoice(state, choiceId) {
  assertInteraction(state);
  if (state.submissionStatus !== 'idle') throw new Error('A choice is already submitting');
  if (state.mulliganStatus !== 'idle') throw new Error('A mulligan is already requesting');
  const selected = cardForChoice(state, choiceId);
  if (selected.state === 'disabled' || selected.state === 'locked') throw new Error(selected.disabledReason);
  return {
    state: freeze({ ...clone(state), submissionStatus: 'submitting', submittedChoiceId: choiceId, detailChoiceId: null }),
    submission: freeze({ choiceId }),
  };
}

export function requestMulligan(state) {
  assertInteraction(state);
  if (state.submissionStatus !== 'idle') throw new Error('A choice is already submitting');
  if (state.mulliganStatus !== 'idle') throw new Error('A mulligan is already requesting');
  if (state.offer.mulligansRemaining === 0) throw new Error('There are no mulligans remaining');
  return {
    state: freeze({ ...clone(state), mulliganStatus: 'requesting', expandedCardId: null, detailChoiceId: null }),
    request: freeze({ type: 'mulligan-request', offerId: state.offer.offerId, revision: state.offer.revision }),
  };
}

export function applyMulliganOffer(state, nextOffer) {
  assertInteraction(state);
  validateOffer(nextOffer);
  if (state.mulliganStatus !== 'requesting') throw new Error('No mulligan is requesting');
  if (nextOffer.offerId !== state.offer.offerId) throw new Error('Mulligan Offer ID does not match');
  if (nextOffer.revision <= state.offer.revision) throw new Error('Mulligan requires a newer revision');
  return freeze({ ...clone(state), offer: clone(nextOffer), mulliganStatus: 'idle', focusChoiceId: nextOffer.cards[0].choiceId });
}

export function restoreLifeInteractionState(snapshot, currentOffer) {
  validateOffer(currentOffer);
  if (!snapshot || snapshot.kind !== 'life-interaction') throw new Error('Invalid interaction snapshot');
  if (snapshot.offer.offerId !== currentOffer.offerId || snapshot.offer.revision !== currentOffer.revision) {
    return createLifeInteractionState({ offer: currentOffer });
  }
  const ids = new Set(currentOffer.cards.map((item) => item.choiceId));
  if (snapshot.detailChoiceId && !ids.has(snapshot.detailChoiceId)) throw new Error('Unknown detail choice in restored state');
  if (snapshot.focusChoiceId && !ids.has(snapshot.focusChoiceId)) throw new Error('Unknown focus choice in restored state');
  return freeze({ ...clone(snapshot), offer: clone(currentOffer), submissionStatus: 'idle', mulliganStatus: 'idle' });
}
