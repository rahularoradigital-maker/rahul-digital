# Google Ads brain — architecture & grounding

Status: logic layer built + gated + deployed (demo mode). Real Google Ads API pending credentials.
Last updated: 2026-08-31.

Google is **not** Meta. There is no single creative funnel. A Search account lives or dies on impression
share + Quality Score; a Performance Max / Shopping account on conversion value at a target ROAS; a Video
account on view rate. So the Google brain is its **own track** — separate folder, separate metrics, separate
decision engine — kept apart from the Meta brain per Rahul's instruction.

## Separation decision: folder, not branch

Google lives in `lib/google/**` + `components/app/google/**`, entirely separate from the Meta code, but on
the **same branch / same deployable app**. A separate *branch* was rejected: the Platform selector (Facebook
/ Google / Both) needs both platforms present in one running dashboard, which a branch fork makes impossible.
Folders give clean separation and stay reversible; the real Google Ads client swaps in behind the same files
with zero UI change (ADR-0002 adapter pattern).

```
lib/google/
  campaign-types.ts   taxonomy (Search/PMax/Shopping/Display/Demand Gen/Video/App) + north-star per type
  thresholds.ts       every number, tagged official vs heuristic, each with a source URL
  types.ts            Google-native snapshot (impression share, Lost IS, Quality Score, bid strategy...)
  metric-priority.ts  "most effective metrics on top" — ordered stack per type + spend-weighted account lead
  diagnosis.ts        the deterministic engine (R1–R15): routes each campaign to ONE correct action
  demo-account.ts     deterministic demo account (DEMO mode) spanning every rule
  native.ts           assembles the dashboard's Google-native view (lead metrics + ranked findings)
  cockpit.ts          runs the shared brain over Google data for the topline health/ROAS cockpit
google-source.ts      AdSource impl (stub/DEMO now; real GAQL client later)
components/app/google/google-native-panel.tsx   the on-screen panel (levers on top, then ranked actions)
scripts/check-google-*.ts                        node gates (in check:all)
```

## Campaign types & the metric that leads each (north-star)

| Type | North-star | Decisive diagnostics |
|---|---|---|
| Search | Cost/conversion (CPA) at target | Lost IS (budget) vs (rank), Quality Score, IS, CTR, conv rate |
| Performance Max | Conversion value at target ROAS | Click share, new-customer value, asset-group performance |
| Shopping | ROAS | Benchmark CTR/CPC, IS, click share |
| Display | Conversions at target CPA | Display IS, viewable CTR, view-through conv |
| Demand Gen | Conversions (incl. view-through) at target CPA | VTC, unique reach, video views |
| Video (YouTube) | View rate (consideration) or conversions (action), per goal | Quartiles, CPV, VTC |
| App | Cost per install / in-app action | Install volume, in-app conv rate, tROAS attainment |

The dashboard's Google section leads with the metrics of the campaign type carrying the **most spend**
(spend-weighted), so a Shopping-heavy account leads with ROAS and a Search-heavy one with impression share +
Quality Score. Source: Google campaign-type docs (see thresholds.ts + below).

## The deterministic decision engine (no AI)

Every rule routes to ONE action and is traceable to a sourced behavior. Crucially, the engine **refuses** to
recommend a bid/budget change while a campaign is in its Smart Bidding learning phase — that change would
reset learning and make things worse.

| Rule | Condition | Action |
|---|---|---|
| R1 | Lost IS (budget) > 10% AND meeting target | Raise budget in ≤20% steps (winner capped) |
| R2 | Lost IS (budget) > 10% AND below target | Do NOT scale — fix efficiency first |
| R3 | Lost IS (rank) > 20% AND budget not the cap | Fix Ad Rank (bid/QS/assets), not budget |
| R4/R5 | <~1/4 of the 15-conv/30d floor in 7d, OR changed <14 days ago | Hold — still learning; freeze bid/budget/target |
| R7 | Learning status stuck > 14 days | Flag misconfiguration |
| R8/R9 | Quality Score ≤ 4 on spend | CPC penalty; fix the weak component; rank by cost × (7 − QS) |
| R14 | Bid strategy = Enhanced CPC | Forced migration (eCPC sunset 2025) |
| R15 | Distinct conversion values AND ≥ 50 conversions AND not value-based | Eligible for Target ROAS |

Budget-vs-rank asymmetry (the core lever): raising **bids** to fix a *budget* loss just exhausts budget
faster; raising **budget** to fix a *rank* loss buys more losing auctions. The engine never confuses them.

## Thresholds — official vs heuristic

Official (Google-published): tROAS/tCPA need ≥15 conversions / 30 days; App budgets ~50× tCPI or ~10× tCPA;
Search IS + Lost IS(budget) + Lost IS(rank) ≈ 100%. Heuristic (labeled as such in code + UI): Lost IS(budget)
>10–20% = budget-capped; Quality Score 7–10 good / ≤4 poor; single budget/target change ≤20% to avoid a
learning reset; ~50 conv for a reliable value read. Every constant carries its source URL in `thresholds.ts`.

## Recent Google Ads changes we accommodate (2024 → early 2026)

Condensed from ~52 sourced releases. The ones that shape the brain:

- **eCPC sunset (week of 2025-03-31)** — the last semi-manual bid strategy is gone → R14 forced-migration flag.
- **Smart Bidding Exploration (2025)** — tROAS now chases new query categories; target-setting matters more.
- **AI Max for Search (2025)** — keywordless + broad-match expansion inside Search; DSA is migrating into it
  (auto-migration Feb 2027). New "search term controls" to manage.
- **PMax controls** — campaign-level negative keywords (self-serve, up to 10,000), channel-level reporting,
  search-terms reporting, high-value new-customer + retention goals, brand guidelines, 50 search themes.
- **Demand Gen** replaced Discovery (all upgraded ~Mar 2024); lookalike floor dropped to 100; channel
  controls, product feeds, Target CPC.
- **Merchant Center Next** migration complete; **Content API for Shopping sunset 2026-08-18** → use Merchant API.
- **Measurement** — Data Manager + Confidential Matching, Google tag gateway (first-party), Meridian MMM,
  "Conversions (Platform Comparable)" for cross-platform benchmarking.
- **Creative AI** — Imagen-3 asset generation, in-platform image editing, Asset Studio.
- **New surfaces** — ads in AI Overviews / AI Mode, shoppable CTV, Shopping in Google Lens.

Full sourced list with URLs lives in the research notes; key official recaps:
support.google.com/google-ads/answer/15639790 (2024) and /16756291 (2025).

## What's built vs pending

Built (demo mode, gated, live): taxonomy, metric priority, thresholds, the R1–R15 engine, the demo account,
the on-screen Google-native panel, and the platform selector wiring (Facebook / Google / Both).

Pending (needs credentials): the real Google Ads client. To go live on a real account (e.g. a client's) we
need four things — an **approved Google Ads developer token**, an **OAuth client (id + secret)**, a **refresh
token**, and the **login-customer-id** (MCC). When those land, `google-source.ts` swaps DEMO for real GAQL and
`native.ts` swaps `demoGoogleAccount()` for the fetched snapshot — nothing else changes.
