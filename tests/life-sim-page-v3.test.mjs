import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../life-sim.html', import.meta.url), 'utf8');

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('life simulator uses an isolated full-screen game canvas', () => {
  assert.match(html, /class="life-canvas"/);
  assert.match(html, /height:\s*100dvh/);
  assert.match(html, /overflow:\s*hidden/);
  assert.match(html, /world-site-header\{display:none\}/);
  assert.match(html, /body>footer\{display:none\}/);
});

test('game panels scroll internally instead of moving the control area', () => {
  assert.match(html, /class="life-pane life-pane-profile"/);
  assert.match(html, /class="life-pane life-pane-action"/);
  assert.match(html, /\.life-pane\{[^}]*overflow:auto/);
  assert.match(html, /#event-panel\{[^}]*position:sticky/);
});

test('mobile controls keep readable contrast and stable touch targets', () => {
  assert.match(html, /--life-text:\s*#1f2521/);
  assert.match(html, /--life-muted:\s*#5f6b63/);
  assert.match(html, /min-height:\s*48px/);
  assert.match(html, /@media\(max-width:760px\)/);
  assert.match(html, /grid-template-rows:minmax\(0,1fr\) minmax\(280px,48dvh\)/);
});

test('mobile choice controls remain reachable above the browser chrome', () => {
  assert.match(html, /#event-panel\{[^}]*overflow:hidden/);
  assert.match(html, /\.choice-list\{[^}]*overflow-y:auto/);
  assert.match(html, /\.choice-list\{[^}]*min-height:0/);
  assert.match(html, /padding:0 2px calc\(20px \+ env\(safe-area-inset-bottom\)\) 0/);
});

let passed = 0;
for (const { name, fn } of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}
console.log(`\n${passed}/${tests.length} tests passed`);