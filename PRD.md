# TB Action Finder — Product Spec (MVP)

Status: DECISIONS LOCKED (D1–D7) · pending D8 link confirmations · Owner: Leah · Build: ~2 weeks, vibe-coded with Claude Code · Recipient: TBFighters

---

## 1. Problem & goal

The existing tbfighters.org Take Action page is **campaign-centred**: it lists campaigns and the user has to work out which apply to them and what to do. Even motivated Nerdfighters drop off in that gap, and when an action is urgent, every extra step costs participation.

This tool is **human-centred**: ask two things — your country and how much time you have — and hand back a short, prioritised list of actions you can act on immediately. It generalises "Tofu's map" (US-only, single action) into something country- and time-aware that covers every campaign, current and future.

Success = more individuals taking a concrete action, with less friction, than the campaign page produces today.

## 2. Target users

- Primarily Nerdfighters / TBFighters supporters, mixed technical ability, **mobile-heavy**.
- Located mainly US / UK / Canada, but anyone worldwide may arrive.
- Range from first-time actors ("I want to help, what do I do") to repeat advocates.

## 3. Scope

### In scope (MVP)
- Two-question flow (country, time) -> ranked, filtered action list.
- Router model: every action links out to the page/tool TBFighters already uses (new tab).
- "Learn more" link on every action card.
- Weekly bucket: a "set a weekly reminder" action (calendar link), not a repeat of the tonight action (see §6).
- Hill-day-style "future event" handling (do-now action + sign-up CTA).
- Evergreen fallback actions so no path is a dead end.
- Mobile-first, accessible, and built for visual + technical parity with tbfighters.org (see §11).

### Out of scope (MVP — deliberately deferred)
- In-tool embedding of any action (postcode->MP lookups, inline templates). Roadmap in §8.
- Any backend, accounts, or a shared/global action counter (the basis of "Tool 3").
- Automated recurring email sends (intentionally avoided — see §6/§12).
- Maintenance tooling / CMS for non-engineers (deferred per instruction — see Risk R4).
- Languages other than English.

## 4. User flow

Single page, three states, no full page reloads.

1. Screen 1 — Country: US / UK / Canada / Other. ("Other" matches only `any` actions + fallbacks; Australia currently falls here.)
2. Screen 2 — Time: "Under 30 minutes, tonight" / "About 30 minutes, weekly" / "More — I want to go deeper."
3. Screen 3 — Results: filtered, sorted action cards.

Each result card has one dominant primary button plus secondary controls:
- Primary action button (routes out, new tab) — the do-now action; on Hill Day / future-event cards this is the event sign-up CTA instead.
- "Learn more" link — to the recommended campaign/problem page (`learnMore`).
- "Sign up for TBFighters emails" — on every card, links to the TBFighters signup.
Weekly cards additionally show a "Set a weekly reminder" button (calendar link). The primary button must visually dominate; Learn more and Sign up stay secondary (smaller / text-style) so the main action isn't diluted (see §10 button hierarchy).

## 5. Functional requirements

- FR1: Country filters to actions whose `countries` includes the choice, or `"any"`.
- FR2: Time filters to actions whose `timeBuckets` includes the choice.
- FR3: Inactive actions (`active: false`) never appear.
- FR4: Results sort by importance (see §6 ranking rule).
- FR5: If the top match is a future event (`immediate: false`), the highest-ranked immediate action shows as the primary "do now" card, and the event renders as a sign-up CTA card below it.
- FR6: If no action matches, show the evergreen fallback (recruit a friend), never a blank screen. (Email signup is always present as a per-card button.)
- FR7: For the weekly bucket, each card shows a "Set a weekly reminder" button that creates a recurring calendar event (Google Calendar link or downloadable .ics) prompting the user to repeat the action. The tool never auto-sends messages.
- FR8: Every card shows a "Learn more" link to its `learnMore` URL (the problem/campaign page).
- FR9: Primary buttons open in a new tab; the tool's own state is never lost.
- FR10: Every card shows a "Sign up for TBFighters emails" button linking to TBFighters' signup form. The weekly reminder button is a separate, calendar-based control (see §6) — it is not an email subscription.

## 6. The engine

```
results = actions
  .filter(a => a.countries.includes(country) || a.countries.includes("any"))
  .filter(a => a.timeBuckets.includes(timeBucket))
  .filter(a => a.active)
  .sort(by importance, with own-country rep boost)   // ranking rule below

if results is empty: results = evergreen fallback actions
render results, applying the future-event rule (FR5) and the weekly reminder treatment (FR7)
```

Ranking rule (D5 — DECIDED): a single `importanceRank` per action, plus an engine rule that floats a user's own-country `rep_contact` action above cross-cutting corporate actions (so a UK user sees "contact your MP" above "email Danaher"). This fixes the quirk where Danaher (global rank 2) would otherwise outrank a constituent's own representative action (rank 3/4).

Weekly reminder rationale: automated identical emails on a schedule are weak advocacy — offices weight genuine, individually-sent constituent messages and discount bulk/botted ones, and auto-sending conflicts with the activism guide. A recurring reminder to send a fresh personal message is the effective, on-guidance version.

## 7. Data model (`actions.json`)

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Stable identifier |
| `title` | string | Card heading |
| `blurb` | string | One-line description |
| `countries` | array | `US` / `UK` / `CA` / `any` |
| `timeBuckets` | array | `tonight` / `weekly` / `deeper` |
| `importanceRank` | number | 1 = highest priority |
| `active` | boolean | `false` hides it (closed/expired) |
| `immediate` | boolean | `false` = future event -> CTA treatment (FR5) |
| `type` | string | `email_template` / `external_link` / `rep_contact` / `future_event` |
| `actionUrl` | string | Where the primary button routes (MVP) |
| `signupUrl` | string | For future-event CTA (optional) |
| `learnMore` | string | Problem/campaign page (FR8) |
| `weeklyNudge` | string | Copy shown when time = weekly (optional) |

`type` only changes how a card renders once embedding lands; in the MVP every type routes out via `actionUrl`. This is the seam that lets embedding slot in without a rewrite.

## 8. Recommendation rendering — router now, embedding later

MVP: every card's primary button opens `actionUrl` in a new tab. The table is the forward plan, not MVP work. Estimates are rough, assume a first-time vibe-coder, and exclude ongoing maintenance.

| Action | MVP (router) | Future embed | Rough embed effort |
|---|---|---|---|
| Danaher email | link to templates page | inline template + prefilled mailto + copy button | 0.5–1 day |
| Danaher social | link to campaign page | prefilled share links / copyable text | ~0.5 day |
| US reps (PEPFAR, Dear Colleague) | link to Tofu's map | fork/restyle Tofu (senators easy; House needs district lookup) | 2–4 days |
| UK MP | link to confirmed UK tool | postcode -> constituency -> MP (UK Parliament Members API / mySociety) | 3–5 days |
| Canada MP | link to confirmed CA tool | postal code -> riding -> MP (Represent / OpenNorth API) | 3–5 days |
| Hill Day | link to campaign page + newsletter | stays a CTA — no embed needed | n/a |
| Evergreen deeper | link to newsletter / social | share buttons / prefilled posts | 0.5–1 day |

Indicative total to embed everything: ~10–18 days, sequenced after the MVP (US-via-Tofu first, then UK, then Canada).

## 9. Tofu's map

- MVP: link to the live map — no copying, no licensing issue, but a dependency on its uptime (Risk R5). Send Tofu a courtesy heads-up before launch.
- Embedding later: check the repo `LICENSE`; fork + attribute if permissive; message Tofu regardless. Underlying congressional data is public domain; only the map code/design needs the check.

## 10. Non-functional requirements

- Mobile-first responsive layout; usable one-handed on a phone.
- Button hierarchy: each card has one dominant primary action; "Learn more" and "Sign up" are visually secondary, so multiple CTAs don't dilute the main action.
- Accessibility: keyboard navigable, semantic HTML, sufficient colour contrast, visible focus states, screen-reader labels on buttons/links.
- Performance: single small page + one JSON fetch; trivially fast.
- Browsers: current mobile/desktop Safari, Chrome, Firefox, Edge.
- Privacy: no personal data stored in the MVP (country/time held in memory only; nothing written to localStorage). Postcode lookups later are personal-ish -> GDPR review at that point (Risk R6).
- Analytics (D4 — DECIDED): Cloudflare Web Analytics (free, cookieless, no consent banner) to measure starts, completions, action click-throughs, and reminders set. NOTE: with the "I did it" button removed, outbound click-through is the only "action taken" signal; Cloudflare's event tracking is basic, so if measuring conversions becomes important we may revisit the analytics tool (Risk R11).

## 11. Hosting, deployment, handoff (D1, D2, D6 — DECIDED)

- Stack: plain HTML + CSS + vanilla JS, one page, no build step. Content in `actions.json`.
- Host: GitHub Pages (matches Tofu and tbfighters.org).
- Where it lives (D1): standalone site linked from tbfighters.org for now.
- Repo (D2): created in Leah's account, transferred to TBFighters' org at handoff.
- Built to become the front door (D6): the tool is finished standalone, but designed and architected so it can replace the current `/action` page with minimal rework:
  - Visual parity — reuse tbfighters.org colours, type, header/footer.
  - Technical portability — self-contained, scoped CSS that won't clash with the main site, all content in `actions.json`, no dependencies the main site lacks; hostable at `tbfighters.org/action` with little change.
- Handoff package: the repo, this spec, `actions.json` with documented fields, and a short "how to add/edit an action" note. TBFighters reviews and approves all copy and outbound links at handoff (D7).

## 12. Tone & safety

- All advocacy copy comes from TBFighters' existing, vetted templates — the tool does not generate new advocacy messaging.
- No automated/repeated sends; reminders prompt genuine, individual messages, consistent with the activism guide (polite, respectful; threats/intimidation never okay).
- Link the activism guide where relevant.

## 13. Success metrics

- Primary: action click-throughs (button -> external tool) per session.
- Secondary: flow completion rate, weekly reminders set, share of sessions hitting a fallback (signals a content gap).
- Qualitative: TBFighters volunteer feedback in a soft launch before the public link.

## 14. Open decisions

- D1–D7: DECIDED (see §10–§12 and the engine ranking rule).
- D8 — OUTSTANDING (doesn't block the build): confirm exact outbound links — UK "Act Now" URL, a Canada action/link (likely RESULTS Canada; may not exist yet), and the TBFighters email signup URL used by the universal "Sign up" button.
- D9 — RESOLVED by removing "I did it": with no action-count captured anywhere, no counter/backend is needed, so the host stays GitHub Pages (D1) and the project remains pure static. Consequence: Tool 3 (the aggregate "marble pile") can no longer lean on Tool 2 capturing taps — it will need its own data source when it's built. Re-adding an action counter later is easy in code, but any actions taken in the meantime are never counted.

## 15. Risks & mitigations

- R1 Subjective "impactfulness" — ranking is editorial. Frame results as "suggested priority"; TBFighters owns the order.
- R2 Closed/expired campaigns — the `active` flag; set time-sensitive actions to a known end state.
- R3 External link rot (NewMode, results.org, etc.) — pre-launch link check; known limitation given deferred maintenance.
- R4 Staleness (maintenance deferred) — the tool can drift with no owner. At minimum show a "last reviewed" date; flag a maintenance owner as a fast-follow.
- R5 Dependency on Tofu's map for US rep actions — if it breaks/moves, US actions break. Courtesy message now; plan to fork in the embedding phase.
- R6 Privacy/GDPR once postcode lookups land — don't store postcodes; review before that phase ships.
- R7 Accessibility gaps — bake a11y into the build; test with keyboard + a screen reader before launch.
- R8 Scope creep into embedding/backend mid-build — hold the §3 out-of-scope line.
- R9 `file://` fetch failure (vibe-coding gotcha) — loading `actions.json` via fetch fails when opening `index.html` directly from disk; must be served (GitHub Pages or a local server).
- R10 No confirmed Canada action — Canada may surface only the generic MP action + fallbacks until a real Canada link is confirmed (D8).
- R11 Weak success signal — without "I did it", success rests on outbound-click tracking; Cloudflare Web Analytics is basic at this, so conversion measurement may need a revisit.

## 16. High-level build phases (detailed schedule next)

1. Skeleton + deploy loop live (empty page on GitHub Pages).
2. Data file + filter/sort engine -> real answers produce real cards.
3. Future-event rule, weekly reminder, fallbacks, "Learn more" + "Sign up" buttons.
4. Branding/visual parity, mobile, accessibility, copy review.
5. Soft launch to volunteers -> fixes -> public link.

A day-by-day two-week schedule comes next, now that D1–D7 are locked.
