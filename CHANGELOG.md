# Changelog

All notable changes to AdScale (`adbrain-mvp`). Newest first. Commit hashes are on `validation-v0-v1` (the live branch). Full audit + measurements: `docs/PHASE-0-AUDIT-2026-09-02.md`.

## 2026-09-02 — Phase-0 audit execution

### Security
- Open-redirect on `/auth/callback?next=` closed (only same-origin paths). `ee1d4d8`
- AI kill-switch + daily budget enforced at the `callGemini` / `callGeminiText` primitive, not per caller. `ee1d4d8`
- SSRF guards on the two server-side fetchers of user-supplied URLs (brand-DNA site text, deep-decode video). `ee1d4d8`
- Five mutating handlers gained the product-access gate; `market/positioning` GET too. `ee1d4d8` `07ec0f5`
- `influencer/avatar` proxy now requires a session, is rate-limited (120/min) and capped at 2 MB. `ee1d4d8`
- `/api/health` returns only `{status,time}` to non-admins. `ee1d4d8`
- Migration `0032`: revoke anon/authenticated EXECUTE on the `cp_*` SECURITY DEFINER RPCs + `handle_new_user`; pin `search_path`. **Manual apply pending.**
- All three cron/drain routes share one constant-time `cronSecretGate`. `8c55fd5`

### Correctness
- `CACHE_SCHEMA` bumped to v7 (the per-ad 7d-vs-30d read had shipped without a bump). `bca8b6c`
- Deterministic `ORDER BY` on the change-analysis multi-page scan; `ad_meta` read in ingest paged past 1,000 rows. `bca8b6c`
- Every `ad_metrics` reader now orders by `ad_id + date` (a total order) — offset paging over `ad_id` alone could duplicate or drop rows. `9457acf`
- Shared `objective-metric.ts` + `VOLUME_FLOORS` replace two verbatim copies. `bca8b6c`

### Performance (measured live, see the audit doc)
- `/app/changes` repeat view 11.1 s → 1.6 s (platform data cache, ingest-busted tag). `69895a1`
- `/app/funnel` 8.58 MB → 1.25 MB per view and 11.9 s → 3.0 s repeat (client render with 20-card preview + data cache). `2a61492`
- `/app` client JS 757 KB → 706 KB (70 KB KPI catalog no longer shipped). `f5db31e`
- Store paging is parallel (bursts of 8) via one shared `readAllPages`; uncached reconcile read ~30–40% faster. `9457acf`
- Campaign/event switchers cache for 5 minutes; the Meta Graph campaigns call no longer fires on every `/app` load. `308d4f8`
- Cockpit brand-confirmed lookup runs alongside `loadCockpit` instead of after it. `f5db31e`
- `/api/scope/events` scoped to the active account. `308d4f8`

### Observability / architecture
- `withProductApi` / `withAdminApi` route wrappers; the access-gate check now asserts every exported product-API method (41 across 34 routes). `07ec0f5`
- `captureError` on 21 previously silent money-path catches (sync, cockpit, ingest, OAuth). `07ec0f5`
- `lib/insights/store.ts` — the creative page no longer runs an inline service-role query. `a1a87f7`

### SEO
- `/app` is `noindex, nofollow` (meta + `X-Robots-Tag`); auth/legal/demo pages self-canonical; blog gets the site header/footer; nav anchors resolve from any page. `a1a87f7`

### Cleanup
- 11 zero-reference files deleted, including the publicly served `public/cockpit-v1.html` prototype; `_inbox.zip` gitignored.
- Orphaned checks wired: `check:change-log`, `check:shadow-benchmark`; new `check:paged`. All chained into `check:all`.

### Earlier today (feature work, before the audit)
- Cockpit: 7d-vs-30d per-ad read + "What's working" surface, badge on every ad. `a1fce91` `6aff3fd`
- Studio: five pure engines (test-set, policy-lint, performance-rank, gap-angles, platform-checks) and the first two wired into Concepts. `f1860a4` `83964e3` `15b3ce0` `8a4c409`
- `/api/scope/events` reads `ad_meta` via the admin client (RLS default-deny for the user client). `831e8cd`

## 2026-09-02 (later) — DB hardening applied live + marketing honesty

### Security (applied to the live database)
- **Migration 0032 was ineffective** and **0033 fixes it.** Revoking EXECUTE from `anon`/`authenticated` left Postgres's default `PUBLIC` grant intact, so `has_function_privilege('anon', ...)` still returned true (caught by live verification). `0033` revokes the 3 `cp_*` SECURITY DEFINER RPCs from `PUBLIC` and re-grants `service_role`. Verified live: `anon=false, authed=false, service=true` — the cross-tenant read is closed. `handle_new_user` is a trigger (not `/rpc`-callable), left as-is.
- **Migration 0034** (applied): covering indexes on the 7 unindexed foreign keys the advisor flagged (`cp_brand_dna.brand_id`, `influencer_search_result.user_id`, `notifications.brand_id`, `notifications.org_id`, `org_invites.invited_by`, `profiles.approved_by`, `provider_keys.updated_by`) + a partial index for the failed-login lockout read (`owner_events (meta->>'email', created_at) where event_type='login.failed'`).

### Marketing honesty
- Removed the **"SOC 2 Type II"** trust badge from the homepage security section — the product is not SOC 2 Type II certified. `GDPR`, `EU AI Act`, `Meta Partner` retained (compliance posture / API relationship). The `+38%` ROAS figure, "Trusted by hundreds", and named testimonials still need Rahul's substantiate-or-remove ruling.

### Cleanup
- Deleted `lib/app/ads-manager-url.check.ts` (dead everywhere — not imported by the app or any script).
- The other 28 unreachable `lib/` modules are **NOT** deleted: each has a self-check test and several are staged foundations built in the last few days (creative A/B engines, account-deletion foundation, control-plane security, durable queue). See the audit doc's "unreachable modules" note.
