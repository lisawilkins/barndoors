# Local fake barn (screenshots only)

Made-up FPO data so Home, Herd, Hands, Wranglers, Chores, and Reports look
full for case-study screenshots and recordings. **This is not a second hosted
demo.** There is no demo login on production and no demo-mode switch on the
live site.

**Never run this against production.** Never dump the live barn into the seed.
`supabase db push` does not load `seed.sql`. Only a local `supabase db reset`
(or the first `supabase start`) does.

## Install Docker

Local Supabase runs in Docker.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or
   another Docker engine).
2. Start it and wait until it says Docker is running.

The Supabase CLI is already the tool this repo uses (`supabase --version`
should work). If it is missing: https://supabase.com/docs/guides/local-development/cli/getting-started

## Boot the fake barn

From the **repo root** (not `app/`):

```bash
supabase start
supabase db reset
```

`db reset` drops the **local** database, reapplies every migration, then runs
`supabase/seed.sql`. Do **not** pass `--linked`. That would target the hosted
project.

Then point the Vite app at local Supabase **without touching** your existing
`app/.env` (that file can keep the live keys):

```bash
cp app/env.local-supabase.example app/.env.development.local
cd app
npm install
npm run dev
```

Vite loads `.env.development.local` in `npm run dev` and it overrides `.env`.
It is gitignored. Production Netlify builds do not use it.

If login fails with "Failed to fetch", run `supabase status` and copy the
printed **API URL** and **anon key** into `app/.env.development.local`.

## Fake logins (local only)

Password for every local account: `fpo-local-only`

| Tab on `/login` | Email | Notes |
|---|---|---|
| Manager | `manager@fpo.local` | Robin Hale — full edit |
| Manager | `admin@fpo.local` | Dana West — same permissions; also appears on the Hand schedule |
| Hand | _(email is built in)_ | Password only. Shared account, same as production’s Hand path |

These passwords are for the local stack. They are not production credentials.

## What the seed fills

Invented names throughout. Wranglers are portrayed as kids; no photos.

- **Home** — same section buttons; data is behind each link
- **Herd** — 12 animals, expandable cards with feed + turnout; open **Buttercup** then **Edit** for a full form
- **Hands** — roster (manager, admin, five named hands), **Shift types**, **Schedule** (recurring, a skip, vacations, one-off events around September 2026)
- **Wranglers** — eight fake kids (some with the informational “no photos” flag), **Time slots**, **Schedule**, profile standing assignments
- **Chores** — AM / PM / Weekend extras lists with nested outline rows
- **Reports** — Feed schedule table and card view

Calendars are seeded around **September 2026**. Jump the monthly view there if “today” on your machine is a different month.

## Do not

- `supabase db reset --linked`
- `psql` this file at the hosted database
- Copy live barn rows into `supabase/seed.sql`
- Deploy a second Netlify site or add a production demo login
- Commit `app/.env` or `app/.env.development.local`
