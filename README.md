# AdBrain

Creative decision intelligence for Meta/Google growth teams: know what to test
next, before you spend on it. Competitor ads in, a ranked weekly test plan out,
powered by a Brand Brain knowledge graph.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. The marketing site works immediately. To enable
sign-in, the database, and the AI, follow **[SETUP.md](SETUP.md)**.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build (keep this green before committing)
- `npm run check:claude` — verify the Claude API key works

## Where things live

- `app/` — pages (marketing, auth, `/app` product area) and API routes
- `components/` — shared UI
- `lib/` — Supabase and Anthropic clients
- `proxy.ts` — session refresh + `/app` route protection (Next 16 middleware)
- `supabase/migrations/` — database schema
- `docs/superpowers/` — the design spec and implementation plans

Status: **Phase 0 complete** (foundation). See CLAUDE.md for the roadmap.
