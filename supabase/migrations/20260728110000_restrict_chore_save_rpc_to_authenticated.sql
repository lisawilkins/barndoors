-- Follow-up to 20260728100000_add_chore_lists.sql.
--
-- That migration tried to stop the not-signed-in `anon` role from calling
-- save_chore_section_items with:
--
--     revoke execute on function ... from public;
--
-- Verified against the live database afterwards, that had no effect — anon
-- could still call the function (it returned 204, a successful no-op). The
-- reason: Supabase ships ALTER DEFAULT PRIVILEGES rules that grant EXECUTE on
-- every new function in `public` to anon/authenticated/service_role
-- *explicitly*, per role. Revoking from PUBLIC only drops the blanket grant to
-- everyone; it leaves an explicit per-role grant in place. The role has to be
-- named.
--
-- Worth being clear that this was never an exposure. RLS — the actual check —
-- refused the write the whole time: an anon call with a real payload failed
-- with 42501 "new row violates row-level security policy for table
-- chore_items". This restores the intended second layer, nothing more.

revoke execute on function public.save_chore_section_items(uuid, jsonb) from anon;

-- Belt and braces: keep the PUBLIC revoke too, so the function doesn't become
-- callable by some future role that inherits the blanket grant.
revoke execute on function public.save_chore_section_items(uuid, jsonb) from public;
grant execute on function public.save_chore_section_items(uuid, jsonb) to authenticated;
