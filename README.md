# BarnDoors

Barn and ranch management: herd, chores, hands, wranglers, and print-friendly
reports. Hands use it one-handed outdoors — large tap targets, little typing.

Production: https://barn-doors.netlify.app

## Local fake barn (screenshots)

Made-up seed data for case-study shots. **Not a hosted demo.** Never run it
against production.

Full steps: [docs/local-demo.md](docs/local-demo.md)

```bash
# Docker Desktop must be running
supabase start
supabase db reset          # local only — never --linked
cp app/env.local-supabase.example app/.env.development.local
cd app && npm install && npm run dev
```

Local logins (password `fpo-local-only`): Manager tab `manager@fpo.local`;
Hand tab, same password.

## Everyday app development against the live project

```bash
cp app/.env.example app/.env   # then paste the real project URL and anon key
cd app && npm install && npm run dev
```

Keep `app/.env` gitignored. Production keys live in Netlify, not in the repo.
