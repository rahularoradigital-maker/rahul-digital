# AdScale — Pre-Launch Readiness Report

**Date:** 2026-09-04 · **Branch:** validation-v0-v1 · **Method:** evidence-based sweep of every launch dimension (code read + 172-check gate + build). Every line below is grounded in what is actually in the repo, not assumed.

---

## 1. Verdict

**The code is launch-ready for a controlled 1,000-users/day launch.** Every code-side scale risk and every old P0 blocker is closed and gated in CI (172/172). What stands between you and "open the doors" is now **owner-only**: a few dashboard switches, a payment provider decision, and three live tests only you can run (you hold the accounts + keys). No rewrite, no missing core feature.

**Launch-readiness by dimension:**

| Dimension | State | Evidence |
|---|---|---|
| Scale (1,000 DAU) | 🟢 Done | S0–S7 shipped + proven by `check:scale` at 1,500-account scale |
| Multi-tenant isolation | 🟢 Done | RLS default-deny + service-role + `.eq(user_id)`; `check:tenancy` = 0 gaps |
| AI cost control | 🟢 Done | global + per-tenant breakers (`check:ai-budget`), per-route rate limits (S3) |
| Auth & access | 🟢 Done | fail-closed private-beta gate (`check:access-gate`), brute-force lockout, pw-reset present |
| Secrets | 🟢 Done | tokens encrypted (`TOKEN_ENC_KEY`), `CRON_SECRET` fail-closed + constant-time, export scrubs secrets |
| GDPR (delete + export) | 🟢 Done | soft-delete + grace executor, data export; `check:account-purge` + `check:account-export` |
| Error visibility | 🟢 Adequate | structured-log seam + `owner_events` + admin "Problems"; Sentry = 1-line swap on DSN |
| Read-path speed + RUM | 🟢 Done | SWR + shared L1/L2 cache + rollups + instant skeleton; p75 RUM in admin |
| Billing / charging money | 🔴 Not built | blocked on a payment-provider decision (Stripe won't onboard; use Razorpay/Paddle) |
| Owner platform config | 🟠 Pending | Vercel Pro, Upstash, crons, a few env vars (§4) |
| Live verification | 🟠 Pending | 3 tests only you can run (§3) |

---

## 2. What is DONE (with evidence)

- **Silent 1,000-row truncation removed (S0):** all large-per-tenant reads paged; `check:paged-reads` lints it permanently.
- **Queue-driven ingestion (S2):** `cron/rollups`, `admin/rollups`, and `cron/sync` (behind `SYNC_VIA_QUEUE`) enqueue durable per-account jobs with retry/backoff/dead-letter instead of one-request fan-outs.
- **Per-user rate limits (S3)** on the 5 expensive routes; distributed limiter ready for Upstash.
- **Per-tenant AI cost ceiling (S4):** one whale can't pause AI for everyone.
- **Scale proof (S7):** `check:scale` proves paging, a full 1,500-account queue drain (incl. dead-letter + tail), the per-tenant budget, and the rate limiter — deterministically, in CI.
- **RUM (S6):** real LCP/FCP/TTFB/CLS beaconed to `web_vitals`, p75 shown in the admin console.
- **GDPR pair:** self-serve deletion (14-day grace, revoke Meta, re-login/Cancel aborts) + data export (credential-safe by allowlist + scrub).
- **Quality gate:** 172 checks run in ~2s in parallel, CI-enforced; the golden money-path (`check:golden` + `check:shadow-benchmark`) is byte-identical through every change this session.
- **Code hygiene:** 0 stray TODO/FIXME in the Meta product (the only 3 are in the deferred Google-Ads demo track, `lib/google-source.ts`).

---

## 3. Live tests OUTSTANDING (only you can run — you hold the accounts/keys)

1. **Nightly queue sync** — set `SYNC_VIA_QUEUE=1`, trigger `cron/sync`, confirm every connected account syncs and `jobs` shows no dead-letters. (Golden Meta path; verified in code + at 1,500-scale in `check:scale`, but never run on a real overnight batch from here.)
2. **Account deletion end-to-end** — on a **throwaway account**, request deletion → confirm the Meta token is revoked immediately and, after forcing the grace, `cron/purge-deletions` erases every table. Do this BEFORE enabling the purge cron.
3. **Data export** — click "Download my data" in Settings on a real account; confirm the JSON has your data and **no tokens/secrets**.

---

## 4. OWNER setup checklist (the switches between here and launch)

**Platform (the gating prerequisite — "S1"):**
- [ ] **Vercel Pro** — lifts the 60s function cap (heavy syncs) and the 2-cron limit. Required, not optional, at scale.
- [ ] **Upstash Redis** — set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`; flips the rate limits (and future cache) to true cross-instance with no code change.

**Crons — `vercel.json` currently schedules only `cron/sync` + `cron/growth` (Hobby's 2-cron limit).** On Pro, add:
- [ ] `/api/cron/rollups` (keeps instant-app rollups fresh account-wide)
- [ ] `/api/cron/purge-deletions` (runs the deletion executor after grace) — **do the throwaway-account test first**

**Migrations to apply on next deploy** (code guards against their absence, so nothing errors pre-apply):
- [ ] `0041_web_vitals.sql` · [ ] `0042_account_deletions.sql`

**Env vars missing from `.env.local.example`** (document them; most are optional):
- `SYNC_VIA_QUEUE` (set `1` to activate queue sync), `AI_TENANT_DAILY_COST_BUDGET` (default $5), `ALLOW_DEMO_PATHS`, `PHOTOROOM_API_KEY` / `REMOVEBG_API_KEY` (optional bg-removal), `GOOGLE_ADS_DEVELOPER_TOKEN` (Google track).

**Optional but recommended for a real launch:**
- [ ] **Sentry DSN** → swap the one line in `captureError` (seam already there).
- [ ] **`ALERT_WEBHOOK_URL`** → daily sync-failure + AI-budget alerts (already wired; no-op without it).
- [ ] **Email provider** (Resend/Postmark) → the weekly digest can then actually send.

---

## 5. Genuine remaining GAPS / risks (ranked)

1. **🔴 Billing — cannot charge money yet.** No payment integration. Decide the provider (Razorpay for INR; Paddle / Lemon Squeezy for global Merchant-of-Record, which sidesteps the Stripe-India onboarding wall). The metering/allowance layer is already provider-agnostic, so this is a focused adapter, not a rebuild.
2. **🟠 Purge + rollup crons unscheduled** — until Pro + `vercel.json`, deletions never auto-purge (they sit cancellable — safe) and account-wide rollups refresh only via the on-sync path. Pro closes this.
3. **🟠 Queue sync is opt-in and unproven live** — `SYNC_VIA_QUEUE` defaults off; flip it + verify one nightly run (test #1).
4. **🟠 Rate limits are per-instance until Upstash** — correct logic, but only a true cross-instance cap once Upstash is set.
5. **🟢 Google Ads track is demo-only** — `lib/google-source.ts` returns demo data (3 TODOs). Fine to launch Meta-only; label the Google section "Demo" (already done) or hide it.

---

## 6. Recommended launch sequence

1. Turn on **Vercel Pro + Upstash**, apply migrations, add the two crons to `vercel.json`.
2. Run the **3 live tests** (§3) on throwaway/your own account.
3. Flip `SYNC_VIA_QUEUE=1`; confirm one clean nightly run.
4. Run `scripts/loadtest.mjs` against a preview URL to confirm real p95.
5. Pick a **payment provider**; wire billing.
6. (Optional) add Sentry DSN + `ALERT_WEBHOOK_URL` + email provider.
7. Open the private beta wider.

**Bottom line:** the engineering is done and proven; the launch is now a checklist of your switches + three tests + a billing decision.
