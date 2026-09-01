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

## Rule #2 — the Decision Chain (how every AdBrain insight must reason)

Rule #1 is how Claude BUILDS. Rule #2 is how the PRODUCT REASONS. Every insight, recommendation,
or answer the app gives a user must walk this full chain, never stop at a raw number. This is the
brain of the product (Rahul's 2nd- and 3rd-order thinking). Each stage maps to real code, not vibes.

1. Data. The raw numbers from the real source (Meta store, live account, reels). Attributed, never fabricated.
2. Trust. Decide if the data can be trusted BEFORE using it: the evidence envelope (VERIFIED / PROVIDER / CALCULATED / INFERENCE / UNKNOWN), confidence, freshness. If it can't be trusted, refuse or say unknown; never guess.
3. Signal. Extract the real signal from the noise deterministically (what actually changed or stands out), not a coincidence.
4. Diagnosis. Find the cause, not the symptom (funnel weakest-step `lib/funnel/diagnosis.ts`, culprit `lib/scoring/culprit.ts`). Root cause, corroborated.
5. Economic impact. Quantify it in money / revenue, not a vanity metric. What does it cost or earn?
6. Second-order effect. What this change causes next (the knock-on the obvious read misses).
7. Third-order effect. What that in turn causes downstream; audit it for 5-year fitness.
8. Decision. The call the math supports. The math decides; AI only explains it.
9. Action. The concrete, reversible next step. Anything touching the outside world is a DRAFT, never auto-sent.
10. Outcome. Observe what actually happened after the action, from live data.
11. Learning. Record the outcome and feed it back so the next decision is better.

Both rules end in learning that improves the next pass. When the app cannot complete the chain
honestly (untrusted data, unknown impact), it says so and stops, rather than inventing the rest.

## The Master Intelligence Charter (binding)

`docs/intelligence/MASTER-CHARTER.md` is the permanent charter for how AdBrain must reason, discover
and validate logic, and be audited before it grows (build the most TRUSTWORTHY decision system, not the
smartest-looking one). It is audit-first and plan-first: no feature coding until the Phase 0 discovery
deliverables in `docs/intelligence/PHASE-0-AUDIT-PLAN.md` are produced. Rules #1 and #2 above are how
that charter is executed day to day.

The Product Completion Loop (Rahul, 2026-09-01) governs the 20 SaaS systems (onboarding, auth, email
verify, password reset, account deletion, permissions, empty/loading/error/network states, persistence,
payment, notifications, analytics, crash reporting, privacy, a11y, responsiveness, e2e, beta): classify
before coding, keep green systems, fix the highest-value gap, attack it, live-verify, regress, re-audit,
repeat. Living state: `docs/intelligence/PRODUCT-COMPLETION-MATRIX.md`. Continue autonomously on the
obvious safe next gap; ASK only for gated items (payment model, destructive data ops like account
deletion, legal/privacy, major architecture, or a new external service needing keys).

## Concurrent sessions — NEVER clobber (multiple chats share this repo)

4-5 Claude chats work this repo + the `validation-v0-v1` branch at once on ONE shared tree. The BINDING,
canonical protocol is **`.claude/MULTI-CHAT-PROTOCOL.md`** — read it before committing. The two rules that
prevent most damage: (1) NEVER `git add -A`/`-u` or `commit -a`; instead `git reset -q` then stage only your
explicit paths and verify `git diff --cached --name-only` is exactly yours; (2) claim hot/shared files in
`.claude/WIP.md` before editing them, and prefer new files. Integrate before pushing with
`scripts/safe-push.sh` (fetch + rebase --autostash + push); never force-push; never revert a sibling's work.

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
