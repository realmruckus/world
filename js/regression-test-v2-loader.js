(() => {
  const button = document.querySelector('#run-tests');
  const summary = document.querySelector('#test-summary');
  let suitePromise;

  window.__REGRESSION_MANUAL_BOOTSTRAP__ = true;

  async function run(event) {
    event.preventDefault();
    button.disabled = true;
    summary.textContent = '正在加载测试模块…';
    try {
      suitePromise ||= import('./regression-browser-test.js?build=20260720-v2');
      const suite = await suitePromise;
      await suite.runAllTests();
    } catch (error) {
      summary.textContent = `测试模块加载失败：${error instanceof Error ? error.message : String(error)}`;
      button.disabled = false;
    }
  }

  button.addEventListener('click', run);
  button.click();
})();
