import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../life-sim.html', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../js/life-sim-v3.js', import.meta.url), 'utf8');
const components = fs.readFileSync(new URL('../js/life-card-components.js', import.meta.url), 'utf8');

test('page exposes IdentityBuilder and all four card foundation components', () => {
  for (const tag of ['life-identity-builder', 'life-card-hand', 'life-card-stack', 'life-card-detail', 'life-card-mulligan']) {
    assert.match(html, new RegExp(`<${tag}`));
  }
  assert.match(html, /js\/life-card-components\.js/);
});

test('annual, romance, crisis, and ending states have stable skeleton regions', () => {
  for (const state of ['annual', 'romance', 'crisis', 'ending']) {
    assert.match(html, new RegExp(`data-interface-state="${state}"`));
  }
  assert.match(html, /data-life-region="profile"/);
  assert.match(html, /data-life-region="choices"/);
  assert.match(html, /data-life-region="feedback"/);
});

test('320px, regular phone, landscape, desktop, Safe Area, and dynamic viewport contracts are explicit', () => {
  assert.match(html, /@media\(max-width:359px\)/);
  assert.match(html, /@media\(min-width:360px\) and \(max-width:760px\)/);
  assert.match(html, /@media\(orientation:landscape\) and \(max-height:520px\)/);
  assert.match(html, /@media\(min-width:1024px\)/);
  assert.match(html, /100dvh/);
  for (const side of ['top', 'right', 'bottom', 'left']) assert.match(html, new RegExp(`safe-area-inset-${side}`));
  assert.match(html, /scroll-padding-bottom:/);
});

test('touch, keyboard focus, long text, and Reduced Motion remain operable', () => {
  assert.match(html, /min-(?:height|inline-size):44px/);
  assert.match(html, /touch-action:manipulation/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(components, /keydown/);
  assert.match(components, /Escape/);
  assert.match(components, /Arrow(?:Left|Right)/);
});

test('components emit choiceId or offer metadata and never randomize or execute commands', () => {
  assert.doesNotMatch(components, /Math\.random|crypto\.getRandomValues|applyCommands|resolvePendingChoice/);
  assert.match(components, /choiceId/);
  assert.match(components, /mulligan-request/);
  assert.doesNotMatch(components, /detail:\s*\{[^}]*cardId/);
});

test('details are modal, closeable, scrollable, and focus-restoring', () => {
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /data-card-detail-close/);
  assert.match(html, /\.life-card-detail__surface\{[^}]*overflow-y:auto/);
  assert.match(components, /restoreFocus/);
});

test('the app has submission and mulligan guards without using fixture content as product copy', () => {
  assert.match(app, /submissionStatus/);
  assert.match(app, /mulliganStatus/);
  assert.doesNotMatch(app, /life-content-contract-v1\.json/);
  assert.doesNotMatch(html, /正式视觉|approved asset|正式卡牌/);
});

