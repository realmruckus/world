import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IDENTITY_STEPS,
  advanceIdentityBuilder,
  applyMulliganOffer,
  closeCardDetail,
  closeExpandedCard,
  confirmIdentityBuilder,
  createIdentityBuilder,
  createLifeChoiceCardViewModel,
  createLifeInteractionState,
  createLifeOffer,
  createProfileCardViewModel,
  identityBuilderView,
  openCardDetail,
  openExpandedCard,
  playLifeChoice,
  requestMulligan,
  restoreLifeInteractionState,
  retreatIdentityBuilder,
  selectIdentityCard,
} from '../js/life-ui-foundation.js';

const identityOptions = {
  gender: ['gender_a', 'gender_b'],
  zodiac: ['aries', 'pisces'],
  family: ['family_a', 'family_b'],
  parentJobPrimary: ['job_a', 'job_b'],
  parentJobSecondary: ['job_c', 'job_d'],
};

function completeBuilder() {
  let builder = createIdentityBuilder({ options: identityOptions });
  for (const step of IDENTITY_STEPS.slice(0, -1)) {
    builder = selectIdentityCard(builder, step, identityOptions[step][0]);
    builder = advanceIdentityBuilder(builder);
  }
  return builder;
}

function card(choiceId, overrides = {}) {
  return createLifeChoiceCardViewModel({
    cardId: `card-${choiceId}`,
    choiceId,
    title: `Choice ${choiceId}`,
    summary: 'Neutral placeholder summary',
    details: 'Neutral placeholder details',
    assetId: `placeholder:choice:${choiceId}`,
    requirements: [],
    effectsPreview: [],
    risk: null,
    source: 'fixture:rr-113',
    rarityOrImportance: 'standard',
    accessibilityLabel: `Choice ${choiceId}`,
    ...overrides,
  });
}

test('IdentityBuilder advances, returns, modifies an earlier step, and confirms once', () => {
  let builder = completeBuilder();
  assert.equal(builder.step, 'review');
  builder = retreatIdentityBuilder(builder);
  builder = retreatIdentityBuilder(builder);
  assert.equal(builder.step, 'parentJobPrimary');
  builder = selectIdentityCard(builder, 'parentJobPrimary', 'job_b');
  builder = advanceIdentityBuilder(advanceIdentityBuilder(builder));
  const confirmed = confirmIdentityBuilder(builder);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.selections.parentJobPrimary, 'job_b');
  assert.throws(() => confirmIdentityBuilder(confirmed), /already confirmed/i);
});

test('IdentityBuilder fails closed for incomplete, extra, unknown, and illegal transitions', () => {
  const builder = createIdentityBuilder({ options: identityOptions });
  assert.throws(() => advanceIdentityBuilder(builder), /selection is required/i);
  assert.throws(() => selectIdentityCard(builder, 'family', 'family_a'), /current step/i);
  assert.throws(() => selectIdentityCard(builder, 'gender', 'missing'), /unknown option/i);
  assert.throws(() => createIdentityBuilder({ options: { ...identityOptions, extra: [] } }), /unknown identity step/i);
  assert.throws(() => createIdentityBuilder({ options: { ...identityOptions, zodiac: [] } }), /at least one option/i);
});

test('Identity selections stay independent and returning to family does not rewrite Parent Jobs', () => {
  let builder = completeBuilder();
  const before = structuredClone(builder.selections);
  while (builder.step !== 'family') builder = retreatIdentityBuilder(builder);
  builder = selectIdentityCard(builder, 'family', 'family_b');
  assert.equal(builder.selections.family, 'family_b');
  assert.equal(builder.selections.parentJobPrimary, before.parentJobPrimary);
  assert.equal(builder.selections.parentJobSecondary, before.parentJobSecondary);
});

test('IdentityBuilder view exposes card steps and placeholder assets only', () => {
  const view = identityBuilderView(createIdentityBuilder({ options: identityOptions }));
  assert.equal(view.kind, 'identity-builder');
  assert.equal(view.cards.every((item) => item.assetId.startsWith('placeholder:')), true);
  assert.equal(view.canAdvance, false);
});

test('ProfileCardViewModel reads identity and current state without mutating them', () => {
  const life = {
    identity: {
      name: 'Test Person', genderId: 'gender_a', zodiacSignId: 'aries', familyId: 'family_a',
      parentJobIds: ['job_a', 'job_c'], birthMonth: 4, birthDay: 1,
    },
    clock: { totalWeeks: 53, stage: 'life' },
    career: { educationId: 'college', id: 'starter_job' },
    finance: { cash: 10 }, health: { health: 70 }, relationships: [],
  };
  const snapshot = structuredClone(life);
  const view = createProfileCardViewModel(life);
  assert.deepEqual(life, snapshot);
  assert.equal(view.kind, 'profile-card');
  assert.equal(view.identity.parentJobIds.length, 2);
  assert.equal(view.assetId.startsWith('placeholder:'), true);
  assert.equal(view.ageYears, 1);
});

test('ProfileCardViewModel keeps RR-113 identity as an explicit draft preview and rejects formal assets', () => {
  const life = {
    identity: { name: 'Preview', uiPrototype: { status: 'draft', genderId: 'gender_a', zodiacSignId: 'aries', familyId: 'family_a', parentJobIds: ['job_a'] } },
    clock: { totalWeeks: 0, stage: 'life' }, career: {}, finance: {}, health: {}, relationships: [],
  };
  const view = createProfileCardViewModel(life);
  assert.equal(view.identity.status, 'draft');
  assert.equal(view.identity.parentJobIds[0], 'job_a');
  assert.throws(() => createProfileCardViewModel({ ...life, identity: { ...life.identity, assetId: 'approved:portrait' } }), /placeholder Asset ID/i);
});

test('LifeChoiceCardViewModel is strict, display-ready, and carries a disabled reason', () => {
  const disabled = card('locked', { state: 'disabled', disabledReason: 'Requirement not met' });
  assert.equal(disabled.choiceId, 'locked');
  assert.equal(disabled.disabledReason, 'Requirement not met');
  assert.equal(Object.isFrozen(disabled), true);
  assert.throws(() => card('bad', { assetId: 'https://example.com/art.png' }), /placeholder Asset ID/i);
  assert.throws(() => card('bad', { extra: true }), /unknown card field/i);
  assert.throws(() => card('bad', { state: 'disabled', disabledReason: '' }), /disabled reason/i);
});

test('Hand interaction expands, opens full-screen detail, closes, and restores detail state', () => {
  const offer = createLifeOffer({ offerId: 'offer-1', revision: 1, cards: [card('a'), card('b')] });
  let state = createLifeInteractionState({ offer });
  state = openExpandedCard(state, 'a');
  assert.equal(state.expandedCardId, 'card-a');
  state = openCardDetail(state, 'a');
  assert.equal(state.detailChoiceId, 'a');
  const restored = restoreLifeInteractionState(JSON.parse(JSON.stringify(state)), offer);
  assert.equal(restored.detailChoiceId, 'a');
  assert.equal(closeCardDetail(restored).detailChoiceId, null);
  assert.equal(closeExpandedCard(state).expandedCardId, null);
});

test('playing emits choiceId only and protects disabled or repeated submissions', () => {
  const offer = createLifeOffer({
    offerId: 'offer-2', revision: 1,
    cards: [card('enabled'), card('disabled', { state: 'disabled', disabledReason: 'Not available' })],
  });
  const state = createLifeInteractionState({ offer });
  assert.throws(() => playLifeChoice(state, 'disabled'), /Not available/);
  const played = playLifeChoice(state, 'enabled');
  assert.deepEqual(played.submission, { choiceId: 'enabled' });
  assert.equal(played.state.submissionStatus, 'submitting');
  assert.throws(() => playLifeChoice(played.state, 'enabled'), /already submitting/i);
});

test('Mulligan only requests a replacement and applies the deterministic Offer Model result', () => {
  const initial = createLifeOffer({ offerId: 'offer-3', revision: 3, mulligansRemaining: 1, cards: [card('a')] });
  const state = createLifeInteractionState({ offer: initial });
  const requested = requestMulligan(state);
  assert.deepEqual(requested.request, { type: 'mulligan-request', offerId: 'offer-3', revision: 3 });
  assert.equal(requested.state.mulliganStatus, 'requesting');
  const replacement = createLifeOffer({ offerId: 'offer-3', revision: 4, mulligansRemaining: 0, cards: [card('b')] });
  const applied = applyMulliganOffer(requested.state, replacement);
  assert.equal(applied.offer.cards[0].choiceId, 'b');
  assert.throws(() => requestMulligan(applied), /no mulligans remaining/i);
});

test('empty offers, stale mulligans, and missing restored focus fail closed', () => {
  assert.throws(() => createLifeOffer({ offerId: 'empty', revision: 1, cards: [] }), /at least one card/i);
  const offer = createLifeOffer({ offerId: 'offer-4', revision: 2, mulligansRemaining: 1, cards: [card('a')] });
  const requested = requestMulligan(createLifeInteractionState({ offer }));
  assert.throws(() => applyMulliganOffer(requested.state, { ...offer, revision: 2 }), /newer revision/i);
  const stale = { ...requested.state, detailChoiceId: 'missing' };
  assert.throws(() => restoreLifeInteractionState(stale, offer), /unknown detail choice/i);
});

test('refresh restoration preserves in-flight guards instead of allowing resubmission', () => {
  const offer = createLifeOffer({ offerId: 'offer-5', revision: 1, mulligansRemaining: 1, cards: [card('a')] });
  const submitting = playLifeChoice(createLifeInteractionState({ offer }), 'a').state;
  const restoredSubmission = restoreLifeInteractionState(JSON.parse(JSON.stringify(submitting)), offer);
  assert.equal(restoredSubmission.submissionStatus, 'submitting');
  assert.throws(() => playLifeChoice(restoredSubmission, 'a'), /already submitting/i);

  const requesting = requestMulligan(createLifeInteractionState({ offer })).state;
  const restoredMulligan = restoreLifeInteractionState(JSON.parse(JSON.stringify(requesting)), offer);
  assert.equal(restoredMulligan.mulliganStatus, 'requesting');
  assert.throws(() => requestMulligan(restoredMulligan), /already requesting/i);
});
