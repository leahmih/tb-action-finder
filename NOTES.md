# V2 build notes

## Where things stand (15 Sep 2026)

Day 6 complete. The rep-contact component renders inside the UK card in
the real tool (index.html). script.js branches on whether an action has a
"letter" object, not on type — so pepfar-funding, ca-funding and
dear-colleague still route out via actionUrl. Verified: all 17 non-letter
card renders across all 12 country/time combinations identical to the
previous commit. Letter data lives in actions.json under uk-funding;
uk-letter.json deleted.

## Day 8 — CSS pass

CSS pass largely done — the card fits the tool's design after a hard reload.
uk-lookup.html deleted (22 Sep 2026) — script.js is the only implementation.

- there are way too many buttons on postcode finder cards — see "Button
  hierarchy on letter cards" under Known gaps.
- the subject line is labelled but not editable, while the body under it
  is. Decide whether it should become an input.

## UK letter copy landed (22 Sep 2026)

Leah's copy replaced the placeholder body. The letter now asks MPs to join
the APPG on Global Tuberculosis, so `subject` changed to match.

Structural point worth keeping: the paragraph explaining what the APPG is
lives in `ask`, not in `body`. It was in the body at first, but the body is
shared with the abstentionist variant, which asks for something else
entirely — Sinn Féin constituents were getting a letter that explained the
APPG and then never mentioned it. Anything that only makes sense for one
variant belongs in that variant's `ask`, not in the shared body.

Both copy blocks are marked draft pending TBFighters sign-off. See Known
gaps.

## Spike findings (Day 1)

1. **CORS** — both APIs allow browser requests. postcodes.io returns
   `Access-Control-Allow-Origin: *`. No backend needed.
2. **Constituency field** — postcodes.io returns both
   `parliamentary_constituency` and `parliamentary_constituency_2024`.
   Identical across the five postcodes tested. Use the `_2024` field: it is
   explicitly dated, so it can only fail loudly. The unversioned field will
   silently follow future boundary changes.
3. **Constituency → MP** — two steps. `Members/Search?Location=<name>
   &House=Commons&IsCurrentMember=true` returns a member ID, then
   `Members/<id>/Contact` returns email and phone. The name string is the
   join between two systems that don't coordinate — punctuation mismatches
   (Ynys Môn, apostrophes, ampersands) are the likeliest source of a
   no-match bug. Untested.
4. **Search results** — `totalResults: 1` for Hackney South and Shoreditch.
   Not tested against constituencies whose names are substrings of others.
5. **Bad postcodes** — `banana` and `ZZ99 9ZZ` both return 404 with
   "Postcode not found". Indistinguishable, so one error message covers both.
6. **API unreachable** — `TypeError: Failed to fetch`. Identical whether
   wifi is off or the API is down; the browser cannot tell them apart, so
   the message must not blame either.
7. **Names** — use `nameAddressAs || nameDisplayAs` for the salutation.
   A census of all 649 current Commons MPs found 456 (70.3%) have
   nameAddressAs: null, so it cannot be used alone. nameDisplayAs already
   includes honorifics ("Dame Meg Hillier"), so the fallback reads
   correctly. Register is inconsistent across the populated 30% ("Ms
   Abbott" vs "Dr Rosena Allin-Khan" vs plain names) — harmless, since no
   user sees more than one letter. Don't build your own title logic.

## Letter cards collapse (23 Sep 2026)

Letter cards render title, blurb and a "Write the letter" button; the panel
(and the UK card's postcode lookup) is hidden until the user expands it. A
real `<button>` with `aria-expanded` and `aria-controls`, so it works by
keyboard. Cards are independent — more than one can be open.

Collapsing sets `hidden` on the panel root; it never destroys and rebuilds
it. A half-written letter and a completed MP lookup have to survive a
collapse, and rebuilding would throw both away.

**The gotcha: a hidden textarea has no scrollHeight.** `autosize()` measured
the Danaher letter as 0px, because a fixed-recipient letter renders while
the card is still being built — now hidden from the start. So `autosize()`
no-ops while hidden and is re-run on expand, which is why
`createLetterPanel` returns it and `createRepContact` returns
`{ root, autosize }` rather than a bare node. Anything else that measures
layout inside a letter panel will hit the same thing.

## Day 11 — embed-friendliness

Tested with a hostile host page (Georgia serif, content-box, lime buttons,
dark background) iframing the tool at localhost:8001/host.html.

- Iframes are a style boundary in both directions, so CSS scoping is NOT
  needed for iframe embedding. Direct embedding (markup inlined into a
  host page) is not supported — would need full CSS namespacing.
- Loads fine, no X-Frame-Options issue.
- mailto works from inside the iframe, opens the mail app directly.
- Textarea and card layout render correctly at 700px container width.
- ONLY real issue: the iframe has a fixed height, so the tool scrolls
  inside it — 3-4 scrolls for an expanded card. Needs a postMessage height
  signal, firing on every expand/collapse (ResizeObserver), not just once
  on load.
- **Height signal implemented (6 Oct 2026, 6626431).** When inside an
  iframe, script.js adds a `tbaf-embedded` class to `<html>` and posts
  `{ type: "tbaf:height", height: <px> }` to the parent, on load and on
  every ResizeObserver change.
- Two things had prevented shrinking: `documentElement.scrollHeight` never
  reports less than the iframe's own height, and `body { min-height: 100dvh }`
  resolves to the iframe's height when embedded. Fixed by measuring
  `document.body.getBoundingClientRect().height` and adding
  `.tbaf-embedded body { min-height: 0 }`. Standalone page keeps 100dvh.
- Verified in real Chrome, cross-origin: 655 → 965 (UK tonight) → 1141
  (expand letter) → 965 (collapse) → 655 (back to start).
- Relative paths: nothing assumes the domain root. Verified by serving
  from `/tools/action-finder/` locally in Chrome.

## Day 12 — analytics

Instrumentation added 9 Oct 2026 (f2683fd). No provider wired up yet.

- TBFighters already use Cloudflare Web Analytics (stated in their privacy
  policy at tbfighters.org/privacy.html). V1's decision D4 was matching
  what they run, not an independent choice.
- Their privacy policy promises no cookies, no localStorage, no
  fingerprinting, no data tied to an individual. Instrumentation stays
  inside that: every event stands alone, no session ID, so no stitched
  per-user funnel is possible.
- Deliberately NOT creating a Cloudflare account. The account would be in
  Leah's name and die at handoff. `track()` currently only console.logs,
  with a marked comment showing where a provider call goes.
- **HANDOFF:** add your Cloudflare Web Analytics token and wire it into
  `track()` in script.js. One line, marked in the code.
- Events: `results_rendered` (country, timeBucket), `letter_card_expanded`,
  `mp_lookup_succeeded`, `mp_lookup_failed` (error kind),
  `open_in_email_clicked`, `copy_text_clicked`, `outbound_link_clicked`,
  `weekly_reminder_downloaded` — all with actionId where applicable.

## Letter template shape (`letter` on uk-funding in actions.json)

- `subject` — plain string, shown above the textarea.
- `body` — the letter, with three placeholders: `{{mp_name}}`,
  `{{constituency}}` and `{{ask}}`. Substituted before display.
- `ask` — the standard ask, substituted into `{{ask}}`.
- `abstentionist_parties` — list of `latestParty.name` values matched
  exactly (not by substring). Read from the JSON; no party name is
  hardcoded in the JS.
- `abstentionist` — `{ copy_status, card_note, ask, subject }`. When the
  member's party matches, its `ask` replaces the standard one and
  `card_note` renders above the subject line. When it doesn't match, no note
  element exists in the DOM at all.
- `abstentionist.subject` is optional: the variant uses it when present and
  falls back to the letter's own `subject` when absent. The card and the
  mailto read the same resolved subject, so they can't drift apart. Added
  22 Sep 2026, when the standard subject ("join the APPG") stopped matching
  the abstentionist ask.

**Changed in the NI work (c394f55, 11 Sep 2026).** Before it, uk-letter.json
held only `subject` and `body`, with the ask sentence written inline in `body` and
two placeholders (`{{mp_name}}`, `{{constituency}}`). The ask moved into its
own `ask` field behind a new `{{ask}}` token so the abstentionist variant can
swap it; `abstentionist_parties` and `abstentionist` were added in the same
commit. Real letter copy must keep `{{ask}}` in the body — if the ask is
written inline, Sinn Féin MPs still get the card note but the standard ask.

## Investigated and closed

**Intermittent CORS on the Parliament API.** Claude Code reported that
`access-control-allow-origin` appears inconsistently on identical requests
(CDN caching without `Vary: Origin`), and recommended a proxy or a
build-time snapshot. That testing was done in Node, which does not enforce
CORS — it can observe a header's absence but not whether a browser would be
blocked.

Measured from a real browser instead: 20 consecutive lookups of E8 2NG with
cache disabled, all 200. Not reproduced. Treat as closed unless new
**browser-side** evidence appears. Do not add a proxy on the strength of
Node testing.

## Open decisions

- **Northern Ireland — explained variant chosen.** Sinn Féin MPs do not take
  their seats in the Commons (7 of NI's 18 constituencies; the other 11
  behave normally). Decision: detect by party, show a note on the card and
  swap the ask. Detection keys on `latestParty.name` from the member search;
  the party list lives in the letter data (`abstentionist_parties`), not at
  the top level of actions.json, and not in JS.

  Card note (Leah's draft, still needs TBFighters sign-off):
  "Your MP is a member of Sinn Féin, whose MPs do not take their seats in
  the House of Commons. This message asks them to raise TB funding with UK
  ministers directly."

  Adjusted ask (same status, rewritten 22 Sep 2026):
  "I am asking you to write to the Foreign Secretary and the Minister for
  Development urging the UK to protect its funding for the global TB
  response, including its £850 million pledge to the Global Fund, as the
  aid budget is cut."

  Own subject line (same status, added 22 Sep 2026):
  "Please protect UK funding for the global TB response"

  The card note is Option A of two drafted; the ask started as Option A and
  was rewritten on 22 Sep. Rejected: doing nothing (letter asks for
  something the MP won't do), and excluding NI (removes 11 working
  constituencies to handle 7).

## Known gaps

- **The tool's actions are out of date.** TBFighters' homepage currently
  features Gilead/lenacapavir (HIV), the End TB Now Act of 2026, and a
  NewMode congressional oversight link. The tool still has PEPFAR
  apportionment and Tofu's map. Actions have moved on since V1. This is
  the strongest argument for adding a reviewBy date to every action.
- Northern Ireland postcodes return a real MP, but Sinn Féin MPs don't take
  their Westminster seats. Content decision, needs TBFighters input. — Day 3
- Parliament member search took 1.07s on a cold request. Loading state is
  required, not optional.
- **UK letter copy is drafted but unsigned-off (22 Sep 2026).** The
  placeholder body in `uk-funding.letter` is gone: Leah's copy is now in
  actions.json, marked `copy_status: "draft — Leah's copy, pending
  TBFighters sign-off"` on both the standard letter and the abstentionist
  block. Still a content dependency on TBFighters, but no longer a blank —
  what's outstanding is approval, not writing.
  **Danaher copy does exist (Day 7).** TBFighters' own Option 1 template
  from tbfighters.org/templates/danaher is now inline in
  `danaher-email.letter`. Option 2 was not used: it has gone stale, dating
  a September 2023 commitment as "last year" and "a year later". Flag to
  TBFighters — the same staleness will reach Option 1 eventually.
- **Letter buttons wrap on phones.** "Copy text" and "Open in email" are
  each 1/3 of the column width. At a 375px viewport that is about 125px, so
  "Open in email" wraps onto two lines ("Open in" / "email"). Both buttons
  still sit side by side and work. Possible fix, not done: keep 1/3 on
  desktop, widen on small screens. Seen in a headless Chrome screenshot at
  375px, not on a real phone.
  **Worse inside the card (Day 6).** In index.html the buttons are 1/3 of
  the narrower card width, so "Open in email" wraps at desktop width too,
  and at 375px both labels wrap ("Copy / text", "Open / in / email"). Seen
  in headless Chrome screenshots of the card at 800px and 375px. Relevant
  to the Day 8 CSS pass.
- **Letter buttons tested in one mail setup only.** Tested by hand in the
  macOS Mail app with a Gmail account. Not tested with other mail apps,
  webmail set as the mailto handler, Windows, or phones.
- **Not tested by hand at scale.** Day 6's regression checks ran in
  headless Chrome with the network mocked. Real-service testing so far is
  E8 2NG, BT12 6AA, banana, and one real mailto click.
- **Button hierarchy on letter cards.** The UK card shows four buttons:
  Copy, Open in email, then Learn more and weekly reminder. The last two
  are a V1 decision made when every card had one primary button; they
  weren't re-examined when the card gained an inline flow. Product
  question: do they belong on letter cards, and should they look like the
  action buttons at all?
  **Partly addressed 23 Sep 2026.** The email signup was the third of
  these and has moved to the footer as a text link — it pointed somewhere
  none of the card's own buttons went, and repeated on every card. Learn
  more and the weekly reminder were deliberately left alone.
- **Layout with multiple tall cards.** Was: the Danaher textarea renders
  893px tall at 800px width, so a UK user got two tall interactive cards
  stacked in the centre column alongside short link cards.
  **Largely closed 23 Sep 2026** by collapsing letter cards — the results
  screen now opens as a short, scannable list, and a card is only tall
  while the user is working in it. What's left is the case where someone
  opens both at once, which is now their choice rather than the default.

## Gotchas

- Never open `.html` in TextEdit. It renders as rich text and saves the
  visible text back over the file. This destroyed `uk-lookup.html` once.
  Use `cat`, or VS Code.
- Commit as soon as anything works, not when a step is finished.
- Inexplicably input-specific failures during development are usually
  cache (the URL is the cache key). Hard reload first. Keep "Disable cache"
  ticked in the Network panel while devtools is open.
