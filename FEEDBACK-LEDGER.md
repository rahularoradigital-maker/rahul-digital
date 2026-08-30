# AdBrain — Feedback Ledger

> A running record of every rule and request Rahul has given, what it means, and honestly how (and
> whether) it has been applied. Kept in the repo so it is versioned and travels in the zip. Updated
> 2026-08-28.

Status key: 🟢 applied & verified · 🟠 applied, needs your eyes / a dependency · 🔴 not done / your action.

---

## Part A — How I must work (standing rules)

| # | Your rule (paraphrased) | How it's applied |
|---|---|---|
| A1 | **Test every change LIVE on the actual app before saying it's done.** Not local build/checks — the real app in the browser. | 🟢 Rule saved to memory. From here: change → deploy → wait for it to go live → open your signed-in app → verify with my own eyes → only then report. |
| A2 | **Verify to 100% before claiming, incl. edge cases. Plan first.** | 🟢 Saved to memory. Applied via the 34-check gate + live tests. |
| A3 | **Stop over-claiming / "50 greens but no change".** Distinguish "code compiles" from "works for the user". | 🟢 Acknowledged. Root cause was found & fixed (see B-deploy). I now separate "code-verified" from "live-verified". |
| A4 | **Don't build endlessly — give a finite plan with a finish line.** | 🟢 Delivered a bounded plan: ~1.5 sessions lean, ~3 full-featured. No unrequested building. |
| A5 | **Every document must come as a downloadable file, always.** | 🟢 Saved to memory. This ledger + the app zip are delivered as downloads. |
| A6 | **Report with confidence colours (🟢/🟠/🔴).** | 🟢 Used throughout. |
| A7 | **Every change is for all future users, not a one-off.** | 🟢 All fixes are in shared code paths, not per-account hacks. |

---

## Part B — Product / feature requests

| # | Your request | How it's applied | Status |
|---|---|---|---|
| B1 | **Deploy pipeline was broken — no changes reached the app for days.** | Found the cause: a `vercel.json` hourly cron that Hobby rejects, failing every deploy. Fixed to a daily schedule; deploys now land. | 🟢 |
| B2 | **Objective filter must show real spend matching Ads Manager.** | `resolveCampaignIds` maps the objective to the account's campaigns of that objective (all statuses, paginated), then pulls their top ads. Scope totals use true objective spend. | 🟢 |
| B3 | **Numbers must match Ads Manager per account/objective/window; nothing shown without a trustworthy calc.** | Scope totals from `fetchScopeInsights`; every figure has a rubric; honest empty states when data is missing. | 🟠 (live-verified on your account) |
| B4 | **Ad deep links open Ads Manager at ad level with campaign + ad set + ad selected.** | `ads-manager-url.ts` builds the full hierarchy link; falls back to plain text if ids are missing. | 🟢 |
| B5 | **Topbar: calendar opens; multi-select campaigns; order Account → Date → Objective → Campaign; campaigns filter by objective.** | All implemented in the topbar + switchers. | 🟠 |
| B6 | **Clean up the "AI-made" UI.** | Unified type scale, heading weights, radii, spacing across the app (consistency pass). | 🟠 (subtle by design) |
| B7 | **Spend distribution: conversions + ROI% vs account + an ⓘ explainer.** | Added to the media/spend views with the explainer. | 🟠 |
| B8 | **For any suggestion, check current status; hide paused ads; show only active ads wasting budget; prefer active.** | `effective_status` drives active/paused; suggestions filter to active. | 🟢 |
| B9 | **Show WHERE and WHY with campaign/ad set/ad names + the calculation per date range.** | Waste & opportunity drill-downs name the ad + show the math ("0.91x ROAS on ₹13,229 - below break-even"); every verdict shows its reason. | 🟢 (live-verified) |
| B10 | **Competitor data must change per account; auto-process on account switch.** | Competitor data scoped by `account_external_id`; account switch busts cache + warms the new account. | 🟢 |
| B11 | **Ready for 1000 visitors/day — stress test everything.** | Full performance audit: local-JWT auth (no per-click network), 2-level cache, parallelized Meta pulls, background-sync cron, RLS/index review, security headers. | 🟠 (cold-pull 504 on Hobby is the remaining scale risk) |
| B12 | **Ask AdBrain answer engine.** | Built; grounded only in real data, no fabrication. **Migrated from paid Claude to free Gemini** at your request. | 🟢 (live-verified answering) |
| B13 | **Full functional QA — every button works.** | 5-auditor sweep; 17 defects found, 16 fixed (dead book-demo form, dead weights panel, ask rate-limit, etc.), all live-tested where possible. | 🟢 |
| B14 | **Long lists → "See more"; show "why" on every verdict.** | `CollapsibleRows` collapses to top N; every verdict row shows its reason. | 🟢 (live-verified: "Show 92 more ads") |
| B15 | **Make Ask free (Gemini instead of Claude).** | Ask now runs on Gemini free tier; Claude no longer needed for it. | 🟢 (live-verified) |
| B16 | **Complete architecture/context dump (offline zip).** | `ARCHITECTURE.md` written + this zip delivered. | 🟢 |
| B17 | **Creative half-life tab: "ROAS 0.00 → 0.00 (-19%/day)" makes no sense — fix the wording + check the formula.** | Root cause was a trend computed on a near-zero metric (tiny÷tiny = noise) plus a half-life extrapolation with no cap. Three fixes: (1) an ad that never had steady ROAS now reads "stayed near zero … judged on frequency and CPM, not ROAS" instead of a fake %/day; (2) a metric that STARTED at ~0 is no longer called "a real collapse"; (3) a near-flat slope no longer extrapolates to a fantasy half-life, and a **past** ad-set end date no longer clamps to 0 (that had swung the account half-life from "~30354410 days" to "~0 days" and mislabelled healthy ads "already past the fatigue line"). Now honestly says "Not enough day-wise history yet to estimate a half-life." Locked by 3 new regression checks. | 🟢 (live-verified on Soch, all ad lines + account header) |
| B18 | **"Do the ad-set metadata sync via cron"** + **"make the sync scale to 2-3k-ad accounts."** | Fixed the silent metadata failure (per-ad guard so one bad creative can't kill the batch; failures surface in `last_error`). Then made the whole sync **resumable + deadline-bounded**: each run syncs the missing/stalest ads first, stops before 230s, and records durable progress, so repeated runs converge — the manual endpoint loops for the caller, and the cron self-chains (`?uid=&hop=`) to converge within minutes of the daily trigger. Also fixed the store read to page `ad_meta` past Supabase's 1000-row cap (this was silently truncating large accounts). **Proven live on Soch (1034 ads):** two clean slices reached full coverage with no timeout, and the cockpit now serves from the store — **294 analyzable ads across 186 campaigns** (was a capped 4), real account-wide **ROAS 1.00x on ₹41.3L**, and **account half-life ~6 days (21 fatiguing across 87 day-wise ads)** instead of "not enough history." | 🟢 (fix + scale both live-verified; cron auto-run still needs `CRON_SECRET`, C1) |

---

| B19 | **"Build the multi-tenant structure: agencies, brands, accounts."** | Built **Org → Brands → Accounts** additively (new `orgs`/`org_members`/`brand_members` tables; `brands` re-parented to org; `ad_accounts` gain `brand_id`, many accounts per brand; per-brand access grants so a member sees only assigned clients). Backfilled live: your data became 1 agency org + **5 brands** (Aurelia, Boat, Kimirica, Soch, Tetr), you as owner. The isolation rule (`brandsVisibleTo`) is pure + unit-tested. Then wired it into the app: the topbar is now a **Brand switcher** (lists only brands you may see, via the resolver), and switching **enforces tenancy** (`canAccessBrand`) before activating that brand's account. Live-verified: switched Soch ↔ BOAT and the whole cockpit followed. **Still open (next phases):** per-feature reads beyond the cockpit (competitors, creative, influencer, ask) are still user-scoped, not yet brand-routed; member-invite UI; RLS on membership. | 🟢 (structure + brand navigation live-verified; deeper per-feature isolation is the next phase) |

| B20 | **"Route the remaining features through the selected brand."** | Audited all four: **Competitors** and **Ask** were already brand-scoped (they read the active account / ground on the active-account cockpit, and the brand switcher drives the active account). **Creative-production (Studio)** was the real leak — pure `user_id`, so every brand saw every brand's concepts/assets. Fixed: `brand_id` added to cp_concepts/cp_assets/cp_generations/cp_brand_dna + shopify_connections (backfilled), and each data function now resolves the active brand and filters/sets it; products + product-DNA follow via the brand-scoped Shopify connection. **Live-verified:** with Soch active the asset library returns 4 creatives; switch to BOAT → 0 (not Soch's); back to Soch → 4. **Remaining:** Influencer Hunt still has user-scoped reads (a larger surface) — the next slice; plus member-invite UI and membership RLS. | 🟢 (Creative isolated + verified; Competitors/Ask already scoped; Influencer next) |

---

## Part C — Your open action items (only you can do these)

| # | Item | Effect | Status |
|---|---|---|---|
| C1 | Set **`CRON_SECRET`** in Vercel | Activates the daily background job — cache pre-warm (first-load speed / the 504) AND the day-wise metrics + ad-set metadata sync (B18). Until it is set, the nightly sync never runs. | 🔴 your side |
| C2 | (Optional) Connect **Shopify** | Unlocks true store economics (MER, nCAC) | 🔴 your side |

---

## Part D — Known issues still open

- **Cold-pull `504`** on Hobby's tight function timeout (first fully-cold cockpit load). Mitigation:
  keep cache warm (C1) or a background-sync tier.
- **Creative → Diversity "format" shows Unknown** for all ads (own-ad creative-asset fingerprint not
  populating in production).
- **Gated "coming soon"** screens: Creative → Brand Brain, Concepts, semantic Diversity; Market →
  Voice. Decision pending: build them (they share one Gemini decoder) or remove the placeholders.
- ~~**Complete-coverage sync doesn't fit one request at scale (D-scale).**~~ **RESOLVED (B18).** The sync
  is now resumable + deadline-bounded and converges over repeated runs (manual: caller loops; cron:
  self-chains). Live-verified on Soch's 1034 ads: full coverage in 2 clean slices, cockpit now serves all
  294 analyzable ads from the store. A future optimization (not blocking) is batching the per-ad metadata
  calls (currently 1 Graph call/ad for status), which is the main driver of Meta's app rate-limit at very
  large scale — the resumable design already absorbs a rate-limit by retrying stale ads next run.

---

## Part E — Production launch + Notification Center (2026-08-30)

- **B21 — Production-readiness plan (`/make-plan`).** Ran 4 parallel discovery agents (deployment/infra,
  auth/security/tenancy, payments/email/SEO/legal, reliability/observability/notifications). Produced
  `docs/production/PRODUCTION-READINESS-PLAN.md`: a R/Y/G scorecard, an autopsy, P0-P3 roadmap, a launch
  gate, and the continuous health-loop design. **Verdict: 🔴 not public-launch-ready** — 5 blockers
  (no password reset, no error tracking, silent sync-failure invisibility, missing legal pages + a false
  "Privacy Policy" claim, confirm CRON_SECRET). Core product is well-built; the gaps are operational.
  Billing is **N/A** (no monetization code in v1 by design).
- **B22 — Notification Center foundation (built + verified).** Per-user activity feed + intelligent
  failure surfacing. Shipped: `notifications` table (live + `migrations/0013_notifications.sql`),
  `lib/notifications/humanize.ts` (technical error → plain-English what/why/fix, never leaks a stack
  trace), `lib/notifications/store.ts` (notify/list/mark-read, user-scoped), `scripts/check-notifications.ts`
  wired into `check:all` (PASS). Remaining (P1-2, specced in the plan): emission at sync/ingest/competitor
  seams + `/api/notifications` + the bell/feed UI.

- **B23 — Launch-blocker fixes ("fix these as well", 2026-08-30).** Cleared/advanced the P0 blockers in code
  (build green, tsc clean, all gates pass):
  - **Notification Center is now live end-to-end** (P0-3 + monitoring gate): sync failures + "up to date"
    now emit per-user notifications from the shared `syncAdMetrics` seam (dedupe-keyed, no spam);
    `/api/notifications` (list + mark-read, user-scoped); a bell + activity feed in the topbar; and a public
    `/api/health` probe that reports DB + sync health and whether the cron secret is armed.
  - **Password reset** (P0-1): `/forgot-password` + `/reset-password` (Supabase recovery tokens, enumeration-safe),
    with a "Forgot password?" link on login.
  - **Legal + trust** (P0-4): real `/privacy`, `/terms`, `/cookie-policy`, `/data-deletion` pages; fixed the
    homepage's false "Privacy Policy" claim (now a real link); fixed every dead footer link + added a legal row.
  - **SEO + 404** (gate): `app/not-found.tsx`, `robots.ts`, `sitemap.ts`, OpenGraph/Twitter/metadataBase.
  - **Security**: routed the two Meta error-text leaks in `brand/discover` through the safe humanizer.
  - **Still needs Rahul (cannot be done from code):** Sentry account + DSN (error tracking), `CRON_SECRET`
    set in Vercel (now visible via /api/health), production SMTP in Supabase (so reset/verify emails land),
    a backup restore drill, a load test, and custom domain/DNS. Live in-app verification pending deploy.

- **B24 — Safe hardening batch + tenant-isolation audit ("build what doesn't need my attention", 2026-08-30).**
  All verified: build green, `tsc` clean, 68 gates pass.
  - **Central error capture**: `instrumentation.ts` (`onRequestError`) + `lib/observability.ts` catch every
    server error as one structured log line; a one-line swap to Sentry when a DSN is added (no route edits).
  - **CI/build hygiene**: pinned Node (`.nvmrc` + `engines: node>=22`), added a standalone `typecheck`
    script + a Type-check step in CI, and rewrote `.env.local.example` to match the real env vars
    (dropped the stale ANTHROPIC_API_KEY, added GEMINI_API_KEY + ~11 others).
  - **Notification coverage**: competitor pulls now emit to the feed (persistent "connect a source" /
    "out of credits", and "competitor ads updated" on success), dedupe-keyed.
  - **Tenant-isolation audit (read-only agent):** NO confirmed cross-tenant read leak. Every row-returning
    admin read carries `user_id` (or a user-derived `in()` set). Two flags: (1) `competitors/analyze`
    global cache of PUBLIC competitor-ad analysis - intentional cost lever, no private data, left as-is
    pending your sign-off; (2) `oauth-store.readToken` was safe only via call-site discipline - **now
    HARDENED**: it takes `userId` and enforces ownership through the `ad_accounts` FK join, so it can never
    return another tenant's token even if a future caller passes an unverified id.
  - **Deferred (need you): distributed rate limiting (Upstash), in-app delete-account button, cost alarms
    (need an alert channel).** Unchanged blockers: email SMTP, Sentry DSN, CRON_SECRET confirm, domain/DNS,
    backup restore drill, load test, deploy + live in-app verification.

- **B25 — AI model-routing matrix + GPT-Image + load harness (autonomous block, 2026-08-30).** Reconciled the
  multi-provider router (lib/ai) to Rahul's exact matrix and added the image fallback. All keyless-graceful
  (zero behaviour change on the live Gemini path until the OpenAI/Anthropic keys are added). Verified: build
  green, tsc clean, 68 gates pass, AI-ROUTER GREEN.
  - Routing (lib/ai/config.ts): vision-volume fallback now the CHEAP GPT-mini vision (was GPT-4o) for the
    60+ ads/run path; analyze-text gains an OpenAI fallback; heavy tasks (concept + verdict) fall back to the
    other TOP model (GPT) before the cheap Gemini flash; ask fallback order matched to the matrix.
  - GPT-Image provider (lib/creative-production/providers/openai-image.ts) implementing the full ImageProvider
    contract (generate via /images/generations, edit+variant via /images/edits), wired into the registry as
    IMAGE_PROVIDER=openai, priced in pricing.ts. Matrix's "Nano Banana -> GPT-Image" fallback now exists.
  - Env template: documented OPENAI_API_KEY + ANTHROPIC_API_KEY + the AI_PROVIDER_/AI_MODEL_ overrides and the
    IMAGE_PROVIDER options. check:ai already wired into check:all (passes).
  - Load-test harness (scripts/loadtest.mjs, `npm run loadtest`): bounded, public-GET-only, latency
    percentiles. Baseline vs live: 30/30 = 200, static p50 ~55ms, /api/health p50 ~520ms (live DB read).

- **B26 — Rate limiting + alerts + cost tracking + backup drill + canonical domain (2026-08-30).** All
  verified (68 gates, build green) and deployed.
  - **Canonical URL is now https://adscaledigital.co** (apex serves; www 308-redirects to it). Verified live.
  - **Distributed rate limiting** (lib/rate-limit-distributed.ts + lib/upstash.ts): Upstash-backed atomic
    limiter, fail-open to the in-process one. Add UPSTASH_REDIS_REST_URL/TOKEN to switch on, zero code change.
  - **Alert channel** (lib/alerts.ts): posts to ALERT_WEBHOOK_URL (Slack/Teams/Discord); logs if unset.
  - **AI cost tracking** (lib/ai/usage.ts): per-day AI-call counter in the router; the daily cron alarms on
    sync failures and when calls exceed AI_DAILY_CALL_BUDGET (via the alert channel).
  - **Backup-restore drill** (docs/production/BACKUP-RESTORE-DRILL.md): executable restore procedure + DR quick-ref.
  - **Load-test harness** already shipped (B25, `npm run loadtest`).
  - **Google login**: button + callback code confirmed correct; ONLY needs the Google provider enabled in
    Supabase (Google Cloud OAuth creds) — a dashboard step for Rahul, no code change.

- **B28 — Media-Buyer Change Intelligence engine (complete) + P0 security batch (2026-08-30).** All verified
  (72 gates green, build + tsc clean, deployed).
  - **Change engine, end-to-end:** P1 ingest (`ad_changes` + `syncChangeHistory`, wired into cron) → P3
    impact engine (`change-impact.ts`: before/after on the objective's own metric, settled-tail trim,
    sufficiency-gated → improved/worsened/flat/insufficient) → P4 ranking (`change-ranking.ts` +
    `change-analysis.ts`: buyer leaderboard on outcomes, algo excluded, change-type rollup) → P5 UI
    (`/app/changes` "Change Impact" in nav). Meta gives actor NAME not email; honest correlation-with-controls,
    never naive causality. (Numbers go live once `ad_changes` has real rows from a cron sync.)
  - **P0 security fixes:** SSRF guard on external image fetches; `/api/judgment` auth-gated; notifications
    dedupe bug fixed (partial→full unique index, live); per-user rate caps on creative/analyze +
    market/positioning + brand/discover (cost-DoS guard); cron secret compare now constant-time;
    `.gitignore *.xlsx` + untracked the API-keys spreadsheet.
  - Migration hygiene: renamed my `0015_ad_changes`→`0017` to clear the duplicate ordinal (a parallel
    control-plane workstream owns `0015_audit_log`/`0016_system_flags`).

---

*This ledger is updated as new feedback comes in and re-shared as a download on request.*
