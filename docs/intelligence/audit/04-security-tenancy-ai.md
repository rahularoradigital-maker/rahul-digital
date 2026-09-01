# Phase 0 Audit — #10 Security + #14 Tenancy + #12 AI (READ-ONLY)

Posture: security *primitives* are genuinely good (fail-closed access gate, injection fence `compose`, SSRF guard,
audit spine, kill switches, plane scanner, OAuth CSRF state, encrypted tokens w/ RLS-deny). The gaps are primitives
**not wired to every path**, and **static gates that check a string, not the behaviour** — exactly what generic scanners miss.

## Security
- **S1 (P1) Access gate bypassed on POST handlers.** `check-access-gate.ts:52` asserts `guardProductApi` at FILE
  level, so routes with the guard in GET but not POST pass green while the expensive POST is ungated:
  `creative-production/concepts/route.ts:33` (generateConcepts, Claude), `creative-production/brand/route.ts:31`
  (deriveBrandDNA), `brand/profile/route.ts:47`. A WAITLIST/SUSPENDED/REVOKED user can burn AI spend + write.
  Fix: `guardProductApi()` first line of EVERY handler; gate asserts per-handler.
- **S2 (P1) ~8 CONFIDENTIAL tenant tables have NO RLS and aren't in any migration** (created out-of-band):
  cockpit_cache, brand_profiles, creative_insights, cp_assets, cp_generations, ask_log, demo_requests,
  competitor_creative_analysis. No leak today (all reads go through service-role admin client), but "RLS =
  defense-in-depth" is FALSE for these — isolation rests 100% on hand-written `.eq("user_id")`. Fix: add them to
  versioned migrations with RLS deny-all (oauth_tokens pattern).
- **S3 (P2) SSRF**: `creative-production/intelligence/brand-dna.ts:18` `fetchSiteText` fetches a user-influenced URL
  (Shopify domain) with no `isPublicHttpsUrl` guard and allows http://. The guard exists elsewhere; apply it here.
- **S4 (P2)** Audit is best-effort (swallows failures); account-switch + brand-override are unaudited. Guarantee
  audit for top-tier actions.
- **S5 (P2)** RBAC catalog (`lib/security/rbac.ts`) + `canEditBrand` have ZERO call sites — least-privilege is dead
  code; privileged actions gated only by "signed in" + isAdminEmail. Wire `requirePermission()` into write paths.
- Positives: OAuth CSRF state compare; constant-time CRON_SECRET; oauth_tokens/provider_keys RLS-deny; leads form
  rate-limit + honeypot; plane scanner blocks secret-to-client.

## Tenancy
- **T1 (P1) org→brand→account isolation NOT enforced on data paths.** `resolveUserContext`/`canAccessAccount`/
  `brandsVisibleTo` are called in only 2 routes (brand select/list). Every metric/cockpit/AI route scopes by
  `user.id` + single active account — safe for single-member orgs, but a member/viewer in a multi-member agency org
  is NOT restricted by `brand_members` on reads. Fix: route feature reads through `resolveUserContext` + validate
  brand/account.
- **T2 (P2)** `market/positioning` GET selects `creative_insights` by user_id + type, NO account filter → a user with
  2 accounts sees the WRONG account's positioning (POST writes correctly scoped). Add account_external_id to GET.
- **T3 (P2)** Inconsistent scope keys across features (cockpit=user+account; creative=user+shopDomain; cp_assets=
  user+brand+creative) → "right formula, wrong account" risk. Standardise on one (user,brand,account) tuple.
- Positives: select-account re-verifies URL account id against the token's reachable set; brandsVisibleTo provably
  can't leak a foreign-org brand; cron scopes each sync by (user_id, external_id).

## AI
- **A1 (P1)** Cost ceiling fail-OPEN + coarse: `ai/budget.ts` any DB error → not-exceeded, 60s-cached, daily
  account-wide USD only; no per-request/per-user hard cap in the router; `recordAiCall` is a no-op without Upstash so
  the daily-call alarm sees 0 and never fires. Fix: fail-closed / hard per-request cap; missing counter → "unknown, cap".
- **A2 (P2)** `market/positioning` + `brand/profile` qualitative outputs rely on prompt-only "never invent" with no
  post-check, and are cached + surfaced as insight (financial numbers ARE deterministic upstream — good). Add a
  grounding assertion to positioning (ask already has one).
- **A3 (P2)** Injection fence `compose()` not applied on the scraped-homepage-HTML path (`brand-dna.ts:61` →
  `llm-json.ts`) nor `lib/agents/creative/agents.ts` — scraped copy can carry injected instructions. Route through compose().
- Positives: competitor-name hallucinations resolved against real Meta Ad Library; global KILL_AI brake; per-task
  fallback; AsyncLocalStorage cost attribution.

## UNKNOWN (not statically verifiable)
Live RLS state of the out-of-migration tables (S2) — inferred absent, not confirmed vs running DB; token/provider_keys
at-rest encryption strength not deep-read this pass.
