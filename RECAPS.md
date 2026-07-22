# RECAPS.md — BarnDoors Project History

A running log of decisions and actions taken on this project, in plain language.
Newest entries at the top. This is a history, not a spec — for current rules see
`AGENTS.md`, and for current data model see `barndoors-schema.md`.

---

## 2026-07-22 — Added a security review section to AGENTS.md

Added a **Security review** section to `AGENTS.md` so agents (and I) have a
standing rule for when to run a security pass and what to actually check. Two
parts: *when to review* (before every production deploy, and after anything that
touches forms, routes, backend code, migrations, Edge Functions, or new
dependencies) and a *BarnDoors-specific checklist* (RLS on every table, column
hiding staying server-side, service-role code authorizing its caller, the `.ics`
token endpoint leaking nothing extra, secrets never reaching the frontend, and
Storage bucket policies matching the role rules).

Also documented a **full sweep** procedure in `AGENTS.md` (audit every existing
RLS policy and Edge Function, not just the current diff) — worth running
periodically and before major milestones, since the `security-review` skill only
looks at pending changes on the current branch.

## 2026-07-21 — Feed schedule: added CSV download as view 2

Added a "Download CSV" button next to "Print" on `/reports/feed-schedule`,
same column order and data as the spreadsheet view (`lib/csv.js` — a small
`Blob` + temporary `<a download>` helper, no new dependency). This
**reverses the earlier "no PDF/CSV export in v1" scope decision** — flagged
and confirmed with the project owner before building. Updated `AGENTS.md`
and `barndoors-schema.md` accordingly: PDF generation is still out of scope,
but CSV download is now allowed per-report where it's useful.

## 2026-07-21 — First report: printable feed schedule (spreadsheet view)

Started the Reports section (previously just a placeholder concept in
AGENTS.md/schema). Added a "Reports" button to the home screen, a `/reports`
index page, and the first real report at `/reports/feed-schedule`.

- Spreadsheet-style view: one row per active horse, one column per feed
  item. Column order is fixed — Horse name, Alfalfa, Grass, Grain, SR Pro,
  SimpliFly, then any remaining feed items (Calf Manna, plus anything added
  via "New") alphabetically, then Feed notes last. Built to reuse the same
  amount-formatting rules as the Heard detail view (`lib/feedFormat.js`).
- Sized to print on one 8.5"x11" sheet, single-sided, landscape (set via a
  global `@page { size: letter landscape }` in `index.css` — fine while this
  is the only print report; will need named `@page` rules if a future report
  wants a different size/orientation on the same visit). Font size is
  computed from *both* the number of horses (rows) and the number of feed
  items (columns) — whichever axis is more cramped wins — so the sheet
  scales down gracefully whether you add more horses or more feed items,
  down to a legibility floor (~9px); beyond that floor it's expected to
  spill onto a second page rather than become unreadable. Subtle zebra
  stripe for readability across many rows.
- This is view 1 of 2 planned for the feed schedule; a second layout is
  planned as a follow-up.

## 2026-07-21 — Manager/Hand shared login redesign

Hands no longer get individual login accounts — they weren't using/maintaining
them reliably. Replaced with: managers still sign in individually (email +
password); everyone else signs in as "Hand" through one shared account gated
by a single universal password.

- `/login` now shows two stacked buttons, "Manager" and "Hand", each revealing
  its own fields below it. `AuthContext.signInAsHand(password)` signs in
  against one fixed, non-secret shared email (`HAND_LOGIN_EMAIL`).
- Migration `20260721100000_decouple_hand_profiles_from_auth.sql` dropped the
  foreign key that forced every `profiles` row to have a live `auth.users`
  account behind it, and simplified `profiles_hand_visible()` to always hide
  `email`/`emergency_contact` (there's no more "own profile" concept once
  hand logins are shared). This was necessary so individual hands' person
  records — name, phone, shift schedule, chore assignments — survive once
  their old individual login accounts are deleted; before this change,
  deleting those accounts would have cascade-deleted or been blocked by that
  data.
- New manager-only screens: "Add hand" (`/hands/new`, plain `profiles`
  insert, no login account) and "Add manager" (`/hands/new-manager`, calls
  the new `create-manager` Edge Function, since a manager creating another
  manager's account can't safely use the client-side `signUp` call — it
  would swap the caller's own session to the new user).
- One-time manual setup completed: created the shared `hand@barndoors.internal`
  Auth account and its `profiles` row (`role = 'hand'`, name "Hand").
- Still to do: delete the old individual hand `auth.users` accounts now that
  their person records are decoupled and safe to keep.

## 2026-07-13 — Synced AGENTS.md with Heard UX and turnout/photo decisions

Updated `AGENTS.md` so agents don't regress recent settled choices from this build
pass:

- Heard list uses in-place expandable cards (one open at a time, scroll-to-top),
  not a separate detail page as the default pattern.
- Turnout groups include standing `days_of_week` weekly schedule (not daily logging).
- One current photo per head in v1; client-side resize/compress before Storage upload.

## 2026-07-12 — Turnout schedule editing (location, days, buddies)

Added the missing turnout schedule UI so managers can define where each animal
goes out, on which days, and with which buddies — hands see it read-only on the
detail page.

- New migration adds `days_of_week` (`text[]` of `mon`–`sun`) to `turnout_groups`,
  documented in `barndoors-schema.md`.
- `HeardForm.jsx` now has a repeatable "Turnout schedule" section: location picker
  (from `turnout_locations`), large day-of-week toggle buttons, and buddy picker
  (other active animals). Saving creates/reuses a matching `turnout_groups` row
  and syncs `turnout_group_members`.
- `HeardDetail.jsx` shows each schedule entry as location + days + buddies (same
  card style as feed items).
- Shared helpers in `app/src/lib/turnoutSchedule.js` for load/save/format.

Requires `supabase db push` for the new migration before schedule saves work.

## 2026-07-12 — Read-only animal detail view (hands can browse feed & turnout)

Opening an animal from the Heard list no longer drops straight into edit mode.
Added `HeardDetail.jsx` as the default `/heard/:id` screen for everyone
(managers and hands):

- Layout follows the mockup: name/age/breed + photo header, FEED table with
  notes, TURNOUT location/buddies with notes — all read-only.
- Pencil icons on the FEED and TURNOUT section headers link to
  `/heard/:id/edit`, and only show for managers.
- Hands can now tap any animal in the list and see feed plan + turnout info
  (RLS already allowed read; this was a missing UI path).
- Edit form moved to `/heard/:id/edit` (manager-only). Saving an edit returns
  to the detail view; adding a new animal still returns to the list.

Turnout "days" from the mockup are not shown yet — the schema has locations and
group buddies but no per-day schedule field.

## 2026-07-12 — Added photo upload for animals

Each animal is supposed to have a picture; the `head_photos` table and public
`head-photos` Storage bucket (manager write, everyone-authenticated read) were
already created back when the initial schema was pushed, but nothing in the app
used them yet. Wired it up:

- `HeardForm.jsx` now has a "Photo" section at the top with a live preview, an
  "Add photo"/"Replace photo" file picker, and a "Remove" button. New/replacement
  photos upload to Supabase Storage on save (after the animal record itself is
  saved, since the upload path needs the animal's ID); replacing a photo deletes
  the old file from Storage so orphaned files don't pile up.
- Kept it to one photo per animal (not a gallery) since that's what was asked for
  — the `head_photos` table technically supports multiple rows per animal for
  future history/gallery use, but the app enforces "replace, don't add" for now by
  always updating the same row once one exists.
- `Heard.jsx` list now shows a small thumbnail next to each animal's name (a horse
  emoji placeholder when there's no photo yet), fetched in one batched query
  rather than one request per animal.
- Online-only upload, no offline queue — matches the schema doc's existing note on
  `head_photos` and the project's broader "read-only offline caching, no offline
  writes" decision.
- Added client-side resize/compression before upload (`optimizeImageForUpload.js`):
  scales the long edge down to 1200px max, re-encodes as JPEG at 70% quality, so
  multi-MB phone photos upload faster on spotty barn Wi‑Fi/cell and don't waste
  Storage bandwidth. Falls back to the original file if the browser can't process
  it (e.g. some HEIC cases).

## 2026-07-12 — Added structured feed plan editing to the animal form

The "Add/edit animal" form only had a free-text "Feed notes" box; the actual
`feed_items`/`head_feed_plan` tables (built in the initial migration) had no UI yet.
Added a repeatable "feed item + amount" section to `HeardForm.jsx`:

- Manager picks from the active `feed_items` list (Alfalfa, Grass, Grain, SR Pro,
  SimpliFly, Calf Manna, or any manager-added "New" item) and can add multiple rows
  per animal (e.g. alfalfa + grain + a supplement all at once, per the schema doc).
- Amount fields switch automatically based on each feed item's `dual_unit` flag:
  flakes + lbs for Alfalfa/Grass, or a single amount + unit (cup/scoop/handful/lbs)
  for everything else.
- Save writes/updates/deletes rows in `head_feed_plan` directly (no completion
  tracking, matching the "standing plan, not a logged event" rule), stamping
  `updated_by`/`updated_at` from the signed-in manager.
- Free-text "Feed notes" field is unchanged and still available for anything that
  doesn't fit the structured list (e.g. special instructions).

## 2026-07-12 — Scaffolded Supabase project setup

Built out the Supabase side of the app (not just planning docs this time) so the
project can actually be connected to a real backend:

- Added the Supabase JS client to the app (`app/src/lib/supabaseClient.js`), reading
  the project URL/key from env vars — `app/.env.example` shows what's needed, and
  real `.env` files are now git-ignored.
- Wrote the first full database migration (`supabase/migrations/`) translating every
  table in `barndoors-schema.md` into SQL, with row-level security on every table:
  managers get full read/write, hands get read-only. Note: `AGENTS.md`'s phrasing
  `auth.role() = 'manager'` is shorthand for this — the real Postgres/Supabase
  `auth.role()` only returns `authenticated`/`anon`/`service_role`, so the migration
  implements the intent via a `is_manager()` helper that checks each user's
  `profiles.role` instead.
- Implemented the `profiles_hand_visible` view exactly as described in the schema
  doc, so hands can browse everyone's profile but only see their own email/emergency
  contact.
- Added storage buckets + policies for head photos and profile photos (online-only
  upload, managers write, everyone authenticated can view).
- Added `supabase/seed.sql` with the preloaded feed items, turnout locations, and
  chore types called out in the schema doc (still manager-extensible via "New" in
  the app, this is just the starting set).
- Added a root `netlify.toml` with the SPA redirect rule and build settings called
  out in `AGENTS.md`, so deep links don't 404 on Netlify.
- None of this creates the actual Supabase project or runs the migration against a
  live database yet — that needs the project owner's Supabase account (dashboard
  project creation, then `supabase link` + `supabase db push`, then setting the
  Netlify env vars). Left as manual follow-up steps.

## 2026-07-12 — Fixed sign-up not capturing a display name for Supabase's own dashboard

Noticed while testing: Supabase's own Authentication → Users table only ever
showed email addresses, never a name, for every account created (whether via
sign-up in the app or via the dashboard's "Add user"). Root cause: the sign-up
form never collected a name at all, and separately, the DB trigger that seeds
`profiles.name` was reading `raw_user_meta_data->>'name'` — but Supabase Studio's
own dashboard looks for `full_name` (or a few close variants), not `name`.  Fixed
both: added a required Name field to the sign-up form (passed to
`supabase.auth.signUp` as `full_name` metadata), and updated the trigger to read
`full_name` instead of `name`, so both the app's `profiles.name` and Supabase's
own dashboard now agree going forward. Existing test accounts created before this
fix still show blank in the dashboard — not retroactively fixed, low priority
since they were test data.

## 2026-07-12 — Manager-only add/edit forms for Heard and Chores, edit for Hands

Added the write side of the app, so managers can actually create/edit real
records instead of only viewing seeded lookup data:

- `Heard` and `Chores` each got a full add + edit form (manager-only, guarded by
  a new `ManagerRoute` on top of the existing session guard — client-side UX
  only, the real enforcement is still the database's RLS policies).
- `Hands` got edit-only (name, phone, role, status) — deliberately did not build
  an "add person" flow here: creating a login account has to go through Supabase
  Auth signup (on the Login page), which is what creates the `profiles` row via
  the existing DB trigger. A manager promotes/edits that row after someone signs
  up, rather than a manager creating accounts from inside the app.
- Status fields (`active`/`archived`, `active`/`inactive`) double as the
  soft-delete mechanism per the schema doc's convention — no separate delete
  button, editing status is the "delete."
- Left out of this pass: `recurrence_details` on chores (day-of-week/month
  specifics) — still writable in the DB but no UI for it yet.
- Confirmed gap (raised by testing, not by planning): there's no in-app way to
  add a new hand — only edit existing ones. Creating a login account needs
  Supabase's admin privileges (the `service_role` key), which can't be exposed to
  the frontend; the correct fix is an Edge Function (same pattern already planned
  for the `.ics` calendar feed) that a manager calls to invite someone by email.
  Decided to defer that for now — in the meantime, managers add hands via the
  Supabase dashboard directly (Authentication → Users → Add user), which still
  triggers the same `profiles` row creation. Promoted the first real account
  (`lisa@lisawilkins.com`) to `manager` directly in the database, since the very
  first manager can't be created through the app's own (manager-only) UI.

## 2026-07-12 — Fixed a real Supabase Security Advisor error on profiles_hand_visible

Supabase's Security Advisor correctly flagged `profiles_hand_visible` as an ERROR:
plain views default to running with the view owner's privileges, bypassing RLS on
`profiles` entirely — a common way to accidentally leak data. In this case the
bypass was intentional (hands only have row-level access to their own profile row,
so a view that respected RLS would show a hand only themselves, breaking the
roster). Fixed properly rather than dismissing the warning: replaced the view with
an explicit `SECURITY DEFINER` function (`profiles_hand_visible()`), the sanctioned
pattern for a deliberately scoped RLS bypass — Supabase's advisor flags definer
views but not definer functions. Verified directly against the live database
(function exists with `security_type: DEFINER`, old view confirmed gone, both
migrations recorded on the remote) rather than trusting the CLI's ambiguous
"Finished supabase db push" message, which — as seen earlier in this same
session — prints even when a push actually failed.

## 2026-07-12 — First real Supabase-backed screens (auth + Heard/Hands/Chores)

Wired the app up to the live database for real, past just the setup:

- Added email/password sign in and sign up (`Login.jsx`), a session-aware
  `AuthContext`, and a `ProtectedRoute` wrapper — every screen except `/login` now
  requires a signed-in session, matching the RLS policies (which all require
  `authenticated`). New signups default to `hand` via the existing DB trigger; a
  manager promotes trusted accounts from the Supabase dashboard for now — an in-app
  "manage people" screen is a follow-up, not built yet.
- `Heard`, `Hands`, and `Chores` now show real, read-only lists from the database
  instead of placeholders. `Hands` is role-aware: managers query `profiles`
  directly, hands query `profiles_hand_visible`, matching the field-visibility rule
  in the schema doc.
- Deliberately scoped out of this pass: add/edit UI (manager-only writes). This
  pass was about proving the read path end-to-end; write flows are next.

## 2026-07-12 — Live Supabase project connected and schema deployed

Created the actual Supabase project (dashboard) and pushed the migration for real —
this is no longer just local scaffolding, the tables now exist on a live database:

- Installed the Supabase CLI, linked it to the live project, and ran `supabase db
  push` + the seed script. Along the way, fixed two real bugs the first attempt
  surfaced (both now corrected in the migration file itself, not just worked around):
  - `is_manager()` was defined before the `profiles` table it queries — `language
    sql` functions get parse-checked at creation time (unlike `plpgsql`), so this
    failed immediately. Moved the function to right after `profiles` is created.
  - `calendar_feed_token`'s default called `gen_random_bytes()` unqualified, but
    Supabase installs `pgcrypto` into an `extensions` schema, not `public` — so the
    call couldn't resolve. Schema-qualified it (`extensions.gen_random_bytes`) and
    made the `create extension` statement explicit about that schema too, so this
    works the same way on a brand-new project.
- Verified against the live database (not just "it ran without erroring"): all 14
  tables + the `profiles_hand_visible` view exist, seed row counts match the schema
  doc exactly (6 feed items, 5 turnout locations, 13 chore types), and both storage
  buckets (`head-photos`, `profile-photos`) were created.
- Noted but not yet fixed: the Supabase CLI installed via Homebrew is running as an
  x86_64 binary under Rosetta (this Mac only has Intel Homebrew at `/usr/local`, no
  native Apple Silicon Homebrew at `/opt/homebrew`), which is why every CLI command
  prints a Bun "CPU lacks AVX support" warning. Hasn't caused any actual failures so
  far; a native-Homebrew reinstall is a nice-to-have follow-up, not a blocker.

## 2026-07-12 — Clarified Netlify/Supabase deployment details in AGENTS.md

Discussed hosting the frontend on GitHub Pages vs. Netlify; decided to stick with
Netlify + Supabase (no change to the locked-in stack). That discussion surfaced a
few implementation details worth locking in, plus fixed a path bug:

- Fixed `AGENTS.md` references to `barndoors-schema.md` that had regressed to a
  nonexistent `/docs/` path (the file lives at the repo root).
- Auth is Supabase Auth only — explicitly ruled out Netlify Identity to avoid
  confusion between the two platforms' auth products.
- The subscribable `.ics` calendar feed is implemented as a **Supabase Edge
  Function**, not a Netlify Function.
- Netlify needs a standard SPA redirect rule (`_redirects` or `netlify.toml`)
  so client-side routing doesn't 404 on refresh/deep link.

## 2026-07-07 — Initial commit

- Created the repo with a placeholder `README.md`.

## 2026-07-07 — Added AGENTS.md and barndoors-schema.md

Added the two foundational planning docs before any app code was written:

- **AGENTS.md** — instructions for AI coding agents working in this repo. Covers
  the product summary (herd/head records, chores, people, reports), the locked-in
  tech stack (React/Vite/Tailwind PWA, Supabase, Netlify), the manager-write /
  hand-read-only permission model, and scope decisions deliberately left out of v1
  (offline writes, calendar OAuth, PDF/CSV export) so agents don't reintroduce them
  without asking first.
- **barndoors-schema.md** — the source-of-truth data model (tables and fields),
  starting with the People (`profiles`, `shifts`) and Heard/Head sections.

These files capture the settled product and architecture decisions from planning.
Pushed to `origin/main`.
