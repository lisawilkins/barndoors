# BarnDoors — Consolidated Data Schema (Working Draft)

_Last updated: reflects all decisions through Reports section._

---

## Conventions used throughout

- **Soft delete by default:** most records use a `status` or `active` field instead of being erased. Hard delete is available as a separate, deliberate action (e.g. for true duplicates/mistakes), not the default.
- **Manager-only writes:** every table below is writable only by `role = manager`, enforced via row-level security (`auth.role() = 'manager'`) — no per-table exceptions.
- **Extensible lists:** several lists (feed items, turnout locations, chore types) support a manager-added "New" entry rather than being hardcoded.
- **Field-level visibility (new):** where hands and managers see different fields on the *same* row (not different rows), use a restricted Postgres **view** exposing only allowed columns, rather than filtering in app code. See `profiles_hand_visible` below.

---

## Part 3 — Managers & Hands

### `profiles`
| Field | Notes |
|---|---|
| id | |
| role | `manager` \| `hand` |
| name | |
| photo_url | |
| phone | |
| email | restricted — see visibility note below |
| emergency_contact | restricted — see visibility note below |
| status | `active` \| `inactive` (soft delete) |
| calendar_feed_token | long random string, powers the subscribable `.ics` feed URL; regeneratable if compromised |

**Visibility rule:** hands can see their **own** full profile (including their own email and emergency contact). For *other* hands, `email` and `emergency_contact` are hidden. Managers see everything, for everyone.

**Implementation:** create a view `profiles_hand_visible` that exposes all columns except `email` and `emergency_contact` for rows that aren't the requesting user's own. Hands query this view; managers query `profiles` directly. Do not attempt this restriction in app code alone — enforce at the database layer.

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

## Part 1 — Heard / Head

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

### `chore_types`
Preloaded: Feed, Muck stalls, Clean waters, Clean troughs, Clean out old hay, Fly spray, Blow/Sweep Barn, Misters On/Off, Replace fly traps, Replace fly spray, Trash, Shavings, Turnout — extensible via "New."
| Field | Notes |
|---|---|
| id | |
| name | |
| instructions | optional "read more" text, fixed per type (e.g. filled in for Shavings, blank for Muck Stalls) |
| active | |

### `chores`
| Field | Notes |
|---|---|
| id | |
| chore_type_id | FK → chore_types |
| period | `AM` \| `PM` |
| assignment_type | `open` \| `assigned-once` \| `assigned-recurring` |
| assigned_to | FK → profiles, nullable if open |
| recurrence | `none` \| `daily` \| `weekly` \| `semi-monthly` \| `monthly` \| `quarterly` |
| recurrence_details | day-of-week / day-of-month as needed per recurrence type |
| created_by | |
| status | `active` \| `archived` |

*Semi-monthly = roughly every 2 weeks / twice a month.*

~~`chore_completions`~~ — **dropped.** Hands do not mark chores complete; no completion tracking needed for v1.

---

## Reports

No new tables — reports are filtered, fixed-layout, **print-friendly browser views** (styled for `@media print`, no PDF/CSV generation for v1) built on top of existing data:

| Report | Source tables | Filters |
|---|---|---|
| Feed chart | `head_feed_plan` × `head` × `feed_items` | e.g. species, feed item |
| Turnout chart | `turnout_groups` × `turnout_group_members` × `turnout_locations` × `head` | e.g. location |
| Monthly shifts view | `shifts` (all profiles) | month |
| Individual shift view | `shifts` | profile_id |
| Assigned chores view | `chores` | date, assigned_to |

Fixed columns per report, not a custom column-picker — deferred to a later iteration once real usage shows which variables matter most.

---

## Open questions / unresolved items

1. Vet/dental/farrier notes structure — not yet built, likely `head_medical_notes` (hand-restricted).
2. Building/structure maintenance — not yet scoped, owner/viewer role undecided.
3. Any additional Part 3 profile fields beyond current set — none identified, revisit if needed.
