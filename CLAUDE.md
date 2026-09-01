@AGENTS.md

# AdBrain — project brief

Creative decision intelligence SaaS (inspired by deepsolv.ai, built under our own
brand). Non-technical owner; Claude writes and runs the code.

## Rule #1 — the Build Loop (HARD RULE, above every other rule)

This applies to the WHOLE app, always: every feature, every fix, every future build. Whenever
Rahul shares feedback, an observation, a bug, or an optimisation, anywhere in the app, run this
exact loop in order and show the work. Never shortcut a step. This is how everything in this app
gets built, now and going forward.

1. Observe the real problem. State the actual symptom in his words, not a proxy for it.
2. Challenge the assumption. Ask what is being taken for granted, including the request itself.
3. Trace the root cause. Fix the one shared cause, not the symptom on a single path.
4. Verify against source data. Confirm the real numbers and behaviour before deciding. No guessing.
5. Build deterministic logic. Pure, explainable rules, not vibes or an AI opinion. Missing data stays unknown, never fabricated.
6. Explain the decision. Inputs, formula, and why, so a non-technical reader can follow it.
7. Test edge cases. Unknowns, extremes, combinations, zero-results. Leave one runnable check behind.
8. Live-test. Prove it in the actual running app on the real account, not just a green build.
9. Record the learning. Append it to the ledger / MEMORY so it is never re-learned.
10. Use it to improve the next decision. Feed the learning back into the engine and the next build.

Then close the reply with the plain-English decision listicle and the honest green/orange/red
status table. The older rules (verify to 100%, be your own devil's advocate and fix what you find,
live-test before claiming done) are steps inside this loop, not separate options.

- Design spec: `docs/superpowers/specs/2026-08-25-adbrain-mvp-design.md`
- Phase 0 plan: `docs/superpowers/plans/2026-08-25-phase-0-foundation.md`
- Setup steps for the owner: `SETUP.md`
- Settled decisions (do not re-litigate): `docs/DECISIONS.md`
- Decision rights / when to just-do-it vs ask: `docs/GOVERNANCE.md`
- Design system + principles: `DESIGN.md`; ADRs: `docs/adr/`

Stack: Next.js 16 (App Router, Turbopack) + Tailwind v4 + Supabase (auth/DB) +
Anthropic SDK. Note Next 16 renamed `middleware` to `proxy.ts` and `cookies()` is async.

Rules: no em dashes in user-facing copy; keys are server-only; smallest working diff;
`npm run build` must stay green before committing.

Roadmap: Phase 0 (foundation, DONE) -> Phase 1 (competitor scan -> AI test plan) ->
Phase 2 (connect real Meta/Google account) -> Phase 3 (creative studio). The Brand
Brain is a knowledge graph of subject-predicate-object triples in the `triples` table.
