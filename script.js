let actions = [];
let emailSignupUrl = '';
let chosenCountry = null;
let chosenTimeBucket = null;

fetch('actions.json')
  .then(res => res.json())
  .then(data => {
    actions = data.actions;
    emailSignupUrl = data.emailSignupUrl;
  })
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

// --- ICS helpers ---

function escapeICS(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function foldICSLine(line) {
  if (line.length <= 75) return line;
  let result = line.slice(0, 75);
  let i = 75;
  while (i < line.length) {
    result += '\r\n ' + line.slice(i, i + 74);
    i += 74;
  }
  return result;
}

function formatICSLocal(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}T${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function formatICSUTC(date) {
  const p = n => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
}

function generateICSContent(action) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + 7);
  start.setHours(19, 0, 0, 0);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

  const uid = `${action.id}-${now.getTime()}@tb-action-finder`;
  const nudge = action.weeklyNudge || 'Take action again this week.';
  const desc = escapeICS(`${nudge}\n${action.actionUrl}`);
  const summary = escapeICS(`TB action: ${action.title}`);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TB Action Finder//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICSUTC(now)}`,
    `DTSTART:${formatICSLocal(start)}`,
    `DTEND:${formatICSLocal(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${desc}`,
    'RRULE:FREQ=WEEKLY',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.map(foldICSLine).join('\r\n');
}

function downloadICS(filename, content) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Render ---

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

    const primaryUrl = action.immediate === false ? action.signupUrl : action.actionUrl;
    const primaryLabel = action.immediate === false ? 'Sign me up' : 'Take action';

    const primaryBtn = document.createElement('a');
    primaryBtn.href = primaryUrl;
    primaryBtn.textContent = primaryLabel;
    primaryBtn.className = 'btn-primary';
    primaryBtn.target = '_blank';
    primaryBtn.rel = 'noopener noreferrer';

    const learnMoreLink = document.createElement('a');
    learnMoreLink.href = action.learnMore;
    learnMoreLink.textContent = 'Learn more';
    learnMoreLink.className = 'link-secondary';
    learnMoreLink.target = '_blank';
    learnMoreLink.rel = 'noopener noreferrer';

    const signupBtn = document.createElement('a');
    signupBtn.href = emailSignupUrl;
    signupBtn.textContent = 'Sign up for TBFighters emails';
    signupBtn.className = 'btn-secondary';
    signupBtn.target = '_blank';
    signupBtn.rel = 'noopener noreferrer';

    const actions_row = document.createElement('div');
    actions_row.className = 'card-actions';
    actions_row.appendChild(primaryBtn);
    actions_row.appendChild(learnMoreLink);
    actions_row.appendChild(signupBtn);

    if (chosenTimeBucket === 'weekly') {
      const reminderBtn = document.createElement('button');
      reminderBtn.textContent = 'Set a weekly reminder';
      reminderBtn.className = 'btn-secondary';
      reminderBtn.addEventListener('click', () => {
        downloadICS(`tb-action-${action.id}.ics`, generateICSContent(action));
      });
      actions_row.appendChild(reminderBtn);
    }

    card.appendChild(title);
    card.appendChild(blurb);
    card.appendChild(actions_row);
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
