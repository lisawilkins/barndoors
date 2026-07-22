# AGENTS.md — BarnDoors

This file guides AI coding agents (Cursor, etc.) working in this repo. It reflects
product/architecture decisions made during planning — treat these as settled unless
the project owner explicitly changes them here.

Full data model lives in `barndoors-schema.md` — that file is the source of
truth for tables/fields; keep it in sync with actual migrations in
`supabase/migrations/`. `RECAPS.md` is a plain-language project history (not a
spec). This file covers behavior, conventions, and guardrails.

## Project summary

BarnDoors is a barn/ranch management web app covering:
1. **Heard & head records** — livestock data, feed plans, turnout groups, custom fields
2. **Chores** — daily/weekly/semi-monthly/monthly/quarterly tasks, open or assigned
3. **People** — managers (full edit access) and hands (read-only), profiles, shift scheduling
4. **Reports** — print-friendly, filtered views over the above; some reports also offer a
   plain CSV download (no PDF export in v1)

Primary usage context: hands operate the app **one-handed, outdoors, in rain/heat/chaotic
conditions**, often via on-screen dictation. Every UI decision should default to large touch
targets, minimal typing, and high legibility over density or cleverness.

## Tech stack (do not deviate without asking)

- **Frontend:** React + Vite + Tailwind, built as an installable PWA (manifest + service worker).
  All frontend code lives in the **`app/`** directory at the repo root; Netlify builds from
  there (`netlify.toml` sets `base = "app"`). Tailwind v4 via the `@tailwindcss/vite` plugin
  (no separate `tailwind.config.js` unless explicitly added later). **Routing:** React Router
  (`react-router-dom`) for client-side navigation.
- **Backend:** Supabase (Postgres + Auth + Storage + Row-Level Security). Schema
  lives in `supabase/migrations/` (timestamped SQL files), with lookup seed data in
  `supabase/seed.sql` and local CLI config in `supabase/config.toml`. Apply new
  migrations to the linked remote project via `supabase db push` (after
  `supabase link`). Local link state under `supabase/.temp/` is gitignored. A live
  Supabase project is connected; the committed migrations reflect production.
- **Deployment:** Netlify (frontend), Supabase (backend). Production site:
  `https://barn-doors.netlify.app`. Root `netlify.toml` sets `base = "app"`, `publish = "dist"`
  (publish is relative to base — **not** `app/dist`), and `command = "npm run build"`. Netlify
  needs an SPA redirect rule (`_redirects` or `netlify.toml`: `/*  /index.html  200`) so
  client-side routes don't 404 on refresh/deep link.
  - **Env vars:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `app/.env.example`).
    Local dev copies that file to `app/.env` (gitignored). Production values live in Netlify
    **Site configuration → Environment variables**, never committed. Use the real project URL
    and key from Supabase (Project Settings → API) — not the placeholders in the example file.
    Newer Supabase projects may use a `sb_publishable_...` key; it still goes in
    `VITE_SUPABASE_ANON_KEY`.
  - **Build-time inlining:** Vite bakes `VITE_*` vars into the JS bundle at build time.
    Changing Netlify env vars requires a **redeploy** (not just saving). A blank page or login
    "Failed to fetch" usually means missing, placeholder, or stale values.
  - **Supabase Auth URLs:** In Supabase **Authentication → URL configuration**, set **Site URL**
    to the Netlify production URL and add it to **Redirect URLs** (e.g.
    `https://barn-doors.netlify.app/**`).
- **Auth:** Supabase Auth only. Do not use Netlify Identity or any other auth provider —
  this was flagged explicitly to avoid confusion between the two platforms.
  - **Managers** each have an individual Supabase Auth account (email + password) and sign in
    individually on `/login`. New manager accounts are created in-app by an existing manager
    (`/hands/new-manager`, `ManagerForm.jsx`), which calls the `create-manager` Supabase Edge
    Function (`supabase/functions/create-manager/`) — that function uses the service-role Admin
    API (`auth.admin.createUser`) so the calling manager's own session isn't disturbed (a plain
    client-side `supabase.auth.signUp()` would otherwise swap the caller's session to the new
    user), then promotes the new profile's `role` to `manager` (the signup trigger always
    defaults new accounts to `hand`). The very first manager still has to be promoted by hand
    in the Supabase dashboard/SQL, since creating one requires an existing manager to be logged
    in already.
  - **Hands do not have individual accounts.** Everyone signs in as a hand through one shared,
    dedicated Supabase Auth account gated by a single universal password (set on `/login` by
    selecting "Hand"). The shared account's email is a fixed, non-secret constant
    (`HAND_LOGIN_EMAIL` in `app/src/lib/AuthContext.jsx`) — only the password is meant to be kept
    to people who work here; if it's forgotten, ask anyone else who knows it. That account and
    its matching `profiles` row (`role = 'hand'`) are created once, manually, the same way the
    first manager is (dashboard/SQL) — there's no in-app flow to create or rotate this account,
    since it's expected to change rarely if ever.
  - Individual hand **person records** (name, phone, emergency contact, photo — used for shift
    scheduling, chore assignment, and reports) are separate from login entirely: a manager
    creates them directly (`/hands/new`, `HandForm.jsx`, a plain `profiles` insert) with no auth
    account behind them. `profiles.id` is therefore **not** foreign-keyed to `auth.users.id`
    (dropped in `supabase/migrations/20260721100000_decouple_hand_profiles_from_auth.sql`) — a
    manager's row happens to match their real auth id, but a hand's row doesn't need to. Don't
    reintroduce that FK; it previously meant deleting a hand's login would cascade-delete (or
    be blocked by) their shift/chore/report history.
  - There's no more "own profile" concept for hands (everyone shares one login), so
    `profiles_hand_visible()` always hides `email` and `emergency_contact` rather than only
    showing them on your "own" row.
  - **One-time setup for the shared Hand account (do this in order, don't skip steps):**
    1. Deploy the `20260721100000_decouple_hand_profiles_from_auth.sql` migration and the
       `create-manager` Edge Function, and ship the updated frontend.
    2. In the Supabase dashboard, create one new Auth user for the shared login (e.g.
       `hand@barndoors.internal` — must match `HAND_LOGIN_EMAIL`) with the real desired
       universal password.
    3. Insert a matching `profiles` row for that user's id (`role = 'hand'`, a generic display
       name like "Hand").
    4. Verify both the "Manager" and "Hand" paths on `/login` work end to end.
    5. **Only then** delete the old individual hand `auth.users` accounts — doing it before
       step 1 ships would cascade-delete or corrupt those hands' shift/chore/report history
       (see the `profiles.id` note above).
- **Offline:** read-only caching only (service worker + IndexedDB) for this iteration —
  no offline writes, no sync engine (e.g. PowerSync). Do not add offline write queues
  without explicit sign-off; this was a deliberate scope decision, not an oversight.
- **Calendar:** shifts are exposed via (a) an in-app calendar tab, (b) a subscribable
  `.ics` feed URL keyed to a per-profile `calendar_feed_token`, and (c) one-time `.ics`
  download. No Google/Apple Calendar API integration, no OAuth for calendar. The `.ics`
  feed is generated by a **Supabase Edge Function** (looks up the token, returns generated
  ICS content) — not a Netlify Function.
- **Photos:** online-only upload to Supabase Storage (`head-photos` bucket for animals,
  `profile-photos` for people). No offline photo queue. **One current photo per head in
  v1** — replace on upload, not a gallery (the `head_photos` table may hold multiple rows
  later, but the app treats it as a single standing photo for now). Resize/compress in
  the browser before upload (max 1200px long edge, JPEG ~70% quality) so phone-camera
  files upload reliably on spotty barn Wi‑Fi/cell.
- **Reports:** print-friendly browser views (`@media print` styling), fixed columns +
  filters, no custom column-picker in v1. A given report may also offer a plain CSV
  download alongside its printable view (built client-side with a `Blob` + temporary
  `<a download>` — no new dependency, no server round-trip) when that's useful as a
  second, non-print output — e.g. the feed schedule report. No PDF generation in v1;
  that's still explicitly out of scope unless flagged and confirmed like this was.

## Roles & permissions — the one rule that governs everything

- **Managers:** full create/edit/delete (soft-delete default, hard-delete as a separate
  deliberate action) across all data.
- **Hands:** **read-only, full stop** — across heard/head, chores, turnout, feed plans,
  shifts, everything. Hands do not mark chores complete — there is no completion
  tracking in this app. Hands cannot create, edit, or delete records anywhere.
- Enforce row-level restrictions via Supabase RLS, not client-side checks alone. Every
  table's write policy should reduce to: managers only. Phrasing like
  `auth.role() = 'manager'` in this doc is shorthand — Postgres `auth.role()` only
  returns `authenticated`/`anon`/`service_role`; the migrations implement manager
  checks via a `public.is_manager()` helper that reads `profiles.role`.
  There should be no per-table exceptions — if a feature seems to need one, stop and
  ask rather than assuming.
- **Field-level (column) restrictions are different from row-level and need a different
  mechanism.** Where hands should see *some* but not *all* columns of a row they're
  otherwise allowed to read (e.g. `profiles.email` and `profiles.emergency_contact` are
  always hidden from hands — there's no "own profile" exception since hand logins are
  shared, see "Auth" above), use a restricted Postgres **function** (e.g.
  `profiles_hand_visible()` — a `SECURITY DEFINER` RPC that nulls hidden columns) that
  hands query instead of the base table. Do not attempt this kind of restriction by
  filtering fields in app code — it's easy to leak data if the UI is bypassed (API
  calls, browser dev tools, etc.).

## Data model

See `barndoors-schema.md` for full field-level detail. Key structural decisions
baked into it that should not be silently changed:

- **Soft delete by default.** Most tables use a `status`/`active` field rather than
  physical deletion. Hard delete is a separate, explicit action.
- **Extensible lists via "New."** `feed_items`, `turnout_locations`, and `chore_types`
  are manager-extensible, not hardcoded enums. Read them from the DB, don't hardcode
  as fixed dropdowns in code. Retiring an entry means toggling its `active` flag
  (deactivate/reactivate), not deleting the row — existing references must keep working.
  Feed items can be managed this way inline from the Heard edit form ("Manage feed
  types"), not a separate settings page.
- **Animals are identified by name only.** `head.tag_id` still exists as a DB column
  but is no longer shown or collected anywhere in the app (forms, list, card view) —
  treat it as deprecated and don't reintroduce a "Tag ID" field without asking.
- **Feed is a standing plan, not a logged event.** `head_feed_plan` has no completion
  tracking (no fed_by/fed_at). Don't add feeding-event logging unless asked.
- **Turnout groups are standing**, manager-edited, many-to-many with head (a head can be
  in multiple groups). Each group defines a **location**, **days of week** (`days_of_week`
  on `turnout_groups` — `mon` through `sun`), and **members** (buddies). This is a
  standing weekly schedule, not a daily log and not date-based reformation. The act of
  turning a group out is a **chore** (`chore_types.name = 'Turnout'`), not a separate
  logged action.
- **Chore instructions ("read more") are fixed per chore type**, not per individual
  chore instance or per assignee. Don't add per-instance instruction overrides.
- **No chore completion tracking.** Hands never mark chores done; don't build a
  completion table or UI for this.
- **Reports are views, not new data.** Feed chart, turnout chart, monthly shifts,
  individual shift view, and assigned chores view are all filtered queries over
  existing tables — fixed columns, no dynamic column selection in v1.

## Heard list UX

The Heard screen uses **in-place expandable cards**, not a separate detail page as the
primary pattern:

- Tap a card to expand feed, turnout, and notes inside the list. Only **one card open
  at a time** — opening another collapses the previous one and scrolls the new card to
  the top of the viewport.
- **Hands** see expanded content read-only. **Managers** see pencil icons on Feed and
  Turnout sections (link to `/heard/:id/edit`) and a Status control at the bottom of
  the expanded card (archive duplicates via `status = 'archived'`, which removes the
  animal from the active Heard list per soft-delete convention).
- `/heard/:id` deep links redirect to the list with that card expanded (`?expand=`).
  Manager create/edit still uses `/heard/new` and `/heard/:id/edit`.
- **Managers can drag-and-drop reorder the list** via a grip handle on the left edge of
  each **collapsed** card (hidden while a card is expanded, since the row layout changes
  and dragging while reading expanded content isn't a real use case). Uses `@dnd-kit`
  (core + sortable + utilities) — the one approved exception to "flag new dependencies
  first." Order persists to `head.sort_order` (see `barndoors-schema.md`); the list query
  orders by `sort_order` instead of `name`. Hands never see the grip and cannot reorder.

## App shell & home screen

Every authenticated screen shares the same top-level layout:

- **Top nav (`TopNav`):** "BarnDoors" wordmark on the left (links to `/`), hamburger menu
  button on the right. The hamburger dropdown shows profile name/role, then links to
  **Heard**, **Hands**, **Chores**, and **Reports** (same four sections as the home screen,
  so they're reachable from any page), then **Sign out**.
- **Home screen (`/`):** post-login landing with large section buttons — **Heard**,
  **Hands**, **Chores**, **Reports** — linking to `/heard`, `/hands`, `/chores`, and
  `/reports`. This is the primary entry point to major app areas; Calendar isn't on home yet.
- **Source layout:** pages in `app/src/pages/`, shared UI in `app/src/components/`, helpers
  in `app/src/lib/`.

## Conventions

- Prefer plain, direct UI copy over jargon — hands are working outdoors, often via
  dictation, not reading carefully.
- Large tap targets, minimal required typing, one-handed-friendly layouts throughout,
  including on desktop/tablet fallback views.
- When generating commit messages or PR summaries, write them in plain language a
  non-developer product owner can follow — avoid unexplained technical jargon.
- Don't run destructive database migrations (drops, irreversible schema changes)
  without explicitly flagging it first and waiting for confirmation.
- When changing the database, add a new file under `supabase/migrations/` **and**
  update `barndoors-schema.md` in the same change.
- Don't introduce new external services/APIs (calendar OAuth, offline sync engines,
  push notification providers, PDF/CSV generation libraries, etc.) without flagging
  the addition — several of these were deliberately scoped out for this iteration.

## Security review

### When to review
Run the `security-review` skill (or an equivalent manual pass) in these situations:
- **Before any production deploy.**
- After a commit or batch of commits introduces a new dynamic/user-input surface — a new
  form, a new route with params, a new third-party script, or any backend/API code.
- **After any new or changed `supabase/migrations/` file** — RLS is the whole security model
  here, so a schema change is always review-worthy.
- **After any new or changed Supabase Edge Function** — `create-manager` and the `.ics` feed
  run with the **service-role key, which bypasses RLS entirely**, so review these on their own
  regardless of batch size.
- After adding a new npm dependency (supply-chain surface).
- After several smaller commits accumulate without a review in between (a batch of copy/layout
  commits doesn't need one; a batch that touches routing, forms, scripts, migrations, or Edge
  Functions does).

Routine content, copy, and styling-only commits don't need a review.

### What to check (BarnDoors-specific)
A generic web-app pass will miss the things most likely to bite this stack. Confirm each:
- **RLS on every table.** Any new/changed table has RLS *enabled* and its write policy reduces
  to managers only (via `is_manager()`, not client-side checks, not `auth.role()`). No table
  ships with RLS off. See "Roles & permissions."
- **Column-level hiding stays server-side.** Fields hidden from hands (e.g. `profiles.email`,
  `emergency_contact`) are nulled by a `SECURITY DEFINER` RPC like `profiles_hand_visible()` —
  never filtered in app code.
- **Service-role code authorizes its caller.** Any Edge Function using the service-role/Admin
  API verifies the caller is an authenticated manager *before* doing privileged work, and
  returns only what that caller should see.
- **Token-keyed public endpoints leak nothing extra.** The `.ics` feed (and anything like it)
  is keyed to an unguessable per-profile `calendar_feed_token`, scoped to that one profile's
  data, and exposes no other records even though it's unauthenticated.
- **Secrets never reach the frontend.** Only `VITE_SUPABASE_URL` and the anon/publishable key
  are client-side. The service-role key is never imported into `app/`, never prefixed `VITE_`,
  and no secret (including the shared Hand password) is committed.
- **Storage access matches role rules.** `head-photos` and `profile-photos` bucket policies
  follow the manager-write / read rules, and uploads are size/type-limited.

### Full sweep (periodic, not per-commit)
The `security-review` skill only inspects **pending changes on the current branch** (the diff).
It does **not** re-audit code that's already committed and unchanged. So run this full sweep of
the existing RLS policies and Edge Functions periodically and before major milestones:

**RLS — every table, not just the diff:**
1. List every table in the public schema and confirm **RLS is enabled** on each — none with it
   off. Cross-check the Supabase dashboard's **Security Advisor**, which flags tables with RLS
   disabled and `SECURITY DEFINER` views as errors.
2. For each table, confirm the **write policy reduces to managers only** (via `is_manager()`,
   never a client-side check or bare `auth.role() = 'manager'`) and reads require an
   authenticated session.
3. Confirm there are **no per-table exceptions** — if one exists it should have been flagged
   and agreed, not slipped in.
4. Re-check column hiding: `profiles_hand_visible()` is still a `SECURITY DEFINER` function (not
   a plain view) and still nulls `email`/`emergency_contact` for hands, and nothing new started
   filtering hidden fields in app code instead.

**Edge Functions — everything under `supabase/functions/`:**
1. Review every function using the **service-role / Admin key** (currently `create-manager` and
   the `.ics` feed) — these bypass RLS entirely, so they carry their own authorization.
2. Confirm each **verifies the caller is an authenticated manager** before any privileged work
   (creating users, promoting roles, etc.).
3. Confirm the `.ics` feed is scoped to the **single profile its `calendar_feed_token` belongs
   to** and returns nothing else, even though the URL is unauthenticated.
4. Confirm the **service-role key comes from the function's own environment/secrets**, and is
   never returned to the client or logged.

Verify findings against the **live database** (query the actual policies / `security_type`), not
just the migration files — a migration "succeeding" in the CLI doesn't always mean it applied.

## Open items (not yet decided — ask rather than assume)

- Vet/dental/farrier notes structure — planned but not built; likely a separate
  hand-restricted table (e.g. `head_medical_notes`), not columns on `head` or
  `head_records`, to keep the visibility split at the table level.
- Building/structure maintenance tracking — not yet scoped, owner/viewer role undecided.
