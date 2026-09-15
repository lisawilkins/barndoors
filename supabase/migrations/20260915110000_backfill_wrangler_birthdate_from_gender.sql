-- One-time backfill: every existing "gender" value turned out to actually be
-- a birthdate (confirmed 2026-09-15, after the Birthday field replaced
-- Gender in the app — see 20260915100000_add_wrangler_birthdate.sql). Copy
-- any gender value that parses as a real date into the new birthdate column,
-- using the same shapes the app's flexible date field accepts (see
-- app/src/lib/formatDate.js: ISO, M/D/Y or M-D-Y numeric, or "Mon D, Y").
-- Only fills rows where birthdate is still empty, so nothing entered by hand
-- since the column was added gets overwritten. The gender column and its
-- original values are left untouched either way — nothing is deleted.
do $$
declare
  r record;
  m text[];
  yr int;
  mo int;
  dy int;
  parsed date;
  month_names text[] := array['january','february','march','april','may','june',
                               'july','august','september','october','november','december'];
  i int;
  converted int := 0;
  skipped int := 0;
begin
  for r in
    select id, first_name, last_initial, gender
    from public.wranglers
    where birthdate is null and gender is not null and trim(gender) <> ''
  loop
    yr := null;
    mo := null;
    dy := null;
    parsed := null;

    -- ISO: 2019-09-10
    m := regexp_match(trim(r.gender), '^(\d{4})-(\d{1,2})-(\d{1,2})$');
    if m is not null then
      yr := m[1]::int; mo := m[2]::int; dy := m[3]::int;
    else
      -- numeric: 9/10/2019, 9-10-19, 9.10.19
      m := regexp_match(trim(r.gender), '^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$');
      if m is not null then
        mo := m[1]::int; dy := m[2]::int; yr := m[3]::int;
        if yr < 100 then
          yr := yr + (case when yr <= 49 then 2000 else 1900 end);
        end if;
      else
        -- month name: Sep 10 2019 / September 10, 2019
        m := regexp_match(trim(r.gender), '^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$');
        if m is not null then
          for i in 1..12 loop
            if month_names[i] = lower(m[1]) or month_names[i] like lower(m[1]) || '%' then
              mo := i;
              exit;
            end if;
          end loop;
          dy := m[2]::int;
          yr := m[3]::int;
          if yr < 100 then
            yr := yr + (case when yr <= 49 then 2000 else 1900 end);
          end if;
        end if;
      end if;
    end if;

    if mo is not null and dy is not null and yr is not null and mo between 1 and 12 and dy between 1 and 31 then
      begin
        parsed := make_date(yr, mo, dy);
      exception when others then
        parsed := null;
      end;
    end if;

    if parsed is not null then
      update public.wranglers set birthdate = parsed where id = r.id;
      converted := converted + 1;
      raise notice 'Wrangler % %: gender "%" -> birthdate %',
        r.first_name, r.last_initial, r.gender, parsed;
    else
      skipped := skipped + 1;
      raise notice 'Wrangler % %: could not parse gender "%" as a date (id=%) — left for manual entry',
        r.first_name, r.last_initial, r.gender, r.id;
    end if;
  end loop;

  raise notice 'Birthdate backfill done: % converted, % left for manual entry.', converted, skipped;
end $$;
