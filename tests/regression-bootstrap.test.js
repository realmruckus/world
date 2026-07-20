import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../regression-test.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../js/regression-browser-test.js', import.meta.url), 'utf8');

test('regression rerun button has a non-module fallback when module loading fails', () => {
  assert.match(html, /id="regression-fallback"/);
  assert.match(html, /location\.reload\(\)/);
});

test('regression module marks the button as successfully bound', () => {
  assert.match(script, /runButton\.dataset\.bound = 'true'/);
});
