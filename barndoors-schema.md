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
| photo_url | |
| phone | |
| email | visible to everyone (managers and hands) — tappable `mailto:` link on the Hands list |
| emergency_contact | restricted — see visibility note below |
| status | `active` \| `inactive` (soft delete) |
| calendar_feed_token | long random string, powers the subscribable `.ics` feed URL; regeneratable if compromised |

**Auth model:** managers and admins each have an individual Supabase Auth account (email + password) and sign in individually (same "Manager" button on `/login` — admin isn't a separate login path). Hands do not — everyone signs in as a hand through one shared Supabase Auth account gated by a single universal password (see AGENTS.md "Auth"). Because of this, `profiles.id` is **not** foreign-keyed to `auth.users.id` — a manager/admin row happens to match their real auth id, but a hand's row is just a manager-managed person record (used for shift scheduling, chore assignment, and reports) with no auth account behind it at all.

**Visibility rule:** there is no "own profile" concept anymore, since hand logins are shared. `emergency_contact` is always hidden from the hand-facing view, for every row. `email` is visible to hands too (added so the Hands list can offer a tappable "email this person" link for everyone, not just managers). Managers see everything, for everyone.

**Implementation:** `profiles_hand_visible()` is a `SECURITY DEFINER` Postgres function that exposes all columns except `emergency_contact` (always nulled). Hands query this function; managers query `profiles` directly. Do not attempt this restriction in app code alone — enforce at the database layer.

### `shifts`
| Field | Notes |
|---|---|
| id | |
| profile_id | FK → profiles |
| date | |
| period | `AM` \| `PM` (no specific hours — just early/late designation) |
| recurrence | `none` \| `daily` \| `weekly` \| `monthly` |
| recurrence_end_date | nullable |

**Calendar access:** hands view schedule via an in-app calendar tab, can subscribe to their personal feed URL (via `calendar_feed_token`), and/or download a one-time `.ics` file. No OAuth / Google or Apple Calendar API integration required.

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

## Reports

No new tables — reports are filtered, fixed-layout, **print-friendly browser views** (styled for `@media print`, no PDF generation for v1) built on top of existing data. Some reports also offer a plain CSV download of the same data (client-side generated, no new dependency) as a second, non-print output — e.g. the feed schedule report.

| Report | Source tables | Filters |
|---|---|---|
| Feed chart | `head_feed_plan` × `head` × `feed_items` | e.g. species, feed item |
| Turnout chart | `turnout_groups` × `turnout_group_members` × `turnout_locations` × `head` | e.g. location |
| Monthly shifts view | `shifts` (all profiles) | month |
| Individual shift view | `shifts` | profile_id |
| Chore sheet | `chore_lists` × `chore_items` | *(printed from the list itself, not from /reports)* |

Fixed columns per report, not a custom column-picker — deferred to a later iteration once real usage shows which variables matter most.

---

## Open questions / unresolved items

1. Vet/dental/farrier notes structure — not yet built, likely `head_medical_notes` (hand-restricted).
2. Building/structure maintenance — not yet scoped, owner/viewer role undecided.
3. Any additional Part 3 profile fields beyond current set — none identified, revisit if needed.
