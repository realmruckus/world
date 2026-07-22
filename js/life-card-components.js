const HTMLElementBase = globalThis.HTMLElement || class {};

function emit(element, type, detail) {
  if (!globalThis.CustomEvent || typeof element.dispatchEvent !== 'function') return;
  element.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[character]));
}

class LifeCardHand extends HTMLElementBase {
  set model(value) { this._model = value; this.render?.(); }
  get model() { return this._model; }

  connectedCallback() {
    this.setAttribute('role', 'listbox');
    this.addEventListener('keydown', (event) => {
      const cards = [...this.querySelectorAll('[data-choice-id]')];
      const index = cards.indexOf(event.target.closest?.('[data-choice-id]'));
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        cards[(index + delta + cards.length) % cards.length]?.focus();
      }
      if ((event.key === 'Enter' || event.key === ' ') && index >= 0) {
        event.preventDefault();
        emit(this, 'card-inspect', { choiceId: cards[index].dataset.choiceId });
      }
    });
    this.render();
  }

  render() {
    if (!this.isConnected || !this._model) return;
    this.innerHTML = this._model.cards.map((card) => `<button class="life-choice-card" type="button" role="option" data-choice-id="${escapeHtml(card.choiceId)}" aria-label="${escapeHtml(card.accessibilityLabel)}" aria-disabled="${card.state === 'disabled' || card.state === 'locked'}"><span class="life-choice-card__asset" aria-hidden="true">${escapeHtml(card.assetId)}</span><strong>${escapeHtml(card.title)}</strong><span>${escapeHtml(card.summary)}</span>${card.disabledReason ? `<small>${escapeHtml(card.disabledReason)}</small>` : ''}<span class="life-choice-card__actions"><span data-card-detail>详情</span><span data-card-play>打出</span></span></button>`).join('');
    this.querySelectorAll('[data-choice-id]').forEach((button) => {
      button.addEventListener('click', (event) => {
        const choiceId = button.dataset.choiceId;
        if (event.target.closest('[data-card-play]')) emit(this, 'life-choice', { choiceId });
        else if (event.target.closest('[data-card-detail]')) emit(this, 'card-detail-open', { choiceId });
        else emit(this, 'card-inspect', { choiceId });
      });
    });
  }
}

class LifeCardStack extends LifeCardHand {}

class LifeCardDetail extends HTMLElementBase {
  set card(value) { this._card = value; this.render?.(); }
  get card() { return this._card; }

  connectedCallback() {
    this.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); this.close(); }
    });
    this.render();
  }

  open(card, restoreFocus) {
    this._restoreFocus = restoreFocus || globalThis.document?.activeElement;
    this.card = card;
    this.hidden = false;
    this.querySelector('[data-card-detail-close]')?.focus();
  }

  close() {
    this.hidden = true;
    emit(this, 'card-detail-close', { choiceId: this._card?.choiceId || null });
    this.restoreFocus();
  }

  restoreFocus() { this._restoreFocus?.focus?.(); }

  render() {
    if (!this.isConnected || !this._card) return;
    const card = this._card;
    this.innerHTML = `<div class="life-card-detail__surface"><button type="button" data-card-detail-close aria-label="关闭详情">关闭</button><span class="life-choice-card__asset" aria-hidden="true">${escapeHtml(card.assetId)}</span><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.details || card.summary)}</p><dl><dt>条件</dt><dd>${escapeHtml(card.requirements.join(' · ') || '—')}</dd><dt>效果</dt><dd>${escapeHtml(card.effectsPreview.join(' · ') || '—')}</dd><dt>风险</dt><dd>${escapeHtml(card.risk || '—')}</dd><dt>来源</dt><dd>${escapeHtml(card.source || '—')}</dd></dl>${card.disabledReason ? `<p role="status">${escapeHtml(card.disabledReason)}</p>` : ''}<button type="button" data-card-play>打出</button></div>`;
    this.querySelector('[data-card-detail-close]')?.addEventListener('click', () => this.close());
    this.querySelector('[data-card-play]')?.addEventListener('click', () => emit(this, 'life-choice', { choiceId: card.choiceId }));
  }
}

class LifeCardMulligan extends HTMLElementBase {
  connectedCallback() {
    this.querySelector('button')?.addEventListener('click', () => emit(this, 'mulligan-request', {
      type: 'mulligan-request', offerId: this.dataset.offerId, revision: Number(this.dataset.revision),
    }));
  }
}

class LifeIdentityBuilder extends HTMLElementBase {}

export function registerLifeCardComponents(registry = globalThis.customElements) {
  if (!registry) return;
  const definitions = {
    'life-card-hand': LifeCardHand,
    'life-card-stack': LifeCardStack,
    'life-card-detail': LifeCardDetail,
    'life-card-mulligan': LifeCardMulligan,
    'life-identity-builder': LifeIdentityBuilder,
  };
  for (const [name, constructor] of Object.entries(definitions)) if (!registry.get(name)) registry.define(name, constructor);
}

registerLifeCardComponents();
