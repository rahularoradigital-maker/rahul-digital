# Risk Audit — Data Model, Tenancy & Security (Phase 0, READ-ONLY)

Scope: `supabase/migrations/*.sql` (33 files), `lib/supabase/*`, `lib/app/access.ts`, `lib/security/*`,
`lib/tenancy/access.ts`, API route guards. Method: static read only. Every claim tagged
MATCH / DRIFT / UNKNOWN vs docs (PROJECT-LEDGER.md, migrations 0015/0016/0022, in-file ADR comments).

---

## 1. Table + RLS inventory

**Counts.** 40 distinct tables are defined in migration files (39 `public.*` + `token_usage`). **All 40 have
`enable row level security`** (create-table vs enable-RLS counts match in every file — verified by per-file
diff). At least **12 further tables exist only in the live DB** (never in a migration file) but are referenced
by `0018_user_fks.sql` and `lib/security/classification.ts`: `ask_log`, `brand_profiles`, `cockpit_cache`,
`cp_assets`, `cp_brand_dna`, `cp_concepts`, `cp_generations`, `cp_product_dna`, `creative_insights`,
`demo_requests`, `decision_triples`, `competitor_creative_analysis`. **RLS status of those 12 is UNKNOWN from
the repo** (cannot verify without the live DB). Approx. total surface ~52 tables.

**Policy posture.** Only **9 tables carry an explicit RLS policy**; the rest are RLS-on / no-policy =
deny-by-default for anon/authenticated, reachable only by the service-role client.

| Table | Owner cols | RLS | Policy | Class (classification.ts) | Tag |
|---|---|---|---|---|---|
| brands | user_id, org_id | on | `for all: auth.uid()=user_id` (0001:90) | CONFIDENTIAL | MATCH |
| competitors | brand_id→brands | on | own-via-brand (0001:96) | — | MATCH |
| competitor_ads | brand_id | on | own-via-brand (0001:101) | CONFIDENTIAL | MATCH |
| triples | brand_id | on | own-via-brand (0001:106) | — | MATCH |
| test_plans / test_plan_items | brand_id / plan_id | on | own-via-brand (0001:111/116) | — | MATCH |
| ad_accounts | user_id, brand_id | on | `auth.uid()=user_id` (0002:39) | CONFIDENTIAL | MATCH |
| oauth_tokens | ad_account_id | on | **none (deny-all)** (0002:42) | HIGHLY_SENSITIVE | MATCH |
| ad_metrics / ad_meta / ad_sync_state | user_id, account_external_id | on | none (0008:75-77) | CONFIDENTIAL/INTERNAL | MATCH |
| ad_changes / change_sync_state | user_id, account_external_id | on | none (0017:32/45) | — | MATCH |
| orgs / org_members / brand_members | org/user | on | none (0009:47-49) | SENSITIVE | MATCH |
| org_invites | org_id, email | on | none (0011:16) | SENSITIVE | MATCH |
| shopify_connections | user_id, brand_id | on | none (0006:16) | HIGHLY_SENSITIVE | MATCH |
| shopify_products / shopify_sync_state | user_id, shop_domain | on | none (0006:43/56) | — | MATCH |
| influencer_* (8 tables) | user_id, account_external_id | on | none (0007) | — | MATCH |
| notifications | user_id, org_id, brand_id | on | none (0013:28) | CONFIDENTIAL | MATCH |
| audit_log | actor_id, org_id | on | none + append-only trigger (0015) | INTERNAL | MATCH |
| system_flags | key | on | none (0016:17) | INTERNAL | MATCH |
| provider_keys | name | on | none (0021:11) | — (encrypted) | MATCH |
| ai_usage | user_id | on | none (0019:16) | — | MATCH |
| owner_events | user_id | on | none (0020:15) | — | MATCH |
| growth_briefs / growth_drafts / growth_articles / growth_sources | none (owner-internal) | on | none | — | MATCH |
| creative_semantics | user_id, content_hash | on | none (0017:20) | — | MATCH |
| cp_concepts/cp_assets/cp_generations/cp_brand_dna | user_id (+brand_id 0010) | on* | none | CONFIDENTIAL | UNKNOWN (live-only DDL) |
| profiles | id=auth.uid | on | `select own` (0022:23) | — | MATCH |
| token_usage | user_id | on | `select own` (0024:21); writes via RPC only | — | MATCH |

\* `cp_*` RLS asserted by in-file comments but the CREATE TABLE is not in the repo — UNKNOWN.

---

## 2. Admin-client (service-role, RLS-bypass) sites & whether scope is re-checked

`createAdminClient()` (lib/supabase/admin.ts:6) uses `SUPABASE_SERVICE_ROLE_KEY`, **bypasses RLS**, and is
imported in **55 files**. Because RLS is no-policy/deny-by-default on nearly every table, **tenant isolation on
the read/write path is enforced entirely in application code, not by the database.** Representative sites:

- `lib/oauth-store.ts:31 readToken` — re-checks scope via `ad_accounts!inner(user_id)` + `.eq(user_id)`; even a
  wrong ad_account_id returns null. `revokeToken` (52) ownership-gates + audits. **MATCH — model site.**
- `lib/cockpit/from-store.ts:92-95` — reads `ad_metrics` filtered `user_id` + `account_external_id` + date
  window (`gte/lte`). **§80 account+window scope satisfied. MATCH.**
- `lib/meta-sync.ts:590-604,682-687 cockpit_cache` — keyed `(user_id, cache_key)`; `cache_key` embeds active
  account id + window + filters (667); L1 mem key is `userId:cacheKey` (668). **Cache is per-user/account/window. MATCH (§81).**
- `app/api/connect/meta/callback/route.ts:96-110` — all writes `.eq(user_id)`; OAuth `state` vs httpOnly
  cookie CSRF check (27-31); `guardProductApi` (39). **MATCH.**
- `app/api/cron/sync/route.ts:66-73` — continue-mode token read gated by `user_id`+`external_id`+`platform`+
  `status`; CRON_SECRET constant-time compare (49). **MATCH.**
- Admin routes `admin/access`, `admin/keys`, `admin/invite`, `growth/review` — `isAdminEmail(user.email)`
  gate + `recordAudit`. **MATCH.**

**Systemic risk:** the ~50 other admin-client call sites each depend on a hand-written `.eq("user_id", …)`.
There is no DB backstop — one omitted filter is a silent cross-tenant leak. Not individually audited here.

---

## 3. Tenancy-isolation findings

- **[P1] Isolation depends on code-level filters with no RLS backstop (DRIFT vs "RLS is defense-in-depth").**
  0009:45-46 and every service-only table comment claim RLS is a second layer, but since the app reads through
  the service role and those tables have no policy, RLS provides **zero** isolation on the live path — it only
  blocks a hypothetical direct anon/authenticated query. A single missing `.eq(user_id)` in any of ~50 files
  leaks data. Evidence: 55 `createAdminClient` importers; deny-all tables in 0006/0007/0008/0013/0017.
- **[P2] RLS policies are USER-scoped and were never updated for the org model (DRIFT vs 0009 tenancy model).**
  `brands`/`competitors`/`triples`/etc. policies test `auth.uid() = user_id` (0001:90-122). 0009 re-parented
  brands to `org_id` and made `user_id` nullable (0009:26-28); `brand_members`/`org_members` grants
  (member/viewer sharing per lib/tenancy/access.ts) are **not reflected in any RLS policy**. A direct-client
  read of an org-shared brand with `user_id IS NULL` would return nothing (or the wrong scope). Isolation is
  correct only because code uses the service role + `brandsVisibleTo()`. RLS is stale, not a real backstop.
- **[P2] Performance tables are user+account scoped, not brand/org scoped.** `ad_metrics`/`ad_meta`/
  `ad_changes` PK is `(user_id, account_external_id, …)` with no `brand_id`/`org_id` (0008, 0017). In the
  agency/org model an account belongs to a brand belongs to an org; these tables cannot be filtered or
  RLS-scoped by brand/org at the DB. Acceptable for single-user-per-account MVP; a scaling gap for agencies.
  Tag: DRIFT vs the org tenancy intent.
- **[P3] Schema not reproducible from the repo (DRIFT vs migrations/README).** ~12 tables (incl. all `cp_*`,
  `brand_profiles`, `cockpit_cache`, `ask_log`, `decision_triples`) exist only in the live DB; migration files
  are explicitly "non-authoritative mirrors" (0007:2, 0018:3). RLS/policy state of those tables is UNVERIFIABLE
  from the repo, and a clean rebuild is impossible. Audit + DR risk.
- **[P3] `brands.user_id` nullable + `on delete set null` on `ad_accounts.brand_id` (0009:28,42).** A dangling
  brand (org_id set, user_id null) is invisible to the user-scoped RLS policy and to any `user_id`-only code
  filter — orphan/black-hole risk during the org transition.

---

## 4. Security findings

- **[P1] No RLS policy set covers the org sharing model — see §3 P2.** If any client component ever queries a
  policy-bearing table (`brands`, `competitors`, `ad_accounts`) directly with the anon key for a shared brand,
  it fails closed (safe) but also breaks member/viewer access; the risk is a future dev "fixing" it by widening
  the policy without the org join. Flag for the RLS-modernization work.
- **[P2] `spend_tokens` metering fails OPEN on DB error (lib/billing/meter.ts:64-69).** A metering outage lets
  uncounted AI spend through. Deliberate + documented, but it is a cost-abuse lever (contrast: image/plan gate
  fails closed at 43-46). MATCH vs code intent; flagged as residual risk.
- **[P2] Public/no-auth routes are correctly gated, but by bespoke logic, not `guardProductApi`.** 11 of 41
  routes lack `guardProductApi`: `leads` (public form — IP rate-limit + honeypot + size cap, service-role write
  to deny-all `demo_requests`, lib/leads/route.ts), `usage` (own-user via `getUser` + `getUsage(user.id)`),
  `health`, `influencer/avatar` (SSRF-allowlisted image proxy), `admin/*` (isAdminEmail), `growth/*` +
  `cron/*` (CRON_SECRET / isAdminEmail). All defensible, but the guard pattern is inconsistent — no single
  choke point. MATCH (each individually safe).
- **[P3] Access gate correctly fails CLOSED (lib/app/access.ts).** Any error/missing profile row ⇒ WAITLIST
  (25-29); admins short-circuit off an env allowlist so a data problem can't lock staff out (22). Uses
  service-role so it works regardless of RLS. MATCH vs 0022 + docs/access-control-plan.md.
- **[P3] RBAC catalog is defined but enforcement coverage is UNKNOWN.** `lib/security/rbac.ts` is a pure
  `can()`/`requirePermission()` model; dangerous platform powers are deliberately held out of every tenant role
  (CONTROL_PLANE_ONLY, 71). Whether `requirePermission` is actually *called* on each guarded write was not
  traced in this pass — UNKNOWN.

### Security strengths confirmed (MATCH)
- **Tokens/secrets never in plaintext.** `oauth_tokens` + `shopify_connections.access_token_encrypted` +
  `provider_keys.encrypted_value` are AES-256-GCM (lib/crypto.ts; master key `TOKEN_ENC_KEY` env-only, throws
  if absent/wrong length, crypto.ts:14-22). `oauth_tokens` is RLS deny-all, service-role only. Bootstrap
  secrets (Supabase, enc key, Meta secret, CRON) forced to env by `isManagedKey` allowlist (lib/keys.ts:8).
- **Audit log is DB-enforced append-only** (0015: BEFORE UPDATE/DELETE trigger raises) — tamper-evident even
  against the service key. Secrets excluded by convention + audit-row redaction. MATCH vs migration 0015 notes.
- **Kill switches / feature flags**: env var is the guaranteed brake and wins over the DB row
  (lib/security/flags.ts:26-35, pure + testable); `system_flags` RLS deny-all. MATCH vs 0016.
- **OAuth CSRF**: `state` vs httpOnly cookie enforced on the Meta callback (callback route:27-31). MATCH.
- **CRON auth**: constant-time `timingSafeEqual`, 503 when unset (cron/sync:42-51, cron/growth:22-26). MATCH.
- **User deletion cascades** (0018_user_fks adds ON DELETE CASCADE FKs across all user_id tables). MATCH (GDPR).

---

## 5. Doc reconciliation

- Migrations 0015 (audit_log), 0016 (system_flags), 0022 (access_state): code (lib/security/*, lib/app/access.ts)
  matches the migration intent. **MATCH.**
- PROJECT-LEDGER.md line 60 ("Supabase, user-scoped, RLS") — **MATCH for user-scoped**, but **DRIFT**: it omits
  that RLS is no-policy/deny-all on most tables and that real isolation is code-level via the service role.
- "RLS is defense-in-depth" (repeated in migration comments) — **DRIFT**: true only for direct client access,
  which the app does not use; it is not a live-path backstop.
</content>
</invoke>
