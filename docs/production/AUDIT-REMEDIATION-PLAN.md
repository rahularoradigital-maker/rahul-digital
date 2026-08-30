# AdBrain — Security, Architecture & Cleanup Remediation Plan

> From a 4-agent senior audit (security · architecture/scale · backend/DB · repo-hygiene), 2026-08-30.
> Every item is evidence-backed (file:line in the agent reports). Ordered by priority. "Owner" =
> me (code, I do it) or you (dashboard/account/decision). Fix sequence is designed to be done gradually.

## Headline answers to your questions

- **How many sessions can it handle today?** ~**10–30 concurrent** users on the warm dashboard; ~**5–15** once they use AI features. **First wall = the single shared Gemini free key** (~75 calls per creative run, one key for everyone). Second wall = the **Vercel Hobby 60-second function cap** — many routes declare `maxDuration=300`, which Hobby silently ignores, so cold data loads 504 at 60s.
- **Do we need AWS?** **No.** Honest verdict from the architecture audit: moving to AWS is a 2–4 month rewrite for **zero** latency/capacity gain — every real bottleneck (the Gemini key, a heavy in-memory DB read, tier limits) is identical on AWS. The fix is **tier + two code paths for ~$45–70/mo**, not a platform migration.
- **Is the backend "sorted"?** **Mostly** — the live schema is well-built (sane keys, deny-by-default RLS on all 40 tables, correct upserts). The gaps: migration files don't match production, missing user FKs, and one dedupe bug (now fixed).

## Already fixed today (shipped + verified)
- 🟢 **`/api/judgment` was unauthenticated** and could burn your AI budget in a loop → now requires sign-in.
- 🟢 **Notifications silently dropped every deduped alert** (my `0013` used a partial index PostgREST can't upsert against) → replaced with a full unique index, applied live. The sync-failure alerts now actually persist.

---

## P0 — Do first (correctness, security, scale-blockers)

| # | Item | Owner | Why it matters |
|---|------|-------|----------------|
| 1 | **Upgrade Vercel Hobby→Pro + Supabase→Pro** | You | The biggest single unlock, ~config only. Hobby caps functions at 60s (breaks the 300s cold-pull + ingest paths) **and prohibits commercial use**. Pro gives 300s, connection pooling, no DB auto-pause, sub-daily cron. |
| 2 | **Paid / per-tenant Gemini key** | You | Removes the #1 concurrency wall. The router already supports it via env — no code change. |
| 3 | **SSRF guard on `fetchInlineImage`** | Me | Server fetches URLs from ad data with no scheme/private-IP block → blind SSRF to internal hosts. Add https-only + block private ranges. |
| 4 | **Per-user quota + rate-limit on uncapped AI routes** (`creative/analyze`, `market/positioning`, `brand/discover`) | Me | A valid session can loop expensive AI calls → runaway bill. Reuse the `ask`/`competitors` cap pattern. |
| 5 | **Add `auth.users` FKs to data tables** (`ad_metrics`, `ad_meta`, `shopify_products`, etc.) | Me | Today deleting a user orphans their data forever — breaks the data-deletion promise (GDPR). Add `on delete cascade` FKs. |
| 6 | **Remove the `.xlsx` files from git + gitignore `*.xlsx`** | Me | Confirmed **no live secrets** (blank template), but it discloses the full env-var inventory and invites a future key-paste. |
| 7 | **`docs/shared-research/` (2 GB) holds `Yamin-*`/`Imagive-*` decks + WhatsApp PII on disk** | You | ❌❌❌ Violates your own hard "zero sibling-product-name footprint" rule, even locally. I won't delete your files without your OK — but recommend purging from disk. |

## P1 — Hardening & the real scale levers

| # | Item | Owner |
|---|------|-------|
| 8 | **Precompute the cockpit on sync, not on view** — `from-store.ts` pulls the full 90-day rowset (tens of thousands of rows) into memory on every cache-miss render. Write the finished blob per window during ingest. | Me (medium) |
| 9 | **Turn on Upstash** (2 env vars) — activates the distributed rate limiter + AI cost counter already built. | You |
| 10 | **Durable ingest chain** — the self-chain is fire-and-forget (`fetch().catch()`); a dropped hop waits 24h. Add a durable retry (or the queue, #17). | Me (medium) |
| 11 | **competitor_ads**: add a real PK, dedup the batch before upsert, avoid the giant `in()` prune (URL-length blowup). | Me |
| 12 | Notifications feed: order/index mismatch (`updated_at` vs `created_at` index) → sort on every load. | Me (small) |
| 13 | Gemini retry: add jitter/backoff + a circuit breaker (currently fixed 1200ms, correlated retries). | Me (small) |
| 14 | Small security hardening: cron `timingSafeEqual`, validate the `next` redirect param, use Vercel's trusted client IP for rate-limit keys. | Me (small) |

## P2 — Cleanup & maintainability (the "bloat")

| # | Item | Owner |
|---|------|-------|
| 15 | **Retire the dead "generation 1" (~2,900 LOC)** — `lib/rules/*`, `lib/decision.ts`, `lib/data-quality.ts`, `lib/fingerprint.ts`, `lib/cache.ts`, `lib/confidence.ts`, `lib/validator.ts` + their `check:*` scripts. The app uses `lib/scoring/*`, `lib/creative/*` instead; the old copies stay green only via their own tests and cause old/new confusion. | Me (decision) |
| 16 | Delete truly-dead files: `lib/queue.ts` (interface, no impl/importer), `lib/influencer/flag.ts`, `lib/influencer/provider.ts`. | Me |
| 17 | **Rebuild a real migration baseline** (`supabase db pull`) — the `0001+` files can't recreate production; add a CI check that applies migrations to an empty DB. Also fix the duplicate `0007_` ordinal. | Me (medium) |
| 18 | Split `lib/app/kpi-catalog.ts` (2,442-line god-file). | Me (low) |
| 19 | Nonce-based CSP (drop `script-src 'unsafe-inline'`); non-negative CHECK on `ad_metrics` numerics; storage cleanup for `cp-assets` on deletion. | Me |

## P3 — True scale (defer until real load)
Managed queue (`lib/queue.ts` impl on QStash) + worker tier; partition `ad_metrics` by date; read replica. Named in ADR-0004; only needed at sustained thousands of concurrent.

---

## New backend you requested (folded in as its own track)

**T1 — Richer signup** 🟢 done today (name + website + email-confirm).
**T2 — Per-user AI spend + admin console** (your "backend for prompts/jobs/tokens/cost"): capture token usage from every provider response, persist per-user/model cost in a new `ai_usage` table, and build an **admin-gated** console (`/app/admin`, allowlisted email) showing per-user spend, tokens, prompts, and running jobs. This is a real build — best done right after P0 (it touches the router + DB the audit just mapped). Access model: admin-only via an `ADMIN_EMAILS` allowlist (default: your account).

---

## Suggested execution order
1. **You:** upgrade Vercel Pro + Supabase Pro (#1), paid Gemini key (#2), decide on shared-research purge (#7).
2. **Me (now, safe code):** #3 SSRF, #4 AI caps, #6 xlsx removal, #12/#13/#14 small hardening.
3. **Me (next):** #5 FKs, #8 cockpit precompute, then the admin/cost backend (T2).
4. **Me (cleanup pass):** #15–#19.
5. Verify each with the build gate + live check; ship one focused change at a time.
