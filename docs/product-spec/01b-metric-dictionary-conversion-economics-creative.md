# [01b] Master Metric Dictionary — E Conversion · F Economics · G Creative

Part of the Master Metric Dictionary [01]. Sibling parts cover A-D (delivery/attention/engagement/click),
H-N (fatigue/diversity/scaling/incrementality/competitive/predictive/data-quality). Every metric here
traces to a row in [02] Meta Data Mapping and answers the **10 questions** with a **fact label** and a
**named decision**. A metric that changes no decision is tagged `VANITY — not primary`.

## Reading this dictionary
- **Level** — account / campaign / adset / ad / creative (per the brief's data hierarchy).
- **Class** — data-mapping class from [02]: `FETCH` (direct API field) · `CALC` (computed from fetched) ·
  `INFER` (modeled) · `EXTERNAL` (needs Shopify/CRM/finance) · `CANNOT-KNOW`.
- **Fact label** — OFFICIAL PLATFORM FACT · INTERNAL CALCULATION (DERIVED) · RESEARCH-BACKED ·
  INDUSTRY BENCHMARK · MODEL ESTIMATE · INFERENCE · UNKNOWN.
- **Fact-label rule reminder:** a ratio Meta does not itself return (ROAS, CVR, hook rate, MER, marginal
  ROAS) is an INTERNAL CALCULATION or INFERENCE, **never** an "official Meta metric" — even when Ads
  Manager displays it. Meta *does* return `purchase_roas`/`website_purchase_roas` as fields; those are
  FETCH OFFICIAL but still attribution-window-bound (see E-DQ notes).
- **Sample-size / benchmark honesty:** every numeric threshold below is tagged. Where no verified 2026
  benchmark exists it is marked `UNKNOWN / verify at build` rather than invented. The rules engine returns
  an `insufficient_data` sentinel (mirroring `lib/rules/metrics.ts`) rather than a fabricated number.

---

# E · CONVERSION

Conversion metrics answer: *is the click turning into money, and where in the funnel is it leaking?*
All on-platform conversion counts are **attribution-window-dependent and post-iOS-14 partly modeled** —
see **E-DQ** at the end of this section; it applies to every metric E1-E10.

---

### E1 · Purchases / Conversions
**Level:** ad (roll up to adset/campaign/account) · **Class:** FETCH · **Fact:** OFFICIAL PLATFORM FACT

| # | Question | Answer |
|---|---|---|
| 1 | What it measures | Count of the optimized conversion event (e.g. `purchase`) credited to the ad in the attribution window. |
| 2 | Why it matters | The base numerator for every economics metric; the actual business outcome, not a proxy. |
| 3 | Decision it drives | Keep / pause at the ad level; is this ad producing outcomes at all, or only upper-funnel motion? |
| 4 | Inputs | `actions` array, action_type = the account's optimized event; attribution setting (default 7d-click/1d-view). |
| 5 | Formula | Direct field: `actions[action_type='purchase'].value`. |
| 6 | Source | Meta Insights API `actions`. [02] Conversion row. |
| 7 | Comparison window | Day-wise (`time_increment=1`); trend over 7/14/30d. |
| 8 | Min sample | For a stable rate, aim ≥ ~50 conversions before trusting derived CVR/CPA (see E3/E4). Raw count itself has no minimum. `UNKNOWN / verify` for a hard threshold. |
| 9 | Limitations | Window-dependent; view-through inflates; de-duplication across ads is Meta's, not ours. |
| 10 | When NOT to trust | Right after an attribution-setting change; during pixel/CAPI outages; when conversion count < a handful (noise). |

### E2 · Conversion Value (Purchase Value)
**Level:** ad · **Class:** FETCH · **Fact:** OFFICIAL PLATFORM FACT

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Total revenue value attributed to the conversions in E1. |
| 2 | Why it matters | Numerator of ROAS/AOV; distinguishes low-count-high-value from high-count-low-value ads. |
| 3 | Decision | Which ads drive *revenue*, not just orders → scale/protect input. |
| 4 | Inputs | `action_values[action_type='purchase']`, currency, attribution setting. |
| 5 | Formula | Direct field. |
| 6 | Source | Insights API `action_values`. [02]. |
| 7 | Window | Day-wise; 7/14/30d. |
| 8 | Min sample | Same as E1; value is noisier than count because a single large order skews it — inspect distribution, not just sum. |
| 9 | Limitations | Reflects **Meta-attributed** revenue (pixel value), not finance-recognised revenue; refunds/cancellations not netted; currency must be normalised. |
| 10 | When NOT to trust | Pixel value mis-set (e.g. sends cart value not order value); heavy discounting periods; refund-heavy categories. |

### E3 · Conversion Rate (CVR)
**Level:** ad · **Class:** CALC · **Fact:** INTERNAL CALCULATION (DERIVED)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Share of clicks (or LPVs) that convert. |
| 2 | Why it matters | Isolates post-click efficiency; separates a traffic problem from a conversion problem. |
| 3 | Decision | If CTR is fine but CVR is low → landing-page / offer / audience problem, not a creative-hook problem (routes to LP diagnostics, not new creative). |
| 4 | Inputs | purchases (E1); denominator = link clicks *or* landing_page_views (pick and document — LPV-based CVR removes bounce/click-fraud noise). |
| 5 | Formula | `CVR = purchases / clicks` **or** `purchases / landing_page_views`. Zero denominator → `insufficient_data` (never 0). |
| 6 | Source | CALC from FETCH fields ([02] Conversion + Attention rows). |
| 7 | Window | 7/14/30d; day-wise too noisy at ad level for most spend tiers. |
| 8 | Min sample | Rate needs volume: rule of thumb ≥ ~100 clicks *and* ≥ ~25-50 conversions before the rate is stable. Exact threshold `UNKNOWN / verify at build` against account variance. |
| 9 | Limitations | Denominator choice changes the number; click≠visit (drop-off, bounce); cross-device conversions land on a different session. |
| 10 | When NOT to trust | Below sample floor; when clicks are inflated by accidental/mis-clicks; when checkout/pixel is broken (CVR reads 0 falsely). |

### E4 · Cost per Acquisition (CPA / Cost per Purchase)
**Level:** ad · **Class:** CALC · **Fact:** INTERNAL CALCULATION (DERIVED)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Ad spend required to produce one conversion. |
| 2 | Why it matters | The efficiency number a buyer watches hourly; direct pause/scale trigger. |
| 3 | Decision | CPA above target for N days at sufficient spend → pause/replace; below target with headroom → scale candidate (hand to Scaling [11]). |
| 4 | Inputs | spend, purchases (E1). |
| 5 | Formula | `CPA = spend / purchases`. Zero purchases → `insufficient_data` (an ad with spend and 0 orders has *no honest CPA* — flag as "spending, no conversions", a different state). |
| 6 | Source | CALC ([02]). Mirrors `cpa()` in `lib/rules/metrics.ts`. |
| 7 | Window | Day-wise + 7/14d; compare to target CPA (an EXTERNAL business input, not a Meta fact). |
| 8 | Min sample | ≥ ~25-50 conversions for stability; below that CPA swings wildly on one order. |
| 9 | Limitations | "Target CPA" is a business/finance input — never a platform benchmark; ignores margin (a $30 CPA is great or fatal depending on AOV/margin → see F). |
| 10 | When NOT to trust | Low conversion count; mid-learning-phase; when target CPA is stale vs current AOV/margin. |

### E5 · Average Order Value (AOV)
**Level:** ad / account · **Class:** CALC · **Fact:** INTERNAL CALCULATION (DERIVED)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Average revenue per attributed order. |
| 2 | Why it matters | Bridges CPA to profitability; a higher-AOV ad can tolerate a higher CPA. |
| 3 | Decision | Set/adjust per-ad or per-audience CPA ceilings; spot premium-vs-discount buyer segments by creative. |
| 4 | Inputs | conversion value (E2), purchases (E1). |
| 5 | Formula | `AOV = conversion_value / purchases`. |
| 6 | Source | CALC ([02]). |
| 7 | Window | 7/30d (day-wise too spiky). |
| 8 | Min sample | ≥ ~25-50 orders; single big order distorts small samples. |
| 9 | Limitations | Meta-pixel AOV ≠ finance AOV (refunds, taxes, shipping, bundles); mix-shift can move AOV without any creative change. |
| 10 | When NOT to trust | Promo periods; pixel value misconfig; tiny order counts. |

### E6 · Landing Page View Rate & Cost per LPV
**Level:** ad · **Class:** FETCH (LPV count) + CALC (rate/cost) · **Fact:** OFFICIAL PLATFORM FACT (count) / INTERNAL CALCULATION (rate)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | LPV rate = landing_page_views / link_clicks; Cost per LPV = spend / LPV. |
| 2 | Why it matters | Exposes the click→page-load leak (slow page, mis-click, redirect fail) that CTR hides. |
| 3 | Decision | Low LPV-rate with healthy CTR → fix page speed / redirect / broken link before touching creative. |
| 4 | Inputs | landing_page_views (action type), inline_link_clicks, spend. |
| 5 | Formula | `LPV_rate = LPV / link_clicks`; `CPLPV = spend / LPV`. |
| 6 | Source | LPV is a FETCH action type; rate/cost CALC ([02] Attention row). |
| 7 | Window | Day-wise + 7d. |
| 8 | Min sample | ≥ ~100 link clicks. |
| 9 | Limitations | Requires the Meta pixel to fire the LPV event (many accounts under-fire it); click≠intent. |
| 10 | When NOT to trust | Pixel LPV not implemented; heavy bot/click noise. |

### E7 · Funnel Step Actions (Add-to-Cart, Initiate Checkout, Add Payment Info)
**Level:** ad · **Class:** FETCH · **Fact:** OFFICIAL PLATFORM FACT (each step count) / INTERNAL CALCULATION (step rates)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Counts (and derived rates) of mid-funnel events between LPV and purchase. |
| 2 | Why it matters | Localises the leak: view→ATC vs ATC→checkout vs checkout→purchase are different problems. |
| 3 | Decision | Route the fix: view→ATC leak = offer/PDP; checkout→purchase leak = pricing/shipping/trust/tech, not creative. |
| 4 | Inputs | `actions` for add_to_cart, initiate_checkout, add_payment_info, purchase. |
| 5 | Formula | Step rate = step_n_count / step_(n-1)_count. |
| 6 | Source | FETCH actions; rates CALC ([02]). |
| 7 | Window | 7/14d (mid-funnel counts small at ad level). |
| 8 | Min sample | Each step needs its own volume; deep steps (add_payment_info) are sparse — often only trustworthy at campaign/account level. |
| 9 | Limitations | Requires full-funnel pixel/CAPI events; de-dupe browser vs server; window-bound. |
| 10 | When NOT to trust | Missing/partial pixel events; low-volume ads (compute at higher level instead). |

### E8 · Click-to-Purchase / End-to-End Funnel Conversion
**Level:** ad / campaign · **Class:** CALC · **Fact:** INTERNAL CALCULATION (DERIVED)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Whole-funnel efficiency from link click to purchase (product of the step rates in E6/E7). |
| 2 | Why it matters | Single summary of post-click health; the denominator context for CVR diagnosis. |
| 3 | Decision | Whether the bottleneck is upstream (get more/better clicks) or downstream (fix the funnel). |
| 4 | Inputs | link clicks, LPV, ATC, IC, purchases. |
| 5 | Formula | `purchases / link_clicks`, decomposed into the E6/E7 step rates. |
| 6 | Source | CALC ([02]). |
| 7 | Window | 7/30d. |
| 8 | Min sample | As E3 (rate needs volume); decomposition needs volume at each step. |
| 9 | Limitations | Multiplicative estimate assumes independent steps and single-session paths — cross-device/return-visit paths break the chain. |
| 10 | When NOT to trust | Sparse mid-funnel steps; multi-session buyers dominate the category. |

### E9 · Attribution-Window Conversion Split (7d-click / 1d-view / 1d-click)
**Level:** ad / account · **Class:** FETCH · **Fact:** OFFICIAL PLATFORM FACT (per window) — but window choice is a *judgement*, not a fact

| # | Question | Answer |
|---|---|---|
| 1 | Measures | The same conversions counted under different attribution windows. |
| 2 | Why it matters | View-through vs click-through credit changes ROAS materially; comparing ads on different windows is a classic error (AUTOPSY: attribution error). |
| 3 | Decision | Which credit model to standardise on for pause/scale decisions; how much of "performance" is view-through. |
| 4 | Inputs | `action_attribution_windows` = [7d_click, 1d_view, 1d_click]. |
| 5 | Formula | Report each window separately; view-through share = 1d_view_only / total. |
| 6 | Source | FETCH ([02]). |
| 7 | Window | Any; must be **consistent** across compared entities. |
| 8 | Min sample | As E1. |
| 9 | Limitations | 1d-view credit is weakly causal; windows are not additive (overlap); default changed historically. |
| 10 | When NOT to trust | Ever, when comparing two entities set to different windows — normalise first. |

### E10 · Modeled / Under-reported Conversion Gap (iOS & privacy)
**Level:** account (best) / ad · **Class:** INFER · **Fact:** MODEL ESTIMATE / INFERENCE

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Estimated share of true conversions that Meta models or misses post-ATT (statistical modeling + signal loss). |
| 2 | Why it matters | On-platform conversions are partially modeled and generally under-count vs finance; every economics view must flag this. |
| 3 | Decision | How much to trust Meta ROAS vs blended/MER (F); whether to weight toward MER for scale decisions. |
| 4 | Inputs | Meta-reported conversions vs a truth source (Shopify orders) over the same window. |
| 5 | Formula | `gap = (external_orders − meta_attributed_orders) / external_orders` (directional only). |
| 6 | Source | INFERENCE; needs EXTERNAL truth to estimate ([02] Hard limits). |
| 7 | Window | 7/30d aligned windows. |
| 8 | Min sample | Account-level and stable spend; not reliable per-ad. |
| 9 | Limitations | Attribution ≠ incrementality; the gap mixes modeling, cross-channel overlap, and organic — do not treat as a clean correction factor. |
| 10 | When NOT to trust | As a per-ad multiplier; during tracking changes; small windows. |

> **E-DQ (applies to all of E):** conversion counts are attribution-window-bound and, post-iOS-14/ATT,
> partly **modeled** — flag "attribution limits apply" on every economics surface ([02] Hard limits).
> Meta-attributed revenue is **not** finance-recognised revenue. The moment a decision needs *true*
> profitability, cross to Section F's EXTERNAL metrics, which say "needs external source" rather than
> fabricate a number.

---

# F · ECONOMICS

The profitability layer. **Meta alone cannot compute the metrics that matter most here.** On-platform
ROAS (F1) is the only economics metric Meta can produce unaided; everything from F2 onward is `EXTERNAL`
(needs Shopify/CRM/finance) or `INFERENCE` (needs experiments/MMM). Surfacing any of F2-F19 as a hard
number from Meta data alone is a fabrication — show "needs external source" or a clearly-tagged estimate.

---

### F1 · On-Platform ROAS
**Level:** ad · **Class:** CALC (also FETCH as `purchase_roas`) · **Fact:** INTERNAL CALCULATION (DERIVED); the raw `purchase_roas` field is OFFICIAL but window-bound

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Meta-attributed revenue per dollar of ad spend. |
| 2 | Why it matters | The universal first-look efficiency ratio; drives most day-to-day pause/scale intuition. |
| 3 | Decision | Rank/triage ads; but **never scale on ROAS alone** — pair with margin (F7) and marginal ROAS (F15). A $500/day @4x can beat a $50/day @7x (brief). |
| 4 | Inputs | conversion value (E2), spend. |
| 5 | Formula | `ROAS = revenue / spend`; zero spend → `insufficient_data`. Mirrors `roas()` in `lib/rules/metrics.ts`. |
| 6 | Source | CALC / FETCH `website_purchase_roas` ([02] Conversion row). |
| 7 | Window | Day-wise + 7/14/30d; consistent attribution window (E9). |
| 8 | Min sample | ≥ ~25-50 conversions; below that ROAS is one-order noise. |
| 9 | Limitations | Uses Meta-attributed (partly modeled, under-reported) revenue; ignores margin, refunds, new-vs-returning; **not** incremental. |
| 10 | When NOT to trust | Low conversions; view-through-heavy window; retargeting/branded audiences (harvests existing demand → flattering, non-incremental). |

### F2 · Blended ROAS
**Level:** account · **Class:** EXTERNAL · **Fact:** INTERNAL CALCULATION over EXTERNAL data

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Total store revenue / total Meta spend (or total ad spend), ignoring attribution. |
| 2 | Why it matters | Immune to attribution modeling; a sanity check against inflated on-platform ROAS. |
| 3 | Decision | Account-level "are we actually growing profitably?"; caps trust in F1 when the two diverge. |
| 4 | Inputs | Shopify/finance total revenue (EXTERNAL), Meta spend. |
| 5 | Formula | `blended_ROAS = total_revenue / meta_spend`. |
| 6 | Source | EXTERNAL ([02] Economics row). |
| 7 | Window | Daily/weekly aligned. |
| 8 | Min sample | Account-level; needs stable channel mix. |
| 9 | Limitations | Includes organic/returning/other-channel revenue → over-credits Meta; not per-ad; confounded by promos/email/other paid. |
| 10 | When NOT to trust | When other channels or organic move; per-ad decisions; without a matched revenue window. |

### F3 · MER (Marketing Efficiency Ratio)
**Level:** account · **Class:** EXTERNAL · **Fact:** INTERNAL CALCULATION over EXTERNAL data

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Total revenue / total marketing spend (all channels). |
| 2 | Why it matters | The CFO/operator north-star for paid efficiency, attribution-independent. |
| 3 | Decision | Overall spend-up / spend-down posture; the guardrail scale decisions must respect. |
| 4 | Inputs | total revenue (EXTERNAL), total marketing spend (EXTERNAL). |
| 5 | Formula | `MER = total_revenue / total_marketing_spend`. |
| 6 | Source | EXTERNAL finance ([02]). |
| 7 | Window | Weekly/monthly (daily too noisy). |
| 8 | Min sample | Account-level, multi-week. |
| 9 | Limitations | Blends all channels & organic → cannot attribute a change to Meta; lags; mix-shift sensitive. |
| 10 | When NOT to trust | For per-channel/per-ad decisions; during multi-channel changes. |

### F4 · CAC (Customer Acquisition Cost)
**Level:** account / campaign · **Class:** EXTERNAL · **Fact:** INTERNAL CALCULATION over EXTERNAL data

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Spend per acquired customer (all customers, new+returning unless split). |
| 2 | Why it matters | Core unit economics; pairs with LTV (F8). |
| 3 | Decision | Whether acquisition is sustainable vs LTV; budget posture. |
| 4 | Inputs | spend, customer count (EXTERNAL — Meta cannot reliably tell new customers apart). |
| 5 | Formula | `CAC = spend / customers`. |
| 6 | Source | EXTERNAL Shopify/CRM ([02]). |
| 7 | Window | Weekly/monthly. |
| 8 | Min sample | Account-level. |
| 9 | Limitations | "Customer" is often blended new+returning → understates true acquisition cost; needs CRM join. |
| 10 | When NOT to trust | When new/returning aren't split (use NCAC, F5); per-ad. |

### F5 · NCAC (New-Customer Acquisition Cost)
**Level:** account / campaign · **Class:** EXTERNAL · **Fact:** INTERNAL CALCULATION over EXTERNAL data

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Spend per **new** customer only. |
| 2 | Why it matters | The honest growth cost; returning-customer orders flatter blended CAC/ROAS. This is the number sophisticated DTC operators scale on. |
| 3 | Decision | True scaling headroom; whether "great ROAS" is just harvesting existing customers. |
| 4 | Inputs | spend, new-customer count (EXTERNAL: Shopify new-vs-returning tag). |
| 5 | Formula | `NCAC = spend / new_customers`. |
| 6 | Source | EXTERNAL ([02] — Meta alone can't reliably split new vs returning). |
| 7 | Window | Weekly/monthly. |
| 8 | Min sample | Account/campaign-level. |
| 9 | Limitations | Needs reliable new-vs-returning definition; first-order only (no LTV); depends on CRM hygiene. |
| 10 | When NOT to trust | Without a clean new-customer flag; per-ad; when subscription/one-time definitions blur. |

### F6 · New vs Returning Revenue Split
**Level:** account · **Class:** EXTERNAL · **Fact:** RESEARCH-BACKED method over EXTERNAL data

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Share of revenue from new vs returning customers. |
| 2 | Why it matters | Reveals whether Meta is acquiring or harvesting; recontextualises F1/F5. |
| 3 | Decision | Rebalance prospecting vs retargeting budget; adjust ROAS expectations by intent. |
| 4 | Inputs | order-level new/returning tag (EXTERNAL). |
| 5 | Formula | `new_share = new_customer_revenue / total_revenue`. |
| 6 | Source | EXTERNAL Shopify/CRM ([02]). |
| 7 | Window | Weekly/monthly. |
| 8 | Min sample | Account-level. |
| 9 | Limitations | Meta's on-platform "new/returning" (if any) ≠ true store definition; cross-device leakage. |
| 10 | When NOT to trust | Without CRM join; guest-checkout-heavy stores where identity is fuzzy. |

### F7 · Contribution Margin & Contribution-Margin ROAS (cmROAS / MER on margin)
**Level:** ad / account · **Class:** EXTERNAL · **Fact:** INTERNAL CALCULATION over EXTERNAL data

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Revenue minus variable costs (COGS, shipping, payment fees, returns) — and that margin per ad dollar. |
| 2 | Why it matters | The only ROAS that maps to *profit*. A 4x ROAS at 20% margin can lose money; cmROAS catches it (fixes the F1 blind spot). |
| 3 | Decision | The real scale/kill line: scale where marginal contribution > 0 after ad cost, not where ROAS is high. |
| 4 | Inputs | revenue (E2), COGS/shipping/fees/return rate (EXTERNAL finance), spend. |
| 5 | Formula | `contribution_margin = revenue − variable_costs − spend`; `cmROAS = contribution_margin / spend` (define & document the variant used). |
| 6 | Source | EXTERNAL finance/product-cost feed ([02] Economics row). |
| 7 | Window | Weekly/monthly; per-ad only if product mix is known. |
| 8 | Min sample | As economics; needs per-SKU cost data for ad-level. |
| 9 | Limitations | Requires accurate, current COGS & return rates per SKU — usually the hardest EXTERNAL data to get; mix-shift changes margin without any ad change. |
| 10 | When NOT to trust | Stale/averaged COGS; bundle/discount distortion; when returns lag the reporting window. |

### F8 · LTV (Customer Lifetime Value)
**Level:** account / cohort · **Class:** EXTERNAL · **Fact:** MODEL ESTIMATE (predicted) / INTERNAL CALCULATION (historical)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Total (historical) or predicted contribution a customer delivers over their lifetime. |
| 2 | Why it matters | Sets how much you can afford to pay to acquire (CAC/NCAC ceiling). |
| 3 | Decision | Allowable CAC; prospecting aggressiveness; payback tolerance. |
| 4 | Inputs | repeat purchase behaviour, margin, churn/retention (EXTERNAL CRM/subscription). |
| 5 | Formula | Historical: cohort cumulative margin. Predicted: a retention/BG-NBD-style model → MODEL ESTIMATE with confidence. |
| 6 | Source | EXTERNAL ([02]). |
| 7 | Window | Cohort months (30/60/90/180/365-day). |
| 8 | Min sample | Mature cohorts; predicted LTV needs history. |
| 9 | Limitations | Predicted LTV is a forecast — never a fact; category/seasonality/promo cohorts differ; survivorship bias. |
| 10 | When NOT to trust | Young cohorts; new brands without repeat history; presenting predicted LTV as booked. |

### F9 · LTV:CAC Ratio
**Level:** account / cohort · **Class:** EXTERNAL · **Fact:** INTERNAL CALCULATION over EXTERNAL data (uses a MODEL ESTIMATE if LTV is predicted)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Lifetime value relative to acquisition cost. |
| 2 | Why it matters | The sustainability ratio for the whole acquisition engine. |
| 3 | Decision | Spend-up when healthy; pull back / fix retention or margin when thin. |
| 4 | Inputs | LTV (F8), CAC/NCAC (F4/F5). |
| 5 | Formula | `LTV / CAC` (state which CAC and which LTV horizon). |
| 6 | Source | EXTERNAL ([02]). |
| 7 | Window | Cohort-aligned. |
| 8 | Min sample | Account/cohort. |
| 9 | Limitations | Inherits LTV forecast error and CAC-definition ambiguity; a common "3:1" rule of thumb is **INDUSTRY FOLKLORE, not a verified benchmark** — `UNKNOWN / verify at build`, treat as brand-specific. |
| 10 | When NOT to trust | With predicted LTV on young cohorts; when comparing brands with different margin structures. |

### F10 · Payback Period
**Level:** account / cohort · **Class:** EXTERNAL · **Fact:** INTERNAL CALCULATION over EXTERNAL data

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Time (days/months) to recover CAC from a cohort's cumulative contribution margin. |
| 2 | Why it matters | Cash-flow constraint on how fast you can scale (a great LTV:CAC with 12-month payback can still bankrupt a cash-tight brand). |
| 3 | Decision | Scaling pace tied to working-capital reality. |
| 4 | Inputs | CAC (F4/F5), cohort cumulative margin curve (EXTERNAL). |
| 5 | Formula | Months until cumulative margin ≥ CAC. |
| 6 | Source | EXTERNAL ([02]). |
| 7 | Window | Cohort curve. |
| 8 | Min sample | Mature cohorts. |
| 9 | Limitations | Depends on margin & retention accuracy; ignores discount rate; cohort-specific. |
| 10 | When NOT to trust | Young cohorts; extrapolated curves; ignoring seasonality of repeat. |

---

## F (marginal) · MARGINAL ECONOMICS — MANDATORY

The brief's central question: *"what happens to efficiency if we spend another $10K?"* Average ROAS/CAC
describe dollars **already** spent; scaling decisions depend on the **next** dollar. **Meta alone cannot
know any of these** — they require either a fitted spend→response curve over historical daily data
(INFERENCE) or a lift experiment/MMM (also INFERENCE). Every value here is **MODEL ESTIMATE / INFERENCE,
never a platform fact**, and every surface must show a confidence band, not a point pretending to precision.

### F12 · Marginal Spend (ΔSpend)
**Level:** adset / campaign / account · **Class:** INFER (input to the curve) · **Fact:** INTERNAL CALCULATION

| # | Question | Answer |
|---|---|---|
| 1 | Measures | The incremental budget increment under consideration (e.g. +$10K). |
| 2 | Why it matters | The x-axis of every marginal question; frames F13-F17. |
| 3 | Decision | The size of the next budget move being evaluated. |
| 4 | Inputs | current spend, proposed increment. |
| 5 | Formula | `ΔSpend = spend_new − spend_current`. |
| 6 | Source | CALC / planning input. |
| 7 | Window | Forward-looking (next 7/14/30d). |
| 8 | Min sample | n/a (it's the lever). |
| 9 | Limitations | Only meaningful paired with a response estimate (F13). |
| 10 | When NOT to trust | When treated as if response scales linearly (it does not — see F17). |

### F13 · Marginal Revenue (ΔRevenue for ΔSpend)
**Level:** adset / campaign · **Class:** INFER · **Fact:** MODEL ESTIMATE

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Expected extra revenue from the next spend increment. |
| 2 | Why it matters | Whether the next $10K produces more than $10K of margin. |
| 3 | Decision | Add / hold / cut the increment. |
| 4 | Inputs | fitted spend→revenue response curve from daily history; or lift test. |
| 5 | Formula | `ΔRevenue = f(spend_new) − f(spend_current)`, where `f` is the fitted response curve (e.g. concave/log/Hill). |
| 6 | Source | INFERENCE ([02] Economics row: iROAS/marginal → MODEL ESTIMATE). |
| 7 | Window | Forward 7/14/30d; fit on ≥ several weeks of daily data. |
| 8 | Min sample | Enough daily spend **variation** to fit a curve — flat-budget accounts give no signal. `UNKNOWN / verify` for exact points; more variation = tighter band. |
| 9 | Limitations | Correlational, not causal, without a holdout; confounded by seasonality, promos, creative refresh, auction competition. |
| 10 | When NOT to trust | Flat historical spend; recent regime change; extrapolating far beyond observed spend range. |

### F14 · Marginal CAC
**Level:** adset / campaign · **Class:** INFER · **Fact:** MODEL ESTIMATE

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Cost of the **next** customer at the current spend level (rises with scale). |
| 2 | Why it matters | Average CAC hides that the marginal customer is more expensive; this is the true scale-limit signal. |
| 3 | Decision | Stop scaling when marginal CAC exceeds allowable CAC (from LTV, F8). |
| 4 | Inputs | fitted spend→customers curve. |
| 5 | Formula | `mCAC = ΔSpend / ΔNewCustomers` along the curve (derivative). |
| 6 | Source | INFERENCE ([02]). |
| 7 | Window | Forward. |
| 8 | Min sample | As F13; needs EXTERNAL new-customer data for the *new*-customer version. |
| 9 | Limitations | Curve-fit + attribution uncertainty compound; auction dynamics shift the curve week to week. |
| 10 | When NOT to trust | Thin spend variation; comparing across very different audiences; extrapolation. |

### F15 · Marginal ROAS (mROAS)
**Level:** adset / campaign · **Class:** INFER · **Fact:** MODEL ESTIMATE

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Return on the **next** dollar (slope of the response curve), not the average. |
| 2 | Why it matters | The correct scaling criterion — you scale until *marginal* ROAS hits your break-even, which is well below average ROAS. This operationalises "the next dollar" question. |
| 3 | Decision | Allocate the next budget dollar to the entity with the highest marginal ROAS above break-even; stop when mROAS ≤ break-even. |
| 4 | Inputs | derivative of fitted spend→revenue curve (F13). |
| 5 | Formula | `mROAS = d(Revenue)/d(Spend)` at current spend ≈ `ΔRevenue / ΔSpend`. |
| 6 | Source | INFERENCE ([02]). |
| 7 | Window | Forward. |
| 8 | Min sample | As F13. |
| 9 | Limitations | Depends entirely on curve quality; not causal without a test; break-even itself needs margin (F7). |
| 10 | When NOT to trust | Flat spend history; regime change; presented without a confidence band. |

### F16 · Spend Elasticity of Revenue
**Level:** adset / campaign / account · **Class:** INFER · **Fact:** MODEL ESTIMATE

| # | Question | Answer |
|---|---|---|
| 1 | Measures | % change in revenue per % change in spend. |
| 2 | Why it matters | A unit-free scalability score: elasticity near 1 = room to scale; near 0 = saturated. |
| 3 | Decision | Rank entities by remaining scale headroom. |
| 4 | Inputs | fitted spend→revenue curve. |
| 5 | Formula | `elasticity = (%ΔRevenue) / (%ΔSpend) = (dR/dS)·(S/R)`. |
| 6 | Source | INFERENCE ([02]). |
| 7 | Window | Forward, fit on daily history. |
| 8 | Min sample | Needs spend variation across a range; `UNKNOWN / verify` for a "scalable" cutoff. |
| 9 | Limitations | Local to the observed spend range; confounded like F13; changes as competition/creative change. |
| 10 | When NOT to trust | Extrapolation beyond observed range; flat spend; post-regime-change. |

### F17 · Diminishing Returns (Response-Curve Concavity)
**Level:** adset / campaign / account · **Class:** INFER · **Fact:** MODEL ESTIMATE

| # | Question | Answer |
|---|---|---|
| 1 | Measures | The curvature of the spend→response curve — how fast marginal return decays as spend rises. |
| 2 | Why it matters | Names the shape scaling fights against; the region before saturation (F18) where each extra dollar returns less. |
| 3 | Decision | How aggressively to scale and in what increments; where efficiency starts eroding. |
| 4 | Inputs | fitted curve (Hill/log/power) parameters. |
| 5 | Formula | Second derivative / fitted saturation parameter of the response curve. |
| 6 | Source | INFERENCE ([02]). |
| 7 | Window | Forward. |
| 8 | Min sample | Wide spend range in history to observe curvature. |
| 9 | Limitations | Shape is assumed by the model family chosen — document it; not causal without a test. |
| 10 | When NOT to trust | Narrow spend history (curvature unobservable); wrong curve family; extrapolation. |

### F18 · Saturation Point
**Level:** adset / campaign · **Class:** INFER · **Fact:** MODEL ESTIMATE

| # | Question | Answer |
|---|---|---|
| 1 | Measures | The spend level beyond which incremental revenue flattens (mROAS → break-even/zero). |
| 2 | Why it matters | The practical ceiling for an entity; scaling past it burns budget for little return. |
| 3 | Decision | Cap budget at/below saturation; redirect surplus to unsaturated entities or new creative. |
| 4 | Inputs | fitted curve; break-even threshold (needs margin, F7). |
| 5 | Formula | Spend where `mROAS = break-even` (or where dR/dS falls below a set floor). |
| 6 | Source | INFERENCE ([02]). |
| 7 | Window | Forward. |
| 8 | Min sample | Ideally spend history that has *reached* the flattening region; otherwise it's extrapolated → widen the band. |
| 9 | Limitations | Usually estimated by extrapolation (rarely observed directly) → low confidence; moves as auction/creative change. |
| 10 | When NOT to trust | When never actually observed near saturation; static creative assumption; presented as a precise number. |

### F19 · Incremental ROAS (iROAS) / Incremental Revenue
**Level:** campaign / account · **Class:** INFER · **Fact:** MODEL ESTIMATE / INFERENCE (fact only with a valid holdout)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Revenue that would **not** have happened without the ads (true causal lift). |
| 2 | Why it matters | The only economics metric that answers "did Meta *cause* this?"; the antidote to retargeting/branded ROAS inflation and the attribution gap (E10). |
| 3 | Decision | The highest-authority scale/cut decision and the calibration truth for F1/F15. |
| 4 | Inputs | Conversion Lift / geo-holdout / ghost-ads experiment, or MMM. |
| 5 | Formula | `iROAS = incremental_revenue / spend`, `incremental = treatment − control`. |
| 6 | Source | INFERENCE — needs an experiment or MMM ([02] Hard limits: "true incrementality without a holdout → INFERENCE only"). |
| 7 | Window | Experiment duration. |
| 8 | Min sample | Powered test (large geos/audiences); most small accounts can't power it — say so. |
| 9 | Limitations | Without a holdout it is an estimate, never a fact; tests are expensive, periodic, and stale between runs; MMM has its own assumptions. |
| 10 | When NOT to trust | No/under-powered holdout; extrapolating one test across all creative/time; presenting modeled iROAS as measured. |

---

# G · CREATIVE (performance of the creative asset)

How the *creative itself* performs. Raw video-play counts live in **B Attention** ([01a]); the derived
creative-quality signals below are the ones that drive creative decisions (produce more / iterate / kill /
refresh). Fatigue over time is **H** and creative variety is **I** — cross-referenced, not duplicated here.
Video signals require the ad to be video; static/carousel use G7-G12 only.

---

### G1 · Hook Rate (3-second / thumb-stop rate)
**Level:** creative / ad · **Class:** CALC · **Fact:** INTERNAL CALCULATION (DERIVED) — **not** an official Meta field

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Share of impressions that stopped the scroll for 3 seconds. |
| 2 | Why it matters | The single strongest early signal of whether the opening earns attention; gates everything downstream. |
| 3 | Decision | Low hook rate → rework the first frame/3 seconds (new hook), don't touch the offer/body. |
| 4 | Inputs | video_3_sec_watched_actions, impressions. |
| 5 | Formula | `hook_rate = video_3_sec_plays / impressions`. |
| 6 | Source | CALC from FETCH ([02] Attention row: "hook rate = 3-sec plays / impressions, NOT an official field"). |
| 7 | Window | Day-wise + 3/7d; watch the trend for early fatigue (H). |
| 8 | Min sample | ≥ ~1,000-2,000 impressions for a stable rate; exact floor `UNKNOWN / verify at build`. |
| 9 | Limitations | "3-sec play" is a weak attention proxy (autoplay, sound-off, quick scroll counts); placement-dependent (Reels vs Feed); definition is Meta's. |
| 10 | When NOT to trust | Below impression floor; mixed placements aggregated; comparing video to static (undefined for static). |

### G2 · Hold Rate
**Level:** creative / ad · **Class:** CALC · **Fact:** INTERNAL CALCULATION (DERIVED)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Share of openers who keep watching to a defined depth. |
| 2 | Why it matters | Separates "good hook, weak body" from "good all through"; middle-of-video retention. |
| 3 | Decision | High hook + low hold → fix the body/pacing after the hook, keep the opener. |
| 4 | Inputs | depends on the chosen definition (below). |
| 5 | Formula | **Pick and document ONE** ([02] flags 3 competing defs): (a) p75_watched / 3_sec_plays [Meta-ish]; (b) 15_sec_views / 3_sec_plays [industry]; (c) thruplay / 3_sec_plays. AdBrain default: **verify at build**, then hold it fixed everywhere. |
| 6 | Source | CALC from FETCH ([02] Attention row: "3 competing defs — pick one, document it"). |
| 7 | Window | 3/7d. |
| 8 | Min sample | As G1. |
| 9 | Limitations | Not comparable across accounts using a different definition; sound/placement dependent; the three defs give materially different numbers. |
| 10 | When NOT to trust | When the definition isn't stated; mixed-placement aggregates; static creative. |

### G3 · Video Retention Curve (% watched at 25/50/75/100)
**Level:** creative · **Class:** FETCH (raw quartiles) + CALC (curve) · **Fact:** OFFICIAL PLATFORM FACT (quartile counts) / INTERNAL CALCULATION (curve shape)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Audience remaining at each quartile of the video. |
| 2 | Why it matters | Pinpoints *where* viewers drop — the exact second to fix; drives frame-level creative edits ([04][05]). |
| 3 | Decision | Recut at the biggest drop-off point; move key message/CTA before the cliff. |
| 4 | Inputs | video_p25/p50/p75/p100_watched_actions, video_3_sec, impressions. |
| 5 | Formula | Curve of quartile_plays / impressions (or / 3-sec plays); drop-off = step between quartiles. |
| 6 | Source | FETCH quartiles ([02] Attention row). |
| 7 | Window | 7d. |
| 8 | Min sample | As G1; quartile counts thin fast on low-spend ads. |
| 9 | Limitations | Only 4 coarse points (not per-second); auto-scroll/sound-off noise; length-dependent (a 60s and 15s video aren't comparable at p50). |
| 10 | When NOT to trust | Low plays; comparing different-length videos at the same quartile; static. |

### G4 · Average Watch Time / Average % Watched
**Level:** creative · **Class:** FETCH · **Fact:** OFFICIAL PLATFORM FACT

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Mean seconds (or % of length) watched per impression/play. |
| 2 | Why it matters | Single-number retention summary; complements the curve (G3). |
| 3 | Decision | Trim length toward the point most viewers reach; flag over-long creative. |
| 4 | Inputs | video_avg_time_watched_actions, video length. |
| 5 | Formula | Direct field (`video_avg_time_watched`); % = avg_time / length. |
| 6 | Source | FETCH ([02] Attention row). |
| 7 | Window | 7d. |
| 8 | Min sample | As G1. |
| 9 | Limitations | An average hides bimodal drop-off (the curve, G3, is richer); placement/sound dependent. |
| 10 | When NOT to trust | When distribution is bimodal; cross-length comparisons; low plays. |

### G5 · ThruPlay Rate & Cost per ThruPlay
**Level:** creative · **Class:** FETCH (thruplay) + CALC (rate/cost) · **Fact:** OFFICIAL PLATFORM FACT (count) / INTERNAL CALCULATION (rate & cost)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Share of impressions watched to completion or ≥15s (Meta's ThruPlay), and the cost of each. |
| 2 | Why it matters | Meta's own "meaningful view" optimization unit; useful for awareness creative efficiency. |
| 3 | Decision | Compare completion efficiency across creatives for awareness objectives; not a conversion signal. |
| 4 | Inputs | thruplay actions, impressions, spend. |
| 5 | Formula | `thruplay_rate = thruplays / impressions`; `CPThruPlay = spend / thruplays`. |
| 6 | Source | FETCH ([02] Attention row). |
| 7 | Window | 7d. |
| 8 | Min sample | As G1. |
| 9 | Limitations | ThruPlay = completion **or** 15s (short videos complete trivially → inflated); attention ≠ conversion. |
| 10 | When NOT to trust | Comparing short vs long videos; treating it as a purchase-intent signal. |

### G6 · Creative CTR (link / outbound)
**Level:** creative / ad · **Class:** FETCH (clicks) + CALC (rate) · **Fact:** OFFICIAL PLATFORM FACT (clicks) / INTERNAL CALCULATION (rate)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Link/outbound clicks per impression at the creative level. |
| 2 | Why it matters | Whether the creative + copy + CTA drive intent to click (works for static & video). |
| 3 | Decision | Low CTR → rework CTA/copy/offer clarity; isolate from CVR (E3) to place the fix. |
| 4 | Inputs | inline_link_clicks (or outbound_clicks), impressions. |
| 5 | Formula | `link_CTR = inline_link_clicks / impressions`. Mirrors `ctr()` in `lib/rules/metrics.ts` (uses link clicks). |
| 6 | Source | FETCH ([02] Delivery row: "link CTR uses inline_link_clicks"). |
| 7 | Window | Day-wise + 7d. |
| 8 | Min sample | ≥ ~1,000 impressions. |
| 9 | Limitations | Clicks ≠ visits (see E6 LPV); all-clicks CTR vs link CTR differ — use link CTR; placement-dependent. |
| 10 | When NOT to trust | All-clicks vs link-clicks mixed; low impressions; click-bait creative (high CTR, low CVR). |

### G7 · Creative-Level CVR / CPA / ROAS
**Level:** creative · **Class:** CALC · **Fact:** INTERNAL CALCULATION (DERIVED)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | E3/E4/F1 computed at the creative level (aggregating the same creative across ads/adsets). |
| 2 | Why it matters | The bottom-line verdict on a creative asset independent of where it ran. |
| 3 | Decision | Produce-more / iterate / kill at the *creative* level; feeds winners ([11]) and fingerprint learning ([05]). |
| 4 | Inputs | creative-keyed roll-up of spend, clicks/LPV, purchases, value. |
| 5 | Formula | Same as E3/E4/F1, grouped by creative id/fingerprint. |
| 6 | Source | CALC ([02]); needs correct creative→ad mapping. |
| 7 | Window | 7/14/30d. |
| 8 | Min sample | As E3/E4 (≥ ~25-50 conversions); creatives split across many adsets fragment the sample (Simpson's-paradox risk — AUTOPSY). |
| 9 | Limitations | Same creative in different audiences/placements performs differently → aggregation can mislead; attribution caveats (E-DQ). |
| 10 | When NOT to trust | Sample fragmented across adsets; audience mix differs; low conversions. |

### G8 · Meta Ad Ranking Diagnostics (Quality / Engagement-Rate / Conversion-Rate Ranking)
**Level:** ad · **Class:** FETCH · **Fact:** OFFICIAL PLATFORM FACT (but **relative/ordinal**, not absolute)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Meta's ranking of the ad vs ads competing for the same audience: quality, engagement-rate, conversion-rate rankings (above avg / average / below avg buckets). |
| 2 | Why it matters | Meta's own read on relative competitiveness; a below-average bucket flags an auction disadvantage. |
| 3 | Decision | "Below average conversion-rate ranking" → post-click/offer fix; "below average quality" → creative/relevance fix. |
| 4 | Inputs | quality_ranking, engagement_rate_ranking, conversion_rate_ranking fields. |
| 5 | Formula | Direct fields (ordinal buckets) — not a computed number. |
| 6 | Source | FETCH ([02]; verify field availability — Meta has changed these). |
| 7 | Window | Current; needs recent delivery to populate. |
| 8 | Min sample | Only shown after sufficient impressions; otherwise "—". |
| 9 | Limitations | Relative (peer-dependent), opaque methodology, coarse buckets, no historical trend, can be blank; **not comparable across audiences**. |
| 10 | When NOT to trust | Low delivery (blank/unstable); as an absolute score; comparing across different audiences. |

### G9 · Creative Efficiency Score (composite)
**Level:** creative · **Class:** CALC (INFER weights) · **Fact:** INTERNAL CALCULATION (DERIVED) — composite, not a Meta field

| # | Question | Answer |
|---|---|---|
| 1 | Measures | A weighted blend of hook (G1), hold (G2), CTR (G6), CVR/ROAS (G7) into one comparable creative-quality score. |
| 2 | Why it matters | One ranked list for triage when buyers have hundreds of creatives; feeds Winners/Scaling ([11]) and Diversity ([06]). |
| 3 | Decision | Shortlist creatives to scale/iterate/retire; prioritise production ([05]). |
| 4 | Inputs | G1, G2, G6, G7 (each with its own sample gate). |
| 5 | Formula | Weighted sum of normalised sub-metrics; **weights + reason documented** ([14] Confidence); returns `insufficient_data` if any gated input is missing. |
| 6 | Source | INTERNAL CALCULATION; the rules engine computes, AI narrates (master-plan discipline #6). |
| 7 | Window | 7/14d. |
| 8 | Min sample | Each sub-metric must clear its own floor; otherwise the composite is suppressed, not guessed. |
| 9 | Limitations | Weights are a judgement (must be validated, not arbitrary — brief's rule engine); a composite can hide a single bad dimension; objective-dependent (awareness vs conversion weight differently). |
| 10 | When NOT to trust | Un-validated weights; missing sub-metrics; mixing objectives in one score. |

### G10 · Creative Engagement Signals (reactions / comments / shares / saves per impression)
**Level:** creative / ad · **Class:** FETCH (counts) + CALC (rate) · **Fact:** OFFICIAL PLATFORM FACT (counts) / INTERNAL CALCULATION (rate) — mostly `VANITY — not primary` unless tied to a decision

| # | Question | Answer |
|---|---|---|
| 1 | Measures | Social-engagement actions on the creative per impression. |
| 2 | Why it matters | Weak proxy for resonance/social proof; shares/saves can hint at organic amplification. Reactions/comments alone rarely change a spend decision. |
| 3 | Decision | Mostly none directly → keep off the primary surface (decision gate). Exception: sudden negative-comment spike → creative-risk / brand-safety review (a real decision). |
| 4 | Inputs | post reactions, comments, shares, saves; impressions. |
| 5 | Formula | `engagement_rate = (reactions+comments+shares+saves) / impressions`. |
| 6 | Source | FETCH ([02]); overlaps C Engagement ([01a]) — reported there, referenced here. |
| 7 | Window | 7d. |
| 8 | Min sample | As G1. |
| 9 | Limitations | Engagement ≠ revenue; gameable; comment *sentiment* needs NLP, not counts; classic vanity trap (KILLCRITIC). |
| 10 | When NOT to trust | As a scale signal; without sentiment; when used to justify keeping a low-ROAS creative. |

### G11 · Creative Age & Spend Accumulated (days live, ∑ spend, ∑ impressions)
**Level:** creative · **Class:** CALC · **Fact:** INTERNAL CALCULATION (DERIVED)

| # | Question | Answer |
|---|---|---|
| 1 | Measures | How long a creative has run, and how much spend/impressions it has absorbed. |
| 2 | Why it matters | Context for every other creative metric — a 2-day creative and a 60-day one are read differently; the denominator for fatigue (H) and the "has it had a fair test?" question. |
| 3 | Decision | Gate "kill" decisions (don't kill an under-tested new creative); trigger fatigue review on old high-spend creatives. |
| 4 | Inputs | first/last delivery date, cumulative spend & impressions (daily roll-up). |
| 5 | Formula | `age = last_active − first_active`; cumulative sums from daily data. |
| 6 | Source | CALC ([02] Delivery row). |
| 7 | Window | Lifetime + recent activity. |
| 8 | Min sample | n/a (it *defines* whether sample is sufficient elsewhere). |
| 9 | Limitations | Paused/re-activated creatives have gappy "age"; same asset re-uploaded gets a new id (breaks continuity unless fingerprinted, [05]). |
| 10 | When NOT to trust | When creative ids churn on re-upload; intermittent delivery; without fingerprint de-dupe. |

---

## Cross-references & guardrails (apply to E/F/G)
- **AUTOPSY targets in this set:** creative-level aggregation across audiences (Simpson's paradox, G7);
  attribution-window mismatch (E9); false winners from low samples (E3/E4/G7); non-incremental ROAS from
  retargeting (F1 vs F19); saturation read from spend history that never reached saturation (F18).
- **KILLCRITIC targets:** social engagement as a primary metric (G10); any marginal number shown without a
  confidence band (F12-F19); a "3:1 LTV:CAC" or similar rule of thumb presented as a verified benchmark
  (F9); composite scores with un-validated weights (G9).
- **Every marginal/economics metric that Meta cannot know (F2-F19)** must render as "needs external source"
  or a clearly-tagged MODEL ESTIMATE with confidence — never a bare number ([02] Consequences).
- **Benchmarks:** no generic numeric benchmark is asserted here; each threshold is either a documented
  business input, `UNKNOWN / verify at build`, or supplied by the Benchmark Engine ([27]) with
  source/date/sample/confidence.
