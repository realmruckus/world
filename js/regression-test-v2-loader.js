(() => {
  let button = document.querySelector('#run-tests');
  const summary = document.querySelector('#test-summary');
  let suitePromise;

  async function run(event) {
    event.preventDefault();
    button.disabled = true;
    summary.textContent = '正在加载测试模块…';
    try {
      suitePromise ||= import('./regression-browser-test-v2.js?build=20260720-v3');
      const suite = await suitePromise;
      await suite.runAllTests();

      const replacement = button.cloneNode(true);
      replacement.disabled = false;
      replacement.addEventListener('click', run);
      button.replaceWith(replacement);
      button = replacement;
    } catch (error) {
      summary.textContent = `测试模块加载失败：${error instanceof Error ? error.message : String(error)}`;
      button.disabled = false;
    }
  }

  button.addEventListener('click', run);
  button.click();
})();
