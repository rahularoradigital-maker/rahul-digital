# AdBrain — Backend Control Plane (right-sized plan)

> Response to the 65-phase control-plane spec, sized to reality: **~5–15 users/day, 1 user in the DB, no
> payments, no credits, no plans.** Principle (from the spec itself): *do not overengineer infrastructure
> that is not currently required; build extensibility where it materially reduces future migration cost.*
> Verdict: build the ~15% that matters now, seam the rest, defer everything that governs money/credits/
> customers until monetization exists. Scales to the 10k-user vision without a rewrite.

## What already exists (don't rebuild)
- **AI usage + cost** (spec Ph 5–7, 16–17): `ai_usage` ledger (user, task, provider, model, tokens, cost), per-model pricing, gated admin console. *Basic, live.*
- **Audit log** (Ph 27): `lib/security/audit-log.ts` `recordAudit(...)` (parallel workstream) — credential revocation already audited.
- **RBAC** (Ph 28): `lib/security/rbac.ts` — permission catalog + `can(role, perm)`.
- **Kill switches / flags** (Ph 36–37): `lib/security/flags.ts` `isKilled(...)` — router honors an AI kill switch.
- **Rate limiting** (Ph 34): `enforceRateLimit` (Upstash-backed, fail-open) on public + AI routes.
- **Secret handling** (Ph 3, 29): OAuth tokens AES-encrypted, `server-only`, ownership-checked `readToken`, never returned to client.
- **Tenant isolation** (Ph 60 partial): audited — every admin read is user/brand scoped; `auth.users` FKs added.
- **Rules/formulas as code** (Ph 22–24): 1,061-rule corpus (`lib/judgment/rules.json`) + `lib/scoring/*` — exist, but not yet *versioned registries*.

## P0 — Build now (real value at your scale)
1. **Complete AI-cost attribution.** Set the user context on *every* AI entry route (some route→lib chains don't yet), so no AI spend is "unattributed." + a lightweight `MODEL_PRICING_VERSION` marker on the pricing table.
2. **Admin console: add an Audit trail + system-health section** — read the existing `audit_log` (who/what/when) and `/api/health` + sync-state into the console. Turns "spend only" into a real control panel.
3. **AI budget guardrail** — a global daily AI-cost ceiling that trips the existing kill switch (throttle/pause) + alerts. Reuses `flags.ts` + the cost counter.

## P1 — Seam only (cheap now, drop-in later)
4. **One event model** (Ph 42): a single `{event_type, actor, user_id, org_id, feature, request_id, ts, meta}` shape reused by usage + audit, so analytics/warehouse export is later a config, not a migration.
5. **Connector registry** (Ph 4): a small table listing connectors (Meta/Shopify/ScrapeCreators/AI) with status + last-ok + cost-model — health at a glance.
6. **Registry *pointers*** (Ph 20–24): reference the rules/formulas that already exist by id + version, without moving prompts around.

## Defer until you monetize (no business reason yet — would be rebuilt)
- **Credit ledger + entitlements + plans + token budgets as entitlements** (Ph 8–15): you have no credits/plans; these must match a pricing model that doesn't exist yet.
- **Org billing, payments, payment webhooks, invoices, refunds** (Ph 15, 31, 32): no payments in the product.
- **Email governance ledger** (Ph 30), **data warehouse** (Ph 54), **full decision-trace/reproducibility** (Ph 25–26), **anomaly ML** (Ph 35): valuable at scale; premature at 1 user.

## Why defer is the right call (not laziness)
Building the credit/billing/entitlement machinery now means designing it against a **pricing model you haven't decided**. When you set pricing, it gets rewritten — the exact throwaway work you've told me to never build. The P1 seams (event model, registries) are the cheap insurance that makes the deferred tier a **drop-in**, not a rewrite. This is how you reach the 10k-user vision without a big-bang migration.

## Quality gates that DO apply now
Every AI call attributed to a user + cost ✓ (P0-1) · admin can see cost/usage/jobs/audit ✓ (P0-2) · runaway-AI guardrail ✓ (P0-3) · no raw secrets exposed ✓ (exists) · audit log immutable ✓ (exists) · tenant isolation ✓ (exists). The credit/billing gates are N/A until monetization.

## Execution
Build P0 now (days), land the P1 seams alongside, revisit the deferred tier the week pricing is decided. Each change ships behind the build gate (`check:all`) + a live check.
