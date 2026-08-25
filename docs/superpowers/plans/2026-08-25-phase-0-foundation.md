# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A deployed Next.js app with a branded marketing landing page, working Supabase auth, the database schema, an authenticated app shell, and a proven Claude API call.

**Architecture:** Single Next.js (App Router) codebase holds both the public marketing site and the authenticated product app. Supabase provides auth + Postgres + storage. Claude is called only from server routes (key never reaches the browser). Deployed on Vercel.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Tailwind CSS, Supabase (`@supabase/ssr`), Anthropic SDK (`@anthropic-ai/sdk`).

## Global Constraints

- Product working name: **AdBrain**. Never use deepsolv's name, logo, or copy.
- No em dashes in user-facing copy.
- Claude API key and Supabase service key are server-only; never imported into a client component.
- Managed/low-ops only: no self-hosted infra.
- Every non-trivial function leaves one runnable check behind.

---

### Task 1: Scaffold Next.js app
**Files:** whole project (package.json, tsconfig, app/, tailwind).
- [ ] Scaffold Next.js (TS, App Router, Tailwind, ESLint) into the existing repo (preserving `docs/` and `.git`).
- [ ] `npm run build` succeeds.
- [ ] Commit.

### Task 2: Environment + config
**Files:** Create `.env.local.example`, `.env.local`, `.gitignore` (ensure `.env.local` ignored).
- [ ] Define env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.
- [ ] `.env.local.example` documents each; real `.env.local` holds placeholders until the user fills keys.
- [ ] Commit.

### Task 3: Database schema (SQL migration)
**Files:** Create `supabase/migrations/0001_init.sql`.
- [ ] Tables from spec §3.3: `brands`, `competitors`, `competitor_ads`, `triples`, `test_plans`, `test_plan_items`.
- [ ] RLS policies scoping every table to `auth.uid()` via `user_id`/`brand_id`.
- [ ] Commit. (User runs this SQL in the Supabase dashboard during setup.)

### Task 4: Supabase client helpers
**Files:** Create `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server), `middleware.ts` (session refresh + route protection).
- [ ] Browser + server clients via `@supabase/ssr`.
- [ ] Middleware redirects unauthenticated users away from `/app/*` to `/login`.
- [ ] Commit.

### Task 5: Marketing landing page
**Files:** Create `app/page.tsx`, `app/layout.tsx`, marketing components under `components/marketing/`.
- [ ] Sections (original copy, AdBrain brand): hero, problem, features overview (Signals/Scan/Deconstruct/Plan/Brain), comparison table (AdBrain vs Reporting vs AI Generators), CTA, footer.
- [ ] Responsive, theme-consistent, no em dashes.
- [ ] `npm run build` succeeds. Commit.

### Task 6: Auth pages
**Files:** Create `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/auth/callback/route.ts`, server actions in `app/(auth)/actions.ts`.
- [ ] Email/password sign up + login + magic link; sign-out action.
- [ ] Redirect to `/app` on success.
- [ ] Commit.

### Task 7: App shell + dashboard
**Files:** Create `app/app/layout.tsx` (nav + sign-out), `app/app/page.tsx` (empty dashboard).
- [ ] Protected by middleware; shows logged-in user email; empty-state dashboard.
- [ ] Commit.

### Task 8: Claude health-check route
**Files:** Create `lib/anthropic.ts`, `app/api/health/claude/route.ts`, `scripts/check-claude.mjs`.
- [ ] Server route calls Claude with a trivial prompt, returns `{ ok, model, reply }`.
- [ ] `scripts/check-claude.mjs` is the one runnable check (asserts a non-empty reply when a key is present; skips cleanly if no key).
- [ ] Commit.

### Task 9: Setup checklist for the user
**Files:** Create `SETUP.md`.
- [ ] Exact click-by-click steps for the 3 things only the user can do: create Supabase project + run migration, get Anthropic key, deploy to Vercel.
- [ ] Commit.

---

## Success criteria (from spec §5)
- Visitor can read the landing page, sign up, log in, reach the (empty) dashboard.
- A server route successfully calls Claude and returns a reply.

## What only the user can do (cannot be automated safely)
- Create the Supabase project and paste its keys (their account/credentials).
- Obtain the Anthropic API key (their account/billing).
- Deploy to Vercel (their account login).
These are documented in `SETUP.md`; everything else is built and runs locally.
