-- Lets a manager flag a wrangler as "no photos" — off by default. Shown as a
-- small icon next to that wrangler's name wherever wranglers are listed
-- (online schedule and printouts). Previously faked by stuffing "NO PHOTOS"
-- into a wrangler's first_name; that workaround should be cleaned up in the
-- data now that a real field exists.
alter table public.wranglers
  add column no_photos boolean not null default false;
