let actions = [];
let chosenCountry = null;
let chosenTimeBucket = null;

fetch('actions.json')
  .then(res => res.json())
  .then(data => { actions = data.actions; })
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

function getRecommendedActions() {
  const sorted = actions
    .filter(a => a.countries.includes(chosenCountry) || a.countries.includes('any'))
    .filter(a => a.timeBuckets.includes(chosenTimeBucket))
    .filter(a => a.active !== false)
    .sort((a, b) => {
      const aIsOwnRep = a.type === 'rep_contact' && a.countries.includes(chosenCountry);
      const bIsOwnRep = b.type === 'rep_contact' && b.countries.includes(chosenCountry);
      const aIsDanaher = a.type === 'email_template';
      const bIsDanaher = b.type === 'email_template';
      if (aIsOwnRep && bIsDanaher) return -1;
      if (aIsDanaher && bIsOwnRep) return 1;
      return a.importanceRank - b.importanceRank;
    });
  const firstImmediateIdx = sorted.findIndex(a => a.immediate !== false);
  if (firstImmediateIdx > 0) {
    const top = sorted[firstImmediateIdx];
    const rest = sorted.filter((_, i) => i !== firstImmediateIdx);
    return [top, ...rest];
  }
  return sorted;
}

function renderResults() {
  const container = screens.results;
  const existing = container.querySelector('.results-list, .no-results');
  if (existing) existing.remove();

  const matches = getRecommendedActions();

  if (matches.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'no-results';
    msg.textContent = 'No actions found.';
    container.appendChild(msg);
    return;
  }

  const list = document.createElement('div');
  list.className = 'results-list';

  matches.forEach(action => {
    const card = document.createElement('div');
    card.className = 'action-card';

    const title = document.createElement('h3');
    title.textContent = action.title;

    const blurb = document.createElement('p');
    blurb.textContent = action.blurb;

    card.appendChild(title);
    card.appendChild(blurb);
    list.appendChild(card);
  });

  container.appendChild(list);
}

document.querySelectorAll('[data-country]').forEach(btn => {
  btn.addEventListener('click', () => {
    chosenCountry = btn.dataset.country;
    showScreen('time');
  });
});

document.querySelectorAll('[data-time]').forEach(btn => {
  btn.addEventListener('click', () => {
    chosenTimeBucket = btn.dataset.time;
    renderResults();
    showScreen('results');
  });
});
