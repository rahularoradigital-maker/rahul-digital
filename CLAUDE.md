@AGENTS.md

# AdBrain — project brief

Creative decision intelligence SaaS (inspired by deepsolv.ai, built under our own
brand). Non-technical owner; Claude writes and runs the code.

- Design spec: `docs/superpowers/specs/2026-08-25-adbrain-mvp-design.md`
- Phase 0 plan: `docs/superpowers/plans/2026-08-25-phase-0-foundation.md`
- Setup steps for the owner: `SETUP.md`

Stack: Next.js 16 (App Router, Turbopack) + Tailwind v4 + Supabase (auth/DB) +
Anthropic SDK. Note Next 16 renamed `middleware` to `proxy.ts` and `cookies()` is async.

Rules: no em dashes in user-facing copy; keys are server-only; smallest working diff;
`npm run build` must stay green before committing.

Roadmap: Phase 0 (foundation, DONE) -> Phase 1 (competitor scan -> AI test plan) ->
Phase 2 (connect real Meta/Google account) -> Phase 3 (creative studio). The Brand
Brain is a knowledge graph of subject-predicate-object triples in the `triples` table.
