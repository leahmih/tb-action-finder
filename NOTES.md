# V2 build notes

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
7. **Names** — use `nameAddressAs` for the salutation, `nameDisplayAs` on
   the card. Don't build title logic; Parliament has already solved it.

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
  the party list lives in actions.json, not in JS.

  Card note (placeholder — Leah's draft, needs TBFighters sign-off):
  "Your MP is a member of Sinn Féin, whose MPs do not take their seats in
  the House of Commons. This message asks them to raise TB funding with UK
  ministers directly."

  Adjusted ask (same status):
  "I am asking you to write to the Foreign Secretary and the Minister for
  Development urging the UK to maintain its funding for tuberculosis
  programmes, including its pledge to the Global Fund."

  Both are Option A of two drafted. Rejected: doing nothing (letter asks for
  something the MP won't do), and excluding NI (removes 11 working
  constituencies to handle 7).

## Known gaps

- Network failure currently shows the "couldn't find that postcode"
  message. Wrong and misleading. — Day 3
- `BS1 5TR` (Carla Denyer) has an email but no phone number. "Email but no
  phone" is a normal state, not an error. — Day 4
- Northern Ireland postcodes return a real MP, but Sinn Féin MPs don't take
  their Westminster seats. Content decision, needs TBFighters input. — Day 3
- Parliament member search took 1.07s on a cold request. Loading state is
  required, not optional.

## Gotchas

- Never open `.html` in TextEdit. It renders as rich text and saves the
  visible text back over the file. This destroyed `uk-lookup.html` once.
  Use `cat`, or VS Code.
- Commit as soon as anything works, not when a step is finished.
