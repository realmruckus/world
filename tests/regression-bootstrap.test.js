import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../regression-test-v2.html', import.meta.url), 'utf8');
const loader = await readFile(new URL('../js/regression-test-v2-loader.js', import.meta.url), 'utf8');
const wrapper = await readFile(new URL('../js/regression-browser-test-v2.js', import.meta.url), 'utf8');

test('v2 regression page binds through a classic external loader', () => {
  assert.match(html, /id="run-tests"/);
  assert.match(html, /src="\.\/js\/regression-test-v2-loader\.js"/);
  assert.doesNotMatch(html, /type="module"/);
});

test('v2 loader reports module loading failures in the page', () => {
  assert.match(loader, /addEventListener\('click'/);
  assert.match(loader, /import\('\.\/regression-browser-test-v2\.js\?build=/);
  assert.match(loader, /测试模块加载失败/);
});

test('v2 wrapper reruns the existing regression suite with a fresh module instance', () => {
  assert.match(wrapper, /export async function runAllTests/);
  assert.match(wrapper, /regression-browser-test\.js\?run=/);
});
