-- The signup trigger read raw_user_meta_data->>'name', but the app's sign-up
-- form (and Supabase Studio's own "Display name" column in Authentication >
-- Users) both use the `full_name` key instead — so names typed at sign-up were
-- silently falling back to the user's email everywhere. Align the trigger to
-- the same key.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, name, email, status)
  values (
    new.id,
    'hand',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.email,
    'active'
  );
  return new;
end;
$$;
