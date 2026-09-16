-- Optional photo for wranglers, same shape as profiles.photo_url (a plain
-- column, not a separate table like head_photos — a person only ever has
-- one current photo, no history needed). Stored in the existing
-- profile-photos bucket under a wranglers/ prefix so it can share that
-- bucket's already-correct manager-write / public-read policies without any
-- policy changes.
alter table public.wranglers
  add column photo_url text;
