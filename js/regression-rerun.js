const runControl = document.querySelector('#run-tests');

if (runControl) {
  runControl.addEventListener('click', (event) => {
    if (runControl.dataset.bound === 'true') event.preventDefault();
  });
}
