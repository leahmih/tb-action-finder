fetch('actions.json')
  .then(res => res.json())
  .then(data => console.log('actions.json loaded:', data))
  .catch(err => console.error('Failed to load actions.json:', err));

const screens = {
  country: document.getElementById('screen-country'),
  time: document.getElementById('screen-time'),
  results: document.getElementById('screen-results'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  screens[name].querySelector('h2')?.focus();
}

// Country buttons -> time screen
document.querySelectorAll('[data-country]').forEach(btn => {
  btn.addEventListener('click', () => {
    showScreen('time');
  });
});

// Time buttons -> results screen
document.querySelectorAll('[data-time]').forEach(btn => {
  btn.addEventListener('click', () => {
    showScreen('results');
  });
});
