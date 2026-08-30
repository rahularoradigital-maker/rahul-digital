# AdBrain — Production Launch & Continuous Reliability Plan

> Author: Principal Production-Readiness pass (make-plan orchestration).
> Date: 2026-08-30. Evidence-grounded: every finding below cites a real file or a live check.
> Scope: what it takes to put AdBrain in front of real, paying agencies + brands and keep it up.
> Method: 4 parallel read-only discovery agents swept deployment/infra, auth/security/tenancy,
> payments/email/SEO/legal, and reliability/observability/notifications. This is the synthesis.

---

## 0. How to read this document

This is a **plan**, not a changelog. It is written so any future session can pick up one phase in a
fresh context and execute it without re-discovering the codebase. Each item says: **what**, **why it
matters**, **the evidence**, and **the concrete move**. Nothing here is assumed — if I could not verify
something, it is marked `VERIFY` rather than asserted.

**The launch verdict is at the bottom (§9).** Read the scorecard (§2) first, then the P0 blockers (§4).

### The KEEP / FIX / IMPROVE / MISSING lens (applied throughout)

The operating rule was: *do not blindly change working infrastructure.* Most of AdBrain's core is
genuinely well-built and should be left alone. The gaps are concentrated in a few areas (monitoring,
legal, auth-recovery). We fix those; we do not refactor the parts that work.

---

## 1. What AdBrain actually is (so the plan fits the product)

- A **multi-tenant B2B SaaS**: orgs (agencies) → brands → ad accounts. Isolation is real and code-enforced.
- **Not** a self-serve, credit-card-on-file product today. The public site is a **lead-gen funnel**
  (`/book-demo`, `/signup`) — there is **no payment/checkout/billing code anywhere** (verified: zero
  Stripe/billing references in the repo). So the entire "Payments/Billing" half of a generic launch
  checklist is **N/A for v1**, not "missing". This is the single biggest way this plan differs from a
  boilerplate SaaS-launch checklist: we do not build billing we do not have.
- The real product surface is the signed-in cockpit: Meta-ads day-wise ingestion → decision engine →
  competitor intelligence → creative studio → ask. That is what has to be reliable.

**Consequence for the plan:** the launch bar is *"a real agency can sign in, connect Meta, and trust the
numbers, and we find out before they do when something breaks"* — not *"can process a credit card."*

---

## 2. Production-readiness scorecard (Red / Yellow / Green)

Scored on evidence, worst-instance-wins, ties break down. 🟢 ready · 🟡 launch with a documented limit · 🔴 blocker.

| # | Area | Status | One-line reason (evidence) |
|---|------|--------|----------------------------|
| 1 | **Tenant isolation** | 🟡 | Code-enforced correctly, but no DB-level RLS backstop on most tables + not every admin read audited (`lib/tenancy/*`, migrations). |
| 2 | **Auth core (login/signup/session/logout)** | 🟢 | Supabase-managed; proxy gates `/app`, API routes re-verify `getUser()` (`proxy.ts`, route files). |
| 3 | **Auth recovery (password reset / OTP)** | 🔴 | **No password-reset flow and no OTP anywhere.** A locked-out user cannot self-recover. |
| 4 | **Secrets hygiene** | 🟢 | No secret in client bundle; `server-only` tripwire on admin client; `.env` gitignored (grep-clean). |
| 5 | **Security headers / CSP / HTTPS** | 🟢 | Enforced CSP, HSTS preload, X-Frame DENY, nosniff, Permissions-Policy (`next.config.ts`). Vercel gives HTTPS. |
| 6 | **Error handling (no leaks)** | 🟡 | Consistent sanitized error JSON; two spots leak Meta API error text (`app/api/brand/discover/route.ts:59,94`). |
| 7 | **Monitoring / error tracking** | 🔴 | **None.** No Sentry/Datadog/PostHog/OTel — zero (grep-verified). Only `console.*` into ephemeral Vercel logs. |
| 8 | **Health / background-job visibility** | 🔴 | `ad_sync_state.last_error` is written on every sync but **never surfaced** to user or ops (`lib/ingest/ad-metrics.ts`). No `/api/health`. |
| 9 | **Notification center (user-facing)** | 🟡 | Greenfield; **foundation now built** (table + failure-translation + store + check). UI + emission wiring pending (see §6). |
| 10 | **DB integrity / hot paths** | 🟢 | Paginated, no N+1 (`lib/cockpit/from-store.ts`); impressions>0 CHECK; day-wise upsert keys correct. |
| 11 | **Cron / background jobs** | 🟡 | Self-chaining cron is well-built + auth-gated, BUT `CRON_SECRET` must be confirmed set in prod, and Hobby is daily-only. |
| 12 | **Rate limiting** | 🟡 | DB-atomic quota on `/api/ask` (good); lead form limiter is per-instance only, not distributed (`lib/rate-limit.ts`). |
| 13 | **Email deliverability** | 🟡 | Supabase built-in auth email only (rate-limited, not prod SMTP); demo requests notify no one. |
| 14 | **SEO / crawlability** | 🔴 | No robots, sitemap, OG/Twitter tags, per-page metadata, or manifest. Public funnel is under-indexed. |
| 15 | **Legal / trust pages** | 🔴 | No privacy/terms/cookie/deletion pages; footer links all point to `/signup`; hero shows a **"Privacy Policy" that isn't a link**. Compliance + false-claim risk. |
| 16 | **404 / error UX** | 🟡 | `global-error.tsx` + `/app/error.tsx` present; **no `app/not-found.tsx`** (default Next 404). |
| 17 | **CI / deploy gates** | 🟡 | CI runs lint+build+`check:all`; nightly health job. Gaps: no Node pin, PR CI lacks standalone `tsc`, `check:all` is a hand-maintained chain, duplicate `0007` migration ordinal. |
| 18 | **Backups / DR** | 🟡 | Supabase provides automated backups + PITR (plan-dependent — `VERIFY` tier); **no restore drill has been run**. |
| 19 | **Cost control at scale** | 🟡 | Free tiers everywhere; fingerprint-once cost lever designed but the whole stack is pre-paid-tier. Fine now, capped later (see the 10k plan). |
| — | **Payments / billing** | ⚪ N/A | No monetization code in v1 by design. Revisit when self-serve billing is added. |

**Tally:** 4 🟢 · 9 🟡 · 5 🔴 · 1 N/A. **Overall: 🔴 — must not public-launch until the 5 reds are cleared (§4).** The product *works*; it is not yet *safe to leave alone in public*.

---

## 3. The autopsy (what breaks first if we launched tomorrow)

Ordered by likelihood × blast radius. This drives the P0 ordering.

1. **A user forgets their password → cannot get back in → churns silently.** No reset flow (#3). First support ticket, guaranteed.
2. **A background sync starts failing for one account → nobody knows.** `last_error` is written but invisible (#7, #8). Data silently goes stale; the user trusts a wrong number. This is the worst one for a $100M/mo strategist: *silent wrongness beats loud failure.*
3. **A crash in production is invisible.** No error tracking (#7). We learn about outages from angry emails, not alarms.
4. **A regulator, enterprise-procurement, or a careful agency asks for the privacy policy → the link 404s to `/signup` and the hero already claimed one exists** (#15). Instant trust collapse + potential compliance exposure.
5. **`CRON_SECRET` unset in prod → nightly refresh silently never runs** (#11). Everything looks "connected" but data is frozen. (Known real hazard — this exact class of silent-skip has bitten before.)
6. **A whale account (40k rows) loads the cockpit → 90-day baseline into memory each call** (#10 caveat). Slow, not broken; the cache mitigates. Watch, don't fix yet.

---

## 4. P0 — Launch blockers (must be 🟢 before public launch)

Each is scoped to be executable in one focused session.

### P0-1 · Password reset flow (#3)
- **Why:** account recovery is table-stakes; without it, lockout = churn.
- **Move:** add `/forgot-password` (calls `supabase.auth.resetPasswordForEmail`) + `/reset-password` (consumes the recovery token, `updateUser`). Supabase issues, expires, and one-time-uses the token — do **not** hand-roll tokens. Wire the "Forgot password?" link on the login page.
- **Verify:** live — request reset → receive email → set new password → old password rejected, new works. Expired/used link shows a safe error. Enumeration-safe copy ("if an account exists, we sent a link").
- **Anti-pattern guard:** do not build custom OTP unless product wants it; Supabase recovery links cover this.

### P0-2 · Error tracking (#7)
- **Why:** you cannot operate what you cannot see. This is the biggest single gap.
- **Move:** add Sentry (`@sentry/nextjs`) via `instrumentation.ts` + client/server configs; DSN as an env var. Capture server route errors + the `console.error` sites already labeled "(recoverable)". Keep it lean — one dep.
- **Verify:** throw a test error in a route → it appears in Sentry with request context, no secrets, no PII. Confirm no source-map secret leak.
- **Note:** this is *distinct* from the user-facing notification center (§6) — Sentry is for **us**; notifications are for **them**. Both feed off the same failure signals.

### P0-3 · Surface background-job failures (#8) — the reliability keystone
- **Why:** `ad_sync_state.last_error`/`last_ok` already capture every sync failure; today they die in the table.
- **Move:** (a) on the cron/ingest path, when `last_ok` flips false, call `notifyFailure(...)` (§6 store, already built) so the user sees a plain-English "what/why/fix". (b) add a lightweight `/api/health` that reports per-pipeline `last_ok` + `last_synced_date` for ops/uptime monitors.
- **Verify:** force a sync error (e.g. revoke token in a test account) → notification row appears + `/api/health` shows the pipeline red.

### P0-4 · Legal + trust pages, and stop the false claim (#15)
- **Why:** the hero currently *asserts* a Privacy Policy that does not exist, and every footer "legal" link goes to `/signup`. That is both a trust break and a latent compliance problem the moment a real EU/CA user signs up.
- **Move:** create real `/privacy`, `/terms`, `/cookie-policy`, and a data-deletion/contact path; point the footer + hero at them. Use reviewed boilerplate; **flag for legal review — do not invent binding legal text.** At minimum, make the hero claim true or remove it *today* (that part is not "wait for legal").
- **Verify:** every footer/hero legal link resolves to a real page; no link points to `/signup`; account-deletion path documented.

### P0-5 · Confirm the automation actually runs (#11)
- **Why:** a daily job that silently never fires is worse than no job — it manufactures false confidence.
- **Move:** confirm `CRON_SECRET` is set in Vercel prod (Layer-2 evidence suggests it is — a live competitor run authenticated — but confirm for the *sync* cron specifically). Confirm the Hobby plan permits the `vercel.json` cron cadence and each route's `maxDuration`. If Hobby caps `maxDuration`, either lower it or move to Pro.
- **Verify:** trigger the cron with the secret → 200 + a real sync; without it → 401. Check Vercel dashboard shows the cron firing on schedule.

---

## 5. P1 — Pre-launch hardening (🟡 → 🟢; do before or immediately after launch)

- **P1-1 Tenant-isolation audit (#1):** sweep every `createAdminClient()` read (~60 sites) and confirm each carries a `user_id`/`brand_id`/`org_id` filter. Confirm `competitor_brands` and `notifications` RLS status. Add a `check:*` script that greps admin reads for a tenant filter so this can't regress. *(This is the highest-severity 🟡 — a single unfiltered admin read is a cross-tenant leak.)*
- **P1-2 Notification center UI (#9):** build the bell + activity-feed panel + `/api/notifications` (list/mark-read) on top of the store already built (§6). This is what the user explicitly asked for; foundation done, UI pending.
- **P1-3 Email deliverability (#13):** configure a production SMTP provider in Supabase Auth (Resend/Postmark/SES) so verification + reset emails actually land; verify SPF/DKIM. Route `demo_requests` to a team inbox/Slack so leads aren't dropped.
- **P1-4 Fix the two error-text leaks (#6):** map the Meta error strings in `app/api/brand/discover/route.ts:59,94` to fixed user-safe messages (route the raw text through `humanizeError` from §6 — it already exists).
- **P1-5 SEO baseline (#14):** add `app/robots.ts`, `app/sitemap.ts`, per-page `metadata`, OpenGraph/Twitter tags, `manifest.ts`, favicon set. Keep `/app/*` `noindex`.
- **P1-6 `app/not-found.tsx` (#16):** branded 404.
- **P1-7 CI hardening (#17):** pin Node (`.nvmrc` + `engines`), add standalone `tsc --noEmit` to PR CI, fix the duplicate `0007_` migration ordinal, fix `.env.local.example` drift (it lists an unused `ANTHROPIC_API_KEY` and omits `GEMINI_API_KEY` + ~10 real vars).

---

## 6. The Notification Center (dedicated design — foundation shipped this session)

The user's ask: *"whatever task is going on, a notification runs in parallel showing the user what's
happening; if something breaks, show intelligently what's broken, what's not working, and why — a
notification center maintained for every user."*

### What is built + verified now (🟢)
- **`public.notifications` table** — per-user, org/brand scoped, dedupe-keyed, RLS deny-by-default. Applied live + mirrored in `supabase/migrations/0013_notifications.sql`.
- **`lib/notifications/humanize.ts`** — the "intelligent" half: maps real failures to plain English + a next step, and **never leaks a stack trace**. Covers: ScrapeCreators 402 (out of credits), Meta verification (2332002), Meta rate-limit (1504022), token expiry/OAuth, Gemini 429/503, CRON_SECRET unset, metadata-sync partial, and a safe generic fallback.
- **`lib/notifications/store.ts`** — `notify` / `notifyFailure` / `listNotifications` / `unreadCount` / `markRead`, all user-scoped, best-effort (a notification write never breaks the task it reports on).
- **`scripts/check-notifications.ts`** — wired into `check:all`; asserts every mapping + the "no raw error leaks to the user" guarantee.

### What remains (P1-2, executable)
1. **Emit at the seams** (start/finish/fail): cron sync + ingest (`lib/ingest/ad-metrics.ts` where `last_ok` is set), competitor run (`app/api/competitors/run/route.ts` — already returns honest `no_source`/402), analysis/ask. Call `notify({status:'running'})` at start, `success` at end, `notifyFailure(...)` on error, using a `dedupeKey` per ongoing condition so a nightly-failing sync updates one row instead of spamming.
2. **`/api/notifications`** route: list (user-scoped via `getUser()`), mark-read. 
3. **UI**: a bell with unread count in the topbar + a slide-over feed (reuse the `ConfidenceBanner`/severity-pill visual language already in `app/app/page.tsx`; nothing to duplicate — recon confirmed no existing toast/notification system). Supabase Realtime (already a dep) can push live updates; a poll-on-focus fallback is fine for v1.
4. **Verify live**: run a sync in the signed-in app → see a "running" then "done" notification; break a source → see the plain-English failure with the right fix.

**Design principle enforced in code:** the user sees *what/why/what-to-do*; the raw technical string is stored only in `context` for support. This is the difference between "Sync failed: TypeError…" and "Some ad details didn't finish syncing — re-run; it retries automatically."

---

## 7. P2 — Post-launch reliability & the continuous health loop

The prompt asked for hourly/daily/weekly health agents. Grounded design:

- **Continuous (every sync):** the notification center + `/api/health` (P0-3) already make each run self-reporting. This is the real-time layer.
- **Daily health agent (extend the existing `engineering-health.yml`):** build + `tsc` + `check:all` + `scripts/health-check.mjs`, PLUS a new data-health probe: query `ad_sync_state` for any `last_ok=false` older than 24h and any account with `last_synced_date` > `STALE_AFTER_DAYS` (3, per `lib/data-quality.ts`). Alert (email/Slack) on findings. This catches silent staleness across ALL tenants, not just the one looking at their screen.
- **Weekly:** the 90-day baseline refresh (already designed — display window vs 90d fatigue baseline are decoupled) + a cost snapshot (Gemini calls, ScrapeCreators credits, Supabase rows) so the first cost cliff is seen coming, not hit.
- **Restore drill (#18):** once, before or just after launch, do a real Supabase PITR restore into a scratch project and confirm the app boots against it. "We have backups" is not proven until a restore has run.

---

## 8. P3 — Scale (defer until real load; the architecture is already planned)

The 10k-users/day target has its own committed plan (`docs/plans/…` / the "AdBrain at 10,000 users/day"
plan). Its triggers, not calendar dates, decide when to act: managed queue + worker fleet (supersedes the
cron-drain), paid Gemini + fingerprint-once cost control, connection pooler + read replicas + partitioned
fact tables, per-tenant rate/quota fairness. **Do not build any of it before there are users.** The seams
(`lib/ad-source.ts`, a future `lib/queue.ts`/`lib/cache.ts`) exist so P3 is a swap, not a rewrite.

---

## 9. Launch gate (the hard verdict)

**Current verdict: 🔴 DO NOT PUBLIC-LAUNCH YET.** The product functions and its core is well-built, but
five reds are open, and three of them (silent sync failures, no error tracking, no account recovery) mean
we would harm or lose users without knowing. None is large; all are P0.

**Flip to 🟡 (soft/invite launch OK) when:** P0-1 (reset), P0-2 (error tracking), P0-3 (failure
surfacing + /api/health), P0-5 (cron confirmed) are 🟢, and the P0-4 false-claim is removed today.

**Flip to 🟢 (public launch) when:** all of P0 + P1-1 (tenant audit), P1-2 (notification UI), P1-3
(email), P1-5 (SEO), and the P0-4 legal pages are live and each has been **verified in the running app**,
not just merged.

---

## 10. Evidence index (so any claim here is checkable)

- Deployment/infra: `package.json`, `vercel.json`, `next.config.ts`, `.github/workflows/{ci,engineering-health}.yml`, `.env.local.example`.
- Auth/security/tenancy: `proxy.ts`, `app/(auth)/*`, `lib/tenancy/{resolve,access}.ts`, `lib/supabase/{admin,server}.ts`, migrations `0009`–`0013`.
- Payments/email/SEO/legal: repo-wide grep (no billing code), `app/layout.tsx` (metadata), footer/hero in the marketing pages, `app/api/leads/route.ts`, `demo_requests`.
- Reliability/observability/notifications: `lib/ingest/ad-metrics.ts`, `app/api/cron/sync/route.ts`, `supabase/migrations/0008_daywise_ingestion.sql` (`ad_sync_state`), `lib/data-quality.ts`, `lib/meta-sync.ts`, `app/{global-error,app/error,app/loading}.tsx`, `lib/cockpit/from-store.ts`, `lib/rate-limit.ts`, `lib/notifications/*` (new).

*Anything marked `VERIFY` (Hobby maxDuration/backup tier/CRON_SECRET-for-sync) is a fact to confirm in the Vercel/Supabase dashboards before flipping the relevant scorecard row green — not an assumption baked in.*
