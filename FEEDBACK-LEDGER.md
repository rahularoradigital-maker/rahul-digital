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

---

## Part C — Your open action items (only you can do these)

| # | Item | Effect | Status |
|---|---|---|---|
| C1 | Set **`CRON_SECRET`** in Vercel | Activates the daily background cache pre-warm (helps first-load speed / the 504) | 🔴 your side |
| C2 | (Optional) Connect **Shopify** | Unlocks true store economics (MER, nCAC) | 🔴 your side |

---

## Part D — Known issues still open

- **Cold-pull `504`** on Hobby's tight function timeout (first fully-cold cockpit load). Mitigation:
  keep cache warm (C1) or a background-sync tier.
- **Creative → Diversity "format" shows Unknown** for all ads (own-ad creative-asset fingerprint not
  populating in production).
- **Gated "coming soon"** screens: Creative → Brand Brain, Concepts, semantic Diversity; Market →
  Voice. Decision pending: build them (they share one Gemini decoder) or remove the placeholders.

---

*This ledger is updated as new feedback comes in and re-shared as a download on request.*
