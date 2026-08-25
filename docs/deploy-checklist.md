# Deploy Checklist: AdBrain Phase 0 (marketing site + auth) → Vercel

**Date:** 2026-08-25 | **Deployer:** Rahul
**Scope:** This is the FIRST deploy. Only Phase 0 exists (landing, auth, dashboard shell,
Claude health check). The Phase 1 cockpit is NOT built and NOT covered here.

> Reality notes: no CI, no staging, no monitoring, and no git remote are set up yet. No
> source-control / CI / monitoring connectors are available, so every check below is manual.

## Pre-Deploy

- [x] `node`/build gate green: `npm run build` (verified 2026-08-25)
- [x] Secrets not committed: `.env.local` is git-ignored (verified)
- [x] Working tree clean, changes committed (verified)
- [ ] **Owner setup done** (blocks everything — see `SETUP.md`):
  - [ ] Supabase project created; URL + anon + service-role keys in hand
  - [ ] Migration run in Supabase SQL editor (`supabase/migrations/0001_init.sql`) → "Success"
  - [ ] `ANTHROPIC_API_KEY` obtained; `npm run check:claude` prints `PASS`
        (note: Phase 1 will swap Claude for Gemini; for THIS deploy the app uses Claude)
- [ ] Decide auth email confirmation: ON for real launch, OFF only for early testing
- [ ] Rollback plan: Vercel keeps every deployment; rollback = promote the previous one (1 click)

## Deploy

- [ ] Create a git remote and push (no remote exists yet):
      private GitHub repo → `git remote add origin …` → `git push -u origin main`
      (or deploy via `vercel` CLI without GitHub)
- [ ] Import the repo in Vercel (Add New → Project)
- [ ] Set all 4 environment variables in Vercel (Settings → Environment Variables),
      same values as `.env.local`:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
- [ ] Deploy. Confirm the build succeeds in Vercel (same `next build` that is green locally)
- [ ] In Supabase → Authentication → URL Configuration, set Site URL + redirect to the
      Vercel URL (so magic-link / confirm emails point to production, not localhost)

## Post-Deploy smoke test (do these on the live URL)

- [ ] `/` loads, hero + sections render, no console errors
- [ ] `/login` and `/signup` return 200
- [ ] Sign up a test account → land on `/app` (empty dashboard) → email shows in header
- [ ] `/app` while logged out redirects to `/login` (auth gate works)
- [ ] Sign out returns to `/`
- [ ] `GET /api/health/claude` returns `{ ok: true, reply: "pong" }`
- [ ] Delete the test account in Supabase afterward

## Rollback triggers

- Landing page or `/login` returns 5xx after deploy
- Signup/login fails against production Supabase (usually a wrong/missing env var or Site URL)
- `/api/health/claude` returns `ok: false` (bad/missing key)
- Action: promote the previous Vercel deployment (instant), then fix env/config and redeploy

## Not in this checklist (needs its own before Phase 1 deploy)

The Phase 1 cockpit adds high-stakes surfaces that this checklist does NOT cover. Before
deploying Phase 1, write a new checklist that verifies:
- OAuth tokens encrypted at rest, server-only, never in `NEXT_PUBLIC_*`
- Meta/Google OAuth redirect URIs registered for the production domain
- Meta app review / dev-access status confirmed for the intended users
- Write-back to live ad accounts is OFF or manual-apply only (no auto-apply)
- Incremental-sync + rate-limit handling verified against real API quotas
