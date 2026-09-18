# BarnDoors — Consolidated Data Schema (Working Draft)

_Last updated: reflects all decisions through Reports section._

---

## Conventions used throughout

- **Soft delete by default:** most records use a `status` or `active` field instead of being erased. Hard delete is available as a separate, deliberate action (e.g. for true duplicates/mistakes), not the default.
- **Manager-only writes:** every table below is writable only by `role in ('manager', 'admin')`, enforced via row-level security (`auth.role() = 'manager'`) — no per-table exceptions. `admin` is permission-identical to `manager`, just a separate category for technology admin vs. barn manager.
- **Extensible lists:** several lists (feed items, turnout locations, chore types) support a manager-added "New" entry rather than being hardcoded.
- **Field-level visibility (new):** where hands and managers see different fields on the *same* row (not different rows), use a restricted Postgres **function** exposing only allowed columns, rather than filtering in app code. See `profiles_hand_visible()` below.

---

## Part 3 — Managers & Hands

### `profiles`
| Field | Notes |
|---|---|
| id | manager/admin rows: matches their `auth.users.id`. Hand rows: a plain generated id — no login account required, see note below |
| role | `manager` \| `hand` \| `admin` — `admin` has identical permissions to `manager`, it's just a separate category for technology admin vs. barn manager |
| name | |
| photo_url | optional; uploaded via `HandForm.jsx`, stored in the `profile-photos` bucket under a `profiles/` prefix; shown as a 60×60 thumbnail on the Hands list (placeholder icon if unset), tap to open in a lightbox |
| phone | |
| email | visible to everyone (managers and hands) — tappable `mailto:` link on the Hands list |
| emergency_contact | restricted — see visibility note below |
| status | `active` \| `inactive` (soft delete) |
| calendar_feed_token | long random string, generated for every profile; intended to power a subscribable `.ics` feed URL, but that feed is **not built yet** (no Edge Function reads it) — see AGENTS.md "Calendar" |

**Auth model:** managers and admins each have an individual Supabase Auth account (email + password) and sign in individually (same "Manager" button on `/login` — admin isn't a separate login path). Hands do not — everyone signs in as a hand through one shared Supabase Auth account gated by a single universal password (see AGENTS.md "Auth"). Because of this, `profiles.id` is **not** foreign-keyed to `auth.users.id` — a manager/admin row happens to match their real auth id, but a hand's row is just a manager-managed person record (used for shift scheduling, chore assignment, and reports) with no auth account behind it at all.

**Visibility rule:** there is no "own profile" concept anymore, since hand logins are shared. `emergency_contact` is always hidden from the hand-facing view, for every row. `email` is visible to hands too (added so the Hands list can offer a tappable "email this person" link for everyone, not just managers). Managers see everything, for everyone.

**Implementation:** `profiles_hand_visible()` is a `SECURITY DEFINER` Postgres function that exposes all columns except `emergency_contact` (always nulled). Hands query this function; managers query `profiles` directly. Do not attempt this restriction in app code alone — enforce at the database layer.

### ~~`shifts`~~ — dropped

Superseded by **Part 5 — Hand Scheduling** below. The table was dead scaffolding —
`profile_id`/`date`/`period`/`recurrence`/`recurrence_end_date` with zero frontend
references and no `.ics` Edge Function ever built against it — dropped in the same
migration (`20260916100000_add_hand_scheduling.sql`) that added the real Hand scheduling
tables.

**Calendar access today:** hands view their schedule via `/hands/schedule`, an in-app view
only (mirrors `/wranglers/schedule`). A subscribable feed URL (`calendar_feed_token`, still
a column on `profiles`) and one-time `.ics` download are **planned, not built** — see
AGENTS.md "Calendar."

**Parked for later (no schema impact yet):** building/structure maintenance tracking — owner/viewer role not yet decided.

---

## Part 1 — Herd / Head

### `head`
| Field | Notes |
|---|---|
| id | |
| tag_id / name | |
| species | |
| breed | |
| sex | |
| birth_date | or estimated age |
| status | `active` \| `sold` \| `deceased` \| `archived` (soft delete) |
| status_date | |
| acquired_date | |
| feed_notes | free text, animal-specific |
| turnout_notes | free text, animal-specific |
| notes | free text, general animal-specific notes distinct from `feed_notes`/`turnout_notes` (e.g. temperament, farrier schedule) |
| sort_order | integer; manager-controlled display order for the Herd list (drag-and-drop). Defaults to "append at the end" for new animals via `head_sort_order_seq`; backfilled alphabetically for existing rows. The Herd list orders by this instead of `name`. |

**Parked for later:** vet/dental/farrier notes, restricted from hands — likely a separate table (e.g. `head_medical_notes`) rather than columns on an existing table, so the hand/manager visibility split stays table-level (simple RLS) instead of column-level (requires a view).

### `head_custom_fields`
Flexible key-value fields so managers can track new variables (e.g. "hoof condition") without schema changes.
| Field | Notes |
|---|---|
| id | |
| head_id | FK → head |
| field_name | manager-defined |
| field_value | |

### `head_records`
Time-series log per animal (weight, vaccination, vet visit, etc.) — powers filterable/exportable reports.
| Field | Notes |
|---|---|
| id | |
| head_id | FK → head |
| record_type | |
| value | |
| unit | |
| recorded_by | FK → profiles (manager) |
| recorded_at | |

### `head_photos`
| Field | Notes |
|---|---|
| id | |
| head_id | FK → head |
| photo_url | |
| uploaded_by | |
| uploaded_at | online-only upload, no offline queue |

### `feed_items`
Preloaded: Alfalfa, Grass, Grain, SR Pro, SimpliFly, Calf Manna — extensible via "New."
| Field | Notes |
|---|---|
| id | |
| name | |
| dual_unit | true only for Alfalfa & Grass |
| active | |

### `head_feed_plan`
**Standing daily plan**, not a logged event — no completion tracking, no fed_by/fed_at.
| Field | Notes |
|---|---|
| id | |
| head_id | FK → head |
| feed_item_id | FK → feed_items |
| amount_flakes | used when `dual_unit = true` |
| amount_lbs | used when `dual_unit = true` |
| amount | used when `dual_unit = false` |
| unit | `cup` \| `scoop` \| `handful` \| `lbs` (non-dual items only) |
| updated_at | |
| updated_by | |

A head can have multiple feed plan rows (e.g. alfalfa + grain + SimpliFly all at once).

### `turnout_locations`
Preloaded: Back paddock, Small paddock, Side paddock, Large paddock, Alley/Arena — extensible via "New."
| Field | Notes |
|---|---|
| id | |
| name | |
| active | |

### `turnout_groups`
**Standing** groupings, edited only by managers — not reformed daily, no date tracking.
| Field | Notes |
|---|---|
| id | |
| location_id | FK → turnout_locations |
| name | optional, e.g. "Morning geldings" |
| days_of_week | `text[]` of `mon`–`sun`; which days this group goes out |
| updated_at | |
| updated_by | |

### `turnout_group_members`
Many-to-many — a head can belong to multiple groups; a group can have just one head.
| Field | Notes |
|---|---|
| group_id | FK → turnout_groups |
| head_id | FK → head |

*(Actual turning-out of a group is a **chore**, not logged here — see Part 2.)*

### `save_turnout_schedule_for_head(p_head_id uuid, p_rows jsonb, p_updated_by uuid)`
Saves one animal's turnout rows in a single transaction. Looks up a matching group (same location, same days, same exact member set **including this animal**) *before* removing any memberships, then deletes only memberships the new form state drops. Creates a group only when no match exists. If this save was the last member of a group, that empty group is removed.

`p_rows` is a JSON array of `{ "location_id": "<uuid>", "days": ["mon", …], "buddy_ids": ["<uuid>", …] }`. Rows without a location or days are ignored, matching the Herd form.

**`security invoker`** — the managers-only RLS policies on `turnout_groups` and `turnout_group_members` are the authorization. Do not change it to `security definer`.

`execute` is revoked from **both** `public` and `anon` (Supabase's default privileges grant it to `anon` by name, so revoking from `public` alone does nothing) and granted only to `authenticated`. A hand is `authenticated` too; RLS is what makes their call a no-op / failed write that rolls back.

---

## Part 2 — Chores

Chores are **saved, ordered lists** — a written procedure, not a pool of independent tasks.
The barn manager's real list has to be performed in order (horses are moved and fed in a
specific sequence), so ordering and nesting are the whole point of this model.

Structure per the Claude Design project *Barndoors Chores Redesign* — four levels, of which
the middle two may carry a note:

```
chore_lists    level 0  List        title, description   "AM Chores" — one printable sheet
  chore_items  level 1  Item        text, note           "Initial Barn Check" — numbered
               level 2  Subitem     text, note           "Turn on lights…" — the instruction
               level 3  SubSubItem  text only            "Fly mask on" — nesting stops here
```

Levels 1/2/3 are stored as `chore_items.depth` **0/1/2**. Items hang directly off a list via
`chore_items.list_id`; there is no section layer.

### `chore_lists`
| Field | Notes |
|---|---|
| id | |
| name | "Summer", "Grooming" |
| description | optional |
| status | `active` \| `archived` — soft delete |
| sort_order | tab order on the Chores screen |
| created_at / updated_at / updated_by | |

### `chore_items`
| Field | Notes |
|---|---|
| id | |
| list_id | FK → chore_lists, **on delete cascade** — the list this row belongs to |
| section_id | **legacy**, nullable. See "Deprecated" below |
| parent_id | FK → chore_items, **on delete cascade**; null only at depth 0 |
| depth | `0` Item \| `1` Subitem \| `2` SubSubItem (check constraint) |
| body | the line itself |
| note | optional. **Items and Subitems only** — a SubSubItem never has one, enforced in the save function |
| sort_order | document-order position within the list; only ever compared between siblings |

A check constraint (`chore_items_has_one_owner`) requires exactly one of `list_id` /
`section_id`, so a row can't belong to both a list and a section.

### `chore_sections`
**Unused by the app.** Kept so the change that moved items onto lists stayed additive and
reversible; nothing reads or writes it. Removing it is a separate, flagged decision.

**The displayed number is never stored.** Depth-0 items are numbered 1..n from `sort_order` at
render time, so inserting or reordering renumbers automatically and can't drift.

**Recurrence is plain text, not a field.** The manager writes it where it belongs in the
procedure — "Deep clean on Wednesdays", "Mondays take out the trash" — exactly as the real
list reads.

### `save_chore_list_items(p_list_id uuid, p_items jsonb)`
Replaces one list's items in a single transaction. The editor saves as you type and holds the
whole outline in memory; writing row-by-row from the browser would leave a half-applied tree
if one request failed. Also nulls the note on any depth-2 row, so the "SubSubItems carry no
note" rule holds server-side and not just in the UI.

**`security invoker`** — the managers-only RLS policies on `chore_items` are the
authorization. Do not change it to `security definer`.

`execute` is revoked from **both** `public` and `anon` (Supabase's default privileges grant it
to `anon` by name, so revoking from `public` alone does nothing) and granted only to
`authenticated`. That's defence in depth, not the actual check: a hand is `authenticated` too,
and RLS is what makes the call a no-op for them.

`save_chore_section_items(p_section_id, p_items)` is its unused predecessor, kept alongside
the `chore_sections` table.

### Deprecated

~~`chore_types`~~ and ~~`chores`~~ — **superseded by `chore_lists`.** The old model was keyed on
chore type + AM/PM + `assignment_type` + `recurrence`, with no ordering and no nesting, which
doesn't describe how chores are actually done here. The tables still exist in the database but
nothing in the app reads them; dropping them is a separate, flagged migration.

~~`chore_completions`~~ — **dropped.** Hands do not mark chores complete; no completion tracking needed for v1.

---

## Part 4 — Wranglers

Wranglers participate in riding/working sessions. They're purely tracked data — like a
`head` record, they never sign in or use the app at all — so they follow the app's ordinary
visibility rule: hands read, managers/admins write (`apply_standard_policies()`, no special
hand lockout).

### `wranglers`
| Field | Notes |
|---|---|
| id | |
| first_name / last_initial | the only identifying fields collected — no phone, email, or other PII |
| age | |
| gender | deprecated — no longer shown or collected in the app; existing values are kept, not dropped, same precedent as `head.tag_id` |
| birthdate | replaced `gender` in the form/list; stored as `date`, displayed `MM/DD/YYYY`; entry accepts typed dates in several formats (`9/10/2019`, `9-10-19`, `Sep 10 2019`) or a native date picker |
| notes | free text, manager-filled |
| no_photos | boolean, default `false`; when checked, a small icon shows next to this wrangler's name everywhere wranglers are listed (online schedule and printouts) |
| photo_url | optional; uploaded via `WranglerForm.jsx`, stored in the `profile-photos` bucket under a `wranglers/` prefix; shown as a 60×60 thumbnail on the Wranglers list (placeholder icon if unset), tap to open in a lightbox |
| status | `active` \| `archived` (soft delete) |

### `wrangler_time_slots`
Predefined, manager-extensible list (same pattern as `feed_items`/`turnout_locations`).
Day-specific — "Mon 5:30–6:30 PM" and "Tue 5:30–6:30 PM" are separate rows, even with the same
`name` — since a slot's own day is what makes assigning a wrangler to it a *recurring weekly*
assignment. Managed on its own page (`/wranglers/time-slots`), not inline on a wrangler's
profile. `start_time`/`end_time` are entered via structured time pickers (not free text) on
that page; `name` is a generated display string ("5:30 – 6:30 PM") derived from them on every
save, and `sort_order` is always set to `start_time`'s minutes-since-midnight at the same time
— so the display text and the sort order can never drift apart the way they once did (a past
bug had one day's two slots backwards because `sort_order` was a separately hand-maintained
integer, set once at creation and never resynced on rename).
| Field | Notes |
|---|---|
| id | |
| name | generated, e.g. "5:30 – 6:30 PM" — not directly editable |
| day_of_week | `mon`–`sun` |
| start_time | `time`, nullable (null only on old archived rows predating this column) |
| end_time | `time`, nullable; `check (start_time is null or end_time is null or end_time > start_time)` |
| sort_order | always `start_time`'s minutes-since-midnight, recomputed on every insert/update |
| active | `unique (day_of_week, name) where active` — archived slots keep their name without blocking a new active slot from reusing it |

### `wrangler_recurring_assignments`
The standing weekly pattern (e.g. "Bella rides with David every Monday"). Built directly on a
wrangler's own profile (`WranglerForm.jsx`): pick a day, pick a time slot for that day, pick
Ride or Work, and a horse if riding. Since `time_slot_id` already carries a day (via
`wrangler_time_slots.day_of_week`), the assignment itself needs no separate days-of-week or
date range — one row per (wrangler, time slot) is the whole standing pattern.
| Field | Notes |
|---|---|
| id | |
| wrangler_id | FK → wranglers |
| time_slot_id | FK → wrangler_time_slots — its `day_of_week` is this assignment's day |
| activity | `riding` \| `working` |
| horse_id | FK → head, nullable — only set when `activity = 'riding'` (check constraint) |
| updated_at / updated_by | `unique (wrangler_id, time_slot_id)` — one standing assignment per slot |

### `wrangler_recurring_skips`
Cancels one occurrence of a recurring pattern (e.g. "Bella won't be there on the 23rd")
without touching the standing pattern.
| Field | Notes |
|---|---|
| id | |
| recurring_assignment_id | FK → wrangler_recurring_assignments, on delete cascade |
| date | the skipped occurrence; `unique (recurring_assignment_id, date)` |

### `wrangler_assignments`
One-off, non-recurring assignments, added from the calendar (`WranglerSchedule.jsx`), not the
profile (e.g. "Caden is filling in the first slot next Friday"). Also how a one-time change to
a recurring slot is represented: pair a skip on the recurring row with one of these. The
calendar's picker only offers time slots whose `day_of_week` matches the chosen date.
| Field | Notes |
|---|---|
| id | |
| wrangler_id | FK → wranglers |
| date | |
| time_slot_id | FK → wrangler_time_slots |
| activity | `riding` \| `working` |
| horse_id | FK → head, nullable — riding only (check constraint) |
| updated_at / updated_by | `unique (wrangler_id, date, time_slot_id)` — no double-booking |

### `wrangler_calendar_notes`
Standing notes not tied to any specific wrangler — one per calendar day, or one per whole
month (e.g. "Smoky can't be ridden this month"). One table, mutually-exclusive scope columns,
same pattern as `chore_items_has_one_owner`'s `list_id`/`section_id` split.
| Field | Notes |
|---|---|
| id | |
| note_date | set for a day note; null for a month note |
| note_month | set (first-of-month, e.g. `2026-09-01`) for a month note; null for a day note. Check constraint requires exactly one of `note_date`/`note_month` |
| body | |
| updated_at / updated_by | |

**Resolving a day's effective assignments** (client-side, in `WranglerSchedule.jsx`): for a
given date, take every `wrangler_recurring_assignments` row whose time slot's `day_of_week`
matches that weekday, minus any with a matching `wrangler_recurring_skips` row for that date,
union any `wrangler_assignments` rows for that exact date.

---

## Part 5 — Hand Scheduling

Hands are `profiles` rows with `role = 'hand'` — there is no separate `hands` table (unlike
Wranglers, which have their own `wranglers` table). **`role = 'admin'` profiles are
schedulable the same way** (an admin can also be a working staff member); `role = 'manager'`
profiles are not. This is purely a scheduling-eligibility rule, gated by the single
`isSchedulable()` helper in `app/src/lib/handSchedule.js` — it has no bearing on
read/write permissions, where admin and manager stay identical (see Part 3). Every table
below FKs to `profiles(id)` the same way Wrangler scheduling tables FK to `wranglers(id)`,
and follows the same visibility rule as every other roster/schedule table
(`apply_standard_policies()` — hands read, managers/admins write). `profiles` itself keeps
its own bespoke, field-hiding RLS (see Part 3) — these new tables don't touch that.

### `hand_shift_types`
Predefined, manager-extensible list, same shape and same day-specific reasoning as
`wrangler_time_slots`: "Sun AM" and "Mon AM" are different rows even though both might be
named "AM", since a shift type's own day is what makes assigning a hand to it a *recurring
weekly* shift. Managed on its own page (`/hands/shift-types`), not inline on a hand's
profile.
| Field | Notes |
|---|---|
| id | |
| name | e.g. "AM", "PM", or a free-text slot like a Wrangler time (managers can add more beyond the defaults) |
| day_of_week | `mon`–`sun` |
| sort_order | AM = 0, PM = 1 for each default day, so AM always lists before PM |
| active | `unique (day_of_week, name) where active` — archived types keep their name without blocking a new active one from reusing it |

**Default rows:** 14 rows (AM + PM × every day, Sun–Sat) ship as `insert` statements inside
the same migration that creates the table — not `supabase/seed.sql`, since `seed.sql` only
loads on a local `supabase db reset`, never on the `supabase db push` this project actually
uses to deploy to the linked remote project.

### `hand_recurring_shifts`
The standing weekly (or every-other-week) pattern (e.g. "Anne works every Monday AM").
Built directly on a hand's own profile (`HandForm.jsx`): pick a day, pick a shift type for
that day. Since `shift_type_id` already carries a day (via `hand_shift_types.day_of_week`),
the shift itself needs no separate day column — one row per (hand, shift type) is the whole
standing pattern.
| Field | Notes |
|---|---|
| id | |
| profile_id | FK → profiles, on delete cascade |
| shift_type_id | FK → hand_shift_types, on delete restrict — its `day_of_week` is this shift's day |
| biweekly | boolean, default `false` — when true, the shift occurs every other calendar week instead of every week |
| biweekly_start_date | nullable date; required when `biweekly` is true (check constraint). The "Beginning on" date a manager picks — anchors which calendar week (Sun–Sat) is the first "on" week; nothing occurs before it |
| updated_at / updated_by | `unique (profile_id, shift_type_id)` — one standing shift per type per hand |

**Biweekly cadence** is computed client-side, not stored per-occurrence: `occursOnCadence()`
(`app/src/lib/handSchedule.js`) buckets a target date into its calendar week and compares
that bucket to `biweekly_start_date`'s calendar week — an even number of weeks apart means
it's an "on" week. This is deliberately based on calendar weeks rather than raw day
differences, so a "Beginning on" date that doesn't fall on the shift's own weekday still
produces a sensible alternating pattern instead of a broken one.

### `hand_recurring_shift_skips`
Cancels one occurrence of a recurring shift (e.g. "Anne called in sick on the 23rd") without
touching the standing pattern — not a vacation.
| Field | Notes |
|---|---|
| id | |
| recurring_shift_id | FK → hand_recurring_shifts, on delete cascade |
| date | the skipped occurrence; `unique (recurring_shift_id, date)` |

### `hand_shift_events` + `hand_shift_event_members`
One-off, non-recurring shifts, added from the calendar (`HandSchedule.jsx`), not the
profile. Unlike a Wrangler one-off (`wrangler_assignments`, which still picks an existing
day-scoped time slot), a Hand one-off is a **freestanding event** — its own title, date,
free-text time, and notes — with **more than one hand** assignable to the same event (e.g.
"Gymkhana · Sept 29 · 8am · Groom for event. Meet at SA or event venue · Anne, Lisa,
Sharon"). `hand_shift_event_members` is a plain join table, no independent identity of its
own.
| Field (`hand_shift_events`) | Notes |
|---|---|
| id | |
| title | e.g. "Gymkhana" |
| event_date | |
| event_time | free text, e.g. "8am" |
| notes | e.g. "Groom for event. Meet at SA or event venue." |
| updated_at / updated_by | |

| Field (`hand_shift_event_members`) | Notes |
|---|---|
| event_id | FK → hand_shift_events, on delete cascade |
| profile_id | FK → profiles, on delete cascade |
| | `primary key (event_id, profile_id)` — no separate id |

### `hand_vacations`
A hand can have **multiple separate vacation ranges on file at once**, so this is its own
table, not two columns on `profiles`.
| Field | Notes |
|---|---|
| id | |
| profile_id | FK → profiles, on delete cascade |
| start_date | |
| end_date | check `end_date >= start_date` |
| updated_at / updated_by | |

**Vacation is a visual-only overlay, never a data-removal.** When a hand is on vacation, the
schedule UI (`HandSchedule.jsx`) dims their entry and adds a 🌴 on any day within a vacation
range — but a recurring or one-off shift on that day is still shown, not hidden or deleted.
Skipping or removing a specific shift is always a separate, explicit action (see
`hand_recurring_shift_skips` above, and the one-off remove flow), never an automatic side
effect of a vacation range.

**Resolving a day's effective shifts** (client-side, in `HandSchedule.jsx`, same approach as
`WranglerSchedule.jsx`): for a given date, take every `hand_recurring_shifts` row whose
shift type's `day_of_week` matches that weekday, minus any with a matching
`hand_recurring_shift_skips` row for that date, union every `hand_shift_event_members` row
(expanded from `hand_shift_events`) for that exact date — then, independently, overlay
vacation dimming per hand per day from `hand_vacations`, regardless of which of the two
sources a given entry came from.

There is no Hand equivalent of `wrangler_calendar_notes` (standing day/month notes) — out of
scope for this feature.

---

## Reports

No new tables — reports are filtered, fixed-layout, **print-friendly browser views** (styled for `@media print`, no PDF generation for v1) built on top of existing data. Some reports also offer a plain CSV download of the same data (client-side generated, no new dependency) as a second, non-print output — e.g. the feed schedule report.

| Report | Source tables | Filters |
|---|---|---|
| Feed chart | `head_feed_plan` × `head` × `feed_items` | e.g. species, feed item |
| Turnout chart | `turnout_groups` × `turnout_group_members` × `turnout_locations` × `head` | e.g. location |
| Monthly shifts view *(not yet built — backlog)* | would be `hand_recurring_shifts` × `hand_recurring_shift_skips` × `hand_shift_events`/`hand_shift_event_members` (all hands) | month |
| Individual shift view *(not yet built — backlog)* | same tables, filtered | profile_id |
| Chore sheet | `chore_lists` × `chore_items` | *(printed from the list itself, not from /reports)* |

Fixed columns per report, not a custom column-picker — deferred to a later iteration once real usage shows which variables matter most.

---

## Open questions / unresolved items

1. Vet/dental/farrier notes structure — not yet built, likely `head_medical_notes` (hand-restricted).
2. Building/structure maintenance — not yet scoped, owner/viewer role undecided.
3. Any additional Part 3 profile fields beyond current set — none identified, revisit if needed.
