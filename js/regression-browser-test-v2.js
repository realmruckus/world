export async function runAllTests() {
  await import(`./regression-browser-test.js?run=${Date.now()}`);
}
