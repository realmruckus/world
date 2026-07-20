import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../regression-test.html', import.meta.url), 'utf8');
const script = await readFile(new URL('../js/regression-browser-test.js', import.meta.url), 'utf8');

test('regression rerun control remains usable without JavaScript', () => {
  assert.match(html, /<a[^>]+id="run-tests"[^>]+href="\.\/regression-test\.html\?rerun=1"/);
  assert.doesNotMatch(html, /id="regression-fallback"/);
});

test('regression module intercepts native navigation and marks binding complete', () => {
  assert.match(script, /event\.preventDefault\(\)/);
  assert.match(script, /runButton\.dataset\.bound = 'true'/);
});
