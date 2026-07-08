# AGENTS.md — BarnDoors

This file guides AI coding agents (Cursor, etc.) working in this repo. It reflects
product/architecture decisions made during planning — treat these as settled unless
the project owner explicitly changes them here.

Full data model lives in `/docs/barndoors-schema.md` — that file is the source of
truth for tables/fields; keep it in sync with actual migrations. This file covers
behavior, conventions, and guardrails.

## Project summary

BarnDoors is a barn/ranch management web app covering:
1. **Heard & head records** — livestock data, feed plans, turnout groups, custom fields
2. **Chores** — daily/weekly/semi-monthly/monthly/quarterly tasks, open or assigned
3. **People** — managers (full edit access) and hands (read-only), profiles, shift scheduling
4. **Reports** — print-friendly, filtered views over the above (no PDF/CSV export in v1)

Primary usage context: hands operate the app **one-handed, outdoors, in rain/heat/chaotic
conditions**, often via on-screen dictation. Every UI decision should default to large touch
targets, minimal typing, and high legibility over density or cleverness.

## Tech stack (do not deviate without asking)

- **Frontend:** React + Vite + Tailwind, built as an installable PWA (manifest + service worker)
- **Backend:** Supabase (Postgres + Auth + Storage + Row-Level Security)
- **Deployment:** Netlify (frontend), Supabase (backend); env vars for Supabase URL/anon key
  live in Netlify environment settings, never committed
- **Offline:** read-only caching only (service worker + IndexedDB) for this iteration —
  no offline writes, no sync engine (e.g. PowerSync). Do not add offline write queues
  without explicit sign-off; this was a deliberate scope decision, not an oversight.
- **Calendar:** shifts are exposed via (a) an in-app calendar tab, (b) a subscribable
  `.ics` feed URL keyed to a per-profile `calendar_feed_token`, and (c) one-time `.ics`
  download. No Google/Apple Calendar API integration, no OAuth for calendar.
- **Photos:** online-only upload to Supabase Storage. No offline photo queue.
- **Reports:** print-friendly browser views (`@media print` styling), fixed columns +
  filters. No PDF/CSV generation, no custom column-picker in v1.

## Roles & permissions — the one rule that governs everything

- **Managers:** full create/edit/delete (soft-delete default, hard-delete as a separate
  deliberate action) across all data.
- **Hands:** **read-only, full stop** — across heard/head, chores, turnout, feed plans,
  shifts, everything. Hands do not mark chores complete — there is no completion
  tracking in this app. Hands cannot create, edit, or delete records anywhere.
- Enforce row-level restrictions via Supabase RLS, not client-side checks alone. Every
  table's write policy should reduce to: `allow write if auth.role() = 'manager'`.
  There should be no per-table exceptions — if a feature seems to need one, stop and
  ask rather than assuming.
- **Field-level (column) restrictions are different from row-level and need a different
  mechanism.** Where hands should see *some* but not *all* columns of a row they're
  otherwise allowed to read (e.g. `profiles.email` and `profiles.emergency_contact` are
  hidden for other hands, but visible on their own profile), build a restricted
  Postgres **view** (e.g. `profiles_hand_visible`) that hands query instead of the base
  table. Do not attempt this kind of restriction by filtering fields in app code —
  it's easy to leak data if the UI is bypassed (API calls, browser dev tools, etc.).

## Data model

See `/docs/barndoors-schema.md` for full field-level detail. Key structural decisions
baked into it that should not be silently changed:

- **Soft delete by default.** Most tables use a `status`/`active` field rather than
  physical deletion. Hard delete is a separate, explicit action.
- **Extensible lists via "New."** `feed_items`, `turnout_locations`, and `chore_types`
  are manager-extensible, not hardcoded enums. Read them from the DB, don't hardcode
  as fixed dropdowns in code.
- **Feed is a standing plan, not a logged event.** `head_feed_plan` has no completion
  tracking (no fed_by/fed_at). Don't add feeding-event logging unless asked.
- **Turnout groups are standing**, manager-edited, many-to-many with head (a head can be
  in multiple groups; no date-based reformation). The act of turning a group out is a
  **chore** (`chore_types.name = 'Turnout'`), not a separate logged action.
- **Chore instructions ("read more") are fixed per chore type**, not per individual
  chore instance or per assignee. Don't add per-instance instruction overrides.
- **No chore completion tracking.** Hands never mark chores done; don't build a
  completion table or UI for this.
- **Reports are views, not new data.** Feed chart, turnout chart, monthly shifts,
  individual shift view, and assigned chores view are all filtered queries over
  existing tables — fixed columns, no dynamic column selection in v1.

## Conventions

- Prefer plain, direct UI copy over jargon — hands are working outdoors, often via
  dictation, not reading carefully.
- Large tap targets, minimal required typing, one-handed-friendly layouts throughout,
  including on desktop/tablet fallback views.
- When generating commit messages or PR summaries, write them in plain language a
  non-developer product owner can follow — avoid unexplained technical jargon.
- Don't run destructive database migrations (drops, irreversible schema changes)
  without explicitly flagging it first and waiting for confirmation.
- Don't introduce new external services/APIs (calendar OAuth, offline sync engines,
  push notification providers, PDF/CSV generation libraries, etc.) without flagging
  the addition — several of these were deliberately scoped out for this iteration.

## Open items (not yet decided — ask rather than assume)

- Vet/dental/farrier notes structure — planned but not built; likely a separate
  hand-restricted table (e.g. `head_medical_notes`), not columns on `head` or
  `head_records`, to keep the visibility split at the table level.
- Building/structure maintenance tracking — not yet scoped, owner/viewer role undecided.
