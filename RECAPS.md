# RECAPS.md — BarnDoors Project History

A running log of decisions and actions taken on this project, in plain language.
Newest entries at the top. This is a history, not a spec — for current rules see
`AGENTS.md`, and for current data model see `barndoors-schema.md`.

---

## 2026-07-12 — Clarified Netlify/Supabase deployment details in AGENTS.md

Discussed hosting the frontend on GitHub Pages vs. Netlify; decided to stick with
Netlify + Supabase (no change to the locked-in stack). That discussion surfaced a
few implementation details worth locking in, plus fixed a path bug:

- Fixed `AGENTS.md` references to `barndoors-schema.md` that had regressed to a
  nonexistent `/docs/` path (the file lives at the repo root).
- Auth is Supabase Auth only — explicitly ruled out Netlify Identity to avoid
  confusion between the two platforms' auth products.
- The subscribable `.ics` calendar feed is implemented as a **Supabase Edge
  Function**, not a Netlify Function.
- Netlify needs a standard SPA redirect rule (`_redirects` or `netlify.toml`)
  so client-side routing doesn't 404 on refresh/deep link.

## 2026-07-07 — Initial commit

- Created the repo with a placeholder `README.md`.

## 2026-07-07 — Added AGENTS.md and barndoors-schema.md

Added the two foundational planning docs before any app code was written:

- **AGENTS.md** — instructions for AI coding agents working in this repo. Covers
  the product summary (herd/head records, chores, people, reports), the locked-in
  tech stack (React/Vite/Tailwind PWA, Supabase, Netlify), the manager-write /
  hand-read-only permission model, and scope decisions deliberately left out of v1
  (offline writes, calendar OAuth, PDF/CSV export) so agents don't reintroduce them
  without asking first.
- **barndoors-schema.md** — the source-of-truth data model (tables and fields),
  starting with the People (`profiles`, `shifts`) and Heard/Head sections.

These files capture the settled product and architecture decisions from planning.
Pushed to `origin/main`.
