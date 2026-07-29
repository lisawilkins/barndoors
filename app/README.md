# BarnDoors — App

React + Vite + Tailwind frontend for BarnDoors (see repo root `AGENTS.md` for full
project context and locked-in tech stack decisions).

## Getting started

```bash
cp .env.example .env   # then fill in the real Supabase URL and anon key
npm install
npm run dev
```

`npm run build` and `npm run lint` should both be clean before opening a PR.

## Current status

Herd, Hands, Chores and Reports are all built, on React Router with Supabase auth
and row-level security. Managers sign in individually; hands share one login.

- **Herd** — expandable cards, drag to reorder, feed plans and turnout groups.
- **Hands** — roster with tappable phone/email; managers can add hands and other
  managers.
- **Chores** — nested, printable lists written in a live outline editor. See
  "Chores UX" in the root `AGENTS.md`.
- **Reports** — print-friendly views; the feed schedule also offers CSV.
