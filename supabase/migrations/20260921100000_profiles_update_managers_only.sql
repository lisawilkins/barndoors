-- Close the profiles_update hole: hands must not be able to write their own row.
--
-- The original policy (20260712100000_init_schema.sql) was:
--
--     using (public.is_manager() or id = auth.uid())
--     with check (public.is_manager() or id = auth.uid())
--
-- with a comment claiming hands could update their own row "but not role/status."
-- RLS is row-level, not column-level, so that never hid `role`. After
-- 20260721100000_decouple_hand_profiles_from_auth.sql, every hand shares one
-- login, so a hand session can update `role` on that shared row and become a
-- manager everywhere (every write policy and both photo buckets gate on
-- is_manager(), which reads profiles.role).
--
-- There is no hand self-edit screen. Writes on profiles already go through
-- manager-only forms (HandForm, ManagerForm). create-manager uses the
-- service-role client and bypasses RLS, so this change does not affect it.
-- Do not re-add `or id = auth.uid()`.

drop policy if exists "profiles_update" on public.profiles;

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (public.is_manager())
  with check (public.is_manager());
