# TB Action Finder — V2, and what I'd like to do next

This is a prototype, not a finished product. V2 is working and live, and I'd
like to keep going with it — particularly on your current campaigns, which
have moved on since I started.

Below: what V2 does, the few things that need you rather than me, what I'm
thinking about building next, and a technical reference at the end.

---

## What V2 does

V1 was a router. You said where you live and how much time you had, and it
gave you a ranked list of actions, each one a link to somebody else's page.
Finding out *what* to do was solved; actually doing it was still up to you.

V2 keeps the same two questions and changes what happens next. Two of the
actions now complete inside the tool:

**Contact your MP (UK).** Enter a postcode, and the tool finds your
constituency and your MP — name, party, email, phone — then renders a letter
addressed to them by name, which you can edit. Two buttons: one opens your
email app with the whole thing prefilled, one copies the text. No account, no
data stored, nothing sent on your behalf.

**Email Danaher.** Your own template, inline, with the same two buttons. No
lookup needed, since the recipient is fixed.

Everything else still routes out as it did in V1.

The lookup chains two free public APIs — postcodes.io for the constituency,
the UK Parliament Members API for the MP. No backend, no API keys, no
accounts. It's still a static site on GitHub Pages, and still costs nothing
to run.

One thing worth knowing: **MPs from parties that don't take their Westminster
seats are handled separately.** Seven of Northern Ireland's eighteen
constituencies are held by Sinn Féin, whose MPs don't sit in the Commons. For
those, the card shows a short note and the letter asks for something the MP
can actually do — write to ministers — rather than something they've said
they won't. The other eleven NI constituencies behave normally. The party
list is data, not code, so it can be updated without an engineer.

---

## Things that need you, not me

Short list, but genuinely blocked on your side.

**1. Sign off the UK letter copy.** I wrote it. It's marked as a draft in the
code. It will be read as TBFighters speaking, so it shouldn't ship on my say-so.

**2. Sign off the Northern Ireland note especially.** Same reason, more
sharply — it describes a political party's position on a live issue in
Northern Ireland. I've kept it factual and avoided characterising the policy,
but the wording should be yours. Current draft:

> Your MP is a member of Sinn Féin, whose MPs do not take their seats in the
> House of Commons. This message asks them to raise TB funding with UK
> ministers directly.

**3. Decide the UK ask.** I wrote the letter asking MPs to join the APPG on
Global Tuberculosis and support its recommendations. I did that before you
published your own UK action on the same APPG report — yours asks
constituents to make their MP *aware* of the report. We landed in the same
place independently, which is reassuring, but they're not identical asks and
mine is the larger one. It's your campaign, so it's your call.

**4. Your Cloudflare Web Analytics token.** The tool is instrumented but not
connected to anything. I deliberately didn't create an account, because it
would be in my name and would be useless to you later. You already use
Cloudflare Web Analytics, so it's your existing token, dropped into one
marked line in the code. Events currently tracked: which country and time
people pick, which cards they open, whether MP lookups succeed, and whether
people click through to email or copy.

**5. Your beehiiv embed code.** The newsletter signup is currently a link in
the footer. It could be an inline form, which would convert better, but the
embed code comes from your beehiiv account.

**6. A note on the Danaher template.** I used Option 1 from your templates
page. Option 2 has aged out — it dates the September 2023 commitment as "last
year" and "a year later". Option 1 says "over two years later", which still
holds, but it'll go the same way.

---

## What I'm thinking about next

In rough order of what I think matters most.

**The US card is the obvious gap.** Right now a US user gets Tofu's map,
which tells them who their representative is and what that person has done on
TB — and then stops. They still have to work out what to say. That's exactly
the friction V2 removed for UK users, left in place for the country where the
advocacy matters most.

The architecture already supports fixing it: the letter panel doesn't care
where the recipient comes from. What it needs is a ZIP-to-district lookup,
which is harder than UK postcodes because districts don't align to ZIP codes,
and a campaign to attach it to. This is the thing I'd most like to build.

**Your current campaigns aren't in the tool.** The tool still has PEPFAR
apportionment; your site now leads with Gilead and lenacapavir, the End TB Now
Act of 2026, and the congressional oversight action. Updating these is
straightforward — they're entries in a data file.

**Australia.** You have a live Australian action and an Australia filter on
your site. The tool folds Australia into "Other", which was a scoping cut back
in V1. Adding it properly is small.

**A `reviewBy` date on every action.** This one's structural rather than
exciting. V1 shipped pointing at a campaign that had already closed, and
nothing flagged it — there was no mechanism that could have. A date on each
action would turn "someone should check these are still live" into something
visible. Cheap to add, and it would have caught this.

**Canada** could get the same treatment as the UK. The lookup is the same
shape; it needs a Canadian equivalent of the postcode API and a campaign.

**Smaller things I've noted but not built:** a phone script for MP contact
(the tool shows the phone number but has no call copy — a call is a different
ask from an email and needs its own words), and share templates for the "bring
a friend" action, which currently just links to your homepage.

**Deliberately not done, and I'd argue against them:** sending emails on
someone's behalf, which turns a tool that holds no personal data into one that
does, with all the obligations that follow; and a public counter of actions
taken, which needs a backend and duplicates a reward the tool already gives by
removing friction.

---

## Technical reference

**Everything editable lives in `actions.json`.** Each action has a country
list, time buckets, a ranking, an on/off switch, and either an `actionUrl` to
link out to or a `letter` object to render inline. The engine decides which
to show based on whether a `letter` exists — not on a type label — so an
action can be upgraded from a link to an inline letter by adding letter data,
with no code change.

**The letter shape** is `subject`, `body`, and `ask`. The body contains three
placeholders — `{{mp_name}}`, `{{constituency}}` and `{{ask}}` — filled in
before display. The ask lives in its own field so the Northern Ireland variant
can swap it. If you rewrite the body, keep `{{ask}}` in it.

**What could break, and what it would look like:**

- *postcodes.io or the Parliament API goes down.* The card shows "we couldn't
  reach the MP lookup right now" and a link to Parliament's own find-your-MP
  page. Nothing else is affected.
- *A constituency name doesn't match.* The lookup goes via the constituency
  name as a string, and the two systems don't coordinate on punctuation.
  Somewhere like Ynys Môn is the plausible failure. It would affect one
  constituency, not the tool.
- *Boundaries change at the next review.* The tool asks for the 2024
  boundaries explicitly, so it would fail visibly rather than quietly
  returning the wrong MP.
- *A campaign link goes stale.* Nothing detects this today. See `reviewBy`
  above.

**To embed it** in a page on tbfighters.org:

```html
<iframe id="tbaf" src="https://leahmih.github.io/tb-action-finder/"
        width="100%" style="border:0"></iframe>
<script>
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://leahmih.github.io') return;
    if (!e.data || e.data.type !== 'tbaf:height') return;
    document.getElementById('tbaf').style.height = e.data.height + 'px';
  });
</script>
```

The tool reports its own height as cards expand and collapse, so the iframe
grows and shrinks with it rather than scrolling inside a fixed box. Two
things to keep: the `e.origin` check, without which any site could resize the
frame, and the trailing slash on the URL, without which the tool's files
won't load.

Fuller build notes, including everything investigated and rejected along the
way, are in `NOTES.md` in the repo.
