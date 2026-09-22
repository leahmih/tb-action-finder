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
- **Button hierarchy on letter cards.** The UK card shows five buttons:
  Copy, Open in email, then Learn more, email signup and weekly reminder.
  The last three are a V1 decision made when every card had one primary
  button; they weren't re-examined when the card gained an inline flow.
  Product question: which of the three belong on letter cards, and should
  they look like the action buttons at all?
- **Layout with multiple tall cards.** Live now, not hypothetical: the
  Danaher textarea renders 893px tall at 800px width, so a UK user gets two
  tall interactive cards stacked in the centre column alongside short link
  cards. Needs a real look at the results screen as a whole.

## Gotchas

- Never open `.html` in TextEdit. It renders as rich text and saves the
  visible text back over the file. This destroyed `uk-lookup.html` once.
  Use `cat`, or VS Code.
- Commit as soon as anything works, not when a step is finished.
- Inexplicably input-specific failures during development are usually
  cache (the URL is the cache key). Hard reload first. Keep "Disable cache"
  ticked in the Network panel while devtools is open.
