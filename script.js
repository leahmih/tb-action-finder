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
  // A letter action has no actionUrl: the action happens inside the card.
  const desc = escapeICS(action.letter ? nudge : `${nudge}\n${action.actionUrl}`);
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

// --- Embedded rep-contact component ---
// Ported from uk-lookup.html. Rendered inside the card of an action that has
// a "letter" object. Each card holds references to its own elements instead
// of page-wide IDs, so the markup can't collide with the rest of the page.

// Endpoints confirmed against https://members-api.parliament.uk/swagger/v1/swagger.json
//   GET /api/Members/Search?Location={constituency}&House=Commons&IsCurrentMember=true
//   GET /api/Members/{id}/Contact
const POSTCODES_API = 'https://api.postcodes.io/postcodes/';
const MEMBERS_API = 'https://members-api.parliament.uk/api/';
const NOT_FOUND_ERROR = "We couldn't find that postcode. Check it and try again.";
const UNAVAILABLE_ERROR = "We couldn't reach the MP lookup right now.";
const FIND_YOUR_MP_URL = 'https://members.parliament.uk/FindYourMP';
const COPY_ERROR = "Couldn't copy automatically. Select the text above and copy it manually.";

function apiError(message, kind) {
  const err = new Error(message);
  err.kind = kind;
  return err;
}

async function fetchJson(url, label, kindFor404) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw apiError(`${label} could not reach ${url}: ${err.message}`, 'network');
  }
  if (!res.ok) {
    const kind = res.status === 404 && kindFor404 ? kindFor404 : 'unavailable';
    throw apiError(`${label} failed: ${res.status} ${res.statusText} (${url})`, kind);
  }
  return res.json();
}

async function lookupMp(postcode, letter) {
  const postcodeData = await fetchJson(
    POSTCODES_API + encodeURIComponent(postcode),
    'Postcode lookup',
    'notfound'
  );

  const constituency = postcodeData.result.parliamentary_constituency_2024;
  if (!constituency) {
    throw new Error(`No 2024 constituency for postcode "${postcode}"`);
  }

  const searchUrl = MEMBERS_API + 'Members/Search'
    + '?Location=' + encodeURIComponent(constituency)
    + '&House=Commons&IsCurrentMember=true';
  const searchData = await fetchJson(searchUrl, 'Member search');

  const member = searchData.items && searchData.items[0] && searchData.items[0].value;
  if (!member) {
    throw apiError(`No current MP returned for constituency "${constituency}"`, 'unavailable');
  }

  const contactData = await fetchJson(
    MEMBERS_API + 'Members/' + member.id + '/Contact',
    'Contact lookup'
  );

  const contacts = contactData.value || [];
  const withEmail = contacts.find(c => c.email);
  const withPhone = contacts.find(c => c.phone);

  return {
    constituency,
    name: member.nameDisplayAs,
    addressAs: member.nameAddressAs,
    party: member.latestParty && member.latestParty.name,
    email: withEmail && withEmail.email,
    phone: withPhone && withPhone.phone,
    letter,
  };
}

// The subject line, the editable letter and the Copy / Open in email buttons.
// Shared by both letter flows: appended to the card's root, then filled in by
// render() with whatever recipient the flow produced.
function createLetterPanel(root, bodyLabel) {
  // Kept separate from the subject text so that only the subject itself ends
  // up in the mailto and in anything the user copies.
  const letterSubjectLabel = document.createElement('p');
  letterSubjectLabel.className = 'letter-subject-label';
  letterSubjectLabel.textContent = 'Subject line:';
  letterSubjectLabel.hidden = true;

  const letterSubject = document.createElement('p');
  letterSubject.className = 'letter-subject';
  letterSubject.hidden = true;

  const letterBody = document.createElement('textarea');
  letterBody.className = 'letter-body';
  letterBody.setAttribute('aria-label', bodyLabel);
  letterBody.hidden = true;

  const letterActions = document.createElement('div');
  letterActions.className = 'letter-actions';
  letterActions.hidden = true;

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'choice-btn';
  copyBtn.textContent = 'Copy text';

  const copyError = document.createElement('p');
  copyError.className = 'copy-error';
  copyError.setAttribute('role', 'alert');
  copyError.textContent = COPY_ERROR;
  copyError.hidden = true;

  letterActions.appendChild(copyBtn);
  letterActions.appendChild(copyError);

  root.appendChild(letterSubjectLabel);
  root.appendChild(letterSubject);
  root.appendChild(letterBody);
  root.appendChild(letterActions);

  let letterNote = null;
  let emailBtn = null;
  let copiedTimer;

  function resetCopyButton() {
    clearTimeout(copiedTimer);
    copyBtn.textContent = 'Copy text';
  }

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(letterBody.value);
    } catch (err) {
      console.error(err);
      resetCopyButton();
      copyError.hidden = false;
      return;
    }
    copyError.hidden = true;
    copyBtn.textContent = 'Copied';
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(resetCopyButton, 2000);
  });

  // Grow to fit so the whole message is visible without scrolling.
  function autosize() {
    letterBody.rows = letterBody.value.split('\n').length;
    letterBody.style.height = 'auto';
    letterBody.style.height = letterBody.scrollHeight + 'px';
  }

  // recipient: { letter, email, name, addressAs, constituency, party }. Only
  // letter and email are needed; the rest come from an MP lookup when there
  // is one, and the placeholders they fill are optional in the letter body.
  function render(recipient) {
    const letter = recipient.letter;
    const abstentionistParties = letter.abstentionist_parties || [];
    const variant = abstentionistParties.indexOf(recipient.party) !== -1
      ? letter.abstentionist
      : null;

    if (variant) {
      letterNote = document.createElement('p');
      letterNote.className = 'letter-note';
      letterNote.textContent = variant.card_note;
      letterSubjectLabel.parentNode.insertBefore(letterNote, letterSubjectLabel);
    }

    const body = letter.body
      .replace(/\{\{mp_name\}\}/g, recipient.addressAs || recipient.name || '')
      .replace(/\{\{constituency\}\}/g, recipient.constituency || '')
      .replace(/\{\{ask\}\}/g, variant ? variant.ask : letter.ask);

    // The abstentionist variant may carry its own subject; fall back to the
    // letter's when it doesn't.
    const subject = (variant && variant.subject) || letter.subject;

    letterSubject.textContent = subject;
    letterBody.value = body;
    letterSubjectLabel.hidden = false;
    letterSubject.hidden = false;
    letterBody.hidden = false;

    if (recipient.email) {
      emailBtn = document.createElement('button');
      emailBtn.type = 'button';
      emailBtn.className = 'choice-btn';
      emailBtn.textContent = 'Open in email';
      emailBtn.addEventListener('click', () => {
        // Read the textarea at click time so the user's edits are sent.
        window.location.href = 'mailto:' + recipient.email
          + '?subject=' + encodeURIComponent(subject)
          + '&body=' + encodeURIComponent(letterBody.value);
      });
      copyBtn.after(emailBtn);
    }
    letterActions.hidden = false;

    // autosize needs layout, so a fixed-recipient letter — rendered while the
    // card is still being built — has to wait until the card is in the page.
    if (letterBody.isConnected) autosize();
    else requestAnimationFrame(autosize);
  }

  function clear() {
    if (letterNote) letterNote.remove();
    letterNote = null;
    letterSubject.textContent = '';
    letterBody.value = '';
    letterSubjectLabel.hidden = true;
    letterSubject.hidden = true;
    letterBody.hidden = true;
    if (emailBtn) emailBtn.remove();
    emailBtn = null;
    resetCopyButton();
    copyError.hidden = true;
    letterActions.hidden = true;
  }

  return { render, clear };
}

// The postcode form, the MP details list and the lookup that fills the letter
// panel in. Prepended above the panel, so the letter still renders below the
// form it came from.
function addMpLookup(root, action, panel) {
  const inputId = `rep-contact-${action.id}-postcode`;

  const form = document.createElement('form');
  form.className = 'lookup-form';

  const postcodeLabel = document.createElement('label');
  postcodeLabel.htmlFor = inputId;
  postcodeLabel.textContent = 'Your postcode';

  const input = document.createElement('input');
  input.id = inputId;
  input.name = 'postcode';
  input.type = 'text';
  input.setAttribute('autocomplete', 'postal-code');
  input.placeholder = 'e.g. SW1A 1AA';

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'choice-btn';
  button.textContent = 'Find my MP';

  form.appendChild(postcodeLabel);
  form.appendChild(input);
  form.appendChild(button);

  const status = document.createElement('p');
  status.className = 'status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const details = document.createElement('dl');
  details.className = 'mp-details';

  root.prepend(form, status, details);

  function renderMp(mp) {
    details.textContent = '';
    const rows = [
      ['Constituency', mp.constituency],
      ['MP', mp.name],
      ['Party', mp.party],
      ['Email', mp.email],
      ['Phone', mp.phone],
    ];
    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value || 'Not listed';
      details.appendChild(dt);
      details.appendChild(dd);
    });
  }

  function showError(kind) {
    if (kind === 'notfound') {
      status.textContent = NOT_FOUND_ERROR;
      return;
    }
    status.textContent = UNAVAILABLE_ERROR + ' ';
    const link = document.createElement('a');
    link.href = FIND_YOUR_MP_URL;
    link.textContent = 'Find your MP on the Parliament website';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    status.appendChild(link);
  }

  function setLoading(isLoading) {
    button.disabled = isLoading;
    button.textContent = isLoading ? 'Looking up…' : 'Find my MP';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    details.textContent = '';
    panel.clear();
    status.textContent = 'Looking up your MP…';
    setLoading(true);

    try {
      const mp = await lookupMp(input.value.trim(), action.letter);
      status.textContent = '';
      renderMp(mp);
      panel.render(mp);
    } catch (err) {
      // Page shows a message chosen by err.kind; the specific cause goes to the console.
      console.error(err);
      showError(err.kind);
    } finally {
      setLoading(false);
    }
  });
}

function createRepContact(action) {
  const root = document.createElement('div');
  root.className = 'rep-contact';

  // A letter with a "to" address has a fixed recipient: nothing to look up, so
  // the letter is there as soon as the card renders.
  if (action.letter.to) {
    createLetterPanel(root, 'Draft message').render({
      letter: action.letter,
      email: action.letter.to,
    });
  } else {
    addMpLookup(root, action, createLetterPanel(root, 'Draft message to your MP'));
  }

  return root;
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

  const list = document.createElement('ul');
  list.className = 'results-list';

  matches.forEach(action => {
    const card = document.createElement('li');
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
    primaryBtn.setAttribute('aria-label', `${primaryLabel}: ${action.title} (opens in new tab)`);

    const learnMoreLink = document.createElement('a');
    learnMoreLink.href = action.learnMore;
    learnMoreLink.textContent = 'Learn more';
    learnMoreLink.className = 'link-secondary';
    learnMoreLink.target = '_blank';
    learnMoreLink.rel = 'noopener noreferrer';
    learnMoreLink.setAttribute('aria-label', `Learn more about ${action.title} (opens in new tab)`);

    const signupBtn = document.createElement('a');
    signupBtn.href = emailSignupUrl;
    signupBtn.textContent = 'Sign up for TBFighters emails';
    signupBtn.className = 'btn-secondary';
    signupBtn.target = '_blank';
    signupBtn.rel = 'noopener noreferrer';
    signupBtn.setAttribute('aria-label', 'Sign up for TBFighters emails (opens in new tab)');

    const actions_row = document.createElement('div');
    actions_row.className = 'card-actions';
    // A letter action happens inside the card, so it gets no Take action button.
    if (!action.letter) actions_row.appendChild(primaryBtn);
    actions_row.appendChild(learnMoreLink);
    actions_row.appendChild(signupBtn);

    if (chosenTimeBucket === 'weekly') {
      const reminderBtn = document.createElement('button');
      reminderBtn.textContent = 'Set a weekly reminder';
      reminderBtn.className = 'btn-secondary';
      reminderBtn.setAttribute('aria-label', `Set a weekly reminder for ${action.title}`);
      reminderBtn.addEventListener('click', () => {
        downloadICS(`tb-action-${action.id}.ics`, generateICSContent(action));
      });
      actions_row.appendChild(reminderBtn);
    }

    card.appendChild(title);
    card.appendChild(blurb);
    if (action.letter) card.appendChild(createRepContact(action));
    card.appendChild(actions_row);
    list.appendChild(card);
  });

  container.appendChild(list);
}

function resetToStart() {
  chosenCountry = null;
  chosenTimeBucket = null;
  showScreen('country');
}

const siteTitle = document.getElementById('site-title');
siteTitle.addEventListener('click', resetToStart);
siteTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    resetToStart();
  }
});

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
